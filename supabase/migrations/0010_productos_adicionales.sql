-- =============================================================================
-- Migración 0010: productos adicionales en una venta (apartado "Otros")
--
-- Qué hace: crea la tabla `venta_adicionales` y deja que registrar_venta,
-- editar_venta y aplicar_operacion_pendiente reciban, además de los renglones
-- de productos del inventario, una lista de productos adicionales (nombre,
-- cantidad y valor total). anular_venta los incluye en la bitácora.
-- Cómo lo hace: cada adicional se guarda en `venta_adicionales` ligado a la
-- venta, en la misma transacción. No genera movimientos de inventario. El
-- parámetro nuevo `p_adicionales` tiene valor por defecto '[]', así una
-- venta sin "Otros" (o una operación sin conexión guardada antes de esta
-- migración) sigue funcionando igual. Una venta puede tener solo adicionales.
-- Por qué: hay productos que no se manejan en inventario (ej.: hidratantes),
-- pero su plata está en la caja al final del día; sin registrarlos el cierre
-- sale con un sobrante sin explicación. No tienen costo, así que el cierre
-- semanal los muestra aparte, sin utilidad.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tabla: venta_adicionales
--
-- Qué hace: guarda los productos adicionales de una venta.
-- Cómo lo hace: nombre limpio (mismas reglas de la descripción de deudas),
-- cantidad y valor total mayores a cero.
-- Por qué: refleja ProductoAdicional (src/domain/ventas/productosAdicionales.ts).
-- El valor es el total del renglón (5 hidratantes por 25.000 → 25.000).
-- -----------------------------------------------------------------------------
create table public.venta_adicionales (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id),
  descripcion public.descripcion_movimiento not null,
  cantidad integer not null check (cantidad > 0),
  valor bigint not null check (valor > 0),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id)
);

comment on table public.venta_adicionales is
  'Productos vendidos que no están en el inventario (apartado Otros de una venta).';

create index venta_adicionales_venta_idx on public.venta_adicionales (venta_id);

-- Seguridad: igual que venta_items. La app solo lee; escriben las funciones.
alter table public.venta_adicionales enable row level security;
alter table public.venta_adicionales force row level security;

grant select on public.venta_adicionales to authenticated;

create policy venta_adicionales_leer on public.venta_adicionales for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy venta_adicionales_postgres_leer on public.venta_adicionales for select to postgres using (true);
create policy venta_adicionales_postgres_agregar on public.venta_adicionales for insert to postgres with check (true);

-- Nada se borra ni se modifica: un error se corrige anulando la venta.
create trigger venta_adicionales_sin_borrado before delete on public.venta_adicionales
  for each row execute function public.impedir_cambio();
create trigger venta_adicionales_sin_cambio before update on public.venta_adicionales
  for each row execute function public.impedir_cambio();
create trigger venta_adicionales_sin_vaciar before truncate on public.venta_adicionales
  for each statement execute function public.impedir_cambio();


-- -----------------------------------------------------------------------------
-- registrar_venta (con productos adicionales)
--
-- Qué hace: registra una venta con sus renglones del inventario, sus
-- productos adicionales, la salida de la nevera de cada renglón y
-- 'registrar-venta'.
-- Cómo lo hace: igual que en 0004, más p_adicionales: una lista JSON de
-- {descripcion, cantidad, valor}. Cada adicional se limpia con
-- normalizar_descripcion y se valida (cantidad y valor enteros mayores a
-- cero). La venta se rechaza si no hay ningún renglón con cantidad ni ningún
-- adicional. Los adicionales no mueven inventario. Devuelve el id.
-- Por qué: se reemplaza la función (cambia su firma) para que la venta y sus
-- "Otros" queden en una sola transacción. Se borra la anterior antes de
-- crearla para no dejar dos versiones con nombre igual.
-- -----------------------------------------------------------------------------
drop function public.registrar_venta(date, jsonb);

