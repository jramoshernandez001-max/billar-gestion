# Dudas de reglas de negocio

Reglas que no estaban definidas en `CLAUDE.md` ni en los datos privados del negocio. Mientras una duda está pendiente, el código no la resuelve: donde hace falta, lanza un error claro o deja la decisión a quien llama, en vez de suponer una respuesta.

## Pendientes

1. **Producto con compra y también con costo manual** (`src/domain/cierres/cierreSemanal.ts`). El costo manual se decidió para productos sin ninguna compra. Si se da un costo manual a un producto que sí tiene compra hasta el fin de la semana, ¿cuál manda? Hoy manda la compra y el costo manual se ignora.
2. **Utilidad de un cierre incompleto** (`src/domain/cierres/cierreSemanal.ts`). Cuando un producto vendido queda sin costo, la utilidad se calcula con el costo de los demás, pero la venta total sí incluye lo vendido de ese producto. Así la utilidad esperada sale más alta de lo real. ¿Se debe restar de la venta lo vendido de los productos sin costo? (La utilidad real no se puede separar por producto, porque el dinero es uno solo). Hoy se usa la venta total y el resultado queda marcado como incompleto.
3. **Ajustes de inventario en la bitácora** (`src/domain/compartido/bitacora.ts`). El inventario admite movimientos de tipo `ajuste` (por ejemplo, para cargar el inventario inicial), pero la lista de acciones decidida no incluye "registrar ajuste". ¿Se agrega esa acción? ¿O los ajustes no se van a usar? Hoy la lista no la tiene, así que un ajuste no se puede registrar en la bitácora.
4. **Anular algo de un día o una semana ya cerrados** (`src/domain/inventario/anulaciones.ts`, `src/domain/compartido/anulacion.ts`). Si se anula una venta, compra o deuda de un periodo que ya tiene cierre, ¿el cierre se recalcula automáticamente o lo recalcula un usuario a mano (acción `recalcular-cierre-…`)? Además, el cierre suma el valor de los renglones de venta, no los movimientos: falta definir cómo se marca una venta como anulada para que deje de sumar. Hoy solo existe la parte pura: los movimientos inversos y el registro de anulación.

## Resueltas

1. **Dos compras del mismo producto el mismo día.** La última compra es la que se registró de último. Cada compra lleva `registradoEn`, la fecha y hora de registro en ISO 8601 UTC. Si dos compras empatan también en eso, se lanza un error claro.
2. **Compras posteriores al cierre.** El cierre semanal usa, para cada producto, la última compra con fecha igual o anterior al último día de la semana. Así, recalcular un cierre más tarde da el mismo resultado.
3. **Producto vendido sin ninguna compra registrada.** El cierre semanal acepta un costo manual por unidad para cada producto. Si no se da, el cierre no falla: calcula la utilidad con los productos que sí tienen costo y marca el resultado como incompleto, con la lista de productos sin costo. El costo nunca se toma como cero en silencio.
4. **Qué días forman la semana.** La semana va de lunes a domingo y tiene exactamente 7 días: `desde` es lunes y `hasta` es el domingo siguiente. Las fechas se calculan en UTC (`src/domain/compartido/semana.ts`).
5. **Qué acciones se registran en la bitácora.** Todo lo que cambia datos: compras, traslados, ventas, cierres diario y semanal, deudas, abonos, cambios de precio, creación y edición de productos, anulaciones y recálculos de cierre. Hay una lista fija (`ACCIONES_BITACORA`) y se rechaza cualquier otra acción.
6. **Corregir o borrar registros.** Nada se borra. Un registro ya hecho se anula con un registro de corrección que queda en la bitácora con el motivo y el valor de antes y de después; cualquiera de los dos usuarios puede hacerlo. Un cierre se puede recalcular, y eso también queda en la bitácora.
