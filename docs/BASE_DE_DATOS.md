# Base de datos

La base de datos vive en Supabase (Postgres). Su estructura está en `supabase/migrations/`, en archivos SQL que se aplican en orden. Refleja las reglas de `src/domain`: si el dominio cambia, las migraciones deben acompañarlo. La prueba `src/baseDeDatos/migraciones.test.ts` lee el SQL y revisa parte de esa coherencia y de la seguridad.

Reglas generales:

- Todo en español y snake_case. Llaves primarias `uuid`.
- Momentos en `timestamptz` (UTC); fechas de negocio en `date`; dinero en `bigint` (pesos enteros, nunca negativo); unidades en `integer`.
- Cada tabla de datos guarda `creado_en` y `creado_por` (el `auth.uid()` de quien la escribió). En la bitácora, `momento` cumple el papel de `creado_en`.
- **La app solo lee las tablas.** Toda escritura pasa por las funciones de `0004_operaciones_atomicas.sql`, y cada una deja su bitácora en la misma transacción.
- **Nada se borra.** Compras, ventas, deudas y abonos se anulan con su `estado`, y lo anulado no vuelve a quedar vigente. Los movimientos de inventario se compensan con movimientos contrarios y tampoco se pueden editar. Ninguna política permite borrar, y un disparador lo impide en todas las tablas, incluso desde el editor SQL.

## Migraciones

| Archivo | Qué hace |
|---|---|
| `0001_tablas_base.sql` | Crea las diez tablas, sus restricciones y los disparadores que calculan las unidades e impiden reactivar lo anulado. |
| `0002_vista_stock_actual.sql` | Crea la vista `stock_actual` (suma de movimientos), con `security_invoker` para que respete RLS. |
| `0003_seguridad_rls.sql` | Define `es_usuario_autorizado()`, activa y fuerza RLS en todas las tablas, deja las tablas solo de lectura para la app, da políticas explícitas al rol dueño, quita todo al rol `anon` e impide borrar y modificar la bitácora. |
| `0004_operaciones_atomicas.sql` | Crea las funciones de escritura, una por operación. |
| `0008_acceso_con_codigo.sql` | Acceso con código único: tablas `codigos_acceso` (hash bcrypt), `sesiones_codigo` e `intentos_codigo` (la app no las lee), `crear_codigo_acceso` (solo editor SQL), `canjear_codigo_acceso` (con límite de intentos) y `usuario_actual`; amplía `es_usuario_autorizado` y `anotar_bitacora`. |

## Esquema

| Tabla | Para qué sirve | En el dominio |
|---|---|---|
| `usuarios_autorizados` | Correos de Google que pueden entrar (único, en minúsculas), nombre y `activo`. Los usuarios autorizados ven la lista completa; solo se administra a mano desde el editor SQL. | `estaAutorizado` |
| `productos` | Nombre, unidades por caja, si maneja sixpack, precio de la unidad y precio de la caja (aparte, editable). | `ProductoVendible` |
| `compras` | Producto, presentación, cantidad, unidades (calculadas), costo total, fecha elegida por el usuario y estado. `creado_en` es el momento de registro: con varias compras el mismo día, manda la registrada de último. Una compra anulada no cuenta como última compra. | `Compra`, `corregirCostoCompra`, `anularCompra` |
| `movimientos_inventario` | Cada cambio de inventario con signo: tipo (`compra`, `traslado`, `venta`, `ajuste`), ubicación (`bodega`, `nevera`) y a qué compra, venta o traslado pertenece. Un ajuste exige motivo y unidades distintas de cero. `compensa_a` marca el movimiento que uno anula (una sola vez). | `Movimiento`, `crearAjuste`, `movimientosInversos` |
| `ventas` | Fecha y estado. Los cierres suman solo las vigentes. | `Venta`, `anularVenta` |
| `venta_items` | Renglones con cantidad mayor a cero: producto, presentación, cantidad, unidades (calculadas) y precio cobrado (siempre guardado, para no alterar el historial). | `RenglonVenta`, `renglonesParaRegistrar` |
| `deudas` | Cliente, fecha, monto, descripción obligatoria y estado. Una deuda anulada no debe nada. | `Deuda`, `anularDeuda` |
| `abonos_deuda` | Deuda, fecha, monto, descripción obligatoria y estado. Los abonos vigentes nunca superan el monto de la deuda. | `Abono`, `anularAbono` |
| `cierres` | Tipo (`diario` de un día, `semanal` de lunes a domingo), periodo, efectivo, transferencias, costos manuales, momento del cálculo, momento de la última corrección del dinero, costos usados y resultado. Un solo cierre por tipo y periodo. | `CierreGuardado`, `corregirDineroCierre` |
| `bitacora` | Quién (correo), cuándo, acción (de la lista fija), sobre qué registro, antes, después y motivo (obligatorio al anular). Solo se inserta y se lee. | `crearRegistroBitacora` |

