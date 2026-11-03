-- =============================================================================
-- 0003_seguridad_rls.sql
--
-- Qué hace: protege todos los datos. Define quién es un usuario autorizado,
-- activa y fuerza RLS en todas las tablas, crea las políticas de lectura,
-- inserción y actualización, quita todo acceso al rol anon, y bloquea el
-- borrado en todas las tablas y la modificación de la bitácora.
-- Cómo lo hace: es_usuario_autorizado() compara el correo del token de
-- Supabase con la lista de usuarios_autorizados activos. Las políticas solo
-- dejan pasar a quien cumple esa condición. Los privilegios se dan tabla por
-- tabla y, para UPDATE, columna por columna. No existe ninguna política ni
-- privilegio de DELETE, y además un disparador lo impide.
-- Por qué: el repositorio es público y la clave anon de Supabase viaja en el
-- cliente; lo único que protege los datos es RLS. Nada se borra: los errores
-- se corrigen anulando, y la bitácora debe quedar intacta para auditar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Función: correo_del_token
--
-- Qué hace: devuelve el correo del usuario que hace la consulta.
-- Cómo lo hace: lo toma del token (auth.jwt() ->> 'email'), le quita los
-- blancos de los lados y lo pasa a minúsculas; si no hay token, devuelve ''.
-- Por qué: usuarios_autorizados guarda los correos normalizados; comparar
-- siempre la misma forma evita dejar fuera a alguien por una mayúscula, igual
-- que estaAutorizado en src/domain/compartido/acceso.ts.
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
-- autorizados y activos.
-- Cómo lo hace: busca su correo (correo_del_token) en usuarios_autorizados.
-- Es SECURITY INVOKER: corre con los permisos de quien consulta. La política
-- de usuarios_autorizados deja que cada usuario vea solo su propia fila
-- activa, y eso basta para saber si existe.
-- Por qué: se evita SECURITY DEFINER a propósito. Con RLS forzada, una
-- función definer cuyo dueño no se salte RLS no vería ninguna fila; y si su
-- dueño sí se la salta, sería una puerta abierta innecesaria. Así no hay
-- recursión entre la política y la función, ni permisos de más. search_path
-- vacío obliga a escribir public. y auth., para que nadie pueda cambiar a qué
-- tabla apuntan los nombres.
-- -----------------------------------------------------------------------------
create function public.es_usuario_autorizado()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
      from public.usuarios_autorizados as u
     where u.correo = public.correo_del_token()
       and u.activo
  );
$$;


-- -----------------------------------------------------------------------------
-- RLS activada y forzada en todas las tablas.
--
-- Qué hace: obliga a que cada fila pase por las políticas.
-- Cómo lo hace: ENABLE la activa; FORCE la aplica también al dueño de la tabla.
-- Por qué: sin políticas que lo permitan, nadie ve ni escribe nada.
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
-- Cómo lo hace: REVOKE ALL sobre tablas, vistas y funciones del esquema, y
-- ALTER DEFAULT PRIVILEGES para lo que se cree después.
-- Por qué: el rol anon no debe acceder a nada; authenticated solo a lo que se
-- le da abajo. service_role no se toca: se salta RLS y solo debe usarse en un
-- servidor, nunca en el cliente.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;

-- usuarios_autorizados: la app solo la lee.
grant select on public.usuarios_autorizados to authenticated;

-- productos: se crean y se editan (nombre, presentación y precios).
grant select, insert on public.productos to authenticated;
grant update (nombre, unidades_por_caja, maneja_sixpack, precio_unidad, precio_caja)
  on public.productos to authenticated;

-- compras: se registran; después solo se corrige el costo o se anula.
grant select, insert on public.compras to authenticated;
grant update (costo_total, estado) on public.compras to authenticated;

-- movimientos de inventario: solo se agregan; nunca se modifican.
grant select, insert on public.movimientos_inventario to authenticated;

-- ventas: se registran; después solo se anulan.
grant select, insert on public.ventas to authenticated;
grant update (estado) on public.ventas to authenticated;

-- renglones de venta: solo se agregan.
grant select, insert on public.venta_items to authenticated;

-- deudas: solo se agregan.
grant select, insert on public.deudas to authenticated;

-- abonos: se registran; después solo se anulan.
grant select, insert on public.abonos_deuda to authenticated;
grant update (estado) on public.abonos_deuda to authenticated;

-- cierres: se registran; recalcular cambia el momento, los costos y el resultado.
grant select, insert on public.cierres to authenticated;
grant update (calculado_en, costos_usados, resultado) on public.cierres to authenticated;

-- bitácora: solo inserción y lectura.
grant select, insert on public.bitacora to authenticated;

-- stock: solo lectura (la vista respeta RLS de movimientos_inventario).
grant select on public.stock_actual to authenticated;

