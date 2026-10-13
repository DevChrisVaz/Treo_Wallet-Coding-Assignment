## Purpose

Define las cuentas de la billetera: cuentas de usuario y la cuenta de sistema "Tesorería", su apertura, la CLABE que identifica a cada cuenta de usuario y las garantías que la base de datos impone sobre ellas.

## ADDED Requirements

### Requirement: ACC-01 Cuentas de usuario y cuenta de sistema
El sistema SHALL distinguir dos tipos de cuenta: `USER`, que pertenece exactamente a un usuario, y `SYSTEM`, que no pertenece a ningún usuario. MUST existir exactamente una cuenta `SYSTEM` llamada "Tesorería", creada por las migraciones y no por un endpoint. La base de datos MUST garantizar que una cuenta `USER` siempre tiene dueño y que una cuenta `SYSTEM` nunca lo tiene.

#### Scenario: Tesorería creada por migraciones
- **WHEN** se aplican las migraciones sobre una base vacía
- **THEN** existe exactamente una cuenta `SYSTEM` llamada "Tesorería" sin dueño

#### Scenario: Cuenta de usuario sin dueño
- **WHEN** se intenta insertar una cuenta `USER` sin dueño directamente en la base
- **THEN** la base de datos rechaza la inserción

### Requirement: ACC-02 Saldo no negativo garantizado por la base
Cada cuenta SHALL tener un saldo en centavos, entero, que empieza en 0. La base de datos MUST rechazar cualquier escritura que deje negativo el saldo de una cuenta `USER`; solo la cuenta `SYSTEM` MUST poder tener saldo negativo, porque su negativo representa el dinero emitido hacia las cuentas de usuario.

#### Scenario: Saldo negativo en una cuenta de usuario
- **WHEN** se intenta actualizar directamente en la base el saldo de una cuenta `USER` a -1 centavo
- **THEN** la base de datos rechaza la escritura

#### Scenario: Saldo negativo en la Tesorería
- **WHEN** se actualiza el saldo de la Tesorería a un valor negativo
- **THEN** la base de datos acepta la escritura

### Requirement: ACC-03 CLABE de las cuentas de usuario
Cada cuenta `USER` SHALL tener una CLABE de 18 dígitos formada por el código de banco configurado, un código de plaza fijo, un número de cuenta de 11 dígitos tomado de una secuencia de la base y el dígito verificador calculado con los pesos 3, 7 y 1. El código de banco MUST ser ficticio, es decir, no corresponder a ningún banco real, y MUST venir de la configuración. La CLABE MUST ser única en todo el sistema, y la base de datos MUST garantizar que las cuentas `USER` tienen CLABE y la cuenta `SYSTEM` no la tiene.

#### Scenario: CLABE generada para una cuenta nueva
- **WHEN** se abre una cuenta de usuario
- **THEN** su CLABE tiene 18 dígitos, empieza con el código de banco configurado y su último dígito es el dígito verificador correcto

#### Scenario: CLABE única
- **WHEN** se abren dos cuentas de usuario
- **THEN** sus CLABE son distintas

#### Scenario: La Tesorería no tiene CLABE
- **WHEN** se consulta la cuenta `SYSTEM`
- **THEN** su CLABE es nula

### Requirement: ACC-04 Apertura de cuentas al verificar el correo
Al verificar su correo (IDN-06), el usuario SHALL recibir exactamente dos cuentas `USER`, "Principal" y "Ahorro", con saldo 0.00, abiertas en la misma transacción que la verificación. Un usuario sin verificar MUST NOT tener cuentas, y el nombre de cada cuenta MUST ser único entre las cuentas de su dueño, de modo que ninguna repetición de la verificación pueda abrir cuentas adicionales.

#### Scenario: Cuentas abiertas al verificar
- **WHEN** un usuario verifica su correo
- **THEN** tiene exactamente dos cuentas, "Principal" y "Ahorro", con saldo 0

#### Scenario: Usuario sin verificar
- **WHEN** un usuario se registra y aún no verifica su correo
- **THEN** no tiene ninguna cuenta

#### Scenario: Verificación repetida
- **WHEN** se intenta verificar de nuevo a un usuario ya verificado
- **THEN** el usuario sigue teniendo exactamente dos cuentas

### Requirement: ACC-05 Dígito verificador de la CLABE validado en la base
La base de datos SHALL ofrecer una validación de CLABE que acepte solo cadenas de exactamente 18 dígitos cuyo último dígito sea el verificador correcto: la suma de cada uno de los primeros 17 dígitos multiplicado por su peso (3, 7, 1 repetidos), tomando cada producto módulo 10; el verificador es 10 menos esa suma módulo 10, y 0 cuando el resultado es 10. Toda columna que guarde una CLABE MUST usar esa validación en una constraint de verificación, y la validación de la base y la de la aplicación MUST probarse con los mismos vectores.

#### Scenario: Vector conocido válido
- **WHEN** se valida la CLABE `032180000118359719`
- **THEN** la validación la acepta

#### Scenario: Dígito verificador incorrecto
- **WHEN** se intenta guardar la CLABE `032180000118359718`
- **THEN** la base de datos rechaza la escritura

#### Scenario: Suma múltiplo de 10
- **WHEN** se valida una CLABE cuyos primeros 17 dígitos producen una suma ponderada múltiplo de 10
- **THEN** la validación acepta el dígito verificador 0 y rechaza cualquier otro

#### Scenario: Ceros a la izquierda conservados
- **WHEN** se guarda una CLABE que empieza con `0`
- **THEN** al leerla conserva sus 18 caracteres, incluido el cero inicial

### Requirement: ACC-06 Propiedad de las cuentas
Cada cuenta `USER` SHALL estar ligada a su dueño por una llave foránea, y toda consulta que la API haga sobre cuentas en nombre de un usuario MUST filtrar por ese dueño. Una cuenta que no existe y una cuenta de otro usuario MUST producir la misma respuesta `404 NOT_FOUND`.

#### Scenario: Cuenta de otro usuario
- **WHEN** un usuario solicita una cuenta que pertenece a otro usuario
- **THEN** la API responde `404 NOT_FOUND`, igual que con un id inexistente