create function public.registrar_venta(
  p_fecha date,
  p_items jsonb,
  p_adicionales jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venta public.ventas;
  v_item jsonb;
  v_cantidad integer;
  v_valor bigint;
  v_con_cantidad integer;
  v_producto public.productos;
  v_precio bigint;
  v_renglon public.venta_items;
  v_renglones jsonb;
  v_adicional public.venta_adicionales;
  v_adicionales jsonb;
  v_lista_adicionales jsonb;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los renglones de la venta deben venir en una lista';
  end if;
  v_lista_adicionales := coalesce(p_adicionales, '[]'::jsonb);
  if jsonb_typeof(v_lista_adicionales) <> 'array' then
    raise exception 'Los productos adicionales deben venir en una lista';
  end if;

  -- Cada cantidad debe ser un entero mayor o igual a cero; se cuentan las
  -- que tienen cantidad para no crear una venta vacía.
  v_con_cantidad := 0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item ->> 'cantidad')::integer;
    if v_cantidad is null or v_cantidad < 0 then
      raise exception 'La cantidad de cada renglón debe ser un entero mayor o igual a cero';
    end if;
    if v_cantidad > 0 then
      v_con_cantidad := v_con_cantidad + 1;
    end if;
  end loop;

  -- Cada adicional debe traer cantidad y valor mayores a cero.
  for v_item in select value from jsonb_array_elements(v_lista_adicionales) loop
    v_cantidad := (v_item ->> 'cantidad')::integer;
    v_valor := (v_item ->> 'valor')::bigint;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'La cantidad del producto adicional debe ser un entero mayor a cero';
    end if;
    if v_valor is null or v_valor <= 0 then
      raise exception 'El valor del producto adicional debe ser un entero mayor a cero';
    end if;
    v_con_cantidad := v_con_cantidad + 1;
  end loop;

  if v_con_cantidad = 0 then
    raise exception 'La venta no tiene nada que registrar: todos los renglones tienen cantidad cero';
  end if;

  insert into public.ventas (fecha, creado_por) values (p_fecha, auth.uid())
  returning * into v_venta;

  v_renglones := '[]'::jsonb;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item ->> 'cantidad')::integer;
    if v_cantidad = 0 then
      continue;
    end if;

    select * into v_producto from public.productos where id = (v_item ->> 'producto_id')::uuid;
    if not found then
      raise exception 'El producto % no existe', v_item ->> 'producto_id';
    end if;

    v_precio := coalesce(
      (v_item ->> 'precio_cobrado')::bigint,
      case v_item ->> 'presentacion'
        when 'unidad' then v_producto.precio_unidad
        when 'sixpack' then v_producto.precio_unidad * 6
        when 'caja' then v_producto.precio_caja
      end
    );

    insert into public.venta_items (venta_id, producto_id, presentacion, cantidad, precio_cobrado, creado_por)
    values (v_venta.id, v_producto.id, v_item ->> 'presentacion', v_cantidad, v_precio, auth.uid())
    returning * into v_renglon;

    insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, venta_id, creado_por)
    values (v_renglon.producto_id, 'venta', 'nevera', -v_renglon.unidades, v_venta.id, auth.uid());

    v_renglones := v_renglones || jsonb_build_array(to_jsonb(v_renglon));
  end loop;

  -- Los adicionales no están en el inventario: no generan movimientos.
  v_adicionales := '[]'::jsonb;
  for v_item in select value from jsonb_array_elements(v_lista_adicionales) loop
    insert into public.venta_adicionales (venta_id, descripcion, cantidad, valor, creado_por)
    values (v_venta.id, public.normalizar_descripcion(v_item ->> 'descripcion'),
            (v_item ->> 'cantidad')::integer, (v_item ->> 'valor')::bigint, auth.uid())
    returning * into v_adicional;
    v_adicionales := v_adicionales || jsonb_build_array(to_jsonb(v_adicional));
  end loop;

  perform public.anotar_bitacora(
    'registrar-venta', 'ventas', v_venta.id, null,
    to_jsonb(v_venta) || jsonb_build_object('renglones', v_renglones, 'adicionales', v_adicionales),
    null
  );
  return v_venta.id;
end;
$$;

