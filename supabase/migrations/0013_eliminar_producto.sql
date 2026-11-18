-- =============================================================================
-- Migración 0013: eliminar un producto sin tocar lo ya registrado
--
-- Qué hace: agrega la marca `activo` a `productos`, la función
-- `eliminar_producto(p_producto_id, p_motivo)` y la acción 'eliminar-producto'
-- en la bitácora.
-- Cómo lo hace:
--   * `activo` es verdadero por defecto: los productos que ya existen siguen
--     igual.
--   * Eliminar no borra la fila: la marca como inactiva. Así las ventas,
--     compras, cierres y la bitácora viejos siguen sabiendo qué producto era.
--   * Solo se elimina un producto sin existencias (bodega y nevera en cero),
--     para que el inventario no pierda unidades que nadie ve.
--   * El nombre único pasa a valer solo entre productos activos: se puede
--     crear otra vez un producto con el nombre de uno eliminado.
--   * `crear_producto` y `editar_producto` se reemplazan para comparar el
--     nombre solo con activos; un eliminado no se edita.
--   * Dos disparadores impiden comprar, trasladar o ajustar un producto
--     eliminado. Las ventas viejas y las anulaciones siguen funcionando.
-- Por qué: el negocio quiere quitar productos que ya no maneja sin dañar el
-- historial. "Nada se borra" sigue valiendo: eliminar es una marca con motivo
-- en la bitácora.
-- =============================================================================

alter table public.productos
  add column activo boolean not null default true;

comment on column public.productos.activo is
  'Falso si el producto se eliminó: no aparece en la app pero conserva su historial.';

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
    'eliminar-producto',
    'anular-registro',
    'recalcular-cierre-diario',
    'recalcular-cierre-semanal'
  ));


-- -----------------------------------------------------------------------------
-- exigir_producto_activo (disparador)
-- Qué hace: rechaza una compra, un traslado o un ajuste de un producto
-- eliminado.
-- Cómo lo hace: busca el producto de la fila nueva; en movimientos solo revisa
-- traslados y ajustes (las ventas y la anulación de compras viejas siguen).
-- Por qué: un producto eliminado ya no tiene inventario; moverlo dejaría
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
    raise exception 'El producto fue eliminado: créalo de nuevo para mover su inventario';
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
-- eliminar_producto
-- Qué hace: marca un producto como eliminado (inactivo).
-- Cómo lo hace: verifica al usuario y el motivo, bloquea el producto, exige
-- que esté activo y sin existencias, lo marca inactivo y anota
-- 'eliminar-producto' con antes, después y motivo.
-- Por qué: quitar un producto de la app sin borrar su historial; con stock
-- en cero no se pierde inventario.
-- -----------------------------------------------------------------------------
create function public.eliminar_producto(p_producto_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_antes public.productos;
  v_despues public.productos;
  v_stock bigint;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;
  v_motivo := public.motivo_obligatorio(p_motivo);

  select * into v_antes from public.productos where id = p_producto_id for update;
  if not found then
    raise exception 'El producto % no existe', p_producto_id;
  end if;
  if not v_antes.activo then
    raise exception 'El producto % ya fue eliminado', v_antes.nombre;
  end if;

  select coalesce(sum(abs(unidades)), 0) into v_stock
    from public.stock_actual where producto_id = p_producto_id;
  if v_stock <> 0 then
    raise exception 'El producto % todavía tiene existencias: ajústalas a cero antes de eliminarlo', v_antes.nombre;
  end if;

  update public.productos set activo = false where id = p_producto_id
  returning * into v_despues;
  perform public.anotar_bitacora('eliminar-producto', 'productos', p_producto_id, to_jsonb(v_antes), to_jsonb(v_despues), v_motivo);
end;
$$;

alter function public.eliminar_producto(uuid, text) owner to postgres;
revoke all on function public.eliminar_producto(uuid, text) from public, anon;
grant execute on function public.eliminar_producto(uuid, text) to authenticated;


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

-- editar_producto: no edita eliminados y el nombre solo choca con activos
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
    raise exception 'El producto % fue eliminado y no se puede editar', v_antes.nombre;
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
