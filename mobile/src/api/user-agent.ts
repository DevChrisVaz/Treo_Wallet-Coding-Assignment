/**
 * `User-Agent` de la app (MOB-32, D10 de security-hardening): `TreoWallet-App/<versión> (<ios|android>)`.
 * La API lo usa para distinguir a la app de un navegador en el aviso de inicio de sesión (IDN-18). No
 * lleva el modelo del dispositivo, ningún identificador ni datos de la persona. En un sistema que no
 * es iOS ni Android no hay valor y la API la describe como "un dispositivo".
 */
export function appUserAgent(version: string | undefined, os: string): string | undefined {
  if (os !== 'ios' && os !== 'android') return undefined;
  const safe = version && /^[0-9A-Za-z.+-]{1,32}$/.test(version) ? version : '0.0.0';
  return `TreoWallet-App/${safe} (${os})`;
}
