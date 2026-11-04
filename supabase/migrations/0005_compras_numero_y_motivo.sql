-- =============================================================================
-- Migración 0005: número de compra y motivo al corregir el costo
--
-- Qué hace:
--   1. Agrega a `compras` un número consecutivo (`numero`) para mostrar "C-042".
--   2. Cambia `corregir_costo_compra` para que exija un motivo y lo guarde en
--      la bitácora junto con el antes y el después.
-- Cómo lo hace:
--   1. Crea una secuencia, numera las compras que ya existan por orden de
--      registro (creado_en) y deja la secuencia como valor por defecto.
--   2. Reemplaza la función por una con el parámetro `p_motivo`, que se limpia
--      con `motivo_obligatorio` igual que en las anulaciones.
-- Por qué:
--   1. Antes el número se deducía en la app por el orden de registro; guardarlo
--      lo hace estable aunque cambie el filtro o la lista. La secuencia se usa
--      dentro de `registrar_compra` (SECURITY DEFINER), no desde la app.
--   2. Toda corrección debe decir por qué se hizo (regla de la bitácora).
-- =============================================================================

create sequence public.compras_numero_seq;

alter table public.compras add column numero bigint;

-- Compras que ya existían: se numeran por orden de registro.
update public.compras c
   set numero = o.n
  from (select id, row_number() over (order by creado_en, id) as n from public.compras) o
 where c.id = o.id;

select setval('public.compras_numero_seq', coalesce((select max(numero) from public.compras), 0) + 1, false);

alter table public.compras
  alter column numero set default nextval('public.compras_numero_seq'),
  alter column numero set not null,
  add constraint compras_numero_unico unique (numero);

alter sequence public.compras_numero_seq owned by public.compras.numero;

comment on column public.compras.numero is
  'Número consecutivo para mostrar (C-001). Lo asigna la base al registrar.';

-- corregir_costo_compra con motivo
-- Qué hace: corrige el costo total de una compra y registra
-- 'corregir-costo-compra' con antes, después y motivo.
-- Cómo lo hace: exige motivo, bloquea la compra, rechaza una anulada, cambia
-- solo costo_total y anota la bitácora. Cantidad, fecha y producto no cambian,
-- así que el inventario no se mueve.
-- Por qué: si era la última compra del producto, la utilidad usa el costo nuevo.
drop function public.corregir_costo_compra(uuid, bigint);

create function public.corregir_costo_compra(
  p_compra_id uuid,
  p_costo_nuevo bigint,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_antes public.compras;
  v_despues public.compras;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  v_motivo := public.motivo_obligatorio(p_motivo);
  select * into v_antes from public.compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra % no existe', p_compra_id;
  end if;
  -- Una compra anulada ya no cuenta como última compra: corregirle el costo
  -- no cambia nada real y confundiría la bitácora.
  if v_antes.estado = 'anulada' then
    raise exception 'La compra % está anulada: no se puede corregir su costo', p_compra_id;
  end if;
  -- Un costo igual al que ya tiene no es una corrección: no se registra nada.
  if v_antes.costo_total = p_costo_nuevo then
    return;
  end if;

  update public.compras set costo_total = p_costo_nuevo where id = p_compra_id
  returning * into v_despues;

  perform public.anotar_bitacora('corregir-costo-compra', 'compras', p_compra_id, to_jsonb(v_antes), to_jsonb(v_despues), v_motivo);
end;
$$;

alter function public.corregir_costo_compra(uuid, bigint, text) owner to postgres;
revoke all on function public.corregir_costo_compra(uuid, bigint, text) from public, anon;
grant execute on function public.corregir_costo_compra(uuid, bigint, text) to authenticated;