-- Funciones que usan las políticas y los disparadores.
grant execute on function public.correo_del_token() to authenticated;
grant execute on function public.es_usuario_autorizado() to authenticated;
grant execute on function public.unidades_de_presentacion(uuid, text, integer) to authenticated;


-- -----------------------------------------------------------------------------
-- Políticas de usuarios_autorizados.
--
-- Qué hace: cada usuario de la app ve solo su propia fila, si está activa.
-- La administración manual (rol postgres, desde el editor SQL) puede leer,
-- agregar y desactivar correos.
-- Cómo lo hace: la política de authenticated compara el correo con el del
-- token sin llamar a es_usuario_autorizado (que consulta esta misma tabla).
-- Las de postgres existen porque FORCE aplica RLS también al dueño.
-- Por qué: la app no inserta ni modifica esta tabla; evita recursión entre la
-- política y la función, y no deja ver la lista completa de correos.
-- -----------------------------------------------------------------------------
create policy usuarios_autorizados_leer_propio
  on public.usuarios_autorizados for select to authenticated
  using (activo and correo = (select public.correo_del_token()));

create policy usuarios_autorizados_admin_leer
  on public.usuarios_autorizados for select to postgres
  using (true);

create policy usuarios_autorizados_admin_agregar
  on public.usuarios_autorizados for insert to postgres
  with check (true);

create policy usuarios_autorizados_admin_editar
  on public.usuarios_autorizados for update to postgres
  using (true) with check (true);


-- -----------------------------------------------------------------------------
-- Políticas de las tablas de datos.
--
-- Qué hace: solo los usuarios autorizados leen, insertan y (donde se permite)
-- actualizan. Al insertar, creado_por debe ser el usuario actual.
-- Cómo lo hace: (select public.es_usuario_autorizado()) se evalúa una sola
-- vez por consulta gracias al select; creado_por = auth.uid() impide
-- registrar algo a nombre de otro.
-- Por qué: cualquier persona puede tener una sesión de Google válida; solo
-- las de la lista deben ver o tocar los datos.
-- -----------------------------------------------------------------------------

-- productos
create policy productos_leer on public.productos for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy productos_agregar on public.productos for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));
create policy productos_editar on public.productos for update to authenticated
  using ((select public.es_usuario_autorizado()))
  with check ((select public.es_usuario_autorizado()));

-- compras
create policy compras_leer on public.compras for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy compras_agregar on public.compras for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));
create policy compras_editar on public.compras for update to authenticated
  using ((select public.es_usuario_autorizado()))
  with check ((select public.es_usuario_autorizado()));

-- movimientos_inventario
create policy movimientos_leer on public.movimientos_inventario for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy movimientos_agregar on public.movimientos_inventario for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));

-- ventas
create policy ventas_leer on public.ventas for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy ventas_agregar on public.ventas for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));
create policy ventas_editar on public.ventas for update to authenticated
  using ((select public.es_usuario_autorizado()))
  with check ((select public.es_usuario_autorizado()));

-- venta_items
create policy venta_items_leer on public.venta_items for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy venta_items_agregar on public.venta_items for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));

-- deudas
create policy deudas_leer on public.deudas for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy deudas_agregar on public.deudas for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));

-- abonos_deuda
create policy abonos_leer on public.abonos_deuda for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy abonos_agregar on public.abonos_deuda for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));
create policy abonos_editar on public.abonos_deuda for update to authenticated
  using ((select public.es_usuario_autorizado()))
  with check ((select public.es_usuario_autorizado()));

-- cierres
create policy cierres_leer on public.cierres for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy cierres_agregar on public.cierres for insert to authenticated
  with check ((select public.es_usuario_autorizado()) and creado_por = (select auth.uid()));
create policy cierres_editar on public.cierres for update to authenticated
  using ((select public.es_usuario_autorizado()))
  with check ((select public.es_usuario_autorizado()));

-- bitacora: solo leer y agregar; el usuario registrado debe ser el del token.
create policy bitacora_leer on public.bitacora for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy bitacora_agregar on public.bitacora for insert to authenticated
  with check (
    (select public.es_usuario_autorizado())
    and creado_por = (select auth.uid())
    and usuario = (select public.correo_del_token())
  );


-- -----------------------------------------------------------------------------
-- Función de disparador: impedir_cambio
--
-- Qué hace: lanza un error ante un borrado (en cualquier tabla) o una
-- modificación (en la bitácora).
-- Cómo lo hace: se ejecuta antes de DELETE, TRUNCATE o UPDATE y aborta la
-- operación con un mensaje que dice cuál fue y en qué tabla.
-- Por qué: los privilegios ya lo impiden para la app, pero esto también frena
-- a un administrador que se equivoque desde el editor SQL. Nada se borra y la
-- bitácora no se edita.
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

-- La bitácora no se modifica, ni siquiera por usuarios autorizados.
create trigger bitacora_sin_modificar before update on public.bitacora
  for each row execute function public.impedir_cambio();
