-- =============================================================================
-- 0001_tablas_base.sql
--
-- Qué hace: crea las tablas del negocio (usuarios autorizados, productos,
-- compras, movimientos de inventario, ventas y sus renglones, deudas, abonos,
-- cierres y bitácora), con sus restricciones y los disparadores que cuidan la
-- integridad de los datos.
-- Cómo lo hace: tablas en el esquema public, en español y snake_case, con
-- llaves primarias uuid. Los momentos van en timestamptz (UTC), las fechas de
-- negocio en date, el dinero en bigint (pesos enteros, sin decimales) y las
-- unidades en integer. Las listas cerradas (ubicaciones, tipos, presentaciones,
-- estados, acciones) se validan con CHECK.
-- Por qué: es el reflejo en la base de datos de las reglas de src/domain. Si
-- una regla se valida aquí, ningún cliente (ni uno con errores) puede guardar
-- datos que la rompan. Nada se borra: lo que se anula cambia de estado o se
-- compensa con movimientos contrarios, y todo queda en la bitácora.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tipo de dato: descripción de deudas y abonos.
--
-- Qué hace: define el texto que justifica una deuda o un abono.
-- Cómo lo hace: un dominio de texto con CHECK: entre 1 y 200 caracteres, sin
-- espacios (ni otros blancos) a los lados y sin espacios repetidos en medio.
-- char_length cuenta caracteres, no bytes, así que una tilde o un emoji
-- cuentan uno, igual que en src/domain/deudas/descripcion.ts.
-- Por qué: la descripción llega ya limpia desde la app (normalizarDescripcion);
-- si llega sucia, es un error y la base de datos lo rechaza.
-- -----------------------------------------------------------------------------
create domain public.descripcion_movimiento as text
  check (
    char_length(value) between 1 and 200
    and value !~ '^\s'
    and value !~ '\s$'
    and position('  ' in value) = 0
  );

comment on domain public.descripcion_movimiento is
  'Descripción obligatoria de deudas y abonos: 1 a 200 caracteres, sin espacios sobrantes.';


-- -----------------------------------------------------------------------------
-- Tabla: usuarios_autorizados
--
-- Qué hace: guarda los correos de Google que pueden entrar al sistema.
-- Cómo lo hace: un correo único, en minúsculas y sin espacios, con un nombre y
-- un indicador de activo. No lleva creado_por porque no la escribe la app: se
-- administra a mano desde el editor SQL de Supabase.
-- Por qué: el login es solo con Google y solo para los correos de esta lista.
-- Para quitar el acceso se marca activo = false; nada se borra.
-- -----------------------------------------------------------------------------
create table public.usuarios_autorizados (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique
    check (correo = lower(correo) and correo !~ '\s' and correo ~ '^[^@]+@[^@]+$'),
  nombre text not null check (char_length(btrim(nombre)) > 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table public.usuarios_autorizados is
  'Correos de Google autorizados. Se administra a mano; la app solo la lee.';


-- -----------------------------------------------------------------------------
-- Tabla: productos
--
-- Qué hace: guarda los productos con lo que hace falta para convertir
-- presentaciones a unidades y para poner precio.
-- Cómo lo hace: unidades por caja (mayor a cero), si maneja sixpack, precio de
-- la unidad y precio de la caja aparte (es editable).
-- Por qué: refleja ProductoConversion y ProductoVendible del dominio. Los
-- precios de verdad no van en el repositorio: se cargan desde la app.
-- -----------------------------------------------------------------------------
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) > 0),
  unidades_por_caja integer not null check (unidades_por_caja > 0),
  maneja_sixpack boolean not null default false,
  precio_unidad bigint not null check (precio_unidad >= 0),
  precio_caja bigint not null check (precio_caja >= 0),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id)
);

comment on table public.productos is
  'Productos con unidades por caja, sixpack y precios de lista (en pesos enteros).';


