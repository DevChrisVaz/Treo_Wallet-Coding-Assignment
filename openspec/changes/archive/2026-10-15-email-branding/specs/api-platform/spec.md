## MODIFIED Requirements

### Requirement: PLT-16 Entrega de correo transaccional
La API SHALL enviar los correos transaccionales (códigos de verificación, avisos de registro, códigos de confirmación de transferencias, avisos de seguridad y comprobantes de transferencias) por SMTP después de confirmar la transacción de la operación que los origina. Una falla al enviar MUST NOT revertir la operación ya confirmada, MUST registrarse en el log sin exponer el código ni el destinatario completo, y MUST dejar al usuario la posibilidad de pedir un reenvío cuando el correo sea un código. Un aviso o un comprobante (IDN-18, IDN-19, BEN-12, TRF-38) MUST NOT cambiar el código, el cuerpo ni los headers de la respuesta de la operación que lo origina, ni retrasarla mientras se envía. El HTML de todos los correos MUST salir de una envoltura común que siga la identidad de TreoWallet (banda de marca con el logotipo de texto, tarjeta sobre el lienzo claro, colores de `design-tokens`, Work Sans con respaldo del sistema, pie "TreoWallet"), con estilos en línea y sin imágenes. Todo texto variable MUST escaparse, y el HTML MUST decir lo mismo que la versión de texto plano.

#### Scenario: Servidor de correo caído durante el registro
- **WHEN** un usuario se registra mientras el servidor SMTP no responde
- **THEN** la API responde `202` igual que siempre
- **AND** el usuario queda registrado sin verificar
- **AND** puede pedir el reenvío del código cuando el servidor vuelva

#### Scenario: Servidor de correo caído durante un inicio de sesión
- **WHEN** un usuario inicia sesión con su contraseña correcta mientras el servidor SMTP no responde
- **THEN** la API responde `200` con los mismos tokens que respondería con el servidor disponible
- **AND** el log registra la falla con el destinatario enmascarado y sin el cuerpo del correo

#### Scenario: Envoltura de marca
- **WHEN** se genera el HTML de cualquier correo transaccional
- **THEN** lleva el logotipo de texto "TreoWallet", el `viewport` móvil y el pie "TreoWallet · Este es un correo automático."
- **AND** no depende de imágenes ni de fuentes web

#### Scenario: Contenido variable escapado
- **WHEN** el nombre, el alias, el concepto o cualquier otro dato de una persona contiene `<` o `&`
- **THEN** el HTML lo muestra escapado, también dentro de las filas, el bloque de código y los recuadros de aviso
