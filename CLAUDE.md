# Billar Gestión

Sistema web (PWA) para administrar un billar: inventario de bodega y nevera, ventas, cierres diarios y semanales, deudas y utilidad semanal. Un solo negocio por ahora, usado por dos personas desde el celular (y también en PC).

## Stack
- React + Vite + TypeScript, instalable como PWA.
- Vitest para pruebas unitarias.
- Supabase (Postgres, login con Google y lista de correos autorizados o con código de acceso, RLS en todas las tablas) y modo sin conexión con sincronización.

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
- Cada producto tiene categoría: cerveza, licor u otro. El licor se vende por botella entera (1 unidad por caja, sin sixpack, caja al mismo precio; lo exige la base) y solo ofrece "Botella"; las listas de Productos e Inventario se filtran por categoría (`src/domain/inventario/categorias.ts`).
- El precio de la caja se guarda aparte y es editable. El precio cobrado en una venta se guarda en la venta, para que cambios futuros no alteren el historial.
- Las fechas son texto `AAAA-MM-DD`, sin hora.
- `src/autenticacion/`: login con Google o con un código de acceso único por persona (migración 0008: sesión anónima de Supabase + `canjear_codigo_acceso`, que compara con hashes bcrypt, limita intentos y liga la sesión al código; `es_usuario_autorizado()` acepta un correo autorizado o una sesión con código activo; la bitácora anota "Nombre (código)"). Los códigos se crean a mano en el editor SQL con `crear_codigo_acceso` y nunca van en el repo. `servicioAcceso.ts` decide el estado de acceso (sin sesión, no autorizado, autorizado, error) sobre una interfaz de cliente; `adaptadorSupabase.ts` es el único archivo que conoce a Supabase; `ControlDeAcceso.tsx` no renderiza la app para quien no esté autorizado. Ante cualquier fallo se niega el acceso, salvo una excepción: sin red, un correo que la base autorizó en ese teléfono en los últimos 30 días puede ver lo guardado (`memoriaDeAcceso.ts`). La autorización real la hace la base de datos (`es_usuario_autorizado()` y RLS).
- `src/datos/`: repositorios (inventario, ventas, deudas, cierres) que llaman a las funciones de la base con parámetros `p_*` por nombre (una prueba los compara con las migraciones) y convierten filas a los tipos del dominio. Dependen de la interfaz `ClienteDatos`, no de Supabase.
- `src/aplicacion/`: servicios que unen repositorios y dominio (p. ej. `servicioCierres.ts`: carga datos, filtra el periodo, calcula con el dominio y guarda).
- `src/interfaz/`: pantallas y componentes según el diseño de Figma (estilos solo en `estilos.css`). Las pantallas no calculan nada: usan las funciones de `src/aplicacion/` y reciben los servicios por propiedades. Rutas con `#/ruta` (`ruta.ts`; las pantallas de producto llevan el id en la ruta, p. ej. `inventario/trasladar/<id>`); `App.tsx` elige la pantalla.
- `src/sincronizacion/`: modo sin conexión. `colaPendientes.ts` guarda en el teléfono (localStorage) las operaciones nuevas (venta, compra, traslado, ajuste, deuda, abono) con una clave única; `servicioSincronizacion.ts` las envía en orden con `aplicar_operacion_pendiente` (migración 0006, que no repite una clave), se detiene si falla la red y marca como rechazada la que la base rechace; `clienteSincronizado.ts` envuelve `ClienteDatos` (encola esas escrituras, exige conexión para anular/corregir/cerrar y, sin red, devuelve la última copia de cada lectura; las copias se borran al cerrar sesión). Un registro en cola devuelve el id `pendiente:<clave>`. El momento de registro es el del servidor al sincronizar.
- `src/configuracion/`: la configuración de Supabase sale de `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (copiar `.env.example` a `.env.local`, que no se sube). Se rechaza cualquier clave secreta.

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
- El costo de una compra se puede corregir después con un motivo obligatorio: se produce la compra con el costo nuevo y un registro de bitácora con antes, después y motivo. Cada compra tiene un número consecutivo (`numero`, C-001) que asigna la base al registrar. Si era la última compra del producto, la utilidad usa el costo nuevo.
- Un cierre guarda cuándo se calculó. Queda desactualizado si después se anuló o corrigió algo que usó (venta, compra, deuda o abono de su periodo, o el costo de una compra que usó). Recalcularlo lo deja al día y queda en la bitácora.
- Un registro nuevo (venta, deuda, abono o compra) con fecha dentro del periodo de un cierre ya calculado se permite y lo deja desactualizado hasta que se recalcule; se compara su momento de registro con el del cálculo. Una compra nueva solo lo desactualiza si podría cambiar el costo que usó.
- Ajuste de inventario (conteo físico): producto, ubicación, unidades con signo distintas de cero y motivo obligatorio, registrado en la bitácora. El inventario inicial no es un ajuste: se carga como compras con la fecha que elija el usuario.
- Cada deuda y cada abono llevan una descripción obligatoria que justifica el movimiento: sin espacios sobrantes, no vacía, máximo 200 caracteres.
- En esas descripciones se quitan los espacios de los lados y cualquier grupo de espacios, tabulaciones o saltos de línea en medio se reduce a un solo espacio.
- Compras, deudas y abonos también tienen estado (vigente o anulada) y se anulan como las ventas: cambia el estado y queda en la bitácora con antes, después y motivo. Los cálculos ignoran lo anulado; anular una compra crea su movimiento inverso, una deuda con abonos vigentes no se puede anular y no se corrige el costo de una compra anulada.
- Toda escritura pasa por funciones de la base de datos (SECURITY DEFINER, que verifican primero al usuario autorizado y escriben su bitácora en la misma transacción); para la app, las tablas son solo de lectura.
- La base rechaza un abono que supere lo que se debe: bloquea la deuda y suma los abonos vigentes.
- El efectivo y las transferencias de un cierre se pueden corregir; queda en la bitácora y deja el cierre desactualizado hasta que un usuario lo recalcule.
- Un renglón de venta con cantidad cero se ignora sin error (no se guarda ni genera movimiento); si todos son cero, la venta se rechaza.
- El monto de una deuda o de un abono debe ser mayor a cero. Un nombre de producto no se repite (sin importar mayúsculas ni espacios).
- El catálogo con precios y costos es privado: está en `CLAUDE.local.md` y no se sube al repositorio.

## Seguridad (el repositorio es público)
- Nunca subir secretos: `.env`, claves de servicio ni contraseñas. Solo la clave anon pública de Supabase puede estar en el cliente, y solo con RLS activa en todas las tablas.
- Los datos de ejemplo y de prueba son inventados, nunca los reales del negocio.
- En el CI, `npm audit --omit=dev` debe pasar. Las alertas en dependencias de desarrollo son solo un aviso.

## Comandos
- `npm run dev`: servidor local.
- `npm test`: todas las pruebas una vez. `npm run test:watch`: pruebas en modo escucha.
- `npm run lint` y `npm run build`.