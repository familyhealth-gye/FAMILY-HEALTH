"""
specialty_utils.py
Normalización centralizada de especialidades — fuente única de verdad en backend.
Espejo del catálogo en frontend/src/lib/specialties.js.

Uso:
    from specialty_utils import normalize_specialty, specialties_match
"""

SPECIALTY_ALIASES: dict[str, str] = {
    # Odontología
    "odontologia":              "Odontología",
    "odontologa":               "Odontología",
    "odontología":              "Odontología",
    # Medicina General
    "medicina general":         "Medicina General",
    "medicina":                 "Medicina General",
    # Pediatría
    "pediatria":                "Pediatría",
    "pediatra":                 "Pediatría",
    "pediatría":                "Pediatría",
    # Nutrición
    "nutricion":                "Nutrición",
    "nutricin":                 "Nutrición",
    "nutrición":                "Nutrición",
    # Ginecología
    "ginecologia":              "Ginecología",
    "ginecologa":               "Ginecología",
    "ginecología":              "Ginecología",
    "ginecologia/obstetricia":  "Ginecología/Obstetricia",
    "ginecología/obstetricia":  "Ginecología/Obstetricia",
    # Obstetricia
    "obstetricia":              "Obstetricia",
    # Ecografía
    "ecografia":                "Ecografía",
    "ecografa":                 "Ecografía",
    "ecografía":                "Ecografía",
}

CANONICAL_SPECIALTIES = [
    "Medicina General",
    "Odontología",
    "Pediatría",
    "Nutrición",
    "Ginecología",
    "Ginecología/Obstetricia",
    "Obstetricia",
    "Ecografía",
]

# Mapa canónico → colección de historia clínica en MongoDB
SPECIALTY_COLLECTION_MAP: dict[str, str] = {
    "Medicina General":         "medical_history_general",
    "Odontología":              "medical_history_odontology",
    "Pediatría":                "medical_history_pediatric",
    "Nutrición":                "medical_history_nutricion",
    "Ginecología":              "medical_history_ginecologia",
    "Ginecología/Obstetricia":  "medical_history_ginecologia",
    "Obstetricia":              "medical_history_ginecologia",
    "Ecografía":                "medical_history_ecografia",
}


def normalize_specialty(esp: str | None) -> str:
    """
    Normaliza cualquier variante de especialidad al valor canónico.
    Si no hay match, retorna el valor original (sin perder datos desconocidos).
    """
    if not esp:
        return ""
    return SPECIALTY_ALIASES.get(esp.strip().lower(), esp.strip())


def specialties_match(a: str | None, b: str | None) -> bool:
    """Compara dos especialidades ignorando variantes de encoding/tilde."""
    return normalize_specialty(a) == normalize_specialty(b)


def get_collection_for_specialty(esp: str | None) -> str | None:
    """Retorna el nombre de la colección MongoDB para la especialidad dada."""
    canonical = normalize_specialty(esp)
    return SPECIALTY_COLLECTION_MAP.get(canonical)
