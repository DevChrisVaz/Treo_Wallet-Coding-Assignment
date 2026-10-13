/**
 * Puerto de logging para la aplicación: un subconjunto estructural de pino, para que los casos de
 * uso registren eventos sin depender de la librería.
 */
export interface AppLogger {
  debug(object: object, message?: string): void;
  info(object: object, message?: string): void;
  warn(object: object, message?: string): void;
  error(object: object, message?: string): void;
}
