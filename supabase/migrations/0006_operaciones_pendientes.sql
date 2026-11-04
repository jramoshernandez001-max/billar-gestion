-- =============================================================================
-- Migración 0006: operaciones hechas sin conexión (idempotencia)
--
-- Qué hace: crea la tabla `operaciones_aplicadas` y la función
-- `aplicar_operacion_pendiente`, con la que la app envía, al volver internet,
-- lo que el usuario registró sin conexión (ventas, compras, traslados,
-- ajustes, deudas y abonos).
-- Cómo lo hace: cada operación pendiente lleva una clave (uuid) que genera la
-- app al registrarla. La función verifica al usuario, toma un candado por
-- clave, y si la clave ya se aplicó devuelve el resultado guardado sin
-- repetir nada; si no, llama a la función de siempre (registrar_venta, etc.)
-- y guarda la clave con su resultado en la misma transacción.
-- Por qué: sin conexión, el celular no sabe si una petición llegó antes de
-- caerse el internet. Reenviar sin clave duplicaría la venta; con la clave,
-- reenviar es seguro. El momento de registro (`creado_en`) es el del
-- servidor al sincronizar: así un cierre calculado antes de sincronizar
-- queda desactualizado (duda 1 de docs/PENDIENTES.md).
-- Solo se permiten las funciones que crean registros nuevos y no dependen de
-- otro registro pendiente; anular, corregir y cerrar exigen conexión.
-- =============================================================================

create table public.operaciones_aplicadas (
  clave uuid primary key,
  funcion text not null,
  resultado jsonb,
  creado_por uuid,
  creado_en timestamptz not null default now()
);

comment on table public.operaciones_aplicadas is
  'Claves de operaciones hechas sin conexión ya aplicadas; evitan duplicar al reenviar.';

alter table public.operaciones_aplicadas enable row level security;
alter table public.operaciones_aplicadas force row level security;

grant select on public.operaciones_aplicadas to authenticated;

create policy operaciones_aplicadas_leer on public.operaciones_aplicadas for select to authenticated
  using ((select public.es_usuario_autorizado()));
create policy operaciones_aplicadas_postgres_leer on public.operaciones_aplicadas for select to postgres using (true);
create policy operaciones_aplicadas_postgres_agregar on public.operaciones_aplicadas for insert to postgres with check (true);

create trigger operaciones_aplicadas_sin_borrado before delete on public.operaciones_aplicadas
  for each row execute function public.impedir_cambio();
create trigger operaciones_aplicadas_sin_cambio before update on public.operaciones_aplicadas
  for each row execute function public.impedir_cambio();

-- aplicar_operacion_pendiente
-- Qué hace: aplica una operación registrada sin conexión, una sola vez.
-- Cómo lo hace: verifica al usuario; toma un candado de la clave; si la clave
-- existe devuelve su resultado; si no, llama a la función pedida con los
-- argumentos del json (solo una lista fija) y guarda la clave y el resultado.
-- Por qué: ver el comentario del archivo. Cualquier error de la función
-- interna cancela todo, incluida la clave, para poder reintentar o descartar.
create function public.aplicar_operacion_pendiente(
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
        p_argumentos -> 'p_items'));
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

alter function public.aplicar_operacion_pendiente(uuid, text, jsonb) owner to postgres;
revoke all on function public.aplicar_operacion_pendiente(uuid, text, jsonb) from public, anon;
grant execute on function public.aplicar_operacion_pendiente(uuid, text, jsonb) to authenticated;
