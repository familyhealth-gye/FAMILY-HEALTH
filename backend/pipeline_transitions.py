"""
pipeline_transitions.py
Motor de transiciones del pipeline clínico.

Fuente única de verdad para qué estados pueden transicionar a cuáles,
y qué roles pueden ejecutar cada transición.

NUNCA modificar transiciones sin actualizar los tests.
"""

from typing import Optional

# ── Grafo de transiciones válidas ─────────────────────────────────────────────
# { estado_origen: { estado_destino: [roles_permitidos] } }
# "any" = cualquier rol autenticado puede hacerlo
TRANSITIONS: dict[str, dict[str, list[str]]] = {
    "creado": {
        "propuesto":  ["Doctor", "Administrador"],
        "cancelado":  ["Doctor", "Administrador"],
    },
    "propuesto": {
        "en_proforma": ["Recepcion", "Administrador"],
        "aprobado":    ["Recepcion", "Administrador"],
        "cancelado":   ["Recepcion", "Administrador", "Doctor"],
        "postergado":  ["Recepcion", "Administrador"],
        # No puede volver a "creado" — es intencional
    },
    "en_proforma": {
        "aprobado":   ["Recepcion", "Administrador"],
        "postergado": ["Recepcion", "Administrador"],
        "cancelado":  ["Recepcion", "Administrador"],
    },
    "aprobado": {
        "programado":    ["Recepcion", "Administrador"],
        "en_ejecucion":  ["Doctor", "Administrador"],
        "cancelado":     ["Recepcion", "Administrador"],
        "postergado":    ["Recepcion", "Administrador"],
    },
    "programado": {
        "en_ejecucion": ["Doctor", "Administrador"],
        "aprobado":     ["Recepcion", "Administrador"],  # desprogramar
        "cancelado":    ["Recepcion", "Administrador"],
    },
    "en_ejecucion": {
        "realizado": ["Doctor", "Administrador"],
        "aprobado":  ["Doctor", "Administrador"],  # revertir si hubo error
    },
    "realizado": {
        "cobrado":   ["Recepcion", "Administrador"],
        # NO puede volver a propuesto, aprobado, ni creado — es terminal clínico
    },
    "cobrado": {
        # Terminal financiero — sin transiciones válidas
    },
    "cancelado": {
        "creado": ["Administrador"],  # solo admin puede reactivar
    },
    "postergado": {
        "propuesto": ["Recepcion", "Administrador"],
        "cancelado": ["Recepcion", "Administrador"],
    },
}

# Estados terminales — nunca deben editarse clínicamente
TERMINAL_STATES = {"cobrado"}

# Estados que bloquean edición clínica (diagnóstico/superficies)
CLINICAL_LOCK_STATES = {"realizado", "cobrado", "cancelado"}

# ── Funciones de validación ────────────────────────────────────────────────────

class TransitionError(Exception):
    """Error de transición inválida — se convierte en HTTP 422."""
    def __init__(self, message: str, code: str = "INVALID_TRANSITION"):
        super().__init__(message)
        self.code = code


def validate_transition(
    estado_actual: str,
    estado_nuevo: str,
    rol: str,
) -> None:
    """
    Valida si la transición es permitida para el rol dado.
    Lanza TransitionError si no es válida.
    """
    if estado_actual == estado_nuevo:
        raise TransitionError(
            f"El procedimiento ya está en estado '{estado_actual}'.",
            code="SAME_STATE",
        )

    allowed = TRANSITIONS.get(estado_actual, {})

    if estado_nuevo not in allowed:
        valid_targets = list(allowed.keys())
        raise TransitionError(
            f"Transición inválida: '{estado_actual}' → '{estado_nuevo}'. "
            f"Desde '{estado_actual}' solo se puede ir a: {valid_targets or ['ningún estado']}.",
            code="INVALID_TRANSITION",
        )

    roles_permitidos = allowed[estado_nuevo]
    if rol not in roles_permitidos:
        raise TransitionError(
            f"El rol '{rol}' no puede ejecutar la transición "
            f"'{estado_actual}' → '{estado_nuevo}'. "
            f"Roles permitidos: {roles_permitidos}.",
            code="FORBIDDEN_ROLE",
        )


def can_edit_clinically(estado_actual: str) -> bool:
    """True si el procedimiento puede editarse clínicamente (diagnóstico, superficies)."""
    return estado_actual not in CLINICAL_LOCK_STATES


def get_valid_transitions(estado_actual: str, rol: str) -> list[str]:
    """Retorna estados destino válidos para un rol dado desde el estado actual."""
    allowed = TRANSITIONS.get(estado_actual, {})
    return [
        dest for dest, roles in allowed.items()
        if rol in roles
    ]


def is_terminal(estado: str) -> bool:
    return estado in TERMINAL_STATES
