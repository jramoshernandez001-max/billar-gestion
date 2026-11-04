# Vistas de la app: qué necesita cada pantalla

Guía para el diseño en Figma. Para cada vista se indican los datos que se
muestran, las entradas que se piden, las acciones y los avisos. El aspecto
visual lo define el diseño; aquí solo se dice **qué hace falta**.

Reglas comunes a todas las vistas:

- Pensadas primero para celular (una mano, uso en el local) y que se adapten a PC.
- Todo el dinero se muestra en pesos enteros, con separador de miles (ej. `$ 15.000`), sin decimales.
- Las fechas se piden y muestran como día (AAAA-MM-DD o formato local); nunca con hora, salvo en la bitácora.
- Nada se borra: las acciones se llaman **Anular** y siempre piden un **motivo** (texto obligatorio).
- Los mensajes de error de la base ya vienen en español y se muestran tal cual, cerca del botón que los causó.
- Las listas muestran vigentes y anuladas; las anuladas se ven distintas (tachadas o atenuadas) y no tienen acciones.
- Estados que toda pantalla de datos debe contemplar: **cargando**, **vacío**, **error** y **sin conexión**.

## 0. Acceso (login)
- Botón único: **Entrar con Google**.
- Estados: cargando, sin sesión, **no autorizado** (mensaje: ese correo no tiene permiso; botón *Cerrar sesión*), error.
- Una vez dentro: correo de la sesión visible en algún lugar y acción **Cerrar sesión**.

## 1. Inicio (resumen del día)
- Ventas de hoy (total en pesos y número de ventas vigentes).
- Alertas: productos con stock en nevera bajo o negativo; cierres desactualizados; deudas pendientes (total).
- Accesos rápidos: **Nueva venta**, **Nueva compra**, **Trasladar a nevera**, **Cerrar el día**.
- Gráfico opcional: ventas de los últimos 7 días (barras por día).

## 2. Nueva venta
- Fecha (por defecto hoy).
- Lista de renglones; por cada renglón:
  - Producto (selector con búsqueda).
  - Presentación (unidad / sixpack / caja). Sixpack solo aparece si el producto lo maneja.
  - Cantidad (entero; 0 se ignora).
  - Precio cobrado (opcional; por defecto el precio de lista, editable, ej. caja a domicilio).
  - Subtotal del renglón (calculado, solo lectura).
- Botón agregar renglón; quitar renglón.
- Total de la venta (calculado).
- Aviso si la nevera no tiene suficiente (el stock puede quedar negativo; se avisa, no se bloquea).
- Acción: **Registrar venta**. Error si todos los renglones son cero.

## 3. Ventas (historial)
- Filtro por fecha (día o rango) y por estado.
- Lista: fecha, total, estado, renglones (producto, presentación, cantidad, precio cobrado).
- Acción por venta vigente: **Anular** (motivo obligatorio).

## 4. Inventario (stock)
- Tabla por producto: nombre, **bodega**, **nevera**, **total** (en unidades).
- Equivalente en cajas/sixpacks (informativo, opcional).
- Resaltar negativos y bajos.
- Acciones por producto: **Trasladar**, **Ajustar (conteo físico)**, **Comprar**, **Editar producto**.

## 5. Productos (catálogo)
- Lista: nombre, unidades por caja, ¿maneja sixpack?, precio de unidad, precio de caja.
- Formulario crear/editar:
  - Nombre (obligatorio; no se repite, sin importar mayúsculas ni espacios).
  - Unidades por caja (entero mayor a cero).
  - ¿Maneja sixpack? (sí/no). Un sixpack siempre son 6 unidades.
  - Precio de la unidad y precio de la caja (pesos enteros; la caja se edita aparte).
- Nota visible: cambiar un precio no altera ventas pasadas.

## 6. Nueva compra
- Producto, presentación (unidad / sixpack / caja), cantidad, **costo total pagado**, fecha.
- Calculado en pantalla: unidades que entran a bodega y costo por unidad.
- Acción: **Registrar compra**.
- Para cargar el inventario inicial se usa esta misma pantalla con la fecha elegida.

## 7. Compras (historial)
- Lista: fecha, producto, presentación, cantidad, costo total, estado.
- Acciones: **Corregir costo** (costo nuevo; queda registro del antes y después) y **Anular** (motivo).
- Aviso: corregir o anular una compra puede dejar un cierre desactualizado.

## 8. Trasladar a nevera
- Producto y unidades a pasar de bodega a nevera.
- Si la bodega no alcanza, el traslado se registra igual y se **muestra el aviso** con cuántas unidades faltaban.

## 9. Ajuste de inventario (conteo físico)
- Producto, ubicación (bodega / nevera), unidades con signo (+ sobra, − falta; distinto de cero), **motivo obligatorio**.
- Mostrar el stock actual de esa ubicación como referencia.

