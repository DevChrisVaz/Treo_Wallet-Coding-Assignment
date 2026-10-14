/*
 * `next/link` en el lienzo de design-sync (alias de build-ui.mjs). Algunas piezas de las pantallas
 * que se sincronizan lo importan directo (ScheduleField.tsx exporta también la nota del resultado
 * con su enlace), pero next/link es CommonJS y necesita el router de Next. En el lienzo basta el
 * enlace del kit sin proveedor, que es un `<a>` normal.
 */
export { RouterLink as default } from '@/components/ui/RouterLink';
