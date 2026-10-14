## ADDED Requirements

### Requirement: WEB-32 Descarga del estado de cuenta
La pantalla de movimientos de una cuenta SHALL ofrecer:
- un selector de mes con el mes en curso, marcado "(en curso)", y los 12 meses anteriores, con el mes anterior seleccionado por defecto;
- un botón "Descargar PDF" que descarga el estado de cuenta de la cuenta y el mes elegidos.

La descarga MUST pasar por el proxy de lecturas del BFF. Su lista blanca SHALL incluir la ruta del estado de cuenta, solo con GET, y el proxy MUST entregar intactos los bytes del PDF junto con `Content-Type` y `Content-Disposition`. Los tokens MUST NOT llegar al navegador (WEB-01).

Mientras se descarga, el botón MUST mostrar que está ocupado y no aceptar otro clic. Si la descarga falla, la pantalla MUST mostrar el mensaje del código de error sin salir de ella; en `RATE_LIMITED`, el mensaje incluye la espera. Amplía WEB-09 y WEB-14.

#### Scenario: Descargar un mes cerrado
- **WHEN** Ana elige "septiembre 2026" en la pantalla de movimientos de "Principal" y pulsa "Descargar PDF"
- **THEN** el BFF pide `getAccountStatement` con el periodo `2026-09`
- **AND** el navegador recibe un `application/pdf` con el nombre `estado-de-cuenta-2026-09-0015.pdf`

#### Scenario: Opciones del selector
- **WHEN** Ana abre la pantalla de movimientos el 14 de octubre de 2026
- **THEN** el selector ofrece "octubre 2026 (en curso)" y los meses de octubre de 2025 a septiembre de 2026
- **AND** "septiembre 2026" está seleccionado

#### Scenario: Doble clic en Descargar
- **WHEN** Ana hace doble clic en "Descargar PDF"
- **THEN** el BFF recibe una sola petición del estado de cuenta

#### Scenario: Demasiadas descargas
- **WHEN** la API responde 429 `RATE_LIMITED` con `Retry-After: 60`
- **THEN** la pantalla muestra el mensaje de `RATE_LIMITED` con la espera y sigue mostrando los movimientos

#### Scenario: Bytes intactos
- **WHEN** el proxy entrega un estado de cuenta
- **THEN** los bytes que recibe el navegador son idénticos a los que respondió la API

#### Scenario: Ruta binaria fuera de la lista blanca
- **WHEN** el navegador pide por GET `accounts/<id>/statements/2026-09/extra`
- **THEN** la web responde `404` y la API no recibe ninguna llamada
