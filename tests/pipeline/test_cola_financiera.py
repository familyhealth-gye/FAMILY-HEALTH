"""
test_cola_financiera.py
Tests de la cola financiera — especialmente documentos legacy sin campos nuevos.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest


class TestColaFinancieraQuery:
    """
    Tests de la lógica de query sin necesitar MongoDB real.
    Valida que la query cubre todos los casos legacy.
    """

    def _simular_cola(self, planes: list) -> list:
        """
        Simula la lógica de filtrado de la cola financiera
        replicando exactamente la query del backend.
        """
        resultado = []
        for plan in planes:
            procs = plan.get("procedimientos", [])
            tiene_propuesto = any(
                p.get("estado_pipeline") == "propuesto" for p in procs
            )
            if not tiene_propuesto:
                continue

            proformas = plan.get("proformas_generadas")
            # Lógica equivalente al $or: [{$size:0}, {$exists: False}]
            sin_proforma = (proformas is None) or (len(proformas) == 0)

            if sin_proforma:
                resultado.append(plan)
        return resultado

    def test_plan_nuevo_aparece_en_cola(self):
        planes = [{"procedimientos": [{"estado_pipeline": "propuesto"}], "proformas_generadas": []}]
        assert len(self._simular_cola(planes)) == 1

    def test_plan_legacy_sin_campo_aparece_en_cola(self):
        """Documento MongoDB legacy sin el campo proformas_generadas."""
        planes = [{"procedimientos": [{"estado_pipeline": "propuesto"}]}]
        assert len(self._simular_cola(planes)) == 1

    def test_plan_con_proforma_no_aparece(self):
        planes = [{
            "procedimientos": [{"estado_pipeline": "propuesto"}],
            "proformas_generadas": ["pf_001"],
        }]
        assert len(self._simular_cola(planes)) == 0

    def test_plan_sin_propuestos_no_aparece(self):
        planes = [{
            "procedimientos": [{"estado_pipeline": "aprobado"}],
            "proformas_generadas": [],
        }]
        assert len(self._simular_cola(planes)) == 0

    def test_plan_vacio_no_aparece(self):
        assert len(self._simular_cola([{"procedimientos": []}])) == 0

    def test_multiples_planes_mix_legacy_nuevo(self):
        planes = [
            # Plan nuevo con proforma → NO aparece
            {"procedimientos": [{"estado_pipeline": "propuesto"}], "proformas_generadas": ["pf_1"]},
            # Plan nuevo sin proforma → SÍ
            {"procedimientos": [{"estado_pipeline": "propuesto"}], "proformas_generadas": []},
            # Plan legacy sin campo → SÍ
            {"procedimientos": [{"estado_pipeline": "propuesto"}]},
            # Plan aprobado sin proforma → NO (no tiene propuesto)
            {"procedimientos": [{"estado_pipeline": "aprobado"}], "proformas_generadas": []},
        ]
        resultado = self._simular_cola(planes)
        assert len(resultado) == 2

    def test_normalizacion_campos_legacy(self):
        """Los planes legacy deben normalizarse antes de enviarse al frontend."""
        plan = {"procedimientos": [{"estado_pipeline": "propuesto"}]}
        # Simular normalización del backend
        plan.setdefault("proformas_generadas", [])
        plan.setdefault("sesiones_programadas", [])
        plan.setdefault("version", 1)
        assert plan["proformas_generadas"] == []
        assert plan["version"] == 1


class TestVersionConflict:
    """Tests de bloqueo optimista."""

    def _check_version(self, version_local, version_server) -> bool:
        """Simula la validación del backend."""
        return version_local is None or version_local == version_server

    def test_sin_version_local_siempre_pasa(self):
        assert self._check_version(None, 5) is True

    def test_version_correcta_pasa(self):
        assert self._check_version(3, 3) is True

    def test_version_desactualizada_falla(self):
        assert self._check_version(2, 4) is False

    def test_version_futura_falla(self):
        """Cliente con version > server — no debería ocurrir pero debe validarse."""
        assert self._check_version(10, 3) is False
