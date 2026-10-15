## MODIFIED Requirements

### Requirement: PLT-13 Entorno local reproducible
El proyecto `/api` SHALL poder levantarse en local siguiendo su README con: un comando que inicia PostgreSQL 15 o superior y un servidor SMTP de desarrollo con bandeja web, `npm run db:bootstrap` (roles y base de datos), `npm run db:migrate`, `npm run db:seed` y `npm run dev`. La bandeja del servidor SMTP de desarrollo MUST conservar los correos al reiniciar los contenedores (en un volumen de Docker que solo se borra a propósito). `npm test` MUST ejecutar las pruebas unitarias y de integración contra un PostgreSQL real.

#### Scenario: Arranque desde cero
- **WHEN** un desarrollador clona el repositorio y ejecuta los comandos del README en orden sobre una base vacía
- **THEN** la API responde `200` en `GET /health`
- **AND** los correos enviados aparecen en la bandeja web del servidor SMTP de desarrollo

#### Scenario: Reinicio de los contenedores
- **WHEN** un desarrollador detiene y vuelve a levantar los contenedores sin borrar sus volúmenes
- **THEN** los correos recibidos antes del reinicio siguen en la bandeja web
