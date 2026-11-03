-- =============================================================================
-- 0003_seguridad_rls.sql
--
-- Qué hace: protege todos los datos. Define quién es un usuario autorizado,
-- activa y fuerza RLS en todas las tablas, deja las tablas solo de lectura
-- para la app, quita todo acceso al rol anon, y bloquea el borrado en todas
-- las tablas y la modificación de la bitácora.
-- Cómo lo hace: es_usuario_autorizado() compara el correo del token de
-- Supabase con la lista de usuarios_autorizados activos. El rol
-- authenticated solo recibe SELECT, con políticas que exigen ser usuario
-- autorizado. Toda escritura pasa por las funciones de
-- 0004_operaciones_atomicas.sql, que son SECURITY DEFINER y tienen como
-- dueño al rol postgres. Como RLS está forzada (también para el dueño de las
-- tablas), postgres tiene políticas explícitas para leer, agregar y
-- actualizar; nunca para borrar.
-- Por qué: el repositorio es público y la clave anon de Supabase viaja en el
-- cliente; lo único que protege los datos es la base de datos. Si la app no
-- puede escribir directo en las tablas, ningún cambio se salta la bitácora
-- ni las reglas de las funciones. Nada se borra, y la bitácora debe quedar
-- intacta para auditar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Función: correo_del_token
--
-- Qué hace: devuelve el correo del usuario que hace la consulta.
-- Cómo lo hace: lo toma del token (auth.jwt() ->> 'email'), le quita los
-- blancos de los lados y lo pasa a minúsculas; si no hay token, devuelve ''.
-- Por qué: usuarios_autorizados guarda los correos normalizados; comparar
-- siempre la misma forma evita dejar fuera a alguien por una mayúscula, igual
-- que estaAutorizado en src/domain/compartido/acceso.ts. Es de uso interno:
-- la llaman es_usuario_autorizado y las funciones de 0004 para llenar el
-- usuario de la bitácora.
-- -----------------------------------------------------------------------------
create function public.correo_del_token()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(regexp_replace(coalesce(auth.jwt() ->> 'email', ''), '^\s+|\s+$', '', 'g'));
$$;


-- -----------------------------------------------------------------------------
-- Función: es_usuario_autorizado
--
-- Qué hace: dice si quien hace la consulta está en la lista de correos
-- autorizados y activos. Devuelve solo un booleano.
-- Cómo lo hace: busca su correo (correo_del_token) en usuarios_autorizados.
-- Es SECURITY DEFINER y su dueño es postgres: corre con los permisos de
-- postgres, cuya política sobre usuarios_autorizados (más abajo) no llama a
-- esta función.
-- Por qué: la política de lectura de usuarios_autorizados para authenticated
-- llama a esta función. Si la función corriera con los permisos de quien
-- consulta, leer la tabla volvería a pasar por esa misma política y se
-- llamaría a sí misma sin fin. Como DEFINER, la consulta interna pasa por la
-- política de postgres y no hay recursión. Se protege así: solo devuelve un
-- booleano (no expone filas), search_path vacío obliga a escribir public. y
-- auth. (nadie puede cambiar a qué tabla apuntan los nombres), y solo
-- authenticated puede ejecutarla. No verifica autorización al empezar porque
-- ella misma es esa verificación.
-- -----------------------------------------------------------------------------
create function public.es_usuario_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.usuarios_autorizados as u
     where u.correo = public.correo_del_token()
       and u.activo
  );
$$;

alter function public.es_usuario_autorizado() owner to postgres;


