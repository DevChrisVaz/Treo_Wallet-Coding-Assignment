import { describe, expect, it } from 'vitest';
import { describeClient } from '../../../src/modules/identity/application/client-description.js';
import { maskIp } from '../../../src/shared/masking.js';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const EDGE_WIN = `${CHROME_WIN} Edg/129.0.0.0`;
const OPERA_WIN = `${CHROME_WIN} OPR/114.0.0.0`;
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1';
const FIREFOX_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const CHROME_CROS =
  'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

describe('IDN-18 descripción del cliente', () => {
  it.each([
    ['Chrome en Windows', CHROME_WIN],
    ['Edge en Windows', EDGE_WIN],
    ['Opera en Windows', OPERA_WIN],
    ['Firefox en Linux', FIREFOX_LINUX],
    ['Safari en macOS', SAFARI_MAC],
    ['Safari en iOS', SAFARI_IPHONE],
    ['Chrome en iOS', CHROME_IOS],
    ['Firefox en iOS', FIREFOX_IOS],
    ['Chrome en Android', CHROME_ANDROID],
    ['Chrome en ChromeOS', CHROME_CROS],
  ])('IDN-18 reconoce "%s"', (expected, userAgent) => {
    expect(describeClient(userAgent)).toEqual({ kind: 'browser', text: expected });
  });

  it('IDN-18 reconoce la app por su token y el sistema que declara', () => {
    expect(describeClient('TreoWallet-App/1.2.0 (android)')).toEqual({
      kind: 'app',
      text: 'la app de TreoWallet en Android',
    });
    expect(describeClient('TreoWallet-App/1.2.0 (ios)')).toEqual({
      kind: 'app',
      text: 'la app de TreoWallet en iOS',
    });
  });

  it('IDN-18 la app con un sistema desconocido se describe sin sistema', () => {
    expect(describeClient('TreoWallet-App/1.2.0 (symbian)')).toEqual({
      kind: 'app',
      text: 'la app de TreoWallet',
    });
  });

  it.each([
    ['sin User-Agent', undefined],
    ['vacío', ''],
    ['solo espacios', '   '],
    ['un cliente de línea de comandos', 'curl/8.5.0'],
    ['el de la librería de red de Android', 'okhttp/4.12.0'],
    ['el de CFNetwork', 'TreoWallet/1 CFNetwork/1494.0.7 Darwin/23.4.0'],
    ['un navegador sin sistema reconocible', 'Mozilla/5.0 Chrome/129.0.0.0 Safari/537.36'],
    ['un valor enorme', 'A'.repeat(100_000)],
  ])('IDN-18 %s se describe como "un dispositivo"', (_name, userAgent) => {
    expect(describeClient(userAgent)).toEqual({ kind: 'unknown', text: 'un dispositivo' });
  });

  it('IDN-18 nunca devuelve el User-Agent tal como llegó', () => {
    const hostile = 'TreoWallet-App/<script>alert(1)</script> (android)\r\nBcc: x@example.com';
    const described = describeClient(hostile);
    expect(described.text).not.toMatch(/[<>\r\n]|Bcc/);
  });
});

describe('IDN-18 IP enmascarada', () => {
  it.each([
    ['203.0.113.7', '203.0.113.*'],
    ['2001:db8:85a3:8d3:1319:8a2e:370:7348', '2001:db8:85a3:*'],
    ['::1', '::*'],
    ['::ffff:203.0.113.7', '203.0.113.*'],
  ])('IDN-18 %s se muestra como %s', (ip, masked) => {
    expect(maskIp(ip)).toBe(masked);
  });

  it('IDN-18 una IP ausente o inválida no revela nada', () => {
    expect(maskIp(undefined)).toBe('desconocida');
    expect(maskIp('no-es-una-ip')).toBe('desconocida');
  });
});
