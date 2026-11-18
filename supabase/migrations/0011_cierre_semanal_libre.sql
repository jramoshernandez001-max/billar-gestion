-- =============================================================================
-- Migración 0011: cierre semanal con fechas libres (martes a lunes por defecto)
--
-- Qué hace: quita la regla de que el cierre semanal vaya de lunes a domingo y
-- reemplaza `guardar_cierre` para rechazar un cierre semanal que comparta días
-- con otro.
-- Cómo lo hace: borra la restricción `semanal_de_lunes_a_domingo` y pone una
-- que solo exige que el fin no sea anterior al inicio. En `guardar_cierre`,
-- para un semanal, toma un candado de transacción y busca otro semanal cuyo
-- periodo se cruce; si lo hay, lanza un error con sus fechas. Los cierres que
-- ya existen no cambian.
-- Por qué: el negocio ahora cierra la semana los martes (ventas de martes a
-- lunes) y a veces necesita cerrar otro rango. La app propone la semana y el
-- usuario la puede cambiar; la base garantiza que dos cierres semanales no
-- cuenten las mismas ventas.
-- =============================================================================

alter table public.cierres drop constraint semanal_de_lunes_a_domingo;
alter table public.cierres
  add constraint periodo_en_orden check (hasta >= desde);


-- -----------------------------------------------------------------------------
-- guardar_cierre
-- Qué hace: guarda un cierre nuevo y registra 'registrar-cierre-diario' o
-- 'registrar-cierre-semanal'.
-- Cómo lo hace: igual que en la migración 0004, más la revisión de cruces
-- entre cierres semanales.
-- Por qué: el periodo semanal ahora lo elige el usuario.
-- -----------------------------------------------------------------------------
create or replace function public.guardar_cierre(
  p_tipo text,
  p_desde date,
  p_hasta date,
  p_efectivo bigint,
  p_transferencias bigint,
  p_costos_manuales jsonb,
  p_costos_usados jsonb,
  p_resultado jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cierre public.cierres;
  v_cruce public.cierres;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if exists (select 1 from public.cierres where tipo = p_tipo and desde = p_desde) then
    raise exception 'Ya existe un cierre % desde %: use recalcular_cierre', p_tipo, p_desde;
  end if;

  -- Un cierre semanal no puede compartir días con otro. El candado evita que
  -- dos personas guarden a la vez dos semanas que se cruzan.
  if p_tipo = 'semanal' then
    perform pg_advisory_xact_lock(hashtext('cierre-semanal'));
    select * into v_cruce from public.cierres
     where tipo = 'semanal' and desde <= p_hasta and hasta >= p_desde
     limit 1;
    if found then
      raise exception 'El periodo se cruza con el cierre semanal del % al %', v_cruce.desde, v_cruce.hasta;
    end if;
  end if;

  insert into public.cierres
    (tipo, desde, hasta, efectivo, transferencias, costos_manuales, calculado_en,
     costos_usados, resultado, creado_por)
  values
    (p_tipo, p_desde, p_hasta, p_efectivo, p_transferencias,
     coalesce(p_costos_manuales, '{}'::jsonb), now(),
     coalesce(p_costos_usados, '[]'::jsonb), p_resultado, auth.uid())
  returning * into v_cierre;

  perform public.anotar_bitacora(
    case v_cierre.tipo when 'diario' then 'registrar-cierre-diario' else 'registrar-cierre-semanal' end,
    'cierres', v_cierre.id, null, to_jsonb(v_cierre), null
  );
  return v_cierre.id;
end;
$$;
