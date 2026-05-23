"""
test_transitions.py
Tests del motor de transiciones del pipeline clínico.

Cubren:
- Transiciones válidas por rol
- Transiciones inválidas (backwards, cross-role)
- Estados terminales
- Bloqueo de edición clínica
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
from pipeline_transitions import (
    validate_transition, can_edit_clinically,
    get_valid_transitions, TransitionError,
    TRANSITIONS, TERMINAL_STATES, CLINICAL_LOCK_STATES,
)


# ── Transiciones válidas ───────────────────────────────────────────────────────

class TestTransicionesValidas:
    def test_doctor_puede_proponer(self):
        validate_transition("creado", "propuesto", "Doctor")

    def test_recepcion_puede_aprobar(self):
        validate_transition("propuesto", "aprobado", "Recepcion")

    def test_doctor_puede_marcar_realizado(self):
        validate_transition("en_ejecucion", "realizado", "Doctor")

    def test_recepcion_puede_cobrar(self):
        validate_transition("realizado", "cobrado", "Recepcion")

    def test_admin_puede_cualquier_transicion_permitida(self):
        validate_transition("creado", "propuesto", "Administrador")
        validate_transition("propuesto", "aprobado", "Administrador")
        validate_transition("realizado", "cobrado", "Administrador")

    def test_recepcion_puede_programar(self):
        validate_transition("aprobado", "programado", "Recepcion")

    def test_doctor_puede_iniciar_ejecucion(self):
        validate_transition("aprobado", "en_ejecucion", "Doctor")
        validate_transition("programado", "en_ejecucion", "Doctor")


# ── Transiciones inválidas ─────────────────────────────────────────────────────

class TestTransicionesInvalidas:
    def test_realizado_no_puede_volver_a_propuesto(self):
        with pytest.raises(TransitionError) as exc:
            validate_transition("realizado", "propuesto", "Doctor")
        assert exc.value.code == "INVALID_TRANSITION"

    def test_realizado_no_puede_volver_a_creado(self):
        with pytest.raises(TransitionError):
            validate_transition("realizado", "creado", "Administrador")

    def test_cobrado_es_terminal(self):
        with pytest.raises(TransitionError):
            validate_transition("cobrado", "realizado", "Administrador")

    def test_cobrado_no_puede_cancelarse(self):
        with pytest.raises(TransitionError):
            validate_transition("cobrado", "cancelado", "Administrador")

    def test_mismo_estado_es_error(self):
        with pytest.raises(TransitionError) as exc:
            validate_transition("propuesto", "propuesto", "Recepcion")
        assert exc.value.code == "SAME_STATE"

    def test_estado_invalido_origen(self):
        with pytest.raises(TransitionError):
            validate_transition("inexistente", "propuesto", "Doctor")


# ── Restricciones de rol ───────────────────────────────────────────────────────

class TestRestriccionesRol:
    def test_doctor_no_puede_cobrar(self):
        with pytest.raises(TransitionError) as exc:
            validate_transition("realizado", "cobrado", "Doctor")
        assert exc.value.code == "FORBIDDEN_ROLE"

    def test_recepcion_no_puede_proponer(self):
        with pytest.raises(TransitionError) as exc:
            validate_transition("creado", "propuesto", "Recepcion")
        assert exc.value.code == "FORBIDDEN_ROLE"

    def test_recepcion_no_puede_marcar_realizado(self):
        with pytest.raises(TransitionError) as exc:
            validate_transition("en_ejecucion", "realizado", "Recepcion")
        assert exc.value.code == "FORBIDDEN_ROLE"

    def test_doctor_no_puede_aprobar_fase(self):
        with pytest.raises(TransitionError) as exc:
            validate_transition("propuesto", "aprobado", "Doctor")
        assert exc.value.code == "FORBIDDEN_ROLE"


# ── Edición clínica ────────────────────────────────────────────────────────────

class TestEdicionClinica:
    def test_creado_es_editable(self):
        assert can_edit_clinically("creado") is True

    def test_propuesto_es_editable(self):
        assert can_edit_clinically("propuesto") is True

    def test_realizado_no_es_editable(self):
        assert can_edit_clinically("realizado") is False

    def test_cobrado_no_es_editable(self):
        assert can_edit_clinically("cobrado") is False

    def test_cancelado_no_es_editable(self):
        assert can_edit_clinically("cancelado") is False


# ── get_valid_transitions ──────────────────────────────────────────────────────

class TestGetValidTransitions:
    def test_doctor_desde_creado(self):
        result = get_valid_transitions("creado", "Doctor")
        assert "propuesto" in result
        assert "aprobado" not in result

    def test_recepcion_desde_propuesto(self):
        result = get_valid_transitions("propuesto", "Recepcion")
        assert "aprobado" in result
        assert "propuesto" not in result

    def test_cobrado_sin_transiciones(self):
        result = get_valid_transitions("cobrado", "Administrador")
        assert result == []


# ── Integridad del grafo ───────────────────────────────────────────────────────

class TestIntegridadGrafo:
    def test_todos_los_estados_destino_son_validos(self):
        """Ningún estado destino puede ser uno que no exista como origen o sea conocido."""
        estados_conocidos = set(TRANSITIONS.keys()) | {"cobrado", "postergado", "cancelado"}
        for origen, destinos in TRANSITIONS.items():
            for destino in destinos:
                assert destino in estados_conocidos, \
                    f"Estado destino desconocido: {destino} desde {origen}"

    def test_terminal_states_sin_salida(self):
        for estado in TERMINAL_STATES:
            salidas = TRANSITIONS.get(estado, {})
            assert len(salidas) == 0, \
                f"Estado terminal {estado} tiene transiciones: {salidas}"

    def test_todos_los_roles_son_conocidos(self):
        roles_validos = {"Doctor", "Recepcion", "Administrador"}
        for origen, destinos in TRANSITIONS.items():
            for destino, roles in destinos.items():
                for rol in roles:
                    assert rol in roles_validos, \
                        f"Rol desconocido '{rol}' en {origen} → {destino}"