Restricciones en la propia base de datos:

- **Listas cerradas:** ubicaciones, tipos de movimiento, presentaciones, estados, tipos de cierre y acciones de la bitácora se validan con `CHECK`. La lista de acciones es idéntica a `ACCIONES_BITACORA`, y la prueba lo revisa.
- **Unidades y sixpack:** las unidades de compras y renglones las calcula un disparador; el sixpack vale 6 unidades y solo se acepta si el producto lo maneja.
- **Descripciones:** las de deudas y abonos usan el tipo `descripcion_movimiento`: de 1 a 200 caracteres, sin espacios a los lados ni repetidos en medio. Las funciones las limpian antes de guardar.
- **Stock:** `stock_actual` suma los movimientos por producto y ubicación. El stock nunca se escribe a mano.

## Funciones de escritura

| Función | Qué hace | Bitácora |
|---|---|---|
| `crear_producto(nombre, unidades_por_caja, maneja_sixpack, precio_unidad, precio_caja)` | Crea un producto. | `crear-producto` |
| `editar_producto(producto, …mismos campos)` | Cambia datos y precios; si nada cambió, no hace nada. | `cambiar-precio` si solo cambian precios; si no, `editar-producto` |
| `registrar_compra(producto, presentación, cantidad, costo_total, fecha)` | Guarda la compra y su entrada a bodega. | `registrar-compra` |
| `corregir_costo_compra(compra, costo_nuevo)` | Cambia solo el costo total. | `corregir-costo-compra` |
| `anular_compra(compra, motivo)` | Cambia el estado y compensa su entrada a bodega. | `anular-registro` |
| `registrar_traslado(producto, unidades)` | Saca de bodega y mete en nevera. Devuelve si la bodega alcanzaba (`suficiente`, `faltan`); solo informa, no bloquea. | `registrar-traslado` |
| `registrar_ajuste(producto, ubicación, unidades, motivo)` | Guarda el ajuste por conteo físico. | `registrar-ajuste` |
| `registrar_venta(fecha, renglones)` | Guarda la venta, los renglones con cantidad (los de cero se ignoran; si todos son cero, falla) y la salida de nevera de cada uno. | `registrar-venta` |
| `anular_venta(venta, motivo)` | Cambia el estado y crea los movimientos inversos. | `anular-registro` |
| `registrar_deuda(cliente, fecha, monto, descripción)` | Guarda la deuda. | `registrar-deuda` |
| `anular_deuda(deuda, motivo)` | Anula la deuda; falla si tiene abonos vigentes. | `anular-registro` |
| `registrar_abono(deuda, fecha, monto, descripción)` | Bloquea la deuda, suma los abonos vigentes y falla si el nuevo se pasa de lo que se debe. | `registrar-abono` |
| `anular_abono(abono, motivo)` | Anula el abono; la deuda vuelve a deber ese monto. | `anular-registro` |
| `guardar_cierre(tipo, desde, hasta, efectivo, transferencias, costos_manuales, costos_usados, resultado)` | Guarda un cierre calculado por la app; falla si ya existe uno para ese tipo y periodo. | `registrar-cierre-diario` o `registrar-cierre-semanal` |
| `recalcular_cierre(cierre, costos_usados, resultado)` | Lo deja al día con el resultado nuevo. Solo lo pide un usuario; nunca es automático. | `recalcular-cierre-diario` o `recalcular-cierre-semanal` |
| `corregir_dinero_cierre(cierre, efectivo, transferencias)` | Corrige el dinero contado y marca `dinero_corregido_en`; el cierre queda desactualizado hasta recalcularlo. | `corregir-dinero-cierre` |

