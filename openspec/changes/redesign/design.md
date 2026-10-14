## Context

- La web (Next.js App Router + Tailwind v4) y la app móvil (Expo + React Native) consumen el mismo paquete `@devchrisvaz/wallet-design-tokens` e implementan el mismo inventario de 14 componentes, cada una con su tecnología (`web/components/ui`, `mobile/src/components/ui`).
- La web es de escritorio: encabezado con navegación y contenido en `max-w-5xl`. No hay requisitos de diseño responsivo.
- La app móvil navega con un `Stack` de expo-router: Inicio (cuentas), Movimientos (al tocar una cuenta) y el flujo de transferencia (selector de beneficiario y pantalla de envío).
- Los dos sistemas de diseño ya están sincronizados con design-sync (`<app>/.design-sync/`): cada app compila su kit a un bundle con historias por componente y un mapa de todas sus pantallas (historias de `PageShell` en la web y de `Screen` en móvil), que se revisan en un lienzo local. Ese mismo mecanismo sirve para revisar el rediseño antes de aplicarlo.
- Los changes `design-system`, `web-app` y `mobile-app` están implementados pero no archivados.

## Goals / Non-Goals

**Goals:**
- Que quien revise la prueba vea un producto financiero terminado en escritorio y en teléfono.
- Elevar la marca de Treo (paleta, Work Sans, píldoras) con más oficio: profundidad, jerarquía, iconos, un saldo protagonista.
- Que la web en un teléfono sea visualmente indistinguible de la app móvil en las pantallas equivalentes, y que sus pantallas propias usen los mismos patrones.
- Aprobar el diseño viéndolo en los lienzos antes de tocar las pantallas reales.

**Non-Goals:**
- Cambiar contrato, API, reglas de negocio, sesión, textos de error o el alcance funcional de cada cliente (la app móvil no gana registro ni gestión de beneficiarios).
- Tema oscuro, ilustraciones, fuentes nuevas o animaciones más allá de los tokens de movimiento vigentes.
- Compartir implementación de componentes entre web y móvil (ver D3).

## Decisions

### D1. Proceso: prototipo en una rama, aprobación visual, después aplicación

El rediseño se construye primero como prototipo en un worktree aislado (`.claude/worktrees/design-redesign`, rama `design/redesign` desde `main`): tokens v2, kits reestilizados, componentes nuevos y las pantallas rediseñadas como historias de los lienzos de design-sync. La revisión es visual, en los lienzos. Con la aprobación, los detalles acordados se escriben en este documento y se aplican a las pantallas reales (rutas, *features*, pruebas) en la misma rama, que se integra a `main` con `--no-ff`.

- **Alternativa descartada: laboratorio de diseño aparte** (un sistema de maqueta que no se publica). Obliga a construir todo dos veces, lo aprobado y lo implementado pueden divergir y la paridad no se puede comprobar sobre los componentes reales.
- **Alternativa descartada: diseñar primero en Claude Design.** Su agente compone con los componentes y tokens vigentes, así que no puede proponer tokens nuevos, el *dashboard* ni la barra de pestañas; y el resultado son diseños, no código.

Las pantallas reales (`web/app`, `web/components/{auth,accounts,beneficiaries,transfers}`, `mobile/src/features`) y las pruebas no cambian durante la fase de prototipo.

### D2. Estructura: forma de app y forma de *dashboard*

**Forma de app** (app móvil, y la web por debajo de 1024 px):
- Barra de pestañas inferior: **Inicio · Movimientos · Transferir**; la web agrega **Beneficiarios** como cuarta pestaña. La pestaña actual lleva su icono en lima dentro de una píldora verde profundo (lima sobre oscuro, D4) y su etiqueta en el verde de acción.
- Encabezado de Inicio con saludo ("Hola, Ana") y un avatar con las iniciales que abre el menú con "Cerrar sesión".
- El flujo de transferencia ocupa la pantalla completa y oculta la barra de pestañas.
- Entre 480 y 1023 px la forma de app se centra en una columna de 480 px para que no se estire en tabletas.

