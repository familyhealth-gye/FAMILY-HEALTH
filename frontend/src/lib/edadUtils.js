/**
 * Utilidades para cálculo de edad
 */

/**
 * Calcula la edad en años a partir de una fecha de nacimiento
 * @param {string} fechaNacimiento - Fecha en formato YYYY-MM-DD
 * @returns {number|null} - Edad en años o null si la fecha es inválida
 */
export const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  
  if (isNaN(nacimiento.getTime())) return null;
  
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  
  // Ajustar si aún no ha cumplido años este año
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  
  return edad >= 0 ? edad : null;
};

/**
 * Formatea la edad para mostrar
 * @param {string} fechaNacimiento - Fecha en formato YYYY-MM-DD
 * @returns {string} - Texto formateado "X años" o vacío si no hay fecha
 */
export const formatearEdad = (fechaNacimiento) => {
  const edad = calcularEdad(fechaNacimiento);
  if (edad === null) return '';
  
  if (edad === 0) return 'Menor de 1 año';
  if (edad === 1) return '1 año';
  return `${edad} años`;
};

/**
 * Valida que una fecha de nacimiento sea válida
 * @param {string} fechaNacimiento - Fecha en formato YYYY-MM-DD
 * @returns {boolean} - true si es válida
 */
export const validarFechaNacimiento = (fechaNacimiento) => {
  if (!fechaNacimiento) return false;
  
  const fecha = new Date(fechaNacimiento);
  if (isNaN(fecha.getTime())) return false;
  
  const hoy = new Date();
  
  // No puede ser fecha futura
  if (fecha > hoy) return false;
  
  // No puede ser más de 150 años atrás
  const hace150 = new Date();
  hace150.setFullYear(hace150.getFullYear() - 150);
  if (fecha < hace150) return false;
  
  return true;
};
