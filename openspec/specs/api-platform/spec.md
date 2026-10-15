# api-platform Specification

## Purpose

Define el comportamiento transversal de la API de la billetera: formato de errores, trazabilidad de peticiones, logs con datos sensibles enmascarados, configuración segura, límites de tasa, documentación navegable, entorno local reproducible, roles de base de datos de privilegio mínimo e integración continua.

## Requirements

### Requirement: PLT-01 Formato de errores RFC 9457
La API SHALL responder todo error con `Content-Type: application/problem+json` y un cuerpo que cumpla RFC 9457 (compatible con RFC 7807) con los campos `type`, `title`, `status`, `code` y `requestId`, más `detail` e `instance` cuando aplique. El campo `code` MUST pertenecer al catálogo cerrado `ProblemCode` de `contract/openapi.yaml`, y `title` y `detail` MUST estar en español. Las extensiones específicas (`errors`, `transferId`, `transferStatus`, `remaining`, `attemptsRemaining`) MUST usarse solo en los códigos que el contrato indica.

#### Scenario: Error de negocio con código del catálogo
- **WHEN** una operación falla por una regla de negocio
- **THEN** la respuesta tiene `Content-Type: application/problem+json`
- **AND** el cuerpo incluye `type`, `title`, `status`, `code` y `requestId`
- **AND** `status` coincide con el código HTTP de la respuesta
- **AND** `code` es uno de los valores de `ProblemCode`

#### Scenario: Ruta inexistente
- **WHEN** un cliente llama a una ruta que no existe en el contrato
- **THEN** la API responde `404` con `code` igual a `NOT_FOUND` en formato problem+json

### Requirement: PLT-02 Validación de entrada contra el contrato
La API SHALL validar cada cuerpo, parámetro y header de entrada antes de ejecutar cualquier lógica de negocio. Un cuerpo que no es JSON válido MUST responder `400 MALFORMED_REQUEST`. Una entrada que no cumple el schema (campos faltantes, formato inválido, campos no declarados) MUST responder `422 VALIDATION_FAILED` con `errors[]`, donde cada elemento indica el campo con un JSON Pointer (`pointer`), un `code` y un `message`.

#### Scenario: JSON mal formado
- **WHEN** un cliente envía un cuerpo que no es JSON válido
- **THEN** la API responde `400` con `code` igual a `MALFORMED_REQUEST`

#### Scenario: Campo inválido señalado con JSON Pointer
- **WHEN** un cliente envía `{"email": "no-es-correo", "password": "x"}` a `POST /auth/login`
- **THEN** la API responde `422` con `code` igual a `VALIDATION_FAILED`
- **AND** `errors` contiene un elemento con `pointer` igual a `/email`

#### Scenario: Campo no declarado
- **WHEN** un cliente envía un campo que el schema del contrato no declara
- **THEN** la API responde `422 VALIDATION_FAILED` con el `pointer` de ese campo

### Requirement: PLT-03 Errores internos sin detalles
Ante cualquier error no previsto, la API SHALL responder `500` con `code` igual a `INTERNAL_ERROR` y MUST NOT incluir en la respuesta trazas de pila, sentencias SQL, nombres de tablas o constraints, mensajes de librerías ni rutas de archivos. El detalle completo MUST quedar solo en el log, asociado al `requestId`.

#### Scenario: Excepción inesperada
- **WHEN** un handler lanza una excepción no controlada
- **THEN** la respuesta es `500` con `code` igual a `INTERNAL_ERROR` y el `requestId`
- **AND** el cuerpo no contiene la traza de pila ni el mensaje original de la excepción
- **AND** el log de la petición contiene la traza completa con el mismo `requestId`

### Requirement: PLT-04 Traducción de errores de integridad por nombre de constraint
Toda constraint e índice del esquema MUST tener un nombre explícito con prefijo `pk_`, `fk_`, `uq_`, `ck_`, `ix_` o `tg_` (para triggers). La API SHALL traducir las violaciones de integridad de PostgreSQL a códigos del catálogo usando únicamente el nombre de la constraint, nunca el texto del mensaje. Una violación de una constraint sin traducción conocida MUST responder `500 INTERNAL_ERROR`. Los errores de interbloqueo (`40P01`), serialización (`40001`) y permiso denegado (`42501`) MUST responder `500 INTERNAL_ERROR` y registrarse en el log con nivel de error.

