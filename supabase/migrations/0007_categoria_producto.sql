-- =============================================================================
-- Migración 0007: categoría de producto (cerveza, licor, otro)
--
-- Qué hace: agrega `categoria` a `productos` y reemplaza `crear_producto` y
-- `editar_producto` para recibirla (`p_categoria`).
-- Cómo lo hace: columna con valor por defecto 'cerveza' (los productos que ya
-- existen quedan como cerveza y se pueden editar), una restricción que obliga
-- a que un licor se maneje por botella entera (1 unidad por caja y sin
-- sixpack), y las dos funciones nuevas. Editar el producto cambiando solo la
-- categoría se registra como 'editar-producto'.
-- Por qué: el local vende también botellas de licor. El licor no tiene
-- sixpack ni caja; la regla vive en la base para que no dependa de la app.
-- =============================================================================

alter table public.productos
  add column categoria text not null default 'cerveza'
    check (categoria in ('cerveza', 'licor', 'otro'));

alter table public.productos
  add constraint productos_licor_por_botella
    check (categoria <> 'licor' or (unidades_por_caja = 1 and not maneja_sixpack));

comment on column public.productos.categoria is
  'cerveza, licor u otro. El licor se vende por botella entera (sin sixpack ni caja).';

-- crear_producto con categoría
drop function public.crear_producto(text, integer, boolean, bigint, bigint);

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

-- editar_producto con categoría
drop function public.editar_producto(uuid, text, integer, boolean, bigint, bigint);

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
  if exists (
    select 1 from public.productos
     where lower(btrim(nombre)) = lower(public.texto_sin_blancos_lados(p_nombre))
       and id <> p_producto_id
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