**Forma de *dashboard*** (web desde 1024 px):
- Navegación lateral de 248 px: Wordmark, Inicio, Movimientos, Transferir, Beneficiarios y, abajo, el usuario con "Cerrar sesión".
- Barra superior con el título de la página y "Nueva transferencia" como acción principal.
- Contenido de hasta 1200 px: Inicio con el *hero* a todo lo ancho y, debajo, dos columnas (cuentas y límite diario | últimos movimientos); el flujo de transferencia en un panel central con el resumen en vivo a un lado.

- **Alternativa descartada: menú hamburguesa en teléfono.** Esconde la acción principal (Transferir) y no coincide con la app móvil.
- **Alternativa descartada: columna de teléfono también en escritorio.** Paridad trivial, pero desaprovecha el escritorio y no parece un producto web.
- **Alternativa descartada: navegación lateral colapsada en tableta.** Un tercer layout que mantener sin un usuario que lo pida.

### D3. Paridad web/móvil: misma especificación, dos implementaciones

La paridad se logra con tokens compartidos (incluidas las medidas de layout de D5) y una anatomía común por componente (D7), no con código compartido. Se verifica en un **lienzo de paridad**: por cada pantalla equivalente, la historia web a 1280×800, la misma historia web a 390×844 (el layout responsivo entra) y la historia móvil a 390×844, más un control que superpone el marco web sobre el móvil al 50 %. Antes de cada revisión se capturan las parejas a 390×844 y se comparan; las diferencias de *antialiasing* se ignoran, las de estructura, tamaño, color o espaciado se corrigen.

La historia móvil se renderiza con react-native-web (los mismos componentes y el mismo tema que en el dispositivo), así que la comparación es un sustituto fiel del dispositivo salvo en métricas de fuente nativas.

- **Alternativa descartada: usar los componentes de React Native en la web con react-native-web.** Daría una sola implementación, pero reemplaza los componentes DOM/Tailwind y el renderizado del servidor de Next.js, empeora la semántica HTML (formularios, encabezados, `aria`) que exige WEB-23 y es un cambio de arquitectura de la web, no un rediseño.

Pantallas equivalentes: inicio de sesión, Inicio, Movimientos, y los pasos del flujo de transferencia (destinatario, monto, revisión, código, comprobante y sus estados). Registro, verificación de correo y beneficiarios solo existen en la web y se revisan en escritorio y teléfono.

### D4. Lenguaje visual

- **Lienzo y tarjetas:** fondo de la app en `#F6F5F2`, contenido en tarjetas blancas con elevación `card`. Las superficies grandes (*hero*, hojas, paneles) usan radio 16 px (`radius.lg`); las tarjetas pequeñas conservan los 9 px de Treo.
- ***Hero* del saldo:** superficie verde `#1C4B42` con un resplandor lima suave en una esquina; saldo total en `display-xl` con los centavos en un tamaño menor; un chip lima con lo que queda del límite diario ("Disponible hoy: $31,500.00", dato que Inicio ya carga); acciones rápidas como botones redondos con icono debajo.
- **Lima solo sobre oscuro:** sobre `#1C4B42` (6.7:1) para indicadores, la pestaña activa, el chip del *hero* y el estado activo del botón principal. Nunca como texto ni sobre superficies claras (1.5:1 sobre blanco).
- **Listas:** movimientos agrupados por día ("Hoy", "Ayer", "12 oct", fechas de Ciudad de México), con avatar redondo e icono por tipo (verde suave para entradas, neutro para salidas), título, contraparte y monto alineado a la derecha.
- **Movimiento:** hojas que suben y respuesta al presionar con los tokens de 150 y 250 ms; nada con movimiento reducido.

### D5. Tokens v2 (aditivos)

