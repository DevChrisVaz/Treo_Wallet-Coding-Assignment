# Fase A — Prototipo (rama `design/redesign`, revisión en los lienzos)

## 1. Preparación

- [ ] 1.1 [web] Versionar en `main` la configuración de design-sync de la web (`web/.design-sync/`: config, NOTES, conventions, build-ui, entry, tailwind, docs y previews) y las reglas de `.gitignore`, para que la rama del prototipo la herede (DSG-17)
- [ ] 1.2 [mobile] Versionar en `main` la configuración de design-sync de la app móvil (`mobile/.design-sync/`: config, NOTES, conventions, build-ui, entry, fonts, docs y previews) (DSG-17)
- [ ] 1.3 [docs] Crear el worktree `.claude/worktrees/design-redesign` en la rama `design/redesign` desde `main`, preparar `.ds-sync/` en ambas apps y servir sus lienzos en puertos distintos de los vigentes (DSG-17)

## 2. Tokens v2

- [ ] 2.1 [design-tokens] Tokens nuevos de D5 (lienzo, superficie y texto del *hero*, acento sobre oscuro, display mayor, tamaños de icono y avatar, elevaciones, medidas de layout y punto de cambio) en las tres salidas; prueba de que cada uno tiene el mismo valor en TS, CSS y React Native y de que los vigentes no cambiaron (DSG-13, DSG-16)
- [ ] 2.2 [design-tokens] Pares de contraste nuevos (lima y texto atenuado sobre `surface.hero`) en la prueba de contraste y prueba de que ningún token de texto sobre superficies claras es lima (DSG-14)
- [ ] 2.3 [design-tokens] Mapa de concepto a icono (D6) exportado por el paquete; prueba de que cubre los doce conceptos (DSG-15)

## 3. Kit web

- [ ] 3.1 [web] `Icon` (Lucide por concepto) y `Avatar`; pruebas de que los iconos decorativos se ocultan y de que un botón solo con icono exige etiqueta (DSG-15, DSG-17)
- [ ] 3.2 [web] Reestilo de los 14 componentes vigentes con el lenguaje de D4 conservando su API; las pruebas vigentes siguen pasando (DSG-13, DSG-17)
- [ ] 3.3 [web] `TabBar`, `SideNav`, `TopBar` y `AppHeader`; pruebas de `aria-current` y del menú de la cuenta (WEB-26, WEB-27)
- [ ] 3.4 [web] `BalanceHero`, `QuickActions` y `ListSection` con encabezados por día de Ciudad de México; pruebas de la suma sin floats y de la agrupación (WEB-28, WEB-29)
- [ ] 3.5 [web] `BottomSheet` y `Stepper`; pruebas de foco atrapado, cierre con Escape y anuncio del paso (DSG-17, WEB-30)
- [ ] 3.6 [web] `AppShell` responsivo (forma de app bajo 1024 px, columna de 480 px, *dashboard* desde 1024 px) (WEB-24)

## 4. Kit móvil

- [ ] 4.1 [mobile] `Icon` (Lucide con `react-native-svg` en la versión de Expo) y `Avatar`, con las mismas medidas que la web (DSG-15, DSG-17)
- [ ] 4.2 [mobile] Reestilo de los componentes vigentes con el lenguaje de D4 conservando su API; las pruebas vigentes siguen pasando (DSG-13, DSG-17)
- [ ] 4.3 [mobile] `TabBar` y `AppHeader` con la anatomía de la web (MOB-18)
- [ ] 4.4 [mobile] `BalanceHero`, `QuickActions` y `ListSection`; pruebas de la suma sin floats y de la agrupación por día (MOB-19, MOB-20)
- [ ] 4.5 [mobile] `BottomSheet` y `Stepper`; pruebas de cierre con atrás y anuncio del paso (DSG-17, MOB-21)

## 5. Pantallas en los lienzos y revisión

