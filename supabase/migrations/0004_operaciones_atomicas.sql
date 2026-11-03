-- =============================================================================
-- 0004_operaciones_atomicas.sql
--
-- Qué hace: crea las operaciones que la app llama para registrar compras,
-- traslados, ventas y ajustes, y para anular ventas.
-- Cómo lo hace: cada operación es una función plpgsql. Una llamada a una
-- función corre en una sola transacción: el registro, sus movimientos de
-- inventario y su entrada de bitácora se guardan juntos, o si algo falla no
-- se guarda nada. Son SECURITY INVOKER: corren con los permisos de quien las
-- llama, así que aplican todas las políticas de RLS de 0003. search_path
-- vacío obliga a escribir public. y evita que se cambie a qué tabla apunta un
-- nombre.
-- Por qué: si la app hiciera cada paso por separado, un corte de conexión
-- podría dejar una venta sin su salida de inventario o sin su bitácora. Las
-- reglas siguen las de src/domain: verificar disponibilidad solo informa y no
-- bloquea, y anular no borra.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Función: registrar_compra
--
-- Qué hace: registra una compra, su entrada a la bodega y su bitácora.
-- Cómo lo hace: inserta la compra (un disparador calcula las unidades y
-- valida la presentación), inserta el movimiento de tipo compra en bodega por
-- esas unidades y agrega la entrada 'registrar-compra' con la compra como
-- valor después. Devuelve el id de la compra.
-- Por qué: igual que compraAMovimiento en el dominio, la compra es la única
-- entrada de producto. El momento de registro (creado_en) desempata compras
-- del mismo día.
-- -----------------------------------------------------------------------------
create function public.registrar_compra(
  p_producto_id uuid,
  p_presentacion text,
  p_cantidad integer,
  p_costo_total bigint,
  p_fecha date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_compra public.compras;
begin
  insert into public.compras (producto_id, presentacion, cantidad, costo_total, fecha)
  values (p_producto_id, p_presentacion, p_cantidad, p_costo_total, p_fecha)
  returning * into v_compra;

  insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, compra_id)
  values (v_compra.producto_id, 'compra', 'bodega', v_compra.unidades, v_compra.id);

  insert into public.bitacora (usuario, accion, tabla, registro_id, antes, despues)
  values (public.correo_del_token(), 'registrar-compra', 'compras', v_compra.id, null, to_jsonb(v_compra));

  return v_compra.id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Función: registrar_traslado