| Token nuevo | Valor propuesto | Uso |
|---|---|---|
| `surface.canvas` | `#F6F5F2` | Fondo de la app (antes blanco) |
| `surface.hero` | `#1C4B42` | *Hero* del saldo, pantallas de marca |
| `text.onHeroMuted` | blanco con opacidad para ≥ 4.5:1 sobre `surface.hero` (se fija en el prototipo) | Etiquetas del *hero* |
| `accent.onDark` | `#B4E717` | Indicadores y chips sobre superficies oscuras |
| `typography.displayXl` | 48/56, 600, −0.5 px | Saldo total |
| `iconSize.{sm,md,lg}` | 16 / 20 / 24 | Iconos |
| `avatarSize.{sm,md}` | 32 / 40 | Avatares de movimientos y del usuario |
| `elevation.{raised,sheet}` | se fijan en el prototipo | Tarjetas flotantes y hojas inferiores |
| `layout.tabBarHeight` | 64 (más el área segura) | Barra de pestañas en web y móvil |
| `layout.appColumnMax` | 480 | Columna de la forma de app en web |
| `layout.sidebarWidth` | 248 | Navegación lateral |
| `layout.contentMax` | 1200 | Contenido del *dashboard* |
| `breakpoint.dashboard` | 1024 | Cambio de forma en la web |

Se generan para las tres salidas (TS, CSS/Tailwind, React Native) con la misma fuente y las mismas pruebas que hoy. Los tokens vigentes no cambian de valor ni de significado; si el prototipo obliga a cambiar alguno, el paquete pasa a 2.0.0 y el cambio se documenta aquí.

### D6. Iconografía: Lucide

Iconos de línea de Lucide a 16, 20 y 24 px con trazo de 2 px: `lucide-react` en la web, `lucide-react-native` con `react-native-svg` (versión fijada por Expo) en móvil. Un componente `Icon` por plataforma recibe el nombre del concepto, no el del icono, y un único mapa en el paquete de tokens asigna el icono de Lucide a cada concepto (inicio, movimientos, transferir, beneficiarios, cerrar sesión, entrada, salida, depósito, traspaso propio, éxito, error, aviso), para que web y móvil usen el mismo icono.

- **Alternativa descartada: SVG propios en el paquete de tokens.** Más trabajo y React Native igual necesita `react-native-svg`.
- **Alternativa descartada: fuente de iconos (Material Symbols).** Carga de una fuente más y peor nitidez a 16 px.

Los iconos decorativos se ocultan de los lectores de pantalla; los botones solo con icono llevan etiqueta accesible.

### D7. Inventario de componentes v2

| Componente | Web | Móvil | Accesibilidad |
|---|---|---|---|
| `TabBar` | `nav` fija abajo, solo en forma de app | pestañas de expo-router con barra propia | pestaña actual con `aria-current="page"` / `accessibilityState.selected` |
| `SideNav` | navegación lateral del *dashboard* | — | `nav` con `aria-label`, `aria-current` |
| `TopBar` | título y acción principal | — | `h1` de la página |
| `AppHeader` | saludo y avatar (forma de app) | saludo y avatar | el avatar es un botón con etiqueta "Menú de la cuenta" |
| `BalanceHero` | saldo total, chip del límite disponible, acciones rápidas | igual | el monto se anuncia completo aunque los centavos vayan en otro tamaño |
| `QuickActions` | botones redondos con icono y texto | igual | texto visible, no solo icono |
| `ListSection` | lista con encabezados por día | igual | encabezados de sección reales |
| `Avatar` / `Icon` | iniciales o icono en círculo tintado | igual | decorativos ocultos |
| `BottomSheet` | `dialog` modal en teléfono, panel en escritorio | hoja con `Modal` | foco atrapado, Escape / atrás cierra |
| `Stepper` | pasos del flujo | igual | "Paso 2 de 5" anunciado |

Los 14 componentes vigentes se reestilan conservando su API pública; donde una API tenga que cambiar, se documenta aquí y en la tarea que la cambia.

### D8. Flujo de transferencia unificado

