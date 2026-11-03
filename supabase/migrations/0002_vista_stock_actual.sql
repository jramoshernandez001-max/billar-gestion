-- =============================================================================
-- 0002_vista_stock_actual.sql
--
-- Qué hace: crea la vista stock_actual, con las unidades de cada producto en
-- cada ubicación (bodega y nevera).
-- Cómo lo hace: suma las unidades con signo de movimientos_inventario,
-- agrupadas por producto y ubicación. La vista se crea con
-- security_invoker = true, así que consulta la tabla con los permisos de
-- quien la lee y respeta sus políticas de RLS.
-- Por qué: el stock nunca se edita ni se guarda: siempre es la suma de lo que
-- pasó (compras, traslados, ventas, ajustes y sus anulaciones), igual que
-- calcularStock en src/domain/inventario/stock.ts. Sin security_invoker, la
-- vista correría con los permisos de su dueño y se saltaría RLS, dejando ver
-- el inventario a quien no está autorizado.
-- =============================================================================

create view public.stock_actual
with (security_invoker = true)
as
select
  m.producto_id,
  m.ubicacion,
  sum(m.unidades)::bigint as unidades
from public.movimientos_inventario as m
group by m.producto_id, m.ubicacion;

comment on view public.stock_actual is
  'Stock por producto y ubicación: suma de movimientos. Respeta RLS (security_invoker).';
