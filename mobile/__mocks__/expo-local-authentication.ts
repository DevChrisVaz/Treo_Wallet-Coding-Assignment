/**
 * Simulación de expo-local-authentication (biometría del sistema). Empieza como un Android con una
 * huella registrada cuyo diálogo tiene éxito; las pruebas cambian el hardware, el registro, el tipo
 * y las respuestas del diálogo con `localAuthMock` de `src/test-utils/native-mocks`.
 */
import type {
  LocalAuthenticationOptions,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

// Mismos valores que los enums de la librería.
export enum AuthenticationType {
  FINGERPRINT = 1,
  FACIAL_RECOGNITION = 2,
  IRIS = 3,
}

export enum SecurityLevel {
  NONE = 0,
  SECRET = 1,
  BIOMETRIC_WEAK = 2,
  BIOMETRIC_STRONG = 3,
}

type AuthenticateReply = LocalAuthenticationResult | (() => Promise<LocalAuthenticationResult>);

interface BiometricDevice {
  hasHardware: boolean;
  enrolled: boolean;
  types: AuthenticationType[];
}

const DEFAULT_DEVICE: BiometricDevice = {
  hasHardware: true,
  enrolled: true,
  types: [AuthenticationType.FINGERPRINT],
};

let device: BiometricDevice = { ...DEFAULT_DEVICE };
let replies: AuthenticateReply[] = [{ success: true }];

export function __configure(changes: Partial<BiometricDevice>): void {
  device = { ...device, ...changes };
}

/** Respuestas del diálogo en orden; la última se repite. */
export function __onAuthenticate(...next: AuthenticateReply[]): void {
  replies = next;
}

export function __reset(): void {
  device = { ...DEFAULT_DEVICE };
  replies = [{ success: true }];
}

export const hasHardwareAsync = jest.fn(async () => device.hasHardware);

export const isEnrolledAsync = jest.fn(async () => device.hasHardware && device.enrolled);

export const supportedAuthenticationTypesAsync = jest.fn(async () => [...device.types]);

export const getEnrolledLevelAsync = jest.fn(async () =>
  device.hasHardware && device.enrolled ? SecurityLevel.BIOMETRIC_STRONG : SecurityLevel.SECRET,
);

export const authenticateAsync = jest.fn(
  async (_options?: LocalAuthenticationOptions): Promise<LocalAuthenticationResult> => {
    const next = (replies.length > 1 ? replies.shift() : replies[0]) as AuthenticateReply;
    return typeof next === 'function' ? next() : next;
  },
);

export const cancelAuthenticate = jest.fn(async () => undefined);
