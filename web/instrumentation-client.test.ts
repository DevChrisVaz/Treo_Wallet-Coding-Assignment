import * as z from 'zod';
import { describe, expect, it } from 'vitest';

describe('instrumentation-client', () => {
  it('WEB-39 desactiva el compilador de Zod para que no pruebe eval bajo una política sin unsafe-eval', async () => {
    expect(z.config().jitless).not.toBe(true);
    await import('./instrumentation-client');
    expect(z.config().jitless).toBe(true);
  });
});
