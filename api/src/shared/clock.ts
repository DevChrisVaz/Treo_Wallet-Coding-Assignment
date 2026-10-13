/**
 * Puerto de reloj: toda regla que depende de la hora (vencimientos de tokens y códigos, ventana de
 * gracia, día del límite diario) la toma de aquí, para que las pruebas la controlen.
 */
export interface Clock {
  now(): Date;
}
