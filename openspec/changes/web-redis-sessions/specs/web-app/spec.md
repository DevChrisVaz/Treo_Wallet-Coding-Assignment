## ADDED Requirements

### Requirement: WEB-37 Sesión que sobrevive al reinicio del servidor web
Cuando la web tenga configurado un almacén de sesiones externo, la sesión SHALL sobrevivir al reinicio del proceso del servidor web: la misma cookie MUST seguir identificando la sesión, con su access y su refresh token, sin pedir de nuevo el inicio de sesión. El almacén externo MUST aplicar la misma expiración que WEB-03 (inactividad y vigencia absoluta). Renovar el plazo de inactividad MUST NOT reemplazar los tokens que guarde al mismo tiempo una renovación (WEB-04) ni volver a crear una sesión que ya expiró o se cerró. Si el almacén externo no responde, la web MUST responder con un error del servidor sin cerrar la sesión ni usar otro almacén. Sin almacén externo configurado, la web SHALL guardar las sesiones en la memoria del proceso.

#### Scenario: Reinicio del servidor con la sesión activa
- **WHEN** el usuario inicia sesión, el servidor web se reinicia y el usuario abre sus cuentas antes de 15 minutos
- **THEN** la web muestra sus cuentas sin pedirle iniciar sesión

#### Scenario: Inactividad con el almacén externo
- **WHEN** pasan más de 15 minutos sin peticiones del usuario
- **THEN** la sesión ya no está en el almacén externo y el usuario vuelve al inicio de sesión como en WEB-03

#### Scenario: Renovación del plazo durante una renovación de tokens
- **WHEN** una petición renueva el plazo de inactividad mientras otra guarda el par de tokens renovado
- **THEN** la sesión conserva el par de tokens renovado

#### Scenario: Renovación del plazo de una sesión cerrada
- **WHEN** una petición renueva el plazo de inactividad de una sesión que el usuario acaba de cerrar
- **THEN** la sesión no vuelve a existir en el almacén externo

#### Scenario: Almacén externo caído
- **WHEN** el almacén externo no responde al abrir una pantalla con sesión
- **THEN** la petición termina con un error del servidor en vez de quedarse esperando
- **AND** la cookie de sesión se conserva para cuando el almacén vuelva

#### Scenario: Sin almacén externo
- **WHEN** la web arranca sin almacén externo configurado
- **THEN** las sesiones se guardan en la memoria del proceso, como en WEB-03
