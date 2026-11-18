-- =============================================================================
-- Migración 0011: archivar productos (reiniciar el inventario desde cero)
--
-- Qué hace: agrega la marca `activo` a `productos`, una función
-- `archivar_productos(p_motivo)` que retira de la app todos los productos
-- activos, y la acción 'archivar-producto' en la bitácora.
-- Cómo lo hace:
--   * `activo` es verdadero por defecto, así los productos que ya existen
--     siguen igual hasta que alguien los archive.
--   * El nombre único pasa a valer solo entre productos activos, para poder
--     crear de nuevo "Costeñita" aunque exista una Costeñita archivada.
--   * `crear_producto` y `editar_producto` se reemplazan para comparar el
--     nombre solo con activos; un archivado no se edita.
--   * Dos disparadores impiden comprar, trasladar o ajustar un producto
--     archivado. Las ventas viejas y las anulaciones siguen funcionando.
--   * `archivar_productos` verifica al usuario, exige motivo y anota un
--     registro 'archivar-producto' por producto, con antes y después.
-- Por qué: el negocio quiere empezar el inventario de cero. Un producto nuevo
-- tiene id nuevo, así que su stock y su costo arrancan vacíos. Las ventas,
-- compras y cierres viejos siguen apuntando al producto archivado, de modo
-- que el historial y los recálculos no se rompen y nada se borra.
-- =============================================================================

alter table public.productos
  add column activo boolean not null default true;

comment on column public.productos.activo is
  'Falso si el producto se archivó: no aparece en la app pero conserva su historial.';

-- Nombre único solo entre productos activos.
drop index public.productos_nombre_unico;
create unique index productos_nombre_unico
  on public.productos (lower(btrim(nombre)))
  where activo;

-- Acción nueva en la lista fija de la bitácora.
alter table public.bitacora drop constraint bitacora_accion_check;
alter table public.bitacora add constraint bitacora_accion_check check (accion in (
    'registrar-compra',
    'corregir-costo-compra',
    'registrar-traslado',
    'registrar-ajuste',
    'registrar-venta',
    'registrar-cierre-diario',
    'registrar-cierre-semanal',
    'corregir-dinero-cierre',
    'registrar-deuda',
    'registrar-abono',
    'cambiar-precio',
    'crear-producto',
    'editar-producto',
    'archivar-producto',
    'anular-registro',
    'recalcular-cierre-diario',
    'recalcular-cierre-semanal'
  ));


-- -----------------------------------------------------------------------------
-- exigir_producto_activo (disparador)
-- Qué hace: rechaza una compra, un traslado o un ajuste de un producto
-- archivado.
-- Cómo lo hace: busca el producto de la fila nueva; en movimientos solo revisa
-- traslados y ajustes (las ventas y la anulación de compras viejas siguen).
-- Por qué: un producto archivado ya no tiene inventario; moverlo dejaría
-- stock fantasma que nadie ve.
-- -----------------------------------------------------------------------------
create function public.exigir_producto_activo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Ifs separados: plpgsql resuelve new.tipo aunque la tabla no lo tenga.
  if tg_table_name = 'movimientos_inventario' then
    if new.tipo not in ('traslado', 'ajuste') then
      return new;
    end if;
  end if;
  if not exists (select 1 from public.productos where id = new.producto_id and activo) then
    raise exception 'El producto está archivado: créalo de nuevo para mover su inventario';
  end if;
  return new;
end;
$$;

revoke all on function public.exigir_producto_activo() from public, anon, authenticated;

create trigger compras_producto_activo before insert on public.compras
  for each row execute function public.exigir_producto_activo();
create trigger movimientos_producto_activo before insert on public.movimientos_inventario
  for each row execute function public.exigir_producto_activo();


