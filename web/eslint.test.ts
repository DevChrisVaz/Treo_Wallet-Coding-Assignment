import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: import.meta.dirname });

async function restrictedSyntaxMessages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message);
}

describe('regla de montos sin floats', () => {
  it.each([
    'export const a = (x: string) => parseFloat(x);',
    'export const a = (x: string) => Number.parseFloat(x);',
    'export const a = (x: string) => Number(x);',
    'export const a = (x: string) => new Number(x);',
  ])('WEB-21 prohíbe convertir un monto a float: %s', async (code) => {
    const messages = await restrictedSyntaxMessages(code, 'components/ui/AmountField.tsx');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/monto/i);
  });

  it('WEB-21 permite trabajar los montos como texto con las funciones del contrato', async () => {
    const code = [
      "import { formatMXN } from '@devchrisvaz/wallet-contract';",
      "export const a = (x: string) => formatMXN(x.replace(/,/g, ''));",
    ].join('\n');
    expect(await restrictedSyntaxMessages(code, 'components/ui/AmountField.tsx')).toEqual([]);
  });
});