-- -----------------------------------------------------------------------------
-- RLS activada y forzada en todas las tablas.
--
-- Qué hace: obliga a que cada fila pase por las políticas.
-- Cómo lo hace: ENABLE la activa; FORCE la aplica también al dueño de la
-- tabla (postgres).
-- Por qué: sin una política que lo permita, nadie ve ni escribe nada. Con
-- FORCE no se depende de que el dueño se salte RLS o no: lo que puede hacer
-- queda escrito en sus propias políticas.
-- -----------------------------------------------------------------------------
alter table public.usuarios_autorizados enable row level security;
alter table public.usuarios_autorizados force row level security;
alter table public.productos enable row level security;
alter table public.productos force row level security;
alter table public.compras enable row level security;
alter table public.compras force row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.movimientos_inventario force row level security;
alter table public.ventas enable row level security;
alter table public.ventas force row level security;
alter table public.venta_items enable row level security;
alter table public.venta_items force row level security;
alter table public.deudas enable row level security;
alter table public.deudas force row level security;
alter table public.abonos_deuda enable row level security;
alter table public.abonos_deuda force row level security;
alter table public.cierres enable row level security;
alter table public.cierres force row level security;
alter table public.bitacora enable row level security;
alter table public.bitacora force row level security;


-- -----------------------------------------------------------------------------
-- Privilegios: primero se quita todo, luego se da lo mínimo.
--
-- Qué hace: quita todos los privilegios a public, anon y authenticated, y
-- también los que Supabase da por defecto a las tablas y funciones nuevas.
-- Luego da a authenticated solo SELECT en cada tabla y en la vista.
-- Cómo lo hace: REVOKE ALL sobre tablas, vistas, funciones y secuencias del
-- esquema, ALTER DEFAULT PRIVILEGES para lo que se cree después, y un GRANT
-- SELECT por tabla.
-- Por qué: anon no accede a nada. authenticated no puede escribir directo:
-- toda escritura pasa por las funciones de 0004. service_role no se toca: se
-- salta RLS y solo debe usarse en un servidor, nunca en el cliente.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;

grant select on public.usuarios_autorizados to authenticated;
grant select on public.productos to authenticated;
grant select on public.compras to authenticated;
grant select on public.movimientos_inventario to authenticated;
grant select on public.ventas to authenticated;
grant select on public.venta_items to authenticated;
grant select on public.deudas to authenticated;
grant select on public.abonos_deuda to authenticated;
grant select on public.cierres to authenticated;
grant select on public.bitacora to authenticated;
-- La vista respeta la RLS de movimientos_inventario (security_invoker).
grant select on public.stock_actual to authenticated;


