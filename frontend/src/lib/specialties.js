/**
 * specialties.js
 * Catálogo central de especialidades del sistema.
 *
 * Reglas:
 * - CANONICAL_SPECIALTIES: valores canónicos (con tilde, correctos)
 * - SPECIALTY_ALIASES: mapa de variantes legacy → canónico
 * - normalizeSpecialty(): usar SIEMPRE para comparaciones
 *
 * Para agregar una nueva especialidad: solo agregar aquí.
 * NO crear nuevos maps en otros componentes.
 */

export const CANONICAL_SPECIALTIES = [
  "Medicina General",
  "Odontología",
  "Pediatría",
  "Nutrición",
  "Ginecología",
  "Ginecología/Obstetricia",
  "Obstetricia",
  "Ecografía",
];

// Variantes legacy (sin tilde, abreviadas, errores de encoding) → canónico
const SPECIALTY_ALIASES = {
  // Odontología
  "odontologia":              "Odontología",
  "odontologa":               "Odontología",
  "odontología":              "Odontología",
  // Medicina
  "medicina general":         "Medicina General",
  "medicina":                 "Medicina General",
  // Pediatría
  "pediatria":                "Pediatría",
  "pediatra":                 "Pediatría",
  "pediatría":                "Pediatría",
  // Nutrición
  "nutricion":                "Nutrición",
  "nutricin":                 "Nutrición",
  "nutrición":                "Nutrición",
  // Ginecología
  "ginecologia":              "Ginecología",
  "ginecologa":               "Ginecología",
  "ginecología":              "Ginecología",
  "ginecologia/obstetricia":  "Ginecología/Obstetricia",
  "ginecología/obstetricia":  "Ginecología/Obstetricia",
  // Obstetricia
  "obstetricia":              "Obstetricia",
  // Ecografía
  "ecografia":                "Ecografía",
  "ecografa":                 "Ecografía",
  "ecografía":                "Ecografía",
};

/**
 * Normaliza cualquier variante de especialidad al valor canónico.
 * Si no hay match, retorna el valor original (para no perder datos desconocidos).
 */
export const normalizeSpecialty = (esp) => {
  if (!esp) return "";
  const key = esp.trim().toLowerCase();
  return SPECIALTY_ALIASES[key] || esp.trim();
};

/**
 * Compara dos especialidades ignorando variantes de encoding/tilde.
 */
export const specialtiesMatch = (a, b) =>
  normalizeSpecialty(a) === normalizeSpecialty(b);

/**
 * Retorna el componente clínico correspondiente a una especialidad.
 * Usado por el router de AppointmentsWithAttention.
 */
export const SPECIALTY_FORM_MAP = {
  "Medicina General":           "MedicinaGeneralForm",
  "Odontología":                "OdontologiaFormSimple",
  "Pediatría":                  "PediatriaForm",
  "Nutrición":                  "NutricionForm",
  "Ginecología":                "GinecologiaForm",
  "Ginecología/Obstetricia":    "GinecologiaForm",
  "Obstetricia":                "GinecologiaForm",
  "Ecografía":                  "EcografiaForm",
};

export const getFormForSpecialty = (esp) =>
  SPECIALTY_FORM_MAP[normalizeSpecialty(esp)] || null;
