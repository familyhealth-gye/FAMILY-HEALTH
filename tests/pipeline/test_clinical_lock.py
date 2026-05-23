"""
test_clinical_lock.py
Tests de bloqueo de edición clínica en estados terminales.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
from pipeline_transitions import can_edit_clinically, CLINICAL_LOCK_STATES, TRANSITIONS


class TestClinicalLock:
    """Ningún estado en CLINICAL_LOCK_STATES debe permitir edición clínica."""

    @pytest.mark.parametrize("estado", ["realizado", "cobrado", "cancelado"])
    def test_estados_bloqueados(self, estado):
        assert can_edit_clinically(estado) is False, \
            f"Estado '{estado}' debería estar bloqueado clínicamente"

    @pytest.mark.parametrize("estado", ["creado", "propuesto", "en_proforma",
                                         "aprobado", "programado", "en_ejecucion"])
    def test_estados_editables(self, estado):
        assert can_edit_clinically(estado) is True, \
            f"Estado '{estado}' debería ser editable clínicamente"

    def test_clinical_lock_states_es_subset_de_estados_conocidos(self):
        estados_conocidos = set(TRANSITIONS.keys()) | {"cobrado", "cancelado"}
        for estado in CLINICAL_LOCK_STATES:
            assert estado in estados_conocidos, \
                f"CLINICAL_LOCK_STATES contiene estado desconocido: {estado}"


class TestRollbackNoPermitido:
    """Transiciones que representan retrocesos clínicos inválidos."""
    from pipeline_transitions import validate_transition, TransitionError

    def test_realizado_no_retrocede_a_ninguno(self):
        from pipeline_transitions import validate_transition, TransitionError
        retrocesos = ["creado", "propuesto", "en_proforma", "aprobado", "programado", "en_ejecucion"]
        for destino in retrocesos:
            with pytest.raises(TransitionError):
                validate_transition("realizado", destino, "Administrador")

    def test_cobrado_no_retrocede_a_ninguno(self):
        from pipeline_transitions import validate_transition, TransitionError
        todos = ["creado", "propuesto", "aprobado", "realizado", "cancelado"]
        for destino in todos:
            with pytest.raises(TransitionError):
                validate_transition("cobrado", destino, "Administrador")