#### Scenario: Todas las constraints tienen nombre con prefijo
- **WHEN** se consulta el catálogo de PostgreSQL después de aplicar todas las migraciones
- **THEN** cada constraint e índice del esquema de la aplicación tiene un nombre que empieza con uno de los prefijos permitidos

#### Scenario: Violación de unicidad traducida por nombre
- **WHEN** una operación viola una constraint única que tiene traducción registrada
- **THEN** la API responde con el código del catálogo asociado a ese nombre de constraint
- **AND** la respuesta no contiene el nombre de la constraint

#### Scenario: Permiso denegado
- **WHEN** el rol de ejecución intenta una operación para la que no tiene privilegio
- **THEN** la API responde `500 INTERNAL_ERROR`
- **AND** el log registra el evento con nivel de error

### Requirement: PLT-05 Identificador de petición
La API SHALL asignar a cada petición un identificador. Si la petición trae el header `X-Request-Id` con un valor de 1 a 64 caracteres del conjunto `[A-Za-z0-9_-]`, MUST reutilizarlo; en cualquier otro caso MUST generar uno nuevo. El identificador MUST devolverse en el header `X-Request-Id` de toda respuesta, en el campo `requestId` de todo error y en cada línea de log de esa petición.

#### Scenario: Reutiliza el identificador del cliente
- **WHEN** una petición trae `X-Request-Id: bff-123`
- **THEN** la respuesta trae `X-Request-Id: bff-123`
- **AND** los logs de esa petición contienen `bff-123`

#### Scenario: Identificador inválido o ausente
- **WHEN** una petición no trae `X-Request-Id` o trae uno con caracteres fuera del conjunto permitido
- **THEN** la API genera un identificador nuevo y lo devuelve en la respuesta

### Requirement: PLT-06 Logs estructurados con datos sensibles enmascarados
La API SHALL emitir logs en JSON, una línea por evento, con nivel, timestamp, `requestId` y, cuando haya sesión, el id del usuario. Cada petición MUST registrar método, ruta, status y duración. Los logs MUST NOT contener en claro contraseñas, tokens de acceso o de refresco, el header `Authorization`, códigos de un solo uso, email, teléfono, CURP, RFC ni CLABE completas: los secretos MUST reemplazarse por un marcador fijo y los datos personales MUST enmascararse dejando visible solo un fragmento (por ejemplo, los últimos 4 dígitos de la CLABE).

#### Scenario: Línea de log de una petición
- **WHEN** termina una petición
- **THEN** se emite una línea JSON con `requestId`, método, ruta, status y duración

#### Scenario: Secretos y datos personales enmascarados
- **WHEN** se procesa un registro con contraseña, CURP, RFC, teléfono y email
- **THEN** ninguna línea de log de esa petición contiene esos valores en claro
- **AND** la contraseña aparece solo como marcador fijo

#### Scenario: Header de autorización
- **WHEN** una petición autenticada se registra en el log
- **THEN** el valor del header `Authorization` no aparece en claro

### Requirement: PLT-07 IP del cliente solo desde proxies de confianza
La API SHALL determinar la IP del cliente a partir de `X-Forwarded-For` únicamente cuando la conexión proviene de un proxy configurado como de confianza (el BFF de la web o el balanceador). En cualquier otro caso MUST usar la dirección de la conexión e ignorar `X-Forwarded-For`. Esa IP MUST ser la que usan el rate limiting y la auditoría.

#### Scenario: Header falsificado desde un cliente directo
- **WHEN** un cliente que no es un proxy de confianza envía `X-Forwarded-For: 1.2.3.4`
- **THEN** la API usa la dirección de la conexión como IP del cliente

#### Scenario: Petición reenviada por el BFF
- **WHEN** el BFF, configurado como proxy de confianza, reenvía una petición con `X-Forwarded-For` con la IP del navegador
- **THEN** el rate limiting y la auditoría usan la IP del navegador

### Requirement: PLT-08 Configuración validada al arrancar
La API SHALL validar toda su configuración al arrancar y MUST negarse a iniciar, con un mensaje que nombre la variable problemática sin revelar su valor, si falta una variable obligatoria o si tiene un valor inválido. El secreto de firma de tokens MUST tener al menos 256 bits, el código de banco de las CLABE MUST tener 3 dígitos y la conexión de ejecución MUST usar el rol de ejecución, no el dueño del esquema.