-- -----------------------------------------------------------------------------
-- Función: unidades_de_presentacion
--
-- Qué hace: convierte una cantidad en cierta presentación (unidad, sixpack o
-- caja) a unidades.
-- Cómo lo hace: lee el producto; la unidad vale 1, el sixpack 6 (solo si el
-- producto lo maneja) y la caja vale las unidades por caja del producto.
-- Por qué: es la misma regla de aUnidades (src/domain/inventario/conversiones.ts).
-- Calcularla en la base de datos impide guardar unidades que no cuadren con la
-- presentación, o un sixpack de un producto que no lo maneja.
-- search_path vacío: obliga a escribir public. y evita que alguien cambie a
-- qué tabla apunta el nombre.
-- -----------------------------------------------------------------------------
create function public.unidades_de_presentacion(
  p_producto_id uuid,
  p_presentacion text,
  p_cantidad integer
)
returns integer
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_unidades_por_caja integer;
  v_maneja_sixpack boolean;
begin
  if p_cantidad is null or p_cantidad < 0 then
    raise exception 'La cantidad debe ser un entero mayor o igual a cero';
  end if;

  select unidades_por_caja, maneja_sixpack
    into v_unidades_por_caja, v_maneja_sixpack
    from public.productos
   where id = p_producto_id;
  if not found then
    raise exception 'El producto % no existe', p_producto_id;
  end if;

  case p_presentacion
    when 'unidad' then
      return p_cantidad;
    when 'sixpack' then
      if not v_maneja_sixpack then
        raise exception 'Este producto no se maneja por sixpack';
      end if;
      return p_cantidad * 6;
    when 'caja' then
      return p_cantidad * v_unidades_por_caja;
    else
      raise exception 'Presentación desconocida: %', p_presentacion;
  end case;
end;
$$;


-- -----------------------------------------------------------------------------
-- Función de disparador: completar_unidades
--
-- Qué hace: antes de guardar una compra o un renglón de venta, calcula sus
-- unidades a partir de la presentación y la cantidad.
-- Cómo lo hace: llama a unidades_de_presentacion y escribe el resultado en la
-- columna unidades, ignorando lo que haya mandado el cliente.
-- Por qué: las unidades se guardan en el registro para que, si después cambian
-- las unidades por caja del producto, el historial no se altere; y se calculan
-- aquí para que nunca queden mal.
-- -----------------------------------------------------------------------------
create function public.completar_unidades()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.unidades := public.unidades_de_presentacion(new.producto_id, new.presentacion, new.cantidad);
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Función de disparador: impedir_reactivar
--
-- Qué hace: impide que un registro anulado vuelva a quedar vigente.
-- Cómo lo hace: antes de actualizar el estado, si el valor anterior era
-- 'anulada' y el nuevo no, lanza un error.
-- Por qué: anular es la forma de corregir sin borrar; deshacer una anulación
-- cambiaría la historia en silencio. El dominio también rechaza anular dos
-- veces la misma venta.
-- -----------------------------------------------------------------------------
create function public.impedir_reactivar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.estado = 'anulada' and new.estado <> 'anulada' then
    raise exception 'Un registro anulado no puede volver a quedar vigente';
  end if;
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Tabla: compras
--
-- Qué hace: guarda cada compra de producto: qué, en qué presentación, cuánto,
-- cuánto se pagó, en qué fecha y si sigue vigente.
-- Cómo lo hace: cantidad mayor a cero, unidades calculadas por disparador,
-- costo total en pesos, fecha de negocio elegida por el usuario y estado.
-- creado_en es el momento de registro (registradoEn en el dominio): con varias
-- compras el mismo día, manda la registrada de último.
-- Por qué: refleja Compra (src/domain/inventario/compras.ts). El costo puede
-- corregirse después (corregir-costo-compra): se actualiza costo_total y el
-- antes y el después quedan en la bitácora. El inventario inicial también se
-- carga como compras, con la fecha que elija el usuario.
-- -----------------------------------------------------------------------------
create table public.compras (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id),
  presentacion text not null check (presentacion in ('unidad', 'sixpack', 'caja')),
  cantidad integer not null check (cantidad > 0),
  unidades integer not null check (unidades > 0),
  costo_total bigint not null check (costo_total >= 0),
  fecha date not null,
  estado text not null default 'vigente' check (estado in ('vigente', 'anulada')),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id)
);