-- -----------------------------------------------------------------------------
-- Privilegios de las funciones de 0001 y de este archivo.
--
-- Qué hace: ninguna función interna se puede llamar desde la app; solo
-- es_usuario_autorizado, que la necesitan las políticas.
-- Cómo lo hace: un REVOKE explícito por función a public y anon (y a
-- authenticated en las internas), y un GRANT de es_usuario_autorizado a
-- authenticated.
-- Por qué: las funciones internas corren dentro de las funciones de 0004 o
-- de los disparadores, con los permisos de postgres; la app no las necesita.
-- -----------------------------------------------------------------------------
revoke all on function public.unidades_de_presentacion(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.completar_unidades() from public, anon, authenticated;
revoke all on function public.impedir_reactivar() from public, anon, authenticated;
revoke all on function public.correo_del_token() from public, anon, authenticated;
revoke all on function public.es_usuario_autorizado() from public, anon;
grant execute on function public.es_usuario_autorizado() to authenticated;


-- -----------------------------------------------------------------------------
-- Políticas de lectura para la app (rol authenticated).
--
-- Qué hace: solo los usuarios autorizados leen; nadie de la app escribe.
-- Cómo lo hace: una política FOR SELECT por tabla con
-- (select public.es_usuario_autorizado()), que se evalúa una sola vez por
-- consulta gracias al select. usuarios_autorizados también: los autorizados
-- ven la lista completa, solo para leer.
-- Por qué: cualquier persona puede tener una sesión de Google válida; solo
-- las de la lista deben ver los datos.
-- -----------------------------------------------------------------------------
create policy usuarios_autorizados_leer on public.usuarios_autorizados for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy productos_leer on public.productos for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy compras_leer on public.compras for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy movimientos_leer on public.movimientos_inventario for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy ventas_leer on public.ventas for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy venta_items_leer on public.venta_items for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy deudas_leer on public.deudas for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy abonos_leer on public.abonos_deuda for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy cierres_leer on public.cierres for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy bitacora_leer on public.bitacora for select to authenticated
  using ((select public.es_usuario_autorizado()));


-- -----------------------------------------------------------------------------
-- Políticas del rol postgres (dueño de las tablas y de las funciones).
--
-- Qué hace: permite a postgres leer, agregar y, donde corresponde,
-- actualizar. Nunca borrar. En la bitácora, en los movimientos y en los
-- renglones de venta, solo leer y agregar.
-- Cómo lo hace: políticas FOR SELECT, FOR INSERT y FOR UPDATE con true.
-- Por qué: las funciones SECURITY DEFINER de 0004 y es_usuario_autorizado
-- corren como postgres. Con RLS forzada, postgres también pasa por las
-- políticas, y no se asume que se la salte; sin estas políticas, las
-- funciones no podrían leer ni escribir. Lo que hacen las funciones lo
-- limitan sus propias validaciones (empezando por es_usuario_autorizado).
-- Estas políticas también permiten administrar usuarios_autorizados a mano
-- desde el editor SQL, que corre como postgres.
-- -----------------------------------------------------------------------------
create policy usuarios_autorizados_postgres_leer on public.usuarios_autorizados for select to postgres using (true);
create policy usuarios_autorizados_postgres_agregar on public.usuarios_autorizados for insert to postgres with check (true);
create policy usuarios_autorizados_postgres_editar on public.usuarios_autorizados for update to postgres using (true) with check (true);

create policy productos_postgres_leer on public.productos for select to postgres using (true);
create policy productos_postgres_agregar on public.productos for insert to postgres with check (true);
create policy productos_postgres_editar on public.productos for update to postgres using (true) with check (true);

create policy compras_postgres_leer on public.compras for select to postgres using (true);
create policy compras_postgres_agregar on public.compras for insert to postgres with check (true);
create policy compras_postgres_editar on public.compras for update to postgres using (true) with check (true);

create policy movimientos_postgres_leer on public.movimientos_inventario for select to postgres using (true);
create policy movimientos_postgres_agregar on public.movimientos_inventario for insert to postgres with check (true);

create policy ventas_postgres_leer on public.ventas for select to postgres using (true);
create policy ventas_postgres_agregar on public.ventas for insert to postgres with check (true);
create policy ventas_postgres_editar on public.ventas for update to postgres using (true) with check (true);

create policy venta_items_postgres_leer on public.venta_items for select to postgres using (true);
create policy venta_items_postgres_agregar on public.venta_items for insert to postgres with check (true);

create policy deudas_postgres_leer on public.deudas for select to postgres using (true);
create policy deudas_postgres_agregar on public.deudas for insert to postgres with check (true);
create policy deudas_postgres_editar on public.deudas for update to postgres using (true) with check (true);

create policy abonos_postgres_leer on public.abonos_deuda for select to postgres using (true);
create policy abonos_postgres_agregar on public.abonos_deuda for insert to postgres with check (true);
create policy abonos_postgres_editar on public.abonos_deuda for update to postgres using (true) with check (true);

create policy cierres_postgres_leer on public.cierres for select to postgres using (true);
create policy cierres_postgres_agregar on public.cierres for insert to postgres with check (true);
create policy cierres_postgres_editar on public.cierres for update to postgres using (true) with check (true);

create policy bitacora_postgres_leer on public.bitacora for select to postgres using (true);
create policy bitacora_postgres_agregar on public.bitacora for insert to postgres with check (true);


-- -----------------------------------------------------------------------------
-- Función de disparador: impedir_cambio
--
-- Qué hace: lanza un error ante un borrado (en cualquier tabla) o una
-- modificación (en la bitácora y en los movimientos de inventario).
-- Cómo lo hace: se ejecuta antes de DELETE, TRUNCATE o UPDATE y aborta la
-- operación con un mensaje que dice cuál fue y en qué tabla.
-- Por qué: ni la app ni las políticas permiten borrar, pero esto también
-- frena a postgres (las funciones o un administrador que se equivoque desde
-- el editor SQL). Nada se borra y la bitácora no se edita.
-- -----------------------------------------------------------------------------
create function public.impedir_cambio()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'La operación % no está permitida en %: nada se borra y la bitácora no se modifica',
    tg_op, tg_table_name;
end;
$$;

revoke all on function public.impedir_cambio() from public, anon, authenticated;

-- Ningún borrado en ninguna tabla.
create trigger usuarios_autorizados_sin_borrado before delete on public.usuarios_autorizados
  for each row execute function public.impedir_cambio();
create trigger productos_sin_borrado before delete on public.productos
  for each row execute function public.impedir_cambio();
create trigger compras_sin_borrado before delete on public.compras
  for each row execute function public.impedir_cambio();
create trigger movimientos_sin_borrado before delete on public.movimientos_inventario
  for each row execute function public.impedir_cambio();
create trigger ventas_sin_borrado before delete on public.ventas
  for each row execute function public.impedir_cambio();
create trigger venta_items_sin_borrado before delete on public.venta_items
  for each row execute function public.impedir_cambio();
create trigger deudas_sin_borrado before delete on public.deudas
  for each row execute function public.impedir_cambio();
create trigger abonos_sin_borrado before delete on public.abonos_deuda
  for each row execute function public.impedir_cambio();
create trigger cierres_sin_borrado before delete on public.cierres
  for each row execute function public.impedir_cambio();
create trigger bitacora_sin_borrado before delete on public.bitacora
  for each row execute function public.impedir_cambio();

-- Tampoco se vacía ninguna tabla de golpe.
create trigger usuarios_autorizados_sin_vaciar before truncate on public.usuarios_autorizados
  for each statement execute function public.impedir_cambio();
create trigger productos_sin_vaciar before truncate on public.productos
  for each statement execute function public.impedir_cambio();
create trigger compras_sin_vaciar before truncate on public.compras
  for each statement execute function public.impedir_cambio();
create trigger movimientos_sin_vaciar before truncate on public.movimientos_inventario
  for each statement execute function public.impedir_cambio();
create trigger ventas_sin_vaciar before truncate on public.ventas
  for each statement execute function public.impedir_cambio();
create trigger venta_items_sin_vaciar before truncate on public.venta_items
  for each statement execute function public.impedir_cambio();
create trigger deudas_sin_vaciar before truncate on public.deudas
  for each statement execute function public.impedir_cambio();
create trigger abonos_sin_vaciar before truncate on public.abonos_deuda
  for each statement execute function public.impedir_cambio();
create trigger cierres_sin_vaciar before truncate on public.cierres
  for each statement execute function public.impedir_cambio();
create trigger bitacora_sin_vaciar before truncate on public.bitacora
  for each statement execute function public.impedir_cambio();

-- La bitácora no se modifica, ni siquiera por las funciones ni por postgres.
create trigger bitacora_sin_modificar before update on public.bitacora
  for each row execute function public.impedir_cambio();

-- Los movimientos de inventario tampoco se modifican: el stock es su suma, y
-- editar uno desde el editor SQL cambiaría el inventario sin dejar rastro.
-- Un error se corrige con un movimiento compensatorio (compensa_a), no con
-- un UPDATE. Ninguna función del sistema actualiza esta tabla.
create trigger movimientos_sin_modificar before update on public.movimientos_inventario
  for each row execute function public.impedir_cambio();