Web y móvil siguen los mismos pasos: **Destinatario → Monto y concepto → Revisión → Código (si aplica) → Comprobante**. En la web, el paso de destinatario ofrece las cuentas propias y los beneficiarios (las transferencias entre cuentas propias siguen siendo solo de la web); en móvil, solo beneficiarios. El monto es el protagonista del paso 2 (campo grande centrado). En escritorio el flujo va en un panel central con el resumen en vivo al lado.

Todos los comportamientos vigentes se conservan: una sola transferencia por intento con la misma llave de idempotencia, validación igual, OTP, reintento ante pérdida de red en móvil, estados incierto y rechazado, y mensajes por código (WEB-16 a WEB-19, MOB-08 a MOB-14).

- **Alternativa descartada: conservar el formulario único de la web.** No coincide con la app en teléfono y es la pantalla que más mira quien revisa.

### D9. Inicio y Movimientos

- **Inicio:** las tarjetas de cuenta funcionan como selector (la seleccionada lleva el anillo de selección que hoy no usa ninguna pantalla); debajo, los últimos 5 movimientos de la cuenta seleccionada y "Ver todos", que abre Movimientos con esa cuenta. Se usa el mismo endpoint de movimientos con `limit=5`.
- **Movimientos:** selector de cuenta (control segmentado con dos cuentas) y la lista agrupada por día. Móvil conserva los últimos 20 movimientos (MOB-06); la web conserva filtros y paginación (WEB-14), en una hoja inferior en teléfono y en un panel lateral en escritorio.

### D10. Verificación

- Pruebas de componentes nuevos (barra de pestañas, navegación lateral, hoja inferior, indicador de pasos, agrupación por día) con títulos que empiezan con su ID; las pruebas vigentes se actualizan donde cambie el marcado, sin perder casos.
- `vitest-axe` en las pantallas web y pruebas de accesibilidad de React Native Testing Library en móvil.
- Contraste: las pruebas del paquete de tokens incluyen los pares nuevos (`text.onHeroMuted`, lima sobre `surface.hero`).
- Paridad: el lienzo de paridad (D3) captura las parejas a 390×844 y reporta las diferencias; se corre antes de cada revisión y antes de integrar.

## Risks / Trade-offs

- **Alcance:** es un rediseño completo de dos clientes. → El prototipo vive en una rama y se puede descartar sin tocar `main`; la fase de aplicación empieza solo con la aprobación visual.
- **Paridad sobre react-native-web, no sobre el dispositivo.** → Son los mismos componentes y el mismo tema; la verificación en Expo Go sigue siendo la del change `mobile-app`.
- **CSS estático en los lienzos de la web:** las clases nuevas deben existir en el CSS compilado de design-sync. → Se agregan al safelist de `.design-sync/tailwind.css` cuando el prototipo las use.
- **Requisitos que se sustituyen sin `MODIFIED`.** → Cada requisito nuevo nombra al que amplía o sustituye; al archivar `web-app`, `mobile-app` y `design-system` se puede consolidar.
- **Versiones de Lucide con React Native 0.86 y React 19.2.** → Se fijan las versiones que funcionan en el prototipo y se registran aquí.

## Open Questions

Ninguna. Las preguntas abiertas se cerraron en el prototipo, que el usuario aprobó el 2026-10-14 (tarea 5.4); los valores quedan en la sección siguiente.

## Valores y decisiones cerrados en el prototipo

**Tokens (paquete 1.1.0, aditivo):**

- `text.onHeroMuted` = `#BFCDCA` (`green200`), 6.00:1 sobre `surface.hero`.
- `elevation.raised` = `0 4px 12px rgb(0 26 5 / 0.08), 0 1px 3px rgb(0 26 5 / 0.1)` en CSS. En React Native: sombra `#001A05`, opacidad 0.12, radio 12, desplazamiento (0, 4) y `elevation` 4.
- `elevation.sheet` = `0 -8px 24px rgb(0 26 5 / 0.12)` en CSS. En React Native: sombra `#001A05`, opacidad 0.12, radio 24, desplazamiento (0, −8) y `elevation` 16.
- Ningún token vigente cambió de valor, así que el paquete sigue en la línea 1.x.

