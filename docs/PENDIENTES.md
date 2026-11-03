# Dudas pendientes de reglas de negocio

Reglas que no están definidas en `CLAUDE.md` ni en los datos privados del negocio. El código no las resuelve: donde hace falta, lanza un error claro en vez de suponer una respuesta. Cada una necesita la decisión del dueño.

## Compras (`src/domain/inventario/compras.ts`)

1. **Dos compras del mismo producto el mismo día.** Las fechas no tienen hora. Si el último día con compras tiene dos o más compras del mismo producto (por ejemplo, con costos distintos), ¿cuál es "la última compra"? ¿La registrada de último, un promedio ponderado de ese día u otra cosa? Hoy `ultimaCompraDe` lanza un error en ese caso.

## Cierre semanal (`src/domain/cierres/cierreSemanal.ts`)

2. **Compras posteriores al cierre.** Si el cierre de una semana se calcula (o se vuelve a calcular) después de que hubo nuevas compras, ¿se usa el costo de la última compra hasta el último día de la semana, o el de la última compra que exista al momento de calcular? Hoy `cerrarSemana` usa la más reciente de las compras que le pasen; quien llama decide cuáles pasa.
3. **Producto vendido sin ninguna compra registrada.** Por ejemplo, el inventario inicial cargado con un ajuste y sin compra. No hay costo para calcular la utilidad. ¿Se pide un costo a mano, se toma como cero o se bloquea el cierre? Hoy `lineasReposicion` lanza un error.
4. **Qué días forman la semana.** ¿La semana va de lunes a domingo, o de otro día a otro? ¿Se debe impedir un cierre semanal que no tenga 7 días? Hoy `cerrarSemana` acepta cualquier periodo `desde`–`hasta` válido.

## Bitácora (`src/domain/compartido/bitacora.ts`)

5. **Qué acciones se registran y con qué nombre.** ¿Se registra todo (compras, traslados, ventas, cierres, deudas, abonos, cambios de precio) o solo algunas cosas? ¿Hay una lista fija de acciones? Hoy la acción es un texto libre obligatorio.
6. **¿Se pueden corregir o borrar registros ya hechos (ventas, compras, cierres)?** Si se puede, ¿quién y cómo queda en la bitácora? La función ya admite `antes` y `despues` nulos, pero la regla de qué se puede editar no está definida.

## Dudas nuevas

7. **Producto con compra y también con costo manual.** El costo manual se decidió para productos sin ninguna compra. Si se da un costo manual a un producto que sí tiene compra hasta el fin de la semana, ¿cuál manda? Hoy manda la compra y el costo manual se ignora.
8. **Utilidad de un cierre incompleto.** Cuando un producto vendido queda sin costo, la utilidad se calcula con el costo de los demás, pero la venta total sí incluye lo vendido de ese producto. Así la utilidad esperada sale más alta de lo real. ¿Se debe restar de la venta lo vendido de los productos sin costo? (La utilidad real no se puede separar por producto, porque el dinero es uno solo). Hoy se usa la venta total y el resultado queda marcado como incompleto.