## 10. Deudas
- Lista de deudas: cliente, fecha, monto, **saldo pendiente**, descripción, estado.
- Filtro: pendientes / pagadas / anuladas; búsqueda por cliente.
- Formulario **Nueva deuda**: cliente, fecha, monto (mayor a cero), descripción (obligatoria, máx. 200 caracteres, con contador).
- Detalle de una deuda: abonos con fecha, monto, descripción y estado.
- Acciones: **Abonar** (fecha, monto ≤ saldo, descripción obligatoria), **Anular abono**, **Anular deuda** (solo si no tiene abonos vigentes; motivo).
- Total de deudas pendientes arriba.

## 11. Cierre diario
- Selector de día (por defecto hoy).
- Datos calculados (solo lectura): valor vendido, deudas nacidas ese día que siguen pendientes.
- Entradas: **efectivo contado**, **transferencias recibidas** (pesos enteros).
- Resultado: dinero total (efectivo + transferencias + deudas), diferencia, **Cuadra / No cuadra**, faltante o sobrante.
- Acción: **Guardar cierre**. Un solo cierre por día; si ya existe, se muestra el existente.

## 12. Cierre semanal
- Selector de semana (lunes a domingo, siempre 7 días).
- Mismas entradas y resultado de cuadre que el diario.
- Utilidad:
  - **Completo**: utilidad esperada, utilidad real y diferencia; costo de reposición.
  - **Incompleto** (hay productos vendidos sin compras): lista de productos sin costo, monto vendido sin costo, utilidad esperada solo de los productos con costo; **no hay utilidad real**.
- Entrada opcional: **costo manual por unidad** para cada producto sin compras (al ingresarlo el cierre pasa a completo).
- Detalle: para cada producto, qué compra se usó como costo (fecha).
- Gráficos sugeridos: ventas por día de la semana (barras); ventas vs costo vs utilidad (barras apiladas o comparación).

## 13. Cierres (historial)
- Lista: tipo, periodo, resultado (cuadra / faltante), fecha de cálculo.
- Etiqueta **Desactualizado** cuando se anuló o corrigió algo que usó, o se corrigió el dinero.
- Acciones: **Recalcular** (lo pide el usuario, nunca es automático), **Corregir efectivo/transferencias** (queda en bitácora y deja el cierre desactualizado hasta recalcular).

## 14. Bitácora
- Lista cronológica de todo lo que cambió datos: fecha y hora, usuario (correo), acción, registro afectado, motivo.
- Detalle: **antes** y **después** del registro.
- Filtros: acción, usuario, rango de fechas. Solo lectura.

## 15. Resumen y gráficos (más adelante)
- Utilidad por semana (línea o barras, últimas 8 semanas).
- Ventas por producto (ranking).
- Gastos (cuando se agregue esa función).

## Navegación sugerida
Barra inferior en celular: **Inicio · Vender · Inventario · Deudas · Más** (Compras, Productos, Cierres, Bitácora dentro de *Más*). Menú lateral en PC.

## Estado de implementación

| Vista | Ruta | Estado |
| --- | --- | --- |
| 0. Acceso | (control de acceso) | Hecha |
| 1. Inicio | `inicio` | Hecha |
| 2. Nueva venta | `vender` | Hecha |
| 3. Ventas | `mas/ventas` | Hecha (anular en línea, sin ventana emergente) |
| 4. Inventario | `inventario` | Hecha (sin "stock bajo": la base no guarda mínimo) |
| 5. Productos | `mas/productos` | Hecha |
| 6. Nueva compra | `inventario/comprar[/id]` | Hecha |
| 7. Compras | `mas/compras` | Hecha, con Corregir costo y Anular |
| 8. Trasladar | `inventario/trasladar/<id>` | Hecha |
| 9. Ajuste | `inventario/ajustar/<id>` | Hecha |
| 10. Deudas | `deudas` | Hecha (lista, nueva, detalle, abonar, anular) |
| 11-12. Cierres | `cierres/...` | Hecha (diario y semanal, costos faltantes y manual) |
| 13. Historial de cierres | `mas/cierres` | Hecha (recalcular, corregir dinero) |
| 14. Bitácora | `mas/bitacora[/id]` | Hecha |
| 15. Resúmenes | `mas/resumenes` | Pantalla "Próximamente" |
| Sin conexión | (franja global) | Aviso hecho; guardar sin conexión sigue pendiente |

Las pantallas sin diseño en Figma (Corregir costo, Anular, Productos, Deudas,
Cierres, Bitácora y Más) se hicieron con los patrones existentes y se ajustan
cuando el diseño esté disponible.