-- -----------------------------------------------------------------------------
-- archivar_productos
-- Qué hace: archiva todos los productos activos y devuelve cuántos archivó.
-- Cómo lo hace: verifica al usuario y el motivo, marca cada producto activo
-- como inactivo y anota 'archivar-producto' con antes, después y motivo.
-- Por qué: reiniciar el inventario es una sola acción del negocio; hacerla en
-- una transacción evita quedar con la mitad de los productos archivados.
-- -----------------------------------------------------------------------------
create function public.archivar_productos(p_motivo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_antes public.productos;
  v_despues public.productos;
  v_total integer;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;
  v_motivo := public.motivo_obligatorio(p_motivo);
  v_total := 0;

  for v_antes in select * from public.productos where activo order by nombre for update loop
    update public.productos set activo = false where id = v_antes.id
    returning * into v_despues;
    perform public.anotar_bitacora('archivar-producto', 'productos', v_antes.id, to_jsonb(v_antes), to_jsonb(v_despues), v_motivo);
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

alter function public.archivar_productos(text) owner to postgres;
revoke all on function public.archivar_productos(text) from public, anon;
grant execute on function public.archivar_productos(text) to authenticated;


-- crear_producto: el nombre solo choca con productos activos
drop function public.crear_producto(text, integer, boolean, bigint, bigint, text);

create function public.crear_producto(
  p_nombre text,
  p_unidades_por_caja integer,
  p_maneja_sixpack boolean,
  p_precio_unidad bigint,
  p_precio_caja bigint,
  p_categoria text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if exists (
    select 1 from public.productos
     where lower(btrim(nombre)) = lower(public.texto_sin_blancos_lados(p_nombre))
       and activo
  ) then
    raise exception 'Ya existe un producto llamado %', public.texto_sin_blancos_lados(p_nombre);
  end if;

  insert into public.productos
    (nombre, unidades_por_caja, maneja_sixpack, precio_unidad, precio_caja, categoria, creado_por)
  values
    (public.texto_sin_blancos_lados(p_nombre), p_unidades_por_caja, p_maneja_sixpack,
     p_precio_unidad, p_precio_caja, p_categoria, auth.uid())
  returning * into v_producto;

  perform public.anotar_bitacora('crear-producto', 'productos', v_producto.id, null, to_jsonb(v_producto), null);
  return v_producto.id;
end;
$$;

-- editar_producto: no edita archivados y el nombre solo choca con activos
drop function public.editar_producto(uuid, text, integer, boolean, bigint, bigint, text);

create function public.editar_producto(
  p_producto_id uuid,
  p_nombre text,
  p_unidades_por_caja integer,
  p_maneja_sixpack boolean,
  p_precio_unidad bigint,
  p_precio_caja bigint,
  p_categoria text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.productos;
  v_despues public.productos;
  v_accion text;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  select * into v_antes from public.productos where id = p_producto_id for update;
  if not found then
    raise exception 'El producto % no existe', p_producto_id;
  end if;
  if not v_antes.activo then
    raise exception 'El producto % está archivado y no se puede editar', v_antes.nombre;
  end if;
  if exists (
    select 1 from public.productos
     where lower(btrim(nombre)) = lower(public.texto_sin_blancos_lados(p_nombre))
       and id <> p_producto_id
       and activo
  ) then
    raise exception 'Ya existe un producto llamado %', public.texto_sin_blancos_lados(p_nombre);
  end if;

  update public.productos
     set nombre = public.texto_sin_blancos_lados(p_nombre),
         unidades_por_caja = p_unidades_por_caja,
         maneja_sixpack = p_maneja_sixpack,
         precio_unidad = p_precio_unidad,
         precio_caja = p_precio_caja,
         categoria = p_categoria
   where id = p_producto_id
  returning * into v_despues;

  if to_jsonb(v_despues) = to_jsonb(v_antes) then
    return;
  end if;

  if v_despues.nombre = v_antes.nombre
     and v_despues.unidades_por_caja = v_antes.unidades_por_caja
     and v_despues.maneja_sixpack = v_antes.maneja_sixpack
     and v_despues.categoria = v_antes.categoria then
    v_accion := 'cambiar-precio';
  else
    v_accion := 'editar-producto';
  end if;

  perform public.anotar_bitacora(v_accion, 'productos', p_producto_id, to_jsonb(v_antes), to_jsonb(v_despues), null);
end;
$$;

alter function public.crear_producto(text, integer, boolean, bigint, bigint, text) owner to postgres;
alter function public.editar_producto(uuid, text, integer, boolean, bigint, bigint, text) owner to postgres;

revoke all on function public.crear_producto(text, integer, boolean, bigint, bigint, text) from public, anon;
revoke all on function public.editar_producto(uuid, text, integer, boolean, bigint, bigint, text) from public, anon;

grant execute on function public.crear_producto(text, integer, boolean, bigint, bigint, text) to authenticated;
grant execute on function public.editar_producto(uuid, text, integer, boolean, bigint, bigint, text) to authenticated;