#### Scenario: Secreto de tokens demasiado corto
- **WHEN** la API arranca con un secreto de firma de menos de 256 bits
- **THEN** el proceso termina con error antes de aceptar peticiones
- **AND** el mensaje nombra la variable pero no muestra su valor

#### Scenario: Variable obligatoria ausente
- **WHEN** falta la cadena de conexión a la base de datos
- **THEN** el proceso termina con error antes de aceptar peticiones

### Requirement: PLT-09 Límites de tasa
La API SHALL aplicar límites de tasa por ventana de tiempo a los endpoints que la especificación indica, contando por la IP del cliente (PLT-07) y, cuando el requisito lo pida, por la combinación de IP y otro dato. Al superar un límite MUST responder `429` con `code` igual a `RATE_LIMITED` y el header `Retry-After` en segundos. Los límites MUST NOT bloquear la cuenta de un usuario: solo frenan a quien excede la tasa.

#### Scenario: Límite superado
- **WHEN** un cliente supera el número de peticiones permitido en la ventana de un endpoint
- **THEN** la API responde `429 RATE_LIMITED` con `Retry-After`

#### Scenario: La ventana se reinicia
- **WHEN** pasa el tiempo indicado en `Retry-After`
- **THEN** el mismo cliente puede volver a llamar al endpoint

### Requirement: PLT-10 Salud del servicio
La API SHALL exponer `GET /health` sin autenticación, que MUST responder `200` con `{"status": "ok"}` cuando el proceso está listo para atender peticiones.

#### Scenario: Servicio disponible
- **WHEN** se llama a `GET /health` sin token
- **THEN** la respuesta es `200` con `{"status": "ok"}`

### Requirement: PLT-11 Documentación navegable del contrato
Fuera de producción, la API SHALL servir la documentación navegable del contrato en `GET /docs` y el contrato en `GET /openapi.yaml`, tomados del paquete del contrato y sin copias locales. En producción ambas rutas MUST responder `404`.

#### Scenario: Documentación en desarrollo
- **WHEN** la API corre fuera de producción y se abre `GET /docs`
- **THEN** se muestra la documentación navegable de todas las operaciones del contrato

#### Scenario: Documentación deshabilitada en producción
- **WHEN** la API corre en producción y se llama a `GET /docs` o `GET /openapi.yaml`
- **THEN** la respuesta es `404`

### Requirement: PLT-12 Conformidad de las respuestas con el contrato
Cada respuesta de la API, exitosa o de error, MUST cumplir el schema que `contract/openapi.yaml` declara para esa operación y ese código de estado. Las pruebas de integración SHALL validar automáticamente cada respuesta que obtienen contra el contrato y fallar ante cualquier desviación.

#### Scenario: Respuesta fuera del contrato
- **WHEN** una prueba de integración recibe una respuesta cuyo cuerpo no cumple el schema declarado para ese status
- **THEN** la prueba falla indicando la operación y el campo que no cumple

### Requirement: PLT-13 Entorno local reproducible
El proyecto `/api` SHALL poder levantarse en local siguiendo su README con: un comando que inicia PostgreSQL 15 o superior y un servidor SMTP de desarrollo con bandeja web, `npm run db:bootstrap` (roles y base de datos), `npm run db:migrate`, `npm run db:seed` y `npm run dev`. La bandeja del servidor SMTP de desarrollo MUST conservar los correos al reiniciar los contenedores (en un volumen de Docker que solo se borra a propósito). `npm test` MUST ejecutar las pruebas unitarias y de integración contra un PostgreSQL real.

#### Scenario: Arranque desde cero
- **WHEN** un desarrollador clona el repositorio y ejecuta los comandos del README en orden sobre una base vacía
- **THEN** la API responde `200` en `GET /health`
- **AND** los correos enviados aparecen en la bandeja web del servidor SMTP de desarrollo

#### Scenario: Reinicio de los contenedores
- **WHEN** un desarrollador detiene y vuelve a levantar los contenedores sin borrar sus volúmenes
- **THEN** los correos recibidos antes del reinicio siguen en la bandeja web

