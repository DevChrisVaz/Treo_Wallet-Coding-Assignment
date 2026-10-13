-- Arranque de la base de datos (PLT-14). Lo ejecuta un superusuario con psql (`npm run db:bootstrap`).
-- Idempotente: se puede correr cuantas veces haga falta. No crea tablas: eso es de las migraciones.
--
--   wallet_migrator  dueño de las bases wallet y wallet_test y del esquema app; corre migraciones y seed.
--   wallet_app       rol de ejecución de la API; no es dueño de nada y solo recibe los privilegios que
--                    cada migración le otorga tabla por tabla.
--
-- Las contraseñas llegan por variables de entorno (\getenv, psql 15+), nunca en este archivo.

\set ON_ERROR_STOP on

\getenv migrator_password WALLET_MIGRATOR_PASSWORD
\getenv app_password WALLET_APP_PASSWORD

SELECT :'migrator_password' <> '' AND :'app_password' <> '' AS passwords_present \gset
\if :passwords_present
\else
  \echo 'Faltan WALLET_MIGRATOR_PASSWORD o WALLET_APP_PASSWORD'
  \quit 3
\endif

-- Roles ---------------------------------------------------------------------------------------------
SELECT format('CREATE ROLE wallet_migrator LOGIN PASSWORD %L', :'migrator_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wallet_migrator') \gexec
SELECT format('CREATE ROLE wallet_app LOGIN PASSWORD %L', :'app_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wallet_app') \gexec

-- Atributos y contraseñas se reafirman en cada ejecución.
ALTER ROLE wallet_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'migrator_password';
ALTER ROLE wallet_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'app_password';
ALTER ROLE wallet_migrator SET search_path = app;
ALTER ROLE wallet_app SET search_path = app;

-- Bases de datos ------------------------------------------------------------------------------------
SELECT 'CREATE DATABASE wallet OWNER wallet_migrator'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'wallet') \gexec
SELECT 'CREATE DATABASE wallet_test OWNER wallet_migrator'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'wallet_test') \gexec

ALTER DATABASE wallet OWNER TO wallet_migrator;
ALTER DATABASE wallet_test OWNER TO wallet_migrator;
-- PUBLIC pierde CONNECT y TEMP; el rol de ejecución solo puede conectarse.
REVOKE ALL ON DATABASE wallet FROM PUBLIC;
REVOKE ALL ON DATABASE wallet_test FROM PUBLIC;
GRANT CONNECT ON DATABASE wallet TO wallet_app;
GRANT CONNECT ON DATABASE wallet_test TO wallet_app;

-- Esquema app en cada base --------------------------------------------------------------------------
\connect wallet
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION wallet_migrator;
ALTER SCHEMA app OWNER TO wallet_migrator;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO wallet_app;

\connect wallet_test
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION wallet_migrator;
ALTER SCHEMA app OWNER TO wallet_migrator;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO wallet_app;
