# Base de datos

La base de datos vive en Supabase (Postgres). Su estructura está en `supabase/migrations/`, en archivos SQL que se aplican en orden. Refleja las reglas de `src/domain`: si el dominio cambia, las migraciones deben acompañarlo (una prueba, `src/baseDeDatos/migraciones.test.ts`, revisa parte de esa coherencia).

Reglas generales:

- Todo en español y snake_case. Llaves primarias `uuid`.
- Momentos en `timestamptz` (UTC); fechas de negocio en `date`; dinero en `bigint` (pesos enteros, nunca negativo); unidades en `integer`.
- Cada tabla de datos guarda `creado_en` y `creado_por` (el `auth.uid()` de quien la escribió). En la bitácora, `momento` cumple el papel de `creado_en`.
- **Nada se borra.** Ventas, compras y abonos se anulan con su `estado`; un anulado no vuelve a quedar vigente. Los movimientos de inventario se compensan con movimientos contrarios. Ninguna tabla tiene privilegios ni políticas de borrado, y un disparador lo impide incluso desde el editor SQL.

## Migraciones

| Archivo | Qué hace |
|---|---|
| `0001_tablas_base.sql` | Crea las diez tablas, sus restricciones y los disparadores que calculan las unidades e impiden reactivar lo anulado. |
| `0002_vista_stock_actual.sql` | Crea la vista `stock_actual` (suma de movimientos), con `security_invoker` para que respete RLS. |
| `0003_seguridad_rls.sql` | Define `es_usuario_autorizado()`, activa y fuerza RLS en todas las tablas, crea las políticas, quita todo al rol `anon` e impide borrar y modificar la bitácora. |
| `0004_operaciones_atomicas.sql` | Crea `registrar_compra`, `registrar_traslado`, `registrar_venta`, `anular_venta` y `registrar_ajuste`. |

## Esquema

| Tabla | Para qué sirve | En el dominio |
|---|---|---|
| `usuarios_autorizados` | Correos de Google que pueden entrar (único, en minúsculas), nombre y `activo`. Se administra a mano; la app solo la lee, y cada usuario ve únicamente su propia fila. | `estaAutorizado` |
| `productos` | Nombre, unidades por caja, si maneja sixpack, precio de la unidad y precio de la caja (aparte, editable). | `ProductoVendible` |
| `compras` | Producto, presentación, cantidad, unidades (calculadas), costo total, fecha elegida por el usuario y estado. `creado_en` es el momento de registro: con varias compras el mismo día, manda la registrada de último. El costo se puede corregir (acción `corregir-costo-compra`). | `Compra`, `corregirCostoCompra` |
| `movimientos_inventario` | Cada cambio de inventario con signo: tipo (`compra`, `traslado`, `venta`, `ajuste`), ubicación (`bodega`, `nevera`) y a qué compra, venta o traslado pertenece. Un ajuste exige motivo y unidades distintas de cero. `compensa_a` marca el movimiento que uno anula (una sola vez). | `Movimiento`, `crearAjuste`, `movimientosInversos` |
| `ventas` | Fecha y estado (`vigente` o `anulada`). Los cierres suman solo las vigentes. | `Venta` |
| `venta_items` | Renglones: producto, presentación, cantidad, unidades (calculadas) y precio cobrado (siempre guardado, para no alterar el historial). | `RenglonVenta` |
| `deudas` | Cliente, fecha, monto y descripción obligatoria. | `Deuda` |
| `abonos_deuda` | Deuda, fecha, monto, descripción obligatoria y estado. | `Abono` |
| `cierres` | Tipo (`diario` de un día, `semanal` de lunes a domingo), periodo, efectivo, transferencias, costos manuales, momento del cálculo, costos usados y resultado. Un solo cierre por tipo y periodo; recalcular lo actualiza. | `CierreGuardado` |
| `bitacora` | Quién (correo), cuándo, acción (de la lista fija), sobre qué registro, antes, después y motivo (obligatorio al anular). Solo se inserta y se lee. | `crearRegistroBitacora` |

Restricciones en la propia base de datos:

- **Listas cerradas:** ubicaciones, tipos de movimiento, presentaciones, estados, tipos de cierre y acciones de la bitácora se validan con `CHECK`. La lista de acciones es la misma de `ACCIONES_BITACORA`.
- **Unidades y sixpack:** las unidades de compras y renglones las calcula un disparador; el sixpack vale 6 unidades y solo se acepta si el producto lo maneja.
- **Descripciones:** las de deudas y abonos usan el tipo `descripcion_movimiento`: de 1 a 200 caracteres, sin espacios a los lados ni repetidos en medio.
- **Stock:** `stock_actual` suma los movimientos por producto y ubicación. El stock nunca se escribe a mano.

## Operaciones atómicas

La app registra compras, traslados, ventas, anulaciones de venta y ajustes llamando a estas funciones, no escribiendo en las tablas paso a paso. Cada llamada es una sola transacción: el registro, sus movimientos y su entrada de bitácora se guardan juntos, o no se guarda nada. Son `SECURITY INVOKER`, así que aplican las mismas políticas que una consulta normal.