Cada llamada es una sola transacción: el registro, sus movimientos y su bitácora se guardan juntos o no se guarda nada.

## Por qué SECURITY DEFINER y cómo se protege

La app no tiene permisos de escritura en ninguna tabla: así ningún cambio se puede saltar la bitácora ni las validaciones. Para que las funciones sí puedan escribir, son `SECURITY DEFINER`: corren con los permisos de su dueño y no con los de quien las llama. Eso es poderoso, así que todas cumplen estas reglas, y la prueba de migraciones revisa las principales:

1. **Primero se verifica al usuario.** La primera instrucción es `if not public.es_usuario_autorizado() then raise exception …`. En `declare` no se asigna nada, para que no corra nada antes.
2. **El usuario sale del token.** `creado_por` es `auth.uid()` y el usuario de la bitácora es el correo del token (`correo_del_token()`). Ningún parámetro permite registrar a nombre de otro.
3. **`search_path` vacío.** Todos los nombres van con `public.` o `auth.`, así nadie puede crear una tabla o función con el mismo nombre en otro esquema para engañar a la función.
4. **Solo `authenticated` las ejecuta.** Cada una tiene `REVOKE` a `public` y `anon` y `GRANT EXECUTE` a `authenticated`. Las funciones auxiliares (`anotar_bitacora`, `motivo_obligatorio`, etc.) no las ejecuta nadie desde la app.
5. **Dueño explícito y RLS forzada.** El dueño de todas las funciones `DEFINER` es `postgres` (`ALTER FUNCTION … OWNER TO postgres`), sin depender de quién aplique la migración. RLS está forzada también para el dueño de las tablas, así que no se asume que `postgres` se la salte: tiene políticas explícitas para leer, agregar y actualizar en cada tabla (en la bitácora, los movimientos y los renglones, solo leer y agregar). No tiene ninguna política para borrar, y los disparadores bloquean el borrado en todas las tablas y la modificación de la bitácora y de los movimientos de inventario de todas formas.
6. **`es_usuario_autorizado()`** también es `SECURITY DEFINER`, para que los usuarios autorizados puedan leer toda la lista de `usuarios_autorizados` sin recursión entre la política y la función. Devuelve solo un booleano, fija `search_path` y no expone filas.

Consecuencia: las políticas de `postgres` también permiten escribir directo desde el editor SQL de Supabase, sin bitácora. Solo el dueño debe tener acceso al panel.

## Cómo aplicar las migraciones

Las aplica el dueño del proyecto en Supabase; este repositorio solo guarda los archivos.

1. En el panel de Supabase, en Authentication → Providers, dejar activo **solo Google** y apagar el inicio de sesión con correo y contraseña (Email) y cualquier otro proveedor.
2. Abrir el editor SQL y ejecutar los archivos en orden (`0001`, `0002`, `0003` y `0004`), cada uno una sola vez y como `postgres`. Si uno falla, corregir y volver a ejecutar solo ese antes de seguir.
3. Otra opción es la CLI de Supabase (`supabase db push`), que aplica en orden los archivos de `supabase/migrations/` que falten.
4. Agregar los correos autorizados (siguiente sección) y hacer la verificación de seguridad del final.

En el cliente solo va la clave **anon** pública. La clave `service_role` se salta RLS: nunca debe ir en la app ni en el repositorio.

## Cómo agregar o quitar un correo autorizado

Desde el editor SQL de Supabase (rol `postgres`):

```sql
-- Agregar (el correo en minúsculas y sin espacios).
insert into public.usuarios_autorizados (correo, nombre)
values ('correo@ejemplo.com', 'Nombre de ejemplo');

-- Quitar el acceso: se desactiva, no se borra.
update public.usuarios_autorizados
   set activo = false
 where correo = 'correo@ejemplo.com';
```

La app no puede insertar ni modificar esta tabla.

## Cómo crear o quitar un código de acceso

Requisito (una sola vez): en Authentication → Sign In / Providers, activar **Allow anonymous sign-ins**. La app abre una sesión anónima y la base la autoriza solo si se canjea un código activo.

Desde el editor SQL de Supabase (rol `postgres`). El código nunca se guarda en claro ni va en el repositorio: se escribe solo aquí y se le entrega a la persona.

