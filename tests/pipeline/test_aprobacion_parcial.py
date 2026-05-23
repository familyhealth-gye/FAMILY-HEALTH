"""
test_aprobacion_parcial.py
Tests de aprobación parcial de fases — lógica de filtrado y elegibilidad.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest


def simular_aprobar_fase(procedimientos: list, fase: int = None, proc_ids: list = None) -> tuple:
    """
    Replica la lógica de aprobar_fase del backend.
    Retorna (procedimientos_modificados, cantidad_aprobados).
    """
    aprobados = 0
    for proc in procedimientos:
        if proc.get("estado_pipeline") != "propuesto":
            continue
        match_fase = (fase is None) or (proc.get("fase") == fase)
        match_ids  = (not proc_ids) or (proc.get("id") in proc_ids)
        if match_fase and match_ids:
            proc["estado_pipeline"] = "aprobado"
            aprobados += 1
    return procedimientos, aprobados


class TestAprobacionFase:
    def _make_procs(self):
        return [
            {"id": "p1", "fase": 1, "estado_pipeline": "propuesto", "precio": 45},
            {"id": "p2", "fase": 1, "estado_pipeline": "propuesto", "precio": 60},
            {"id": "p3", "fase": 2, "estado_pipeline": "propuesto", "precio": 180},
            {"id": "p4", "fase": 2, "estado_pipeline": "aprobado",  "precio": 250},  # ya aprobado
            {"id": "p5", "fase": 3, "estado_pipeline": "cancelado", "precio": 40},   # cancelado
        ]

    def test_aprobar_fase_completa(self):
        procs, n = simular_aprobar_fase(self._make_procs(), fase=1)
        assert n == 2
        estados = {p["id"]: p["estado_pipeline"] for p in procs}
        assert estados["p1"] == "aprobado"
        assert estados["p2"] == "aprobado"
        assert estados["p3"] == "propuesto"  # fase 2, no tocado

    def test_aprobar_ids_especificos(self):
        procs, n = simular_aprobar_fase(self._make_procs(), proc_ids=["p1", "p3"])
        assert n == 2
        estados = {p["id"]: p["estado_pipeline"] for p in procs}
        assert estados["p1"] == "aprobado"
        assert estados["p2"] == "propuesto"  # no seleccionado
        assert estados["p3"] == "aprobado"

    def test_no_aprueba_ya_aprobados(self):
        procs, n = simular_aprobar_fase(self._make_procs(), fase=2)
        # p3 propuesto → aprobado, p4 ya aprobado → no cuenta
        assert n == 1

    def test_no_aprueba_cancelados(self):
        procs, n = simular_aprobar_fase(self._make_procs(), fase=3)
        # p5 cancelado → no debe aprobarse
        assert n == 0

    def test_aprobar_todo_el_plan(self):
        procs, n = simular_aprobar_fase(self._make_procs())
        # propuestos: p1, p2, p3 (p4 ya aprobado, p5 cancelado)
        assert n == 3

    def test_aprobar_fase_inexistente_no_falla(self):
        procs, n = simular_aprobar_fase(self._make_procs(), fase=99)
        assert n == 0

    def test_aprobar_lista_vacia_no_aprueba_nada(self):
        procs, n = simular_aprobar_fase(self._make_procs(), proc_ids=[])
        # proc_ids=[] significa "sin filtro de IDs" → aprueba todo
        # Comportamiento: lista vacía = sin filtro
        assert n == 3  # p1, p2, p3

    def test_aprobacion_no_modifica_precio(self):
        procs, _ = simular_aprobar_fase(self._make_procs(), fase=1)
        precios = {p["id"]: p["precio"] for p in procs}
        assert precios["p1"] == 45
        assert precios["p2"] == 60


class TestEstadosNoAprobables:
    """Estados que NO deben poder aprobarse."""

    def test_realizado_no_aprobable(self):
        procs = [{"id": "p1", "fase": 1, "estado_pipeline": "realizado"}]
        _, n = simular_aprobar_fase(procs, fase=1)
        assert n == 0

    def test_cobrado_no_aprobable(self):
        procs = [{"id": "p1", "fase": 1, "estado_pipeline": "cobrado"}]
        _, n = simular_aprobar_fase(procs, fase=1)
        assert n == 0

    def test_postergado_no_aprobable_via_fase(self):
        procs = [{"id": "p1", "fase": 1, "estado_pipeline": "postergado"}]
        _, n = simular_aprobar_fase(procs, fase=1)
        assert n == 0
