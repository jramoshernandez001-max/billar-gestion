-- =============================================================================
-- 0004_operaciones_atomicas.sql
--
-- Qué hace: crea todas las operaciones de escritura del sistema. La app no
-- puede escribir directo en ninguna tabla (0003): crea y edita productos,
-- registra y anula compras, ventas, deudas y abonos, corrige costos, hace
-- traslados y ajustes, y guarda, recalcula o corrige cierres llamando a
-- estas funciones.
-- Cómo lo hace: cada operación es una función plpgsql. Una llamada a una
-- función corre en una sola transacción: el registro, sus movimientos de
-- inventario y su entrada de bitácora se guardan juntos o no se guarda nada.
-- Todas cumplen las mismas reglas:
--   1. SECURITY DEFINER con dueño postgres: corren con los permisos de
--      postgres, que tiene políticas explícitas en 0003 (RLS está forzada).
--   2. search_path vacío y nombres siempre con public. o auth.
--   3. La primera instrucción verifica es_usuario_autorizado() y, si no lo
--      es, lanza un error. En declare no se asigna nada, para que nada corra
--      antes de esa verificación.
--   4. El usuario y creado_por salen del token (correo_del_token() y
--      auth.uid()), nunca de un parámetro.
--   5. REVOKE a public y anon, y GRANT EXECUTE solo a authenticated.
-- Por qué: SECURITY DEFINER es necesario porque la app no tiene permisos de
-- escritura; a cambio, cada función valida por su cuenta quién llama y qué
-- datos recibe, y deja la bitácora en la misma transacción. Las reglas
-- siguen las de src/domain: verificar disponibilidad solo informa, anular no
-- borra, lo anulado no cuenta y un cierre nunca se recalcula solo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Funciones auxiliares internas (no las llama la app).
-- -----------------------------------------------------------------------------