### Requirement: PLT-14 Roles de base de datos de privilegio mínimo
La base de datos SHALL tener dos roles: uno dueño del esquema, que ejecuta migraciones y seed, y uno de ejecución, que usa la API. El rol de ejecución MUST NOT ser dueño de ningún objeto, MUST NOT poder crear ni alterar objetos del esquema y MUST tener solo los privilegios que cada migración le otorga explícitamente tabla por tabla. Ninguna tabla MUST otorgarle `DELETE` ni `TRUNCATE`. Los roles MUST crearse con un script de arranque ejecutado por un superusuario, no desde las migraciones, y sus contraseñas MUST venir de variables de entorno.

#### Scenario: El rol de ejecución no puede alterar el esquema
- **WHEN** el rol de ejecución intenta crear o alterar una tabla
- **THEN** PostgreSQL rechaza la operación con `42501`

#### Scenario: Sin DELETE ni TRUNCATE para el rol de ejecución
- **WHEN** se consultan los privilegios del rol de ejecución sobre todas las tablas del esquema
- **THEN** ninguna tabla le otorga `DELETE` ni `TRUNCATE`

### Requirement: PLT-15 Esquema gestionado solo por migraciones reversibles
El esquema SHALL cambiar únicamente mediante migraciones versionadas; la API MUST NOT sincronizar ni modificar el esquema al arrancar. Cada migración MUST tener su reversión, y aplicar todas las migraciones, revertirlas todas y volver a aplicarlas MUST terminar sin errores.

#### Scenario: Ida, vuelta e ida
- **WHEN** sobre una base vacía se aplican todas las migraciones, se revierten todas y se aplican de nuevo
- **THEN** las tres operaciones terminan sin errores

#### Scenario: Migrar dos veces
- **WHEN** se ejecuta `npm run db:migrate` dos veces seguidas
- **THEN** la segunda ejecución no aplica cambios y termina sin errores

### Requirement: PLT-16 Entrega de correo transaccional
La API SHALL enviar los correos transaccionales (códigos de verificación, avisos de registro y, en `api-ledger`, códigos de confirmación de transferencias) por SMTP después de confirmar la transacción de la operación que los origina. Una falla al enviar MUST NOT revertir la operación ya confirmada, MUST registrarse en el log sin exponer el código ni el destinatario completo, y MUST dejar al usuario la posibilidad de pedir un reenvío.

#### Scenario: Servidor de correo caído durante el registro
- **WHEN** un usuario se registra mientras el servidor SMTP no responde
- **THEN** la API responde `202` igual que siempre
- **AND** el usuario queda registrado sin verificar
- **AND** puede pedir el reenvío del código cuando el servidor vuelva

### Requirement: PLT-17 Integración continua del proyecto
El proyecto `/api` SHALL tener su propio pipeline de CI que se ejecute ante cambios en `api/**` o en `contract/**` y que corra lint, verificación de tipos, pruebas unitarias y pruebas de integración contra un PostgreSQL real con los roles creados por el script de arranque. El pipeline MUST fallar si cualquiera de esos pasos falla.

#### Scenario: Cambio en el contrato
- **WHEN** un commit modifica solo archivos de `contract/**`
- **THEN** el pipeline de `/api` se ejecuta

#### Scenario: Prueba de integración fallida
- **WHEN** una prueba de integración falla en el pipeline
- **THEN** el pipeline termina en rojo

### Requirement: PLT-18 Reglas de negocio independientes del transporte HTTP
Las reglas de negocio de la API SHALL vivir fuera de los handlers HTTP y MUST poder ejecutarse y probarse sin levantar el servidor HTTP. Los handlers MUST limitarse a validar la entrada, invocar un caso de uso y traducir su resultado a la respuesta. El código de dominio MUST NOT depender del framework HTTP ni del ORM, y el lint del proyecto MUST fallar si lo hace.

#### Scenario: Caso de uso probado sin HTTP
- **WHEN** se ejecutan las pruebas unitarias de un caso de uso
- **THEN** corren sin iniciar el servidor HTTP

#### Scenario: Dominio que importa el framework
- **WHEN** un archivo de dominio importa el framework HTTP o el ORM
- **THEN** el lint del proyecto falla
