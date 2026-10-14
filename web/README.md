# TreoWallet · web

## Verificaciones manuales

Lo que las pruebas automáticas no pueden comprobar en jsdom se verificó en un navegador real (Chrome, con el MCP de Chrome DevTools) el 13 de octubre de 2026.

**Entorno.** Build de producción (`npm run build` y `next start -p 3100`, sin el overlay de desarrollo de Next.js, que captura el foco en `next dev`) con `SESSION_COOKIE_SECURE=false`. La API real no estaba disponible: se usó una API simulada en el puerto 4100 con las rutas, los cuerpos y los códigos de `contract/openapi.yaml` (no se versiona). **Pendiente: repetir ambas verificaciones contra la API real.**

### Transferencia solo con teclado (WEB-23)

Con Tab, Shift+Tab, Enter, Espacio y las flechas, sin ratón:

| Paso                                                                                                                                               | Resultado                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Abrir `/transfers/new` sin sesión                                                                                                                  | Redirige a `/login?next=%2Ftransfers%2Fnew`                                                                                      |
| Tab desde el inicio de la página                                                                                                                   | El primer foco es "Saltar al contenido", visible, con el anillo de 2 px `#1C4B42` y 2 px de separación; Enter lleva al contenido |
| Correo, Tab, contraseña, Enter                                                                                                                     | Inicia sesión y vuelve a `/transfers/new`                                                                                        |
| Cuenta de origen (flecha abajo), Tab al destino "Un beneficiario", Tab al beneficiario (flecha abajo), monto `15,000`, concepto, referencia, Enter | Pasa a la confirmación; el foco queda en "Confirma la transferencia" y el resumen muestra $15,000.00                             |
| Tab a "Enviar", Espacio                                                                                                                            | Pasa al código; el foco queda en "Ingresa el código", con el destino enmascarado y la hora de expiración                         |
| Código incorrecto, Enter                                                                                                                           | La alerta "El código no es correcto. Te quedan 2 intentos." recibe el foco                                                       |
| Tab al código, código correcto, Enter                                                                                                              | Comprobante "Completada"; el foco queda en "Transferencia enviada"                                                               |
| Volver al resumen                                                                                                                                  | Saldo de Principal en $10,000.00 y "Te quedan $23,000.00 hoy": las cuentas se volvieron a consultar                              |

En todos los pasos el foco fue visible. Observaciones:

- Tras una navegación del lado del cliente el foco queda en el documento: el siguiente Tab va al primer enlace de la navegación y Shift+Tab llega a "Saltar al contenido".
- Durante la verificación la sesión superó los 15 minutos de inactividad: al pulsar "Enviar", la web llevó a `/login?next=%2Ftransfers%2Fnew&reason=expired` con "Tu sesión expiró" y la API no recibió la creación (WEB-03). Con la cookie de una sesión que ya no existía, el layout pasó por `/bff/session/expired`, que borró la cookie.
- La cookie `sid` no es visible para JavaScript (`document.cookie` vacío) y ni el HTML ni el almacenamiento del navegador contienen tokens (WEB-01).

### Contraste y accesibilidad con Lighthouse (WEB-23)

Categoría de accesibilidad de Lighthouse, que incluye `color-contrast`. En modo _snapshot_ la auditoría se hizo después de cargar los datos o de enviar el formulario vacío, con los errores a la vista.

| Pantalla                                            | Modo                            | Dispositivo | Accesibilidad |
| --------------------------------------------------- | ------------------------------- | ----------- | ------------- |
| `/login?reason=expired`                             | navegación                      | móvil       | 100           |
| `/register` con errores en los seis campos          | snapshot                        | móvil       | 100           |
| `/` (resumen)                                       | navegación y snapshot con datos | escritorio  | 100           |
| `/transfers/new` con errores en cinco campos        | snapshot                        | escritorio  | 100           |
| `/beneficiaries/new` con errores en los tres campos | snapshot                        | escritorio  | 100           |
| `/accounts/{id}/movements` con 20 movimientos       | snapshot                        | móvil       | 100           |

`color-contrast` pasó en todas, sin auditorías fallidas.