- [ ] 5.1 [web] Historias rediseñadas de todas las pantallas web (mismos nombres que el mapa vigente), verificadas a 1280 px y a 390 px (WEB-24, WEB-26, WEB-27, WEB-28, WEB-29, WEB-30, WEB-31)
- [ ] 5.2 [mobile] Historias rediseñadas de todas las pantallas móviles a 390×844 (MOB-18, MOB-19, MOB-20, MOB-21, MOB-22)
- [ ] 5.3 [web] Lienzo de paridad (escritorio, web a 390×844 y móvil a 390×844 por pantalla, con superposición) y captura comparada de todas las parejas equivalentes (WEB-25)
- [ ] 5.4 [docs] Revisión visual con el usuario en los lienzos; iterar hasta la aprobación y registrar en `design.md` los valores y decisiones abiertas que se cerraron (DSG-13, DSG-16, WEB-25)

# Fase B — Aplicación (solo con la aprobación visual de 5.4)

## 6. Web

- [ ] 6.1 [web] Layouts `(app)` y `(public)` con `AppShell` y la navegación nueva; pruebas de navegación y de cierre de sesión desde la navegación lateral y desde el avatar (WEB-24, WEB-26, WEB-27)
- [ ] 6.2 [web] Inicio de sesión, registro y verificación sobre la superficie de marca; las pruebas de WEB-11 y WEB-12 siguen pasando (WEB-31)
- [ ] 6.3 [web] Inicio con el *hero*, las tarjetas seleccionables y los últimos 5 movimientos; pruebas de la suma, del cambio de cuenta y de "Ver todos" (WEB-28)
- [ ] 6.4 [web] Movimientos agrupados por día con filtros en hoja inferior (teléfono) y en panel (escritorio); las pruebas de WEB-14 siguen pasando (WEB-29)
- [ ] 6.5 [web] Flujo de transferencia por pasos con el paso de destinatario (cuentas propias y beneficiarios) y el resumen en escritorio; pruebas del indicador, de la transferencia entre cuentas propias y del doble clic en Enviar; las pruebas de WEB-16 a WEB-19 siguen pasando (WEB-30)
- [ ] 6.6 [web] Beneficiarios, nuevo beneficiario y detalle de transferencia con los patrones de la forma de app y del *dashboard* (WEB-25, WEB-26, WEB-27)
- [ ] 6.7 [web] Accesibilidad y responsividad: `vitest-axe` en cada pantalla, flujo de transferencia solo con teclado y prueba de que no hay desplazamiento horizontal entre 320 y 1440 px (WEB-23, WEB-24)

## 7. Móvil

- [ ] 7.1 [mobile] Pestañas de expo-router (Inicio, Movimientos, Transferir) con el flujo de transferencia fuera de ellas y el menú del avatar; pruebas de la pestaña actual y de cerrar sesión (MOB-18)
- [ ] 7.2 [mobile] Inicio de sesión sobre la superficie de marca; las pruebas de MOB-01 siguen pasando (MOB-22)
- [ ] 7.3 [mobile] Inicio con el saludo, el *hero*, las tarjetas seleccionables y los últimos 5 movimientos; pruebas de la suma y de "Ver todos" (MOB-19)
- [ ] 7.4 [mobile] Movimientos como pestaña con selector de cuenta y agrupación por día; prueba del movimiento cerca de la medianoche (MOB-20)
- [ ] 7.5 [mobile] Flujo de transferencia por pasos con el monto protagonista; pruebas del indicador y de la pérdida de red al enviar; las pruebas de MOB-07 a MOB-14 siguen pasando (MOB-21)

## 8. Cierre

- [ ] 8.1 [web] Paridad final: captura comparada de todas las parejas equivalentes sobre las pantallas reales, sin diferencias de estructura, tamaño, color ni espaciado (WEB-25)
- [ ] 8.2 [docs] README de web, móvil y tokens, y `docs/ai-log.md` con las decisiones del rediseño (DSG-13, WEB-24, MOB-18)
- [ ] 8.3 [docs] Re-sincronizar design-sync de ambas apps con los componentes nuevos (previews, conventions y NOTES) y subir a Claude Design cuando haya autorización (DSG-17)
- [ ] 8.4 [docs] Integrar `design/redesign` en `main` con `--no-ff` después de que pasen lint, typecheck y pruebas de los tres proyectos (DSG-13, WEB-24, MOB-18)