--
-- Qué hace: traslada unidades de la bodega a la nevera y dice si la bodega
-- alcanzaba.
-- Cómo lo hace: valida que las unidades sean mayores a cero, consulta el
-- stock de la bodega en stock_actual, inserta los dos movimientos (sale de
-- bodega, entra a nevera) con el mismo traslado_id y agrega la entrada
-- 'registrar-traslado'. Devuelve traslado_id, suficiente y faltan.
-- Por qué: igual que trasladarANevera en el dominio, el aviso informa pero no
-- bloquea: la pantalla decide qué hacer, y el usuario no se queda sin poder
-- trabajar por un traslado olvidado.
-- -----------------------------------------------------------------------------
create function public.registrar_traslado(
  p_producto_id uuid,
  p_unidades integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_traslado_id uuid := gen_random_uuid();
  v_en_bodega bigint;
  v_faltan bigint;
begin
  if p_unidades is null or p_unidades <= 0 then
    raise exception 'Las unidades del traslado deben ser un entero mayor a cero';
  end if;

  select coalesce(sum(s.unidades), 0)
    into v_en_bodega
    from public.stock_actual as s
   where s.producto_id = p_producto_id
     and s.ubicacion = 'bodega';
  v_faltan := greatest(0, p_unidades - v_en_bodega);

  insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, traslado_id)
  values
    (p_producto_id, 'traslado', 'bodega', -p_unidades, v_traslado_id),
    (p_producto_id, 'traslado', 'nevera', p_unidades, v_traslado_id);

  insert into public.bitacora (usuario, accion, tabla, registro_id, antes, despues)
  values (
    public.correo_del_token(),
    'registrar-traslado',
    'movimientos_inventario',
    v_traslado_id,
    null,
    jsonb_build_object(
      'producto_id', p_producto_id,
      'unidades', p_unidades,
      'traslado_id', v_traslado_id
    )
  );

  return jsonb_build_object(
    'traslado_id', v_traslado_id,
    'suficiente', v_faltan = 0,
    'faltan', v_faltan
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Función: registrar_venta
--
-- Qué hace: registra una venta con sus renglones, la salida de la nevera de
-- cada renglón y su bitácora.
-- Cómo lo hace: p_items es una lista JSON de renglones con producto_id,
-- presentacion, cantidad y, si se cobró distinto del de lista, precio_cobrado.
-- Si no viene precio_cobrado, se guarda el de lista de ese momento (unidad,
-- seis veces la unidad para el sixpack, o el de la caja). Un disparador
-- calcula las unidades de cada renglón. Cada renglón con unidades genera un
-- movimiento de venta negativo en la nevera; uno de cero unidades no mueve
-- inventario y no se registra. Al final agrega la entrada 'registrar-venta'
-- con la venta y sus renglones. Devuelve el id de la venta.
-- Por qué: igual que valorVenta y ventaAMovimientos en el dominio. Guardar
-- siempre el precio cobrado hace que un cambio de precio futuro no altere el
-- historial. El dominio no bloquea una venta por falta de stock.
-- -----------------------------------------------------------------------------
create function public.registrar_venta(
  p_fecha date,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_venta public.ventas;
  v_item jsonb;
  v_producto public.productos;
  v_precio bigint;
  v_renglon public.venta_items;
  v_renglones jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los renglones de la venta deben venir en una lista';
  end if;

  insert into public.ventas (fecha) values (p_fecha) returning * into v_venta;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_producto
      from public.productos
     where id = (v_item ->> 'producto_id')::uuid;
    if not found then
      raise exception 'El producto % no existe', v_item ->> 'producto_id';
    end if;

    -- Precio de lista de la presentación; el sixpack vale seis unidades.
    v_precio := coalesce(
      (v_item ->> 'precio_cobrado')::bigint,
      case v_item ->> 'presentacion'
        when 'unidad' then v_producto.precio_unidad
        when 'sixpack' then v_producto.precio_unidad * 6
        when 'caja' then v_producto.precio_caja
      end
    );

    insert into public.venta_items (venta_id, producto_id, presentacion, cantidad, precio_cobrado)
    values (
      v_venta.id,
      v_producto.id,
      v_item ->> 'presentacion',
      (v_item ->> 'cantidad')::integer,
      v_precio
    )
    returning * into v_renglon;

    if v_renglon.unidades > 0 then
      insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, venta_id)
      values (v_renglon.producto_id, 'venta', 'nevera', -v_renglon.unidades, v_venta.id);
    end if;

    v_renglones := v_renglones || jsonb_build_array(to_jsonb(v_renglon));
  end loop;

  insert into public.bitacora (usuario, accion, tabla, registro_id, antes, despues)
  values (
    public.correo_del_token(),
    'registrar-venta',
    'ventas',
    v_venta.id,
    null,
    to_jsonb(v_venta) || jsonb_build_object('renglones', v_renglones)
  );

  return v_venta.id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Función: anular_venta
--
-- Qué hace: anula una venta vigente sin borrar nada.
-- Cómo lo hace: exige un motivo, bloquea la venta (FOR UPDATE) para que no se
-- anule dos veces a la vez, rechaza una venta ya anulada, cambia su estado a
-- 'anulada', crea por cada movimiento de la venta uno inverso que lo compensa
-- (mismo producto, tipo y ubicación, signo contrario, con compensa_a) y
-- agrega la entrada 'anular-registro' con la venta y sus renglones antes y
-- después, y el motivo.
-- Por qué: igual que anularVenta en el dominio: la venta queda guardada con
-- su estado, la nevera recupera las unidades y la bitácora guarda el cambio.
-- Si la venta era de un periodo cerrado, ese cierre queda desactualizado
-- hasta que un usuario lo recalcule; nunca se recalcula solo.
-- -----------------------------------------------------------------------------
create function public.anular_venta(
  p_venta_id uuid,
  p_motivo text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_motivo text := regexp_replace(coalesce(p_motivo, ''), '^\s+|\s+$', '', 'g');
  v_antes public.ventas;
  v_despues public.ventas;
  v_renglones jsonb;
  v_movimiento public.movimientos_inventario;
begin
  if v_motivo = '' then
    raise exception 'El motivo de la anulación es obligatorio';
  end if;

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

  update public.ventas set estado = 'anulada' where id = p_venta_id
  returning * into v_despues;

  for v_movimiento in
    select * from public.movimientos_inventario
     where venta_id = p_venta_id and compensa_a is null
  loop
    insert into public.movimientos_inventario
      (producto_id, tipo, ubicacion, unidades, venta_id, compensa_a)
    values (
      v_movimiento.producto_id,
      v_movimiento.tipo,
      v_movimiento.ubicacion,
      -v_movimiento.unidades,
      v_movimiento.venta_id,
      v_movimiento.id
    );
  end loop;

  insert into public.bitacora (usuario, accion, tabla, registro_id, antes, despues, motivo)
  values (
    public.correo_del_token(),
    'anular-registro',
    'ventas',
    p_venta_id,
    to_jsonb(v_antes) || jsonb_build_object('renglones', v_renglones),
    to_jsonb(v_despues) || jsonb_build_object('renglones', v_renglones),
    v_motivo
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Función: registrar_ajuste
--
-- Qué hace: registra un ajuste de inventario por conteo físico y su bitácora.
-- Cómo lo hace: exige unidades distintas de cero y un motivo (sin espacios a
-- los lados), inserta el movimiento de tipo ajuste con su motivo y agrega la
-- entrada 'registrar-ajuste' con el ajuste como valor después. Devuelve el id
-- del movimiento.
-- Por qué: igual que crearAjuste en el dominio: si el conteo no coincide con
-- la suma de movimientos, se agrega la diferencia y queda dicho por qué. El
-- inventario inicial no usa ajustes: se carga como compras.
-- -----------------------------------------------------------------------------
create function public.registrar_ajuste(
  p_producto_id uuid,
  p_ubicacion text,
  p_unidades integer,
  p_motivo text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_motivo text := regexp_replace(coalesce(p_motivo, ''), '^\s+|\s+$', '', 'g');
  v_movimiento public.movimientos_inventario;
begin
  if p_unidades is null or p_unidades = 0 then
    raise exception 'Las unidades del ajuste deben ser un entero distinto de cero';
  end if;
  if v_motivo = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, motivo)
  values (p_producto_id, 'ajuste', p_ubicacion, p_unidades, v_motivo)
  returning * into v_movimiento;

  insert into public.bitacora (usuario, accion, tabla, registro_id, antes, despues)
  values (
    public.correo_del_token(),
    'registrar-ajuste',
    'movimientos_inventario',
    v_movimiento.id,
    null,
    jsonb_build_object(
      'producto_id', v_movimiento.producto_id,
      'ubicacion', v_movimiento.ubicacion,
      'unidades', v_movimiento.unidades,
      'motivo', v_movimiento.motivo
    )
  );

  return v_movimiento.id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Privilegios de las operaciones.
--
-- Qué hace: solo el rol authenticated puede llamarlas; anon y public no.
-- Cómo lo hace: REVOKE a public y anon, GRANT a authenticated.
-- Por qué: aunque las políticas ya frenan a quien no está autorizado, el rol
-- anon no debe poder ni intentarlo.
-- -----------------------------------------------------------------------------
revoke all on function public.registrar_compra(uuid, text, integer, bigint, date) from public, anon;
revoke all on function public.registrar_traslado(uuid, integer) from public, anon;
revoke all on function public.registrar_venta(date, jsonb) from public, anon;
revoke all on function public.anular_venta(uuid, text) from public, anon;
revoke all on function public.registrar_ajuste(uuid, text, integer, text) from public, anon;

grant execute on function public.registrar_compra(uuid, text, integer, bigint, date) to authenticated;
grant execute on function public.registrar_traslado(uuid, integer) to authenticated;
grant execute on function public.registrar_venta(date, jsonb) to authenticated;
grant execute on function public.anular_venta(uuid, text) to authenticated;
grant execute on function public.registrar_ajuste(uuid, text, integer, text) to authenticated;