comment on table public.compras is
  'Compras. creado_en es el momento de registro; desempata compras del mismo día.';

-- La búsqueda de la última compra ordena por producto, fecha y registro.
create index compras_ultima_compra_idx
  on public.compras (producto_id, fecha desc, creado_en desc);

create trigger compras_completar_unidades
  before insert or update of producto_id, presentacion, cantidad on public.compras
  for each row execute function public.completar_unidades();

create trigger compras_impedir_reactivar
  before update of estado on public.compras
  for each row execute function public.impedir_reactivar();


-- -----------------------------------------------------------------------------
-- Tabla: ventas
--
-- Qué hace: guarda cada venta con su fecha y su estado.
-- Cómo lo hace: estado vigente o anulada; los renglones van en venta_items.
-- Por qué: refleja Venta (src/domain/ventas/venta.ts). Anular cambia el estado
-- y los cierres suman solo las ventas vigentes.
-- -----------------------------------------------------------------------------
create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  estado text not null default 'vigente' check (estado in ('vigente', 'anulada')),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id)
);

comment on table public.ventas is 'Ventas con estado vigente o anulada.';

create index ventas_fecha_idx on public.ventas (fecha);

create trigger ventas_impedir_reactivar
  before update of estado on public.ventas
  for each row execute function public.impedir_reactivar();


-- -----------------------------------------------------------------------------
-- Tabla: venta_items
--
-- Qué hace: guarda los renglones de una venta: producto, presentación,
-- cantidad, unidades y el precio por presentación que se cobró.
-- Cómo lo hace: unidades calculadas por disparador; precio_cobrado siempre se
-- guarda (si en la venta no se cambió, es el de lista de ese momento).
-- Por qué: refleja RenglonVenta. Guardar el precio cobrado en la venta hace
-- que un cambio futuro de precio no altere el historial (CLAUDE.md).
-- -----------------------------------------------------------------------------
create table public.venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id),
  producto_id uuid not null references public.productos (id),
  presentacion text not null check (presentacion in ('unidad', 'sixpack', 'caja')),
  cantidad integer not null check (cantidad >= 0),
  unidades integer not null check (unidades >= 0),
  precio_cobrado bigint not null check (precio_cobrado >= 0),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id)
);

comment on table public.venta_items is
  'Renglones de venta con el precio cobrado guardado, para no alterar el historial.';

create index venta_items_venta_idx on public.venta_items (venta_id);

create trigger venta_items_completar_unidades
  before insert or update of producto_id, presentacion, cantidad on public.venta_items
  for each row execute function public.completar_unidades();


