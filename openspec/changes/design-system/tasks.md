## 1. Proyecto

- [x] 1.1 [design-tokens] Crear `design-tokens/` (paquete `@devchrisvaz/wallet-design-tokens`, `"private": true`, sin dependencias de runtime, `main`/`module`/`types`/`exports` con los subpaths `.`, `./native`, `./tokens.css` y `./tailwind.css`), TypeScript 5.9 estricto, tsup, Vitest, ESLint y Prettier (DSG-01)

## 2. Tokens

- [x] 2.1 [design-tokens] Primitivos de Treo y tokens semánticos del tema claro (superficie, texto, acción, borde, acento, estado, dinero), agrupados por tema; prueba de que ningún token de texto usa `#31C454` y de que el tema solo referencia primitivos (DSG-02, DSG-03, DSG-07)
- [x] 2.2 [design-tokens] Prueba de contraste WCAG sobre la lista de pares texto/superficie (≥ 4.5) y de límites de interfaz (≥ 3); verificada con una mutación que baja un token por debajo del umbral (DSG-04)
- [x] 2.3 [design-tokens] Escala tipográfica (Work Sans 400/500/600, pilas de respaldo, familia por peso para React Native), espaciado, radios, elevación, foco, área táctil y movimiento; pruebas de tamaño mínimo de 12 px y de familia por peso (DSG-05, DSG-06)

## 3. Datos y textos compartidos

- [x] 3.1 [design-tokens] `transferStatus`, `movementType` y `money` (signo `−` U+2212, color por dirección); pruebas de los tonos, etiquetas y direcciones de D5 (DSG-09, DSG-10)
- [x] 3.2 [design-tokens] `problemMessage(code)` y la tabla de mensajes de D6, con respaldo a `INTERNAL_ERROR` para códigos desconocidos; pruebas de `INSUFFICIENT_FUNDS` y de un código desconocido (DSG-12)

## 4. Salidas por plataforma

- [ ] 4.1 [design-tokens] `scripts/generate.mjs`: `generated/tokens.css` (variables `--dt-*` en `:root`) y `generated/tailwind.css` (`:root` + `@theme { --color-*: initial }` + `@theme inline`); prueba de que cada token semántico aparece con el mismo valor en ambas hojas (DSG-07, DSG-08)
- [ ] 4.2 [design-tokens] Tema de React Native en el subpath `./native` (colores, tipografía con familia por peso, espaciado, radios, elevación, movimiento); prueba de que sus valores coinciden con la fuente (DSG-08)
- [ ] 4.3 [design-tokens] Referencia visual `preview/index.html` generada desde los tokens (muestras con contraste, escala tipográfica, botones, insignias, filas de movimiento y medidor del límite), sin publicarla (DSG-11)

## 5. Build, verificación y CI

- [ ] 5.1 [design-tokens] Build ESM + CJS + tipos, `check:exports`, `check:no-node-imports`, prueba de humo (`import` y `require`, más lectura de las hojas CSS) y `verify:install` (DSG-01, DSG-08)
- [ ] 5.2 [design-tokens] `.github/workflows/design-tokens.yml` (ante cambios en `design-tokens/**`): lint, typecheck, formato, pruebas, regeneración de salidas con `git diff --exit-code`, build, verificaciones del paquete y prueba de humo en Node 20, 22 y 24; simulado en un clon limpio (DSG-01, DSG-08)
- [ ] 5.3 [docs] `design-tokens/README.md`: tokens con su contraste, cómo lo consume cada cliente (Tailwind v4 e imports de React Native), inventario de componentes, convenciones de dinero, textos y cómo agregar un tema oscuro (DSG-01, DSG-07, DSG-11)