```sql
-- Crear (8 caracteres o más; mejor 12 con letras y números al azar).
select public.crear_codigo_acceso('Nombre de ejemplo', 'codigo-de-ejemplo-123');

-- Quitar el acceso: se desactiva, no se borra. Todas las sesiones que
-- entraron con ese código pierden el acceso al instante.
update public.codigos_acceso
   set activo = false
 where nombre = 'Nombre de ejemplo';
```

- Cada código es de una persona: en la bitácora aparece como "Nombre (código)".
- Límite de intentos: 5 códigos malos por sesión, o 20 entre todas, en 15 minutos; después se rechaza todo intento hasta que pasen los 15 minutos. Quien ya entró no se ve afectado.
- Después de borrar los datos del navegador hay que volver a escribir el código.

## Lista de verificación de seguridad (manual)

Hacerla después de aplicar las migraciones y cada vez que se cambien políticas o funciones. En los ejemplos del editor SQL, `begin` y `rollback` dejan todo como estaba. `set local request.jwt.claims` simula el token de un usuario; los correos y el uuid son inventados.

1. **Solo Google.** En Authentication → Providers, Google es el único proveedor activo y Email está apagado.

2. **RLS activada y forzada en todas las tablas.** Debe salir `true` en las dos columnas para las diez tablas:

   ```sql
   select relname, relrowsecurity, relforcerowsecurity
     from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r'
    order by relname;
   ```

3. **Ninguna tabla acepta escritura directa desde la app.** La consulta solo debe mostrar `SELECT` para `authenticated` y nada para `anon`:

   ```sql
   select grantee, table_name, privilege_type
     from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
    order by grantee, table_name, privilege_type;
   ```

   Y como usuario autorizado (ver punto 5), un `insert`, `update` o `delete` directo en cualquier tabla debe fallar con "permission denied":

   ```sql
   insert into public.productos (nombre, unidades_por_caja, precio_unidad, precio_caja)
   values ('Producto de prueba', 10, 1000, 9000);
   ```

4. **Un correo no autorizado ve cero datos y no puede escribir.** Todas las cuentas deben dar 0 y la función debe fallar con "No autorizado":

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
   select public.crear_producto('Producto de prueba', 10, false, 1000, 9000); -- error
   rollback;
   ```

   Con la app: iniciar sesión con una cuenta de Google que no esté en la lista y comprobar que no aparece ningún dato y que no se puede registrar nada.

5. **Un correo autorizado lee todo y escribe solo por funciones.** Repetir el punto 4 con un correo de la lista (por ejemplo `correo@ejemplo.com`, si se agregó como prueba) y el uuid de un usuario real de Authentication: `es_usuario_autorizado()` da `true`, `usuarios_autorizados` muestra la lista completa, `crear_producto` funciona y deja una fila en la bitácora con su correo. Terminar con `rollback`.

6. **La bitácora no se puede editar ni borrar.** Como usuario autorizado (punto 5), estas sentencias deben fallar con "permission denied". Desde el editor SQL, como `postgres`, deben fallar con el mensaje del disparador ("no está permitida"):

   ```sql
   update public.bitacora set accion = 'registrar-compra';
   delete from public.bitacora;
   ```

7. **Nada se borra en ninguna tabla y el inventario no se edita.** Desde el editor SQL, `delete from public.ventas;` y `update public.movimientos_inventario set unidades = unidades + 1;` deben fallar con el mensaje del disparador.

8. **El rol anon no accede a nada.** Las dos sentencias deben fallar con "permission denied":

   ```sql
   begin;
   set local role anon;
   select count(*) from public.productos;
   select public.registrar_venta(current_date, '[]'::jsonb);
   rollback;
   ```

   También desde afuera: una petición a `https://<proyecto>.supabase.co/rest/v1/productos` con solo la clave anon (sin sesión) debe responder con error de permisos.

9. **Las funciones DEFINER tienen dueño y search_path.** Para cada función de escritura debe salir `postgres`, `true` y `search_path=""`:

   ```sql
   select p.proname, pg_get_userbyid(p.proowner) as dueno, p.prosecdef, p.proconfig
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef
    order by p.proname;
   ```
