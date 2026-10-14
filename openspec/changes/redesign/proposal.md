## Why

TreoWallet funciona y es accesible, pero se ve plano: todo es blanco sobre blanco, no hay iconos, el saldo no tiene protagonismo y la web es una página de escritorio que en un teléfono solo se estrecha. Para una prueba técnica que evalúa Treo, la interfaz es lo primero que ve quien revisa. Este change rediseña la web y la app móvil para que se sientan como un producto financiero terminado, elevando la marca de Treo (no reemplazándola), y hace que la web en un teléfono sea la misma app que la de Expo.

## What Changes

- **Lenguaje visual elevado** sobre la identidad vigente (verde `#1C4B42`, lima `#B4E717`, Work Sans, píldoras): lienzo cálido `#F6F5F2` con tarjetas blancas elevadas, un *hero* del saldo en verde oscuro con acento lima, lima solo sobre superficies oscuras, radios de 16 px en superficies grandes, iconos de línea y listas de movimientos agrupadas por día.
- **Tokens v2** en `/design-tokens`, aditivos: lienzo de la app, superficies del *hero*, un tamaño de display mayor para el saldo, tamaños de icono y avatar, y tres niveles de elevación. Mayor 2.0.0 solo si un token vigente cambia de significado.
- **Inventario de componentes v2**: barra de pestañas, navegación lateral, barra superior, *hero* del saldo, acciones rápidas, sección de lista con encabezados por día, avatar, icono, hoja inferior e indicador de pasos, en web y en móvil, más el reestilo de los 14 componentes vigentes conservando su API.
- **App móvil**: navegación por pestañas (Inicio, Movimientos, Transferir), Inicio con el *hero* del saldo y los últimos movimientos, Movimientos como pestaña con selector de cuenta, flujo de transferencia con indicador de pasos y pantalla de inicio de sesión de marca.
- **Web responsiva con dos formas**: debajo de 1024 px es la misma app que la de Expo (mismas pestañas, más Beneficiarios); desde 1024 px es un *dashboard* con navegación lateral, barra superior y paneles. Las pantallas que solo existen en la web (registro, verificación, beneficiarios) usan los mismos patrones.
- **Flujo de transferencia unificado**: web y móvil siguen los mismos pasos (destinatario, monto y concepto, revisión, código, comprobante). La web conserva las transferencias entre cuentas propias dentro del paso de destinatario.
- **Proceso en dos fases**: primero un prototipo en una rama aislada que se revisa en los lienzos de design-sync (web de escritorio, web en teléfono y app móvil lado a lado); solo después de la aprobación visual se aplica a las pantallas reales y se integra a `main`.

**Sin cambios:** contrato, API, reglas de negocio, flujos de datos, sesión, textos de error y requisitos de accesibilidad. Todos los requisitos vigentes de `web-app`, `mobile-app` y `design-system` siguen en vigor salvo los aspectos visuales y de navegación que este change sustituye de forma explícita (cada requisito nuevo indica a cuál amplía o sustituye).

**Proyectos que toca:** `/design-tokens`, `/web`, `/mobile` y `/docs`.

**Historias de usuario:** no agrega historias; cambia la presentación de todas las que tienen interfaz (HU1 a HU6).

## Capabilities

### New Capabilities
<!-- Ninguna: los requisitos nuevos pertenecen a design-system, web-app y mobile-app. -->

### Modified Capabilities
- `design-system`: lenguaje visual v2, tokens v2, iconografía e inventario de componentes v2 (DSG-13 a DSG-17).
- `web-app`: layout responsivo con forma de app y de *dashboard*, paridad con la app móvil, navegación, Inicio, Movimientos, flujo de transferencia y pantallas públicas rediseñadas (WEB-24 a WEB-31).
- `mobile-app`: navegación por pestañas, Inicio, Movimientos, flujo de transferencia e inicio de sesión rediseñados (MOB-18 a MOB-22).

Los changes `design-system`, `web-app` y `mobile-app` no están archivados (web y móvil tienen una verificación manual pendiente cada uno), así que sus requisitos aún no están en `openspec/specs/`. Por eso este change agrega requisitos nuevos con IDs nuevos que nombran los requisitos anteriores que amplían o sustituyen, en lugar de deltas `MODIFIED`.

## Impact

- **Código:** tokens y generadores de `/design-tokens`; `web/components/**`, `web/app/**` (layouts y páginas) y sus pruebas; `mobile/src/components/**`, `mobile/src/features/**`, `mobile/src/app/**` (pestañas con expo-router) y sus pruebas.
- **Dependencias nuevas:** iconos Lucide (`lucide-react` en la web; `lucide-react-native` y `react-native-svg`, versión fijada por Expo, en móvil). Licencia ISC.
- **Herramientas locales:** los lienzos de design-sync (`<app>/.design-sync/`) se usan para revisar el prototipo y se agrega un lienzo de paridad web/móvil; no se publican.
- **Claude Design:** los proyectos sincronizados se vuelven a sincronizar al terminar la fase de aplicación.
- **Riesgo de alcance:** es un rediseño completo de dos clientes; el prototipo se puede descartar sin tocar `main` si la dirección no se aprueba.
