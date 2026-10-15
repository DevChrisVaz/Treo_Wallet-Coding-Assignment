## ADDED Requirements

### Requirement: WEB-41 Icono de la aplicación
La web SHALL servir un icono de la aplicación: el monograma "T" de TreoWallet en blanco sobre un cuadrado redondeado del color de acción de la marca, en SVG y en `/favicon.ico`. Cada página SHALL declararlo para el navegador. La petición de `/favicon.ico` MUST responder `200` con una imagen, sin sesión y sin pasar por la lógica de las páginas, y las rutas del icono MUST llevar los headers de seguridad de WEB-38 y cargar bajo la política de WEB-39. Ninguna pantalla pública ni autenticada MUST registrar en la consola un recurso que no cargó.

#### Scenario: Favicon sin sesión
- **WHEN** el navegador pide `/favicon.ico` sin haber iniciado sesión
- **THEN** la respuesta es `200` con un tipo de imagen
- **AND** lleva los headers de WEB-38

#### Scenario: Icono declarado en la página
- **WHEN** se abre cualquier página
- **THEN** su `<head>` declara el icono SVG y el `favicon.ico`
- **AND** el navegador carga el SVG sin violar la política de contenido

#### Scenario: Consola limpia
- **WHEN** el navegador recorre las pantallas públicas y las autenticadas
- **THEN** la consola no registra ningún recurso que haya fallado al cargar
