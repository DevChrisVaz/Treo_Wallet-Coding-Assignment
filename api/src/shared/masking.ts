import { isIP } from 'node:net';

/**
 * Enmascarado de datos personales (PLT-06, IDN-14): deja visible solo un fragmento. Lo usan los
 * logs, `GET /me` y el destino enmascarado de los códigos de un solo uso.
 */

function stars(count: number): string {
  return '*'.repeat(Math.max(count, 0));
}

/** `ana.gomez@example.com` → `an***@example.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}***${email.slice(at)}`;
}

/** `+525512345678` → `+52******5678`: lada y últimos 4 dígitos. */
export function maskPhone(phone: string): string {
  if (phone.length <= 7) return stars(phone.length);
  return `${phone.slice(0, 3)}${stars(phone.length - 7)}${phone.slice(-4)}`;
}

/** Primeros 4 caracteres de la CURP. */
export function maskCurp(curp: string): string {
  return `${curp.slice(0, 4)}${stars(curp.length - 4)}`;
}

/** Primeros 4 caracteres del RFC. */
export function maskRfc(rfc: string): string {
  const characters = [...rfc];
  return `${characters.slice(0, 4).join('')}${stars(characters.length - 4)}`;
}

/** Últimos 4 dígitos de la CLABE. */
export function maskClabe(clabe: string): string {
  return `${stars(clabe.length - 4)}${clabe.slice(-4)}`;
}

/**
 * IP para un aviso al usuario (IDN-18): IPv4 sin el último octeto (`203.0.113.*`) e IPv6 con sus
 * primeros grupos (`2001:db8:85a3:*`). Una dirección ausente o inválida no revela nada.
 */
export function maskIp(ip: string | undefined): string {
  if (!ip) return 'desconocida';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  const address = mapped?.[1] ?? ip;
  if (isIP(address) === 4) return `${address.split('.').slice(0, 3).join('.')}.*`;
  if (isIP(address) === 6) {
    const kept: string[] = [];
    for (const group of address.split(':').slice(0, 3)) {
      if (group === '') break;
      kept.push(group);
    }
    return `${kept.join(':')}${kept.length > 0 ? ':' : '::'}*`;
  }
  return 'desconocida';
}