-- -----------------------------------------------------------------------------
-- Tabla: movimientos_inventario
--
-- Qué hace: guarda cada cambio de inventario de un producto en una ubicación.
-- Cómo lo hace: unidades con signo (positivo entra, negativo sale), tipo
-- (compra, traslado, venta, ajuste) y ubicación (bodega, nevera). Cada
-- movimiento apunta a lo que lo originó: la compra, la venta o el grupo del
-- traslado. Un movimiento que anula a otro lo indica en compensa_a, y cada
-- movimiento solo se puede compensar una vez.
-- Por qué: el stock nunca se edita; es la suma de estos movimientos (vista
-- stock_actual). Refleja Movimiento (src/domain/inventario/stock.ts).
-- -----------------------------------------------------------------------------
create table public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id),
  tipo text not null check (tipo in ('compra', 'traslado', 'venta', 'ajuste')),
  ubicacion text not null check (ubicacion in ('bodega', 'nevera')),
  unidades integer not null,
  compra_id uuid references public.compras (id),
  venta_id uuid references public.ventas (id),
  traslado_id uuid,
  motivo text,
  compensa_a uuid unique references public.movimientos_inventario (id),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id),

  -- Una compra entra a la bodega y apunta a su compra.
  constraint compra_en_bodega
    check (tipo <> 'compra' or (ubicacion = 'bodega' and compra_id is not null)),
  -- Una venta sale de la nevera y apunta a su venta.
  constraint venta_en_nevera
    check (tipo <> 'venta' or (ubicacion = 'nevera' and venta_id is not null)),
  -- Los dos movimientos de un traslado comparten el mismo grupo.
  constraint traslado_agrupado
    check (tipo <> 'traslado' or traslado_id is not null),
  -- Un ajuste exige motivo (sin espacios a los lados) y unidades distintas de cero.
  constraint ajuste_con_motivo
    check (
      tipo <> 'ajuste'
      or (
        unidades <> 0
        and motivo is not null
        and char_length(motivo) > 0
        and motivo !~ '^\s'
        and motivo !~ '\s$'
      )
    ),
  -- Los signos solo se exigen en el movimiento original; el que lo compensa
  -- lleva el signo contrario.
  constraint signo_de_compra
    check (tipo <> 'compra' or compensa_a is not null or unidades > 0),
  constraint signo_de_venta
    check (tipo <> 'venta' or compensa_a is not null or unidades <= 0)
);

comment on table public.movimientos_inventario is
  'Movimientos de inventario con signo. El stock es su suma; nunca se escribe a mano.';

create index movimientos_producto_ubicacion_idx
  on public.movimientos_inventario (producto_id, ubicacion);
create index movimientos_venta_idx on public.movimientos_inventario (venta_id);


-- -----------------------------------------------------------------------------
-- Tabla: deudas
--
-- Qué hace: guarda lo que un cliente se llevó sin pagar.
-- Cómo lo hace: cliente, fecha en que nació, monto en pesos y descripción
-- obligatoria que la justifica.
-- Por qué: refleja Deuda (src/domain/deudas/deudas.ts). En un cierre entran
-- solo las nacidas en el periodo y por lo que sigan debiendo.
-- -----------------------------------------------------------------------------
create table public.deudas (
  id uuid primary key default gen_random_uuid(),
  cliente text not null check (char_length(btrim(cliente)) > 0),
  fecha date not null,
  monto bigint not null check (monto >= 0),
  descripcion public.descripcion_movimiento not null,
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id)
);

comment on table public.deudas is 'Deudas de clientes con descripción obligatoria.';


-- -----------------------------------------------------------------------------
-- Tabla: abonos_deuda
--
-- Qué hace: guarda cada pago, parcial o total, de una deuda.
-- Cómo lo hace: deuda, fecha, monto, descripción obligatoria y estado.
-- Por qué: refleja Abono (src/domain/deudas/deudas.ts). Un abono mal
-- registrado se anula con su estado; nada se borra.
-- -----------------------------------------------------------------------------
create table public.abonos_deuda (
  id uuid primary key default gen_random_uuid(),
  deuda_id uuid not null references public.deudas (id),
  fecha date not null,
  monto bigint not null check (monto >= 0),
  descripcion public.descripcion_movimiento not null,
  estado text not null default 'vigente' check (estado in ('vigente', 'anulada')),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id)
);

comment on table public.abonos_deuda is 'Abonos a deudas, con descripción obligatoria y estado.';

create index abonos_deuda_deuda_idx on public.abonos_deuda (deuda_id);

create trigger abonos_deuda_impedir_reactivar
  before update of estado on public.abonos_deuda
  for each row execute function public.impedir_reactivar();


