import { Writable } from 'node:stream';
import { createLogger, type Logger } from '../../src/platform/logging/logger.js';

export interface CapturedLogs {
  readonly logger: Logger;
  /** Líneas crudas tal como se escribirían en stdout. */
  readonly lines: string[];
  entries(): Record<string, unknown>[];
  text(): string;
}

/** Logger real (mismas reglas de redacción) que escribe en memoria. */
export function captureLogger(): CapturedLogs {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...String(chunk).trim().split('\n'));
      done();
    },
  });
  const logger = createLogger({ level: 'debug', destination });
  return {
    logger,
    lines,
    entries: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
    text: () => lines.join('\n'),
  };
}
