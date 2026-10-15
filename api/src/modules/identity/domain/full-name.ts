/** Nombre completo del titular: nombres, apellido paterno y, si existe, apellido materno, con un espacio. */
export function composeFullName(parts: {
  readonly firstNames: string;
  readonly paternalSurname: string;
  readonly maternalSurname?: string | null | undefined;
}): string {
  return [parts.firstNames, parts.paternalSurname, parts.maternalSurname]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' ');
}
