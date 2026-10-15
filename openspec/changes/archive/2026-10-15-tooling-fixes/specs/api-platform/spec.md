## MODIFIED Requirements

### Requirement: PLT-14 Roles de base de datos de privilegio mínimo
La base de datos SHALL tener dos roles: uno dueño del esquema, que ejecuta migraciones y seed, y uno de ejecución, que usa la API. El rol de ejecución MUST NOT ser dueño de ningún objeto, MUST NOT poder crear ni alterar objetos del esquema y MUST tener solo los privilegios que cada migración le otorga explícitamente tabla por tabla. Ninguna tabla MUST otorgarle `DELETE` ni `TRUNCATE`. Los roles MUST crearse con un script de arranque ejecutado por un superusuario, no desde las migraciones, y sus contraseñas MUST venir de variables de entorno. El script de arranque MUST ejecutarse únicamente en el servidor que indica la URL del superusuario: si no puede garantizarlo, MUST terminar con un error que diga qué URL y qué servicio no coinciden, sin ejecutar nada, y MUST NOT pasar las contraseñas como argumentos del proceso.

#### Scenario: El rol de ejecución no puede alterar el esquema
- **WHEN** el rol de ejecución intenta crear o alterar una tabla
- **THEN** PostgreSQL rechaza la operación con `42501`

#### Scenario: Sin DELETE ni TRUNCATE para el rol de ejecución
- **WHEN** se consultan los privilegios del rol de ejecución sobre todas las tablas del esquema
- **THEN** ninguna tabla le otorga `DELETE` ni `TRUNCATE`

#### Scenario: Con psql instalado
- **WHEN** se ejecuta el script de arranque en una máquina con `psql`
- **THEN** se conecta a la URL del superusuario, sea cual sea su host y su puerto

#### Scenario: Sin psql y con la URL del contenedor local
- **WHEN** se ejecuta el script de arranque sin `psql`, con una URL en `localhost` cuyo puerto es el que publica el servicio de PostgreSQL de compose
- **THEN** el script se ejecuta dentro de ese contenedor

#### Scenario: Sin psql y con un puerto distinto al del contenedor
- **WHEN** se ejecuta el script de arranque sin `psql`, con una URL en `localhost` cuyo puerto no es el que publica el servicio de compose
- **THEN** el script termina con error sin ejecutar nada
- **AND** el mensaje nombra la URL, el puerto que publica compose y qué hacer (instalar `psql` o apuntar la URL a ese puerto)

#### Scenario: Sin psql y con un servidor remoto
- **WHEN** se ejecuta el script de arranque sin `psql`, con una URL cuyo host no es de esta máquina
- **THEN** el script termina con error sin ejecutar nada

#### Scenario: Sin psql y con el servicio de compose apagado
- **WHEN** se ejecuta el script de arranque sin `psql` y el servicio de PostgreSQL de compose no está en marcha
- **THEN** el script termina con error sin ejecutar nada
- **AND** el mensaje dice que hay que levantar compose o instalar `psql`
