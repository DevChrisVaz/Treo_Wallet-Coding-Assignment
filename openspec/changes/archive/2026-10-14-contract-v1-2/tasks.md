## 1. Contrato

- [x] 1.1 [contract] `openapi.yaml`: ruta `getAccountStatement` con el parámetro `StatementPeriod` y la respuesta `application/pdf`; regenerar los tipos; prueba de cliente (bytes con `%PDF-` y 404 problem+json en esa ruta) (CTR-19)
- [x] 1.2 [contract] `openapi.yaml`: `ScheduledDate`, `scheduledFor` en `CreateTransferRequest` y `Transfer`, `cancelledAt`, estados `SCHEDULED` y `CANCELLED`, `ScheduledTransferList`, rutas `listScheduledTransfers` y `cancelTransfer`, códigos `TRANSFER_NOT_CANCELLABLE`, `SCHEDULED_LIMIT_REACHED` y `DATE_OUT_OF_RANGE`; regenerar los tipos; prueba de tipos de las rutas nuevas (CTR-13)
- [x] 1.3 [contract] `mexicoCityDate` y `schedulableRange` con pruebas del instante de noche, del rango y del cambio de año (CTR-18)
- [x] 1.4 [contract] `scheduledFor` en `transferForm` (formato y fecha real) y `transferFormAt(instant)` con `DATE_OUT_OF_RANGE`; vectores de fecha en la prueba de paridad con el contrato (CTR-13)
- [x] 1.5 [contract] Versión 1.2.0 en `package.json` e `info.version`; README con las rutas, las funciones nuevas y la nota de enums que crecen; los pasos del CI del paquete completos (CTR-02)