| Función | Qué guarda |
|---|---|
| `registrar_compra(producto, presentación, cantidad, costo_total, fecha)` | La compra, su entrada a bodega y la bitácora `registrar-compra`. |
| `registrar_traslado(producto, unidades)` | La salida de bodega y la entrada a nevera, y la bitácora `registrar-traslado`. Devuelve si la bodega alcanzaba (`suficiente`, `faltan`); solo informa, no bloquea. |
| `registrar_venta(fecha, renglones)` | La venta, sus renglones (con el precio de lista si no se cobró otro), la salida de nevera de cada renglón y la bitácora `registrar-venta`. |
| `anular_venta(venta, motivo)` | Cambia el estado a `anulada`, crea los movimientos inversos y registra `anular-registro` con antes, después y motivo. |
| `registrar_ajuste(producto, ubicación, unidades, motivo)` | El movimiento de ajuste con su motivo y la bitácora `registrar-ajuste`. |

## Cómo aplicar las migraciones

Las aplica el dueño del proyecto en Supabase; este repositorio solo guarda los archivos.

1. En el panel de Supabase, activar el inicio de sesión con Google (Authentication → Providers) y desactivar los demás.
2. Abrir el editor SQL y ejecutar los archivos en orden: `0001`, `0002`, `0003` y `0004`, cada uno una sola vez. Si uno falla, corregir y volver a ejecutar solo ese antes de seguir.
3. Otra opción es la CLI de Supabase (`supabase db push`), que aplica en orden los archivos de `supabase/migrations/` que falten.
4. Agregar los correos autorizados (siguiente sección) y hacer la verificación de seguridad del final.

En el cliente solo va la clave **anon** pública. La clave `service_role` se salta RLS: nunca debe ir en la app ni en el repositorio.

## Cómo agregar o quitar un correo autorizado

Desde el editor SQL de Supabase:

```sql
-- Agregar (el correo en minúsculas y sin espacios).
insert into public.usuarios_autorizados (correo, nombre)
values ('correo@ejemplo.com', 'Nombre de ejemplo');

-- Quitar el acceso: se desactiva, no se borra.
update public.usuarios_autorizados
   set activo = false
 where correo = 'correo@ejemplo.com';
```

La app no puede insertar ni modificar esta tabla. Como RLS está forzada, existen políticas solo para el rol `postgres` (el del editor SQL) que permiten esta administración.

## Lista de verificación de seguridad (manual)

Hacerla después de aplicar las migraciones y cada vez que se cambien políticas. En los ejemplos del editor SQL, `begin` y `rollback` dejan todo como estaba. `set local request.jwt.claims` simula el token de un usuario; los correos y el uuid son inventados.

1. **RLS activada y forzada en todas las tablas.** Debe salir `true` en las dos columnas para las diez tablas:

   ```sql
   select relname, relrowsecurity, relforcerowsecurity
     from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r'
    order by relname;
   ```

2. **El rol anon no accede a nada.** La primera consulta no debe devolver filas; la segunda debe fallar con "permission denied":

   ```sql
   select grantee, table_name, privilege_type
     from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon';

   begin;
   set local role anon;
   select count(*) from public.productos;
   rollback;
   ```

   También desde afuera: una petición a `https://<proyecto>.supabase.co/rest/v1/productos` con solo la clave anon (sin sesión) debe responder con error de permisos.

3. **Nadie tiene privilegio de borrar.** No debe salir ninguna fila:

   ```sql
   select grantee, table_name
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('DELETE', 'TRUNCATE');
   ```

4. **Un correo no autorizado ve cero datos.** Todas las cuentas deben dar 0 y la operación debe fallar:

   ```sql
   begin;
   set local role authenticated;
   set local request.jwt.claims =
     '{"sub": "00000000-0000-0000-0000-000000000001", "email": "otro@ejemplo.com", "role": "authenticated"}';
   select public.es_usuario_autorizado();            -- false
   select count(*) from public.productos;            -- 0
   select count(*) from public.ventas;               -- 0
   select count(*) from public.bitacora;             -- 0
   select count(*) from public.usuarios_autorizados; -- 0
   select count(*) from public.stock_actual;         -- 0
   rollback;
   ```

   Con la app: iniciar sesión con una cuenta de Google que no esté en la lista y comprobar que no aparece ningún dato y que no se puede registrar nada.

5. **Un correo autorizado ve los datos y solo su propia fila de usuarios.** Repetir el punto 4 con un correo de la lista (por ejemplo `correo@ejemplo.com`, si se agregó como prueba): `es_usuario_autorizado()` da `true` y `usuarios_autorizados` muestra una sola fila, la suya.

6. **La bitácora no se puede editar ni borrar.** Como usuario autorizado (punto 5), estas dos sentencias deben fallar con "permission denied". Desde el editor SQL, como `postgres`, deben fallar con el mensaje del disparador ("no está permitida"):

   ```sql
   update public.bitacora set accion = 'registrar-compra';
   delete from public.bitacora;
   ```

7. **Nada se borra en ninguna tabla.** Desde el editor SQL, `delete from public.ventas;` debe fallar con el mensaje del disparador.

8. **Las funciones no están abiertas a anon.** Como `anon` (punto 2), `select public.registrar_compra(...)` debe fallar con "permission denied".