-- -----------------------------------------------------------------------------
-- Tabla: cierres
--
-- Qué hace: guarda cada cierre calculado, diario o semanal.
-- Cómo lo hace: tipo, periodo (desde y hasta), el dinero contado (efectivo y
-- transferencias), los costos manuales usados, el momento del cálculo, los
-- costos usados por producto y el resultado del cálculo.
-- Por qué: refleja CierreGuardado (src/domain/cierres/actualizacionCierre.ts).
-- El diario es de un solo día; el semanal va de lunes a domingo. Un cierre se
-- recalcula a mano actualizando calculado_en, costos_usados y resultado, y
-- el antes y el después quedan en la bitácora. Hay un solo cierre por tipo y
-- periodo: recalcular cambia ese mismo cierre.
-- -----------------------------------------------------------------------------
create table public.cierres (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('diario', 'semanal')),
  desde date not null,
  hasta date not null,
  efectivo bigint not null check (efectivo >= 0),
  transferencias bigint not null check (transferencias >= 0),
  costos_manuales jsonb not null default '{}'::jsonb
    check (jsonb_typeof(costos_manuales) = 'object'),
  calculado_en timestamptz not null default now(),
  costos_usados jsonb not null default '[]'::jsonb
    check (jsonb_typeof(costos_usados) = 'array'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  creado_en timestamptz not null default now(),
  creado_por uuid not null default auth.uid() references auth.users (id),

  -- Un cierre diario es de un solo día.
  constraint diario_de_un_dia check (tipo <> 'diario' or desde = hasta),
  -- Un cierre semanal va de un lunes (isodow 1) al domingo siguiente.
  constraint semanal_de_lunes_a_domingo
    check (tipo <> 'semanal' or (extract(isodow from desde) = 1 and hasta = desde + 6)),
  -- Un solo cierre por tipo y periodo.
  constraint un_cierre_por_periodo unique (tipo, desde)
);

comment on table public.cierres is
  'Cierres diarios y semanales con el momento del cálculo; se recalculan a mano.';


-- -----------------------------------------------------------------------------
-- Tabla: bitacora
--
-- Qué hace: guarda quién hizo cada cambio, cuándo, qué acción fue, sobre qué
-- registro, cómo estaba antes, cómo quedó después y, si es una anulación, el
-- motivo.
-- Cómo lo hace: la acción debe estar en la lista fija (la misma de
-- ACCIONES_BITACORA en src/domain/compartido/bitacora.ts; una prueba revisa
-- que coincidan). El valor después es obligatorio porque nada se borra.
-- "momento" cumple el papel de creado_en: es cuándo se hizo el cambio.
-- Por qué: los dos usuarios tienen los mismos permisos; la bitácora es la
-- única forma de saber quién cambió qué. Solo se inserta y se lee; nunca se
-- modifica (ver 0003_seguridad_rls.sql).
-- -----------------------------------------------------------------------------
create table public.bitacora (
  id uuid primary key default gen_random_uuid(),
  momento timestamptz not null default now(),
  usuario text not null check (char_length(btrim(usuario)) > 0),
  accion text not null check (accion in (
    'registrar-compra',
    'corregir-costo-compra',
    'registrar-traslado',
    'registrar-ajuste',
    'registrar-venta',
    'registrar-cierre-diario',
    'registrar-cierre-semanal',
    'registrar-deuda',
    'registrar-abono',
    'cambiar-precio',
    'crear-producto',
    'editar-producto',
    'anular-registro',
    'recalcular-cierre-diario',
    'recalcular-cierre-semanal'
  )),
  tabla text,
  registro_id uuid,
  antes jsonb,
  despues jsonb not null,
  motivo text check (motivo is null or (char_length(btrim(motivo)) > 0)),
  creado_por uuid not null default auth.uid() references auth.users (id),

  -- Una anulación siempre explica por qué.
  constraint anulacion_con_motivo check (accion <> 'anular-registro' or motivo is not null)
);

comment on table public.bitacora is
  'Bitácora de auditoría: solo inserción y lectura. La acción debe estar en la lista fija.';

create index bitacora_momento_idx on public.bitacora (momento desc);
create index bitacora_registro_idx on public.bitacora (tabla, registro_id);
