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
- El catálogo con precios y costos es privado: está en `CLAUDE.local.md` y no se sube al repositorio.

## Seguridad (el repositorio es público)
- Nunca subir secretos: `.env`, claves de servicio ni contraseñas. Solo la clave anon pública de Supabase puede estar en el cliente, y solo con RLS activa en todas las tablas.
- Los datos de ejemplo y de prueba son inventados, nunca los reales del negocio.
- En el CI, `npm audit --omit=dev` debe pasar. Las alertas en dependencias de desarrollo son solo un aviso.

## Comandos
- `npm run dev`: servidor local.
- `npm test`: todas las pruebas una vez. `npm run test:watch`: pruebas en modo escucha.
- `npm run lint` y `npm run build`.