-- =============================================================================
-- Migración 0009: editar una venta
--
-- Qué hace: agrega `editar_venta`, que reemplaza una venta mal registrada por
-- la venta corregida.
-- Cómo lo hace: en una sola transacción llama a `anular_venta` (cambia el
-- estado a anulada, devuelve las unidades a la nevera y deja en la bitácora
-- el antes, el después y el motivo) y luego a `registrar_venta` con la fecha
-- y los renglones corregidos (crea la venta nueva, descuenta la nevera y anota
-- 'registrar-venta'). Devuelve el id de la venta nueva. Si cualquiera de las
-- dos falla, no queda nada a medias.
-- Por qué: al equivocarse en el cierre del día había que anular y volver a
-- diligenciar toda la venta. Ahora la app abre la venta ya llena para cambiar
-- solo lo errado. Nada se borra: la venta vieja queda anulada con su motivo y
-- la bitácora conserva las dos. No se puede hacer sin conexión (no está entre
-- las funciones de `aplicar_operacion_pendiente`).
-- =============================================================================

create function public.editar_venta(
  p_venta_id uuid,
  p_fecha date,
  p_items jsonb,
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
  return public.registrar_venta(p_fecha, p_items);
end;
$$;

alter function public.editar_venta(uuid, date, jsonb, text) owner to postgres;
revoke all on function public.editar_venta(uuid, date, jsonb, text) from public, anon;
grant execute on function public.editar_venta(uuid, date, jsonb, text) to authenticated;
