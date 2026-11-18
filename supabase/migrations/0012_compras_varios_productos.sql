-- =============================================================================
-- Migración 0012: una compra con varios productos
--
-- Qué hace: agrega `registrar_compras(p_fecha, p_renglones)`, que registra
-- varios productos comprados juntos en una sola transacción, y la suma a las
-- operaciones que se pueden guardar sin conexión.
-- Cómo lo hace: verifica al usuario, exige al menos un renglón y llama a
-- `registrar_compra` por cada uno (cada compra conserva su número C-001, su
-- movimiento a bodega y su bitácora). Si un renglón falla, no se guarda
-- ninguno. `aplicar_operacion_pendiente` se reemplaza con el caso nuevo.
-- Por qué: el negocio compra varios productos a la vez y quiere registrarlos
-- con un solo botón. Cada producto sigue siendo una compra para que la
-- utilidad use el costo de la última compra de cada uno, como antes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- registrar_compras
-- Qué hace: registra cada renglón como una compra y devuelve sus ids en orden.
-- Cómo lo hace: recorre el arreglo json (producto_id, presentacion, cantidad,
-- costo_total) y llama a registrar_compra con la misma fecha.
-- Por qué: todo o nada; una compra a medias dejaría la bodega descuadrada.
-- -----------------------------------------------------------------------------
create function public.registrar_compras(
  p_fecha date,
  p_renglones jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_renglon jsonb;
  v_ids uuid[];
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if p_renglones is null or jsonb_typeof(p_renglones) <> 'array' or jsonb_array_length(p_renglones) = 0 then
    raise exception 'La compra debe tener al menos un producto';
  end if;

  v_ids := array[]::uuid[];
  for v_renglon in select value from jsonb_array_elements(p_renglones) loop
    v_ids := v_ids || public.registrar_compra(
      (v_renglon ->> 'producto_id')::uuid,
      v_renglon ->> 'presentacion',
      (v_renglon ->> 'cantidad')::integer,
      (v_renglon ->> 'costo_total')::bigint,
      p_fecha);
  end loop;

  return v_ids;
end;
$$;

alter function public.registrar_compras(date, jsonb) owner to postgres;
revoke all on function public.registrar_compras(date, jsonb) from public, anon;
grant execute on function public.registrar_compras(date, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- aplicar_operacion_pendiente
-- Qué hace: igual que en la migración 0010, más 'registrar_compras'.
-- Por qué: una compra de varios productos hecha sin internet debe llegar
-- completa cuando vuelva la conexión.
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
    when 'registrar_compras' then
      v_resultado := to_jsonb(public.registrar_compras(
        (p_argumentos ->> 'p_fecha')::date,
        p_argumentos -> 'p_renglones'));
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
