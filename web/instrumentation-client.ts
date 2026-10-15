import * as z from 'zod';

/*
 * Corre en el navegador antes de que la app se hidrate (convención `instrumentation-client` de
 * Next.js). Zod 4 prueba `Function("")` para saber si puede compilar sus validadores, y con una
 * política de contenido sin `unsafe-eval` (WEB-39) el navegador reporta esa prueba como una
 * violación aunque el error se capture. `jitless` evita la prueba; los formularios validan con el
 * recorrido normal de Zod. Debe fijarse antes de que se construya cualquier esquema, y los del
 * contrato se construyen al cargar el paquete.
 */
z.config({ jitless: true });
