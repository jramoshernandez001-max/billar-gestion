# Billar Gestión

Sistema web (PWA) para administrar un billar: inventario de bodega y nevera, ventas, cierres diarios y semanales, deudas y utilidad semanal. Un solo negocio por ahora, usado por dos personas desde el celular (y también en PC).

## Stack
- React + Vite + TypeScript, instalable como PWA.
- Vitest para pruebas unitarias.
- Planeado: Supabase (Postgres, login solo con Google y lista de correos autorizados, RLS en todas las tablas) y modo sin conexión con sincronización.

## Reglas de código
- Usar principios SOLID y Single Responsibility: cada módulo y función hace una sola cosa.
- Crear pruebas unitarias para todo el sistema.
- Comentarios en cada funcionalidad y función que expliquen: qué hace, cómo lo hace y por qué lo hace.

## Flujo de trabajo
- TDD: primero la prueba y verla fallar (rojo), luego el código mínimo (verde), luego refactor.
- Antes de cada commit deben pasar `npm test`, `npm run lint` y `npm run build`.
- Un cambio completo = un commit: una funcionalidad terminada, un bug o un error importante corregido.
- Commits con Conventional Commits en español: `feat(ámbito):`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Trabajar en una rama por funcionalidad; `main` solo recibe cambios ya revisados.
- No ejecutar `git push` sin que el usuario lo apruebe.
- El usuario quiere ser guiado paso a paso: explicar brevemente qué se hizo y confirmar antes de avanzar.
- Todo lo visual (pantallas, ventanas emergentes) lo diseña el usuario en Figma. Para cada vista solo se le indica qué campos y qué elementos de entrada o gráficos hacen falta.

## Arquitectura
- `src/domain/`: lógica de negocio pura, sin React ni base de datos. Carpetas: `inventario`, `ventas`, `cierres`, `deudas`, `compartido`.
- Todo el dinero va en pesos enteros, sin decimales. Validar con `validarMonto` (`src/domain/compartido/validaciones.ts`).
- El inventario se guarda siempre en unidades. El stock nunca se edita: es la suma de los movimientos (compra, traslado, venta, ajuste) por ubicación (bodega o nevera).
- Presentaciones de venta: unidad, sixpack (siempre 6 unidades, solo si el producto lo maneja) y caja (las unidades por caja dependen del producto).
- El precio de la caja se guarda aparte y es editable. El precio cobrado en una venta se guarda en la venta, para que cambios futuros no alteren el historial.
- Las fechas son texto `AAAA-MM-DD`, sin hora.

## Reglas del negocio (resumen)
- Cierre diario y semanal: cuadra si efectivo + transferencias + deudas es igual o mayor al valor de lo vendido. Si es menor, se registra el faltante.
- Deudas en un cierre: entran solo las nacidas dentro del periodo, y solo por lo que sigan debiendo a la fecha de cierre. Una deuda pagada dentro del periodo ya no entra.
- Utilidad semanal (solo en el cierre semanal): ventas menos el costo de reponer lo vendido, con el costo de la última compra de cada producto. Se muestran utilidad esperada, utilidad real (con el dinero disponible) y la diferencia.
- Última compra: si hay varias el mismo día, manda la registrada de último (`registradoEn`, fecha y hora ISO en UTC). Si empatan también en eso, es un error.
- El cierre semanal usa la última compra con fecha igual o anterior al último día de la semana, para que recalcularlo después dé el mismo resultado.
- Producto vendido sin compras: el cierre semanal acepta un costo manual por unidad. Si no se da, calcula con los demás y marca el resultado como incompleto, con la lista de productos sin costo. Nunca se toma como cero.
- La semana de cierre va de lunes a domingo, exactamente 7 días, con fechas calculadas en UTC.
- La bitácora registra todo lo que cambia datos, con una lista fija de acciones; cualquier otra acción se rechaza.
- Nada se borra: un registro se anula con un registro de corrección (motivo, antes y después) en la bitácora, y lo puede hacer cualquiera de los dos usuarios. Recalcular un cierre también queda en la bitácora.
- Cierre semanal incompleto: no se calcula utilidad real. Se devuelven por separado la utilidad esperada solo con los productos que tienen costo, lo vendido sin costo (monto y lista) y el faltante o sobrante del cuadre. El cuadre sigue usando la venta total.
- Cada venta tiene estado vigente o anulada. Anular cambia el estado y queda en la bitácora con antes y después; los cierres suman solo las ventas vigentes. El recálculo de un cierre lo pide un usuario, nunca es automático.
- El costo de una compra se puede corregir después: se produce la compra con el costo nuevo y un registro de bitácora con antes y después. Si era la última compra del producto, la utilidad usa el costo nuevo.
- Un cierre guarda cuándo se calculó. Queda desactualizado si después se anuló o corrigió algo que usó (venta, compra, deuda o abono de su periodo, o el costo de una compra que usó). Recalcularlo lo deja al día y queda en la bitácora.
- Un registro nuevo (venta, deuda, abono o compra) con fecha dentro del periodo de un cierre ya calculado se permite y lo deja desactualizado hasta que se recalcule; se compara su momento de registro con el del cálculo. Una compra nueva solo lo desactualiza si podría cambiar el costo que usó.
- Ajuste de inventario (conteo físico): producto, ubicación, unidades con signo distintas de cero y motivo obligatorio, registrado en la bitácora. El inventario inicial no es un ajuste: se carga como compras con la fecha que elija el usuario.
- Cada deuda y cada abono llevan una descripción obligatoria que justifica el movimiento: sin espacios sobrantes, no vacía, máximo 200 caracteres.
- En esas descripciones se quitan los espacios de los lados y los espacios repetidos en medio se reducen a uno.
- El catálogo con precios y costos es privado: está en `CLAUDE.local.md` y no se sube al repositorio.

## Seguridad (el repositorio es público)
- Nunca subir secretos: `.env`, claves de servicio ni contraseñas. Solo la clave anon pública de Supabase puede estar en el cliente, y solo con RLS activa en todas las tablas.
- Los datos de ejemplo y de prueba son inventados, nunca los reales del negocio.
- En el CI, `npm audit --omit=dev` debe pasar. Las alertas en dependencias de desarrollo son solo un aviso.

## Comandos
- `npm run dev`: servidor local.
- `npm test`: todas las pruebas una vez. `npm run test:watch`: pruebas en modo escucha.
- `npm run lint` y `npm run build`.