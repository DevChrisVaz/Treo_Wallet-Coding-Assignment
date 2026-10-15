import { listStatementPeriods, statementPeriodLabel } from '@devchrisvaz/wallet-contract';

export interface StatementMonth {
  /** `AAAA-MM`, el periodo de `getAccountStatement`. */
  readonly value: string;
  readonly label: string;
}

/**
 * Opciones del selector del estado de cuenta (WEB-32): del mes de creación de la
 * cuenta al mes en curso de la Ciudad de México, marcado "(en curso)", el más reciente primero. La
 * lista la calcula `listStatementPeriods` del contrato, la misma regla con la que la API rechaza un
 * periodo anterior a la cuenta. Recibe el instante en lugar de leer el reloj.
 */
export function statementMonths(createdAt: Date | string, now: Date): StatementMonth[] {
  return listStatementPeriods(createdAt, now).map((value, index) => {
    // El selector muestra "septiembre 2026", sin el "de" de la etiqueta del contrato.
    const label = statementPeriodLabel(value).replace(' de ', ' ');
    return { value, label: index === 0 ? `${label} (en curso)` : label };
  });
}