-- texto_sin_blancos_lados
-- Qué hace: quita los blancos (espacios, tabulaciones, saltos de línea) de
-- los lados de un texto; un nulo se vuelve ''.
-- Cómo lo hace: regexp_replace con ^\s+ y \s+$.
-- Por qué: igual que trim() en el dominio para motivos y nombres.
create function public.texto_sin_blancos_lados(p_texto text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select regexp_replace(coalesce(p_texto, ''), '^\s+|\s+$', '', 'g');
$$;

-- normalizar_descripcion
-- Qué hace: limpia la descripción de una deuda o un abono.
-- Cómo lo hace: quita los blancos de los lados y reduce a uno los espacios
-- repetidos en medio; el tipo descripcion_movimiento valida el resto.
-- Por qué: es la misma regla de normalizarDescripcion en el dominio.
create function public.normalizar_descripcion(p_texto text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select regexp_replace(public.texto_sin_blancos_lados(p_texto), ' {2,}', ' ', 'g');
$$;

-- motivo_obligatorio
-- Qué hace: devuelve el motivo limpio o lanza un error si queda vacío.
-- Cómo lo hace: usa texto_sin_blancos_lados y revisa el largo.
-- Por qué: toda anulación y todo ajuste deben decir por qué.
create function public.motivo_obligatorio(p_motivo text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_motivo text;
begin
  v_motivo := public.texto_sin_blancos_lados(p_motivo);
  if v_motivo = '' then
    raise exception 'El motivo es obligatorio';
  end if;
  return v_motivo;
end;
$$;

-- anotar_bitacora
-- Qué hace: agrega una entrada a la bitácora.
-- Cómo lo hace: toma el usuario del token (correo_del_token) y creado_por de
-- auth.uid(); el momento lo pone la tabla (now()).
-- Por qué: un solo lugar arma la entrada, así ninguna función puede
-- registrar a nombre de otro. Corre dentro de las funciones DEFINER, como
-- postgres.
create function public.anotar_bitacora(
  p_accion text,
  p_tabla text,
  p_registro_id uuid,
  p_antes jsonb,
  p_despues jsonb,
  p_motivo text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.bitacora (usuario, accion, tabla, registro_id, antes, despues, motivo, creado_por)
  values (public.correo_del_token(), p_accion, p_tabla, p_registro_id, p_antes, p_despues, p_motivo, auth.uid());
end;
$$;


-- -----------------------------------------------------------------------------
-- Productos
-- -----------------------------------------------------------------------------

-- crear_producto
-- Qué hace: crea un producto y registra 'crear-producto'.
-- Cómo lo hace: inserta el producto con el nombre limpio y creado_por del
-- token; la tabla valida unidades por caja y precios.
-- Por qué: los productos y sus precios se cargan desde la app; ningún precio
-- real va en el repositorio.
create function public.crear_producto(
  p_nombre text,
  p_unidades_por_caja integer,
  p_maneja_sixpack boolean,
  p_precio_unidad bigint,
  p_precio_caja bigint
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

  insert into public.productos
    (nombre, unidades_por_caja, maneja_sixpack, precio_unidad, precio_caja, creado_por)
  values
    (public.texto_sin_blancos_lados(p_nombre), p_unidades_por_caja, p_maneja_sixpack,
     p_precio_unidad, p_precio_caja, auth.uid())
  returning * into v_producto;

  perform public.anotar_bitacora('crear-producto', 'productos', v_producto.id, null, to_jsonb(v_producto), null);
  return v_producto.id;
end;
$$;

-- editar_producto
-- Qué hace: cambia los datos de un producto, incluidos sus precios, y
-- registra el antes y el después.
-- Cómo lo hace: bloquea el producto, y si nada cambió no hace nada. Si solo
-- cambiaron precios, la acción es 'cambiar-precio'; si cambió otra cosa,
-- 'editar-producto'.
-- Por qué: los precios cambian pocas veces y el historial de ventas no se
-- altera, porque cada venta guarda su precio cobrado. Las compras y ventas
-- ya guardadas conservan sus unidades aunque cambien las unidades por caja.
create function public.editar_producto(
  p_producto_id uuid,
  p_nombre text,
  p_unidades_por_caja integer,
  p_maneja_sixpack boolean,
  p_precio_unidad bigint,
  p_precio_caja bigint
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

  update public.productos
     set nombre = public.texto_sin_blancos_lados(p_nombre),
         unidades_por_caja = p_unidades_por_caja,
         maneja_sixpack = p_maneja_sixpack,
         precio_unidad = p_precio_unidad,
         precio_caja = p_precio_caja
   where id = p_producto_id
  returning * into v_despues;

  if to_jsonb(v_despues) = to_jsonb(v_antes) then
    return;
  end if;

  if v_despues.nombre = v_antes.nombre
     and v_despues.unidades_por_caja = v_antes.unidades_por_caja
     and v_despues.maneja_sixpack = v_antes.maneja_sixpack then
    v_accion := 'cambiar-precio';
  else
    v_accion := 'editar-producto';
  end if;

  perform public.anotar_bitacora(v_accion, 'productos', p_producto_id, to_jsonb(v_antes), to_jsonb(v_despues), null);
end;
$$;


-- -----------------------------------------------------------------------------
-- Compras
-- -----------------------------------------------------------------------------

-- registrar_compra
-- Qué hace: registra una compra, su entrada a la bodega y 'registrar-compra'.
-- Cómo lo hace: inserta la compra (un disparador calcula las unidades y
-- valida la presentación), inserta el movimiento de compra en bodega y
-- anota la bitácora. Devuelve el id de la compra.
-- Por qué: igual que compraAMovimiento: la compra es la única entrada de
-- producto. creado_en es el momento de registro que desempata compras del
-- mismo día.
create function public.registrar_compra(
  p_producto_id uuid,
  p_presentacion text,
  p_cantidad integer,
  p_costo_total bigint,
  p_fecha date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compra public.compras;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  insert into public.compras (producto_id, presentacion, cantidad, costo_total, fecha, creado_por)
  values (p_producto_id, p_presentacion, p_cantidad, p_costo_total, p_fecha, auth.uid())
  returning * into v_compra;

  insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, compra_id, creado_por)
  values (v_compra.producto_id, 'compra', 'bodega', v_compra.unidades, v_compra.id, auth.uid());

  perform public.anotar_bitacora('registrar-compra', 'compras', v_compra.id, null, to_jsonb(v_compra), null);
  return v_compra.id;
end;
$$;

-- corregir_costo_compra
-- Qué hace: corrige el costo total de una compra y registra
-- 'corregir-costo-compra' con antes y después.
-- Cómo lo hace: bloquea la compra, cambia solo costo_total y anota la
-- bitácora. Cantidad, fecha y producto no cambian, así que el inventario no
-- se mueve.
-- Por qué: igual que corregirCostoCompra. Si era la última compra del
-- producto, la utilidad usa el costo nuevo.
create function public.corregir_costo_compra(
  p_compra_id uuid,
  p_costo_nuevo bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.compras;
  v_despues public.compras;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  select * into v_antes from public.compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra % no existe', p_compra_id;
  end if;

  update public.compras set costo_total = p_costo_nuevo where id = p_compra_id
  returning * into v_despues;

  perform public.anotar_bitacora('corregir-costo-compra', 'compras', p_compra_id, to_jsonb(v_antes), to_jsonb(v_despues), null);
end;
$$;

-- anular_compra
-- Qué hace: anula una compra vigente sin borrarla.
-- Cómo lo hace: exige motivo, bloquea la compra, rechaza una ya anulada,
-- cambia el estado, compensa cada movimiento de la compra con uno inverso
-- (compensa_a) y anota 'anular-registro' con antes, después y motivo.
-- Por qué: igual que anularCompra: la bodega vuelve a cuadrar y la compra
-- anulada deja de contar como última compra.
create function public.anular_compra(
  p_compra_id uuid,
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
  v_movimiento public.movimientos_inventario;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  v_motivo := public.motivo_obligatorio(p_motivo);
  select * into v_antes from public.compras where id = p_compra_id for update;
  if not found then
    raise exception 'La compra % no existe', p_compra_id;
  end if;
  if v_antes.estado = 'anulada' then
    raise exception 'La compra % ya está anulada', p_compra_id;
  end if;

  update public.compras set estado = 'anulada' where id = p_compra_id
  returning * into v_despues;

  for v_movimiento in
    select * from public.movimientos_inventario
     where compra_id = p_compra_id and compensa_a is null
  loop
    insert into public.movimientos_inventario
      (producto_id, tipo, ubicacion, unidades, compra_id, compensa_a, creado_por)
    values
      (v_movimiento.producto_id, v_movimiento.tipo, v_movimiento.ubicacion,
       -v_movimiento.unidades, v_movimiento.compra_id, v_movimiento.id, auth.uid());
  end loop;

  perform public.anotar_bitacora('anular-registro', 'compras', p_compra_id, to_jsonb(v_antes), to_jsonb(v_despues), v_motivo);
end;
$$;


-- -----------------------------------------------------------------------------
-- Inventario: traslados y ajustes
-- -----------------------------------------------------------------------------

-- registrar_traslado
-- Qué hace: traslada unidades de la bodega a la nevera y dice si la bodega
-- alcanzaba.
-- Cómo lo hace: valida unidades mayores a cero, consulta stock_actual,
-- inserta los dos movimientos con el mismo traslado_id y anota
-- 'registrar-traslado'. Devuelve traslado_id, suficiente y faltan.
-- Por qué: igual que trasladarANevera: el aviso informa pero no bloquea.
create function public.registrar_traslado(
  p_producto_id uuid,
  p_unidades integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado_id uuid;
  v_en_bodega bigint;
  v_faltan bigint;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if p_unidades is null or p_unidades <= 0 then
    raise exception 'Las unidades del traslado deben ser un entero mayor a cero';
  end if;
  v_traslado_id := gen_random_uuid();

  select coalesce(sum(s.unidades), 0) into v_en_bodega
    from public.stock_actual as s
   where s.producto_id = p_producto_id and s.ubicacion = 'bodega';
  v_faltan := greatest(0, p_unidades - v_en_bodega);

  insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, traslado_id, creado_por)
  values
    (p_producto_id, 'traslado', 'bodega', -p_unidades, v_traslado_id, auth.uid()),
    (p_producto_id, 'traslado', 'nevera', p_unidades, v_traslado_id, auth.uid());

  perform public.anotar_bitacora(
    'registrar-traslado', 'movimientos_inventario', v_traslado_id, null,
    jsonb_build_object('producto_id', p_producto_id, 'unidades', p_unidades, 'traslado_id', v_traslado_id),
    null
  );

  return jsonb_build_object('traslado_id', v_traslado_id, 'suficiente', v_faltan = 0, 'faltan', v_faltan);
end;
$$;

-- registrar_ajuste
-- Qué hace: registra un ajuste de inventario por conteo físico.
-- Cómo lo hace: exige unidades distintas de cero y motivo, inserta el
-- movimiento de ajuste con el motivo y anota 'registrar-ajuste'. Devuelve el
-- id del movimiento.
-- Por qué: igual que crearAjuste. El inventario inicial no usa ajustes: se
-- carga como compras.
create function public.registrar_ajuste(
  p_producto_id uuid,
  p_ubicacion text,
  p_unidades integer,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_movimiento public.movimientos_inventario;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if p_unidades is null or p_unidades = 0 then
    raise exception 'Las unidades del ajuste deben ser un entero distinto de cero';
  end if;
  v_motivo := public.motivo_obligatorio(p_motivo);

  insert into public.movimientos_inventario (producto_id, tipo, ubicacion, unidades, motivo, creado_por)
  values (p_producto_id, 'ajuste', p_ubicacion, p_unidades, v_motivo, auth.uid())
  returning * into v_movimiento;

  perform public.anotar_bitacora(
    'registrar-ajuste', 'movimientos_inventario', v_movimiento.id, null,
    jsonb_build_object(
      'producto_id', v_movimiento.producto_id,
      'ubicacion', v_movimiento.ubicacion,
      'unidades', v_movimiento.unidades,
      'motivo', v_movimiento.motivo
    ),
    null
  );
  return v_movimiento.id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Ventas
-- -----------------------------------------------------------------------------

-- registrar_venta
-- Qué hace: registra una venta con sus renglones, la salida de la nevera de
-- cada renglón y 'registrar-venta'.
-- Cómo lo hace: p_items es una lista JSON de renglones con producto_id,
-- presentacion, cantidad y, si se cobró distinto del de lista,
-- precio_cobrado. Un renglón de cantidad cero se ignora sin error; si no
-- queda ninguno con cantidad, lanza un error. Si no viene precio_cobrado, se
-- guarda el de lista de ese momento (unidad, seis veces la unidad para el
-- sixpack, o el de la caja). Devuelve el id de la venta.
-- Por qué: igual que renglonesParaRegistrar, valorVenta y ventaAMovimientos.
-- Guardar siempre el precio cobrado hace que un cambio de precio no altere el
-- historial. El dominio no bloquea una venta por falta de stock.
create function public.registrar_venta(
  p_fecha date,
  p_items jsonb
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
  v_con_cantidad integer;
  v_producto public.productos;
  v_precio bigint;
  v_renglon public.venta_items;
  v_renglones jsonb;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los renglones de la venta deben venir en una lista';
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

  perform public.anotar_bitacora(
    'registrar-venta', 'ventas', v_venta.id, null,
    to_jsonb(v_venta) || jsonb_build_object('renglones', v_renglones),
    null
  );
  return v_venta.id;
end;
$$;

-- anular_venta
-- Qué hace: anula una venta vigente sin borrar nada.
-- Cómo lo hace: exige motivo, bloquea la venta, rechaza una ya anulada,
-- cambia el estado, compensa cada movimiento de la venta con uno inverso y
-- anota 'anular-registro' con la venta y sus renglones antes y después.
-- Por qué: igual que anularVenta. Si la venta era de un periodo cerrado, ese
-- cierre queda desactualizado hasta que un usuario lo recalcule.
create function public.anular_venta(
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
    to_jsonb(v_antes) || jsonb_build_object('renglones', v_renglones),
    to_jsonb(v_despues) || jsonb_build_object('renglones', v_renglones),
    v_motivo
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Deudas y abonos
-- -----------------------------------------------------------------------------

-- registrar_deuda
-- Qué hace: registra una deuda y 'registrar-deuda'.
-- Cómo lo hace: limpia el cliente y la descripción (lados y espacios
-- repetidos) e inserta; el tipo descripcion_movimiento valida el largo.
-- Devuelve el id de la deuda.
-- Por qué: igual que Deuda y normalizarDescripcion en el dominio.
create function public.registrar_deuda(
  p_cliente text,
  p_fecha date,
  p_monto bigint,
  p_descripcion text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deuda public.deudas;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  insert into public.deudas (cliente, fecha, monto, descripcion, creado_por)
  values (public.texto_sin_blancos_lados(p_cliente), p_fecha, p_monto,
          public.normalizar_descripcion(p_descripcion), auth.uid())
  returning * into v_deuda;

  perform public.anotar_bitacora('registrar-deuda', 'deudas', v_deuda.id, null, to_jsonb(v_deuda), null);
  return v_deuda.id;
end;
$$;

-- anular_deuda
-- Qué hace: anula una deuda vigente sin abonos vigentes.
-- Cómo lo hace: exige motivo, bloquea la deuda (así no entra un abono a la
-- vez), rechaza una ya anulada o con abonos vigentes, cambia el estado y
-- anota 'anular-registro'.
-- Por qué: igual que anularDeuda: con abonos vigentes, primero se anulan los
-- abonos, para que ningún pago quede colgando de una deuda que no cuenta.
create function public.anular_deuda(
  p_deuda_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_antes public.deudas;
  v_despues public.deudas;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  v_motivo := public.motivo_obligatorio(p_motivo);
  select * into v_antes from public.deudas where id = p_deuda_id for update;
  if not found then
    raise exception 'La deuda % no existe', p_deuda_id;
  end if;
  if v_antes.estado = 'anulada' then
    raise exception 'La deuda % ya está anulada', p_deuda_id;
  end if;
  if exists (
    select 1 from public.abonos_deuda
     where deuda_id = p_deuda_id and estado = 'vigente'
  ) then
    raise exception 'La deuda % tiene abonos vigentes: anule primero los abonos y luego la deuda', p_deuda_id;
  end if;

  update public.deudas set estado = 'anulada' where id = p_deuda_id
  returning * into v_despues;

  perform public.anotar_bitacora('anular-registro', 'deudas', p_deuda_id, to_jsonb(v_antes), to_jsonb(v_despues), v_motivo);
end;
$$;

-- registrar_abono
-- Qué hace: registra un abono a una deuda vigente sin pasarse de lo que se
-- debe, y 'registrar-abono'.
-- Cómo lo hace: bloquea la deuda (FOR UPDATE), suma sus abonos vigentes y,
-- si el nuevo los haría superar el monto, lanza un error que dice cuánto se
-- debe. Limpia la descripción e inserta. Devuelve el id del abono.
-- Por qué: el bloqueo evita que dos abonos al mismo tiempo pasen la revisión
-- y juntos superen la deuda. En el dominio, saldoPendiente también rechaza
-- abonos que superan el monto. Una deuda anulada ya no debe nada.
create function public.registrar_abono(
  p_deuda_id uuid,
  p_fecha date,
  p_monto bigint,
  p_descripcion text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deuda public.deudas;
  v_abonado bigint;
  v_abono public.abonos_deuda;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  select * into v_deuda from public.deudas where id = p_deuda_id for update;
  if not found then
    raise exception 'La deuda % no existe', p_deuda_id;
  end if;
  if v_deuda.estado = 'anulada' then
    raise exception 'La deuda % está anulada: ya no debe nada', p_deuda_id;
  end if;

  select coalesce(sum(monto), 0) into v_abonado
    from public.abonos_deuda
   where deuda_id = p_deuda_id and estado = 'vigente';
  if p_monto is not null and v_abonado + p_monto > v_deuda.monto then
    raise exception 'El abono de % supera lo que se debe (%)', p_monto, v_deuda.monto - v_abonado;
  end if;

  insert into public.abonos_deuda (deuda_id, fecha, monto, descripcion, creado_por)
  values (p_deuda_id, p_fecha, p_monto, public.normalizar_descripcion(p_descripcion), auth.uid())
  returning * into v_abono;

  perform public.anotar_bitacora('registrar-abono', 'abonos_deuda', v_abono.id, null, to_jsonb(v_abono), null);
  return v_abono.id;
end;
$$;

-- anular_abono
-- Qué hace: anula un abono vigente sin borrarlo.
-- Cómo lo hace: exige motivo, bloquea el abono, rechaza uno ya anulado,
-- cambia el estado y anota 'anular-registro'.
-- Por qué: igual que anularAbono: la deuda vuelve a deber ese monto.
create function public.anular_abono(
  p_abono_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_antes public.abonos_deuda;
  v_despues public.abonos_deuda;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  v_motivo := public.motivo_obligatorio(p_motivo);
  select * into v_antes from public.abonos_deuda where id = p_abono_id for update;
  if not found then
    raise exception 'El abono % no existe', p_abono_id;
  end if;
  if v_antes.estado = 'anulada' then
    raise exception 'El abono % ya está anulado', p_abono_id;
  end if;

  update public.abonos_deuda set estado = 'anulada' where id = p_abono_id
  returning * into v_despues;

  perform public.anotar_bitacora('anular-registro', 'abonos_deuda', p_abono_id, to_jsonb(v_antes), to_jsonb(v_despues), v_motivo);
end;
$$;


-- -----------------------------------------------------------------------------
-- Cierres
-- -----------------------------------------------------------------------------

-- guardar_cierre
-- Qué hace: guarda un cierre calculado por la app y registra
-- 'registrar-cierre-diario' o 'registrar-cierre-semanal'.
-- Cómo lo hace: rechaza un cierre que ya exista para ese tipo y periodo (se
-- debe recalcular), inserta con calculado_en = now() y anota la bitácora. La
-- tabla valida el periodo (un día, o de lunes a domingo). Devuelve el id.
-- Por qué: refleja guardarCierre. El cálculo lo hace el dominio; aquí se
-- guarda con el momento del cálculo.
create function public.guardar_cierre(
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
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  if exists (select 1 from public.cierres where tipo = p_tipo and desde = p_desde) then
    raise exception 'Ya existe un cierre % desde %: use recalcular_cierre', p_tipo, p_desde;
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

-- recalcular_cierre
-- Qué hace: deja al día un cierre con el resultado que la app volvió a
-- calcular, y registra 'recalcular-cierre-diario' o '-semanal'.
-- Cómo lo hace: bloquea el cierre, cambia calculado_en (now()),
-- costos_usados y resultado, y anota antes y después.
-- Por qué: refleja recalcularCierre. Un cierre nunca se recalcula solo: esta
-- función la llama un usuario. El dinero contado se conserva.
create function public.recalcular_cierre(
  p_cierre_id uuid,
  p_costos_usados jsonb,
  p_resultado jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.cierres;
  v_despues public.cierres;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  select * into v_antes from public.cierres where id = p_cierre_id for update;
  if not found then
    raise exception 'El cierre % no existe', p_cierre_id;
  end if;

  update public.cierres
     set calculado_en = now(),
         costos_usados = coalesce(p_costos_usados, '[]'::jsonb),
         resultado = p_resultado
   where id = p_cierre_id
  returning * into v_despues;

  perform public.anotar_bitacora(
    case v_antes.tipo when 'diario' then 'recalcular-cierre-diario' else 'recalcular-cierre-semanal' end,
    'cierres', p_cierre_id, to_jsonb(v_antes), to_jsonb(v_despues), null
  );
end;
$$;

-- corregir_dinero_cierre
-- Qué hace: corrige el efectivo y las transferencias de un cierre y registra
-- 'corregir-dinero-cierre' con antes y después.
-- Cómo lo hace: bloquea el cierre, cambia el dinero y pone
-- dinero_corregido_en = now(); el resultado y calculado_en no cambian.
-- Por qué: refleja corregirDineroCierre. Como dinero_corregido_en queda
-- después de calculado_en, el cierre queda desactualizado hasta que un
-- usuario lo recalcule a mano.
create function public.corregir_dinero_cierre(
  p_cierre_id uuid,
  p_efectivo bigint,
  p_transferencias bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.cierres;
  v_despues public.cierres;
begin
  if not public.es_usuario_autorizado() then
    raise exception 'No autorizado: el correo de esta sesión no está en la lista de usuarios autorizados';
  end if;

  select * into v_antes from public.cierres where id = p_cierre_id for update;
  if not found then
    raise exception 'El cierre % no existe', p_cierre_id;
  end if;

  update public.cierres
     set efectivo = p_efectivo,
         transferencias = p_transferencias,
         dinero_corregido_en = now()
   where id = p_cierre_id
  returning * into v_despues;

  perform public.anotar_bitacora('corregir-dinero-cierre', 'cierres', p_cierre_id, to_jsonb(v_antes), to_jsonb(v_despues), null);
end;
$$;


-- -----------------------------------------------------------------------------
-- Dueño y privilegios.
--
-- Qué hace: fija postgres como dueño de las funciones DEFINER, quita todo a
-- public y anon, y deja ejecutar las operaciones solo a authenticated. Las
-- auxiliares no las ejecuta nadie desde la app.
-- Cómo lo hace: ALTER FUNCTION ... OWNER TO, REVOKE y GRANT por función.
-- Por qué: el dueño define con qué permisos corren las DEFINER, así que se
-- deja explícito en vez de depender de quién aplique la migración; sus
-- políticas están en 0003. anon no debe poder ni intentarlo.
-- -----------------------------------------------------------------------------
revoke all on function public.texto_sin_blancos_lados(text) from public, anon, authenticated;
revoke all on function public.normalizar_descripcion(text) from public, anon, authenticated;
revoke all on function public.motivo_obligatorio(text) from public, anon, authenticated;
revoke all on function public.anotar_bitacora(text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;

alter function public.crear_producto(text, integer, boolean, bigint, bigint) owner to postgres;
alter function public.editar_producto(uuid, text, integer, boolean, bigint, bigint) owner to postgres;
alter function public.registrar_compra(uuid, text, integer, bigint, date) owner to postgres;
alter function public.corregir_costo_compra(uuid, bigint) owner to postgres;
alter function public.anular_compra(uuid, text) owner to postgres;
alter function public.registrar_traslado(uuid, integer) owner to postgres;
alter function public.registrar_ajuste(uuid, text, integer, text) owner to postgres;
alter function public.registrar_venta(date, jsonb) owner to postgres;
alter function public.anular_venta(uuid, text) owner to postgres;
alter function public.registrar_deuda(text, date, bigint, text) owner to postgres;
alter function public.anular_deuda(uuid, text) owner to postgres;
alter function public.registrar_abono(uuid, date, bigint, text) owner to postgres;
alter function public.anular_abono(uuid, text) owner to postgres;
alter function public.guardar_cierre(text, date, date, bigint, bigint, jsonb, jsonb, jsonb) owner to postgres;
alter function public.recalcular_cierre(uuid, jsonb, jsonb) owner to postgres;
alter function public.corregir_dinero_cierre(uuid, bigint, bigint) owner to postgres;

revoke all on function public.crear_producto(text, integer, boolean, bigint, bigint) from public, anon;
revoke all on function public.editar_producto(uuid, text, integer, boolean, bigint, bigint) from public, anon;
revoke all on function public.registrar_compra(uuid, text, integer, bigint, date) from public, anon;
revoke all on function public.corregir_costo_compra(uuid, bigint) from public, anon;
revoke all on function public.anular_compra(uuid, text) from public, anon;
revoke all on function public.registrar_traslado(uuid, integer) from public, anon;
revoke all on function public.registrar_ajuste(uuid, text, integer, text) from public, anon;
revoke all on function public.registrar_venta(date, jsonb) from public, anon;
revoke all on function public.anular_venta(uuid, text) from public, anon;
revoke all on function public.registrar_deuda(text, date, bigint, text) from public, anon;
revoke all on function public.anular_deuda(uuid, text) from public, anon;
revoke all on function public.registrar_abono(uuid, date, bigint, text) from public, anon;
revoke all on function public.anular_abono(uuid, text) from public, anon;
revoke all on function public.guardar_cierre(text, date, date, bigint, bigint, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.recalcular_cierre(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.corregir_dinero_cierre(uuid, bigint, bigint) from public, anon;

grant execute on function public.crear_producto(text, integer, boolean, bigint, bigint) to authenticated;
grant execute on function public.editar_producto(uuid, text, integer, boolean, bigint, bigint) to authenticated;
grant execute on function public.registrar_compra(uuid, text, integer, bigint, date) to authenticated;
grant execute on function public.corregir_costo_compra(uuid, bigint) to authenticated;
grant execute on function public.anular_compra(uuid, text) to authenticated;
grant execute on function public.registrar_traslado(uuid, integer) to authenticated;
grant execute on function public.registrar_ajuste(uuid, text, integer, text) to authenticated;
grant execute on function public.registrar_venta(date, jsonb) to authenticated;
grant execute on function public.anular_venta(uuid, text) to authenticated;
grant execute on function public.registrar_deuda(text, date, bigint, text) to authenticated;
grant execute on function public.anular_deuda(uuid, text) to authenticated;
grant execute on function public.registrar_abono(uuid, date, bigint, text) to authenticated;
grant execute on function public.anular_abono(uuid, text) to authenticated;
grant execute on function public.guardar_cierre(text, date, date, bigint, bigint, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.recalcular_cierre(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.corregir_dinero_cierre(uuid, bigint, bigint) to authenticated;