**Iconos (Lucide 1.48.0):** `lucide-react` en web y `lucide-react-native` con `react-native-svg` 15.15.4 en móvil. Cada concepto usa este icono:

| Concepto | Icono | Concepto | Icono |
|---|---|---|---|
| inicio | `House` | movimientos | `ReceiptText` |
| transferir | `Send` | beneficiarios | `Users` |
| cerrar sesión | `LogOut` | entrada | `ArrowDownLeft` |
| salida | `ArrowUpRight` | depósito | `Landmark` |
| traspaso propio | `Repeat2` | éxito | `CircleCheck` |
| error | `CircleAlert` | aviso | `TriangleAlert` |

Conceptos de interfaz agregados en el prototipo:

| Concepto | Icono | Concepto | Icono |
|---|---|---|---|
| información | `Info` | cerrar | `X` |
| atrás | `ChevronLeft` | adelante | `ChevronRight` |
| desplegar | `ChevronDown` | filtros | `SlidersHorizontal` |
| cuenta | `UserRound` | | |

**Resplandor del *hero*:** es un círculo de 192 px (`spacing[16] × 3`) desplazado 64 px hacia arriba y a la derecha, fuera de la esquina superior derecha. Lleva un degradado radial de `accent.onDark`, del 35 % de opacidad en el centro a transparente en el 70 % del radio. En la web es un `radial-gradient` con `color-mix`; en móvil es un `RadialGradient` de `react-native-svg`. En ambos casos es decorativo y se oculta a los lectores de pantalla.

**Decisiones de detalle que cambian lo escrito arriba:**

- **Un solo `h1` por página en todos los anchos.** En la forma de app es el saludo del `AppHeader` ("Hola, Ana"); en el *dashboard*, el título de la `TopBar`; dentro del flujo, el título del `FlowHeader`, y en ese modo no se muestra la `TopBar`. Ajusta D7, donde la `TopBar` era siempre el `h1`.
- **Monto protagonista.** El "$" y el monto forman una sola unidad centrada. El ancho del campo se mide con un espejo oculto del texto, en web y en móvil, porque los dígitos de Work Sans son proporcionales.
- **Selección de cuenta (D9).** La tarjeta seleccionada lleva un borde interior de 2 px en lugar de un anillo, para que la tarjeta conserve su altura. En la web, toda la tarjeta es el área de selección: el botón con el nombre sigue dentro del `h3` y su pseudo-elemento cubre la tarjeta. "Mostrar CLABE" queda encima con su propia área de 44 px, sin que las áreas se encimen.
- **Funciones propias que se conservan (D3).**
  - La web mantiene "Mostrar CLABE" en las tarjetas, la cuarta pestaña Beneficiarios, la fila de filtros de Movimientos y las cuentas propias en el paso de destinatario.
  - El texto de ayuda del monto es propio de cada app ("por ejemplo 1,250.50" en la web, "sin comas" en móvil) porque describe cómo lee cada una el monto. Concepto y Referencia usan el texto de móvil ("De 1 a 40 caracteres", "De 1 a 7 dígitos") en ambas.
  - El `Select` de la web es nativo: cerrado se ve igual que el de móvil, y al abrirse usa el selector del sistema.
- **Espaciado de la forma de app.** El contenido de las pestañas empieza 36 px bajo el encabezado, en web y en móvil. En móvil, la pantalla no reserva el alto de la barra de pestañas, que es hermana de la pantalla y no la tapa.
- **Comprobante.** No lleva título visible: el encabezado es solo para lectores de pantalla. Muestra la cuenta de origen como "Principal · •••• 9719" en ambas plataformas. El icono sigue el tono del estado: éxito si se completó y error si falló o se rechazó.
- **Paridad medida.** Las 15 parejas de pantallas web y móvil a 390×844 salen idénticas, con diferencias solo de suavizado o con diferencias por diseño. La tabla está en `web/.design-sync/NOTES.md`, sección "Paridad".