alter function public.registrar_venta(date, jsonb, jsonb) owner to postgres;
revoke all on function public.registrar_venta(date, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_venta(date, jsonb, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- anular_venta (con productos adicionales en la bitácora)
--
-- Qué hace: anula una venta vigente sin borrar nada.
-- Cómo lo hace: igual que en 0004; además guarda en la bitácora los
-- productos adicionales de la venta, antes y después.
-- Por qué: al anular, la bitácora debe mostrar todo lo que tenía la venta.
-- Los adicionales no mueven inventario, así que no hay nada que compensar.
-- -----------------------------------------------------------------------------
create or replace function public.anular_venta(
  p_venta_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_antes public.ventas;
  v_despues public.ventas;
  v_renglones jsonb;
  v_adicionales jsonb;
  v_movimiento public.movimientos_inventario;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  v_motivo := public.motivo_obligatorio(p_motivo);
  select * into v_antes from public.ventas where id = p_venta_id for update;
  if not found then
    raise exception 'La venta % no existe', p_venta_id;
  end if;
  if v_antes.estado = 'anulada' then
    raise exception 'La venta % ya está anulada', p_venta_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.creado_en, i.id), '[]'::jsonb)
    into v_renglones
    from public.venta_items as i
   where i.venta_id = p_venta_id;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.creado_en, a.id), '[]'::jsonb)
    into v_adicionales
    from public.venta_adicionales as a
   where a.venta_id = p_venta_id;

  update public.ventas set estado = 'anulada' where id = p_venta_id
  returning * into v_despues;

  for v_movimiento in
    select * from public.movimientos_inventario
     where venta_id = p_venta_id and compensa_a is null
  loop
    insert into public.movimientos_inventario
      (producto_id, tipo, ubicacion, unidades, venta_id, compensa_a, creado_por)
    values
      (v_movimiento.producto_id, v_movimiento.tipo, v_movimiento.ubicacion,
       -v_movimiento.unidades, v_movimiento.venta_id, v_movimiento.id, auth.uid());
  end loop;

  perform public.anotar_bitacora(
    'anular-registro', 'ventas', p_venta_id,
    to_jsonb(v_antes) || jsonb_build_object('renglones', v_renglones, 'adicionales', v_adicionales),
    to_jsonb(v_despues) || jsonb_build_object('renglones', v_renglones, 'adicionales', v_adicionales),
    v_motivo
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- editar_venta (con productos adicionales)
--
-- Qué hace: reemplaza una venta mal registrada por la corregida, con sus
-- productos adicionales.
-- Cómo lo hace: igual que en 0009, pasando p_adicionales a registrar_venta.
-- Por qué: al editar una venta también se corrige su "Otros".
-- -----------------------------------------------------------------------------
drop function public.editar_venta(uuid, date, jsonb, text);

create function public.editar_venta(
  p_venta_id uuid,
  p_fecha date,
  p_items jsonb,
  p_adicionales jsonb,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  perform public.anular_venta(p_venta_id, p_motivo);
  return public.registrar_venta(p_fecha, p_items, p_adicionales);
end;
$$;

alter function public.editar_venta(uuid, date, jsonb, jsonb, text) owner to postgres;
revoke all on function public.editar_venta(uuid, date, jsonb, jsonb, text) from public, anon;
grant execute on function public.editar_venta(uuid, date, jsonb, jsonb, text) to authenticated;


-- -----------------------------------------------------------------------------
-- aplicar_operacion_pendiente (con productos adicionales)
--
-- Qué hace: igual que en 0006; al aplicar una venta pendiente le pasa
-- también sus productos adicionales.
-- Cómo lo hace: lee p_adicionales del json; si no viene (una venta guardada
-- sin conexión antes de esta migración), manda una lista vacía.
-- Por qué: una venta con "Otros" hecha sin internet debe llegar completa.
-- -----------------------------------------------------------------------------
create or replace function public.aplicar_operacion_pendiente(
  p_clave uuid,
  p_funcion text,
  p_argumentos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente public.operaciones_aplicadas;
  v_resultado jsonb;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if p_clave is null then
    raise exception 'La operación pendiente necesita una clave';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_clave::text, 0));

  select * into v_existente from public.operaciones_aplicadas where clave = p_clave;
  if found then
    return v_existente.resultado;
  end if;

  case p_funcion
    when 'registrar_venta' then
      v_resultado := to_jsonb(public.registrar_venta(
        (p_argumentos ->> 'p_fecha')::date,
        p_argumentos -> 'p_items',
        coalesce(p_argumentos -> 'p_adicionales', '[]'::jsonb)));
    when 'registrar_compra' then
      v_resultado := to_jsonb(public.registrar_compra(
        (p_argumentos ->> 'p_producto_id')::uuid,
        p_argumentos ->> 'p_presentacion',
        (p_argumentos ->> 'p_cantidad')::integer,
        (p_argumentos ->> 'p_costo_total')::bigint,
        (p_argumentos ->> 'p_fecha')::date));
    when 'registrar_traslado' then
      v_resultado := public.registrar_traslado(
        (p_argumentos ->> 'p_producto_id')::uuid,
        (p_argumentos ->> 'p_unidades')::integer);
    when 'registrar_ajuste' then
      v_resultado := to_jsonb(public.registrar_ajuste(
        (p_argumentos ->> 'p_producto_id')::uuid,
        p_argumentos ->> 'p_ubicacion',
        (p_argumentos ->> 'p_unidades')::integer,
        p_argumentos ->> 'p_motivo'));
    when 'registrar_deuda' then
      v_resultado := to_jsonb(public.registrar_deuda(
        p_argumentos ->> 'p_cliente',
        (p_argumentos ->> 'p_fecha')::date,
        (p_argumentos ->> 'p_monto')::bigint,
        p_argumentos ->> 'p_descripcion'));
    when 'registrar_abono' then
      v_resultado := to_jsonb(public.registrar_abono(
        (p_argumentos ->> 'p_deuda_id')::uuid,
        (p_argumentos ->> 'p_fecha')::date,
        (p_argumentos ->> 'p_monto')::bigint,
        p_argumentos ->> 'p_descripcion'));
    else
      raise exception 'La operación % no se puede hacer sin conexión', p_funcion;
  end case;

  insert into public.operaciones_aplicadas (clave, funcion, resultado, creado_por)
  values (p_clave, p_funcion, v_resultado, auth.uid());

  return v_resultado;
end;
$$;
