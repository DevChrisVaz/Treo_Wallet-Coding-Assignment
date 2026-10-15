## Why

El enunciado no se evalúa solo por el código: exige una propuesta de despliegue en AWS (Fase 4), un README con instrucciones y "qué haría con más tiempo", la trazabilidad requisito → diseño → tarea → commit → prueba, la bitácora de AI, el video y los CIs en verde. Este change reúne esos entregables en un solo lugar y al final, cuando ya existe lo que documentan.

## What Changes

- **`/docs/aws-deploy.md`**: propuesta de despliegue en AWS para una empresa regulada, sin desplegar nada. Incluye diagrama de arquitectura en Mermaid, los seis temas obligatorios de la tabla del enunciado (cómputo, base de datos, web, móvil, observabilidad y auditoría, CI/CD) y las tres respuestas escritas (conexiones al escalar, crecimiento de 100x, herramienta de IaC).
- **`README.md` raíz**: cómo correr en local los cuatro proyectos (bootstrap, migraciones, seed, Mailpit, dev), cómo correr las pruebas, el **Mapa de la especificación** (HU → requisito → change → tareas → pruebas), la justificación de las desviaciones (`/specs` y monorepo), la sección "qué haría con más tiempo" y la nota de que se aceptó exceder las 10–14 h.
- **`scripts/trace.sh`**: genera la matriz requisito → tarea → commit → prueba a partir de los trailers `Task:` y `Refs:` y de los títulos de prueba que empiezan con un ID.
- **Cierre de `docs/ai-log.md`**: última sesión, correcciones a la AI durante la implementación y resumen.
- **Guion del video** (≤ 5 min, web y móvil, incluido el intento con saldo insuficiente y la bandeja de Mailpit).
- **Verificación final**: los cuatro CIs en verde en `main` y el checklist de entregables del enunciado completo.

No hay cambios de comportamiento del sistema, por eso el change declara `skip_specs: true`.

## Capabilities

### New Capabilities

Ninguna. Este change es documentación y herramientas del repositorio; no agrega ni modifica comportamiento observable del sistema.

### Modified Capabilities

Ninguna.

## Impact

- **Proyectos que toca:** `/docs` (aws-deploy.md, ai-log.md, guion del video), raíz del repositorio (`README.md`, `scripts/trace.sh`). No modifica `/contract`, `/api`, `/web` ni `/mobile`; solo los referencia.
- **Historias de usuario:** no implementa ninguna; el Mapa de la especificación las enlaza todas (HU1 a HU6) con sus requisitos, tareas y pruebas.
- **Dependencias:** se ejecuta al final, después de `contract-v1`, `api-foundation`, `api-ledger`, `web-app` y `mobile-app`, porque documenta y verifica lo que esos changes producen (scripts reales, nombres de pruebas, workflows de CI, commits con trailers).
- **Sección del enunciado que cubre:** Fase 4 (propuesta de AWS) y la lista de Entregables (README, OpenAPI navegable, instrucciones de la app móvil, video, CI en verde, bitácora de AI).
