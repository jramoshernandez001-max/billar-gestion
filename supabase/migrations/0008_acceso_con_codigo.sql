-- =============================================================================
-- Migración 0008: acceso con código único
--
-- Qué hace: agrega una segunda forma de entrar, además de Google: un código
-- único por persona que entrega el administrador. Crea las tablas
-- `codigos_acceso` (los códigos, guardados con hash), `sesiones_codigo` (qué
-- sesión entró con qué código) e `intentos_codigo` (para frenar a quien
-- intente adivinar); las funciones `crear_codigo_acceso` (solo desde el
-- editor SQL), `canjear_codigo_acceso` (la llama la app) y `usuario_actual`;
-- y reemplaza `es_usuario_autorizado` y `anotar_bitacora`.
-- Cómo lo hace: la app abre una sesión anónima de Supabase (sin correo) y
-- llama a `canjear_codigo_acceso` con el código. Si coincide con un código
-- activo, esa sesión queda ligada al código en `sesiones_codigo`, y desde ahí
-- `es_usuario_autorizado` la acepta igual que a un correo autorizado. RLS y
-- todas las funciones siguen usando `es_usuario_autorizado`, así que no
-- cambia nada más. La bitácora anota "Nombre (código)" en vez del correo.
-- Por qué: hay personas autorizadas que no van a usar una cuenta de Google.
-- El código nunca se guarda en claro (bcrypt): si alguien lee la base, no
-- obtiene los códigos. Para quitar el acceso se marca el código como
-- inactivo: todas las sesiones que entraron con él pierden el acceso al
-- instante. Nada se borra.
--
-- Requisito en Supabase: activar "Allow anonymous sign-ins" en
-- Authentication → Sign In / Providers. Los códigos se crean a mano en el
-- editor SQL (ver docs/BASE_DE_DATOS.md); nunca van en el repositorio.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;


-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

-- codigos_acceso
-- Qué hace: guarda un código por persona, con su nombre y si está activo.
-- Cómo lo hace: solo el hash bcrypt del código (codigo_hash), nunca el texto.
-- Por qué: el nombre aparece en la bitácora; activo = false quita el acceso.
create table public.codigos_acceso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) > 0),
  codigo_hash text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table public.codigos_acceso is
  'Códigos de acceso (hash bcrypt). Se administran a mano; la app no los lee.';

-- sesiones_codigo
-- Qué hace: liga una sesión de Supabase (auth.uid()) al código con que entró.
-- Cómo lo hace: una fila por sesión; si la misma sesión canjea otro código,
-- se actualiza.
-- Por qué: es lo que es_usuario_autorizado consulta para una sesión sin correo.
create table public.sesiones_codigo (
  usuario_id uuid primary key,
  codigo_id uuid not null references public.codigos_acceso (id),
  creado_en timestamptz not null default now()
);

comment on table public.sesiones_codigo is
  'Sesiones que entraron con un código. La app no la lee.';

-- intentos_codigo
-- Qué hace: anota cada intento de canjear un código, bueno o malo.
-- Cómo lo hace: quién (auth.uid()), si acertó y cuándo.
-- Por qué: permite limitar los intentos fallidos y frenar a quien pruebe
-- códigos al azar.
create table public.intentos_codigo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  exitoso boolean not null,
  momento timestamptz not null default now()
);

create index intentos_codigo_momento on public.intentos_codigo (momento);

comment on table public.intentos_codigo is
  'Intentos de canjear un código (para limitar los fallidos). La app no la lee.';


-- -----------------------------------------------------------------------------
-- Seguridad de las tablas nuevas
--
-- Qué hace: RLS activada y forzada; la app (anon y authenticated) no tiene
-- ningún permiso; postgres (dueño de las funciones) lee y agrega, y edita
-- solo donde hace falta. Nada se borra.
-- Por qué: aunque son hashes, los códigos no deben salir de la base. Todo
-- pasa por canjear_codigo_acceso, que corre como postgres.
-- -----------------------------------------------------------------------------
alter table public.codigos_acceso enable row level security;
alter table public.codigos_acceso force row level security;
alter table public.sesiones_codigo enable row level security;
alter table public.sesiones_codigo force row level security;
alter table public.intentos_codigo enable row level security;
alter table public.intentos_codigo force row level security;

revoke all on public.codigos_acceso from public, anon, authenticated;
revoke all on public.sesiones_codigo from public, anon, authenticated;
revoke all on public.intentos_codigo from public, anon, authenticated;

create policy codigos_acceso_postgres_leer on public.codigos_acceso for select to postgres using (true);
create policy codigos_acceso_postgres_agregar on public.codigos_acceso for insert to postgres with check (true);
create policy codigos_acceso_postgres_editar on public.codigos_acceso for update to postgres using (true) with check (true);

create policy sesiones_codigo_postgres_leer on public.sesiones_codigo for select to postgres using (true);
create policy sesiones_codigo_postgres_agregar on public.sesiones_codigo for insert to postgres with check (true);
create policy sesiones_codigo_postgres_editar on public.sesiones_codigo for update to postgres using (true) with check (true);

create policy intentos_codigo_postgres_leer on public.intentos_codigo for select to postgres using (true);
create policy intentos_codigo_postgres_agregar on public.intentos_codigo for insert to postgres with check (true);

create trigger codigos_acceso_sin_borrado before delete on public.codigos_acceso
  for each row execute function public.impedir_cambio();
create trigger sesiones_codigo_sin_borrado before delete on public.sesiones_codigo
  for each row execute function public.impedir_cambio();
create trigger intentos_codigo_sin_borrado before delete on public.intentos_codigo
  for each row execute function public.impedir_cambio();
create trigger intentos_codigo_sin_cambio before update on public.intentos_codigo
  for each row execute function public.impedir_cambio();


-- -----------------------------------------------------------------------------
-- crear_codigo_acceso
-- Qué hace: crea el código de una persona a partir del texto que se le va a
-- entregar.
-- Cómo lo hace: exige nombre y un código de al menos 8 caracteres sin
-- espacios a los lados, rechaza un código igual a otro activo y guarda solo
-- su hash bcrypt.
-- Por qué: se ejecuta a mano desde el editor SQL (como postgres); ninguna
-- persona de la app puede crear códigos. 8 caracteres o más hacen inviable
-- adivinarlo con el límite de intentos de canjear_codigo_acceso.
-- -----------------------------------------------------------------------------
create function public.crear_codigo_acceso(
  p_nombre text,
  p_codigo text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_nombre is null or char_length(btrim(p_nombre)) = 0 then
    raise exception 'El código necesita el nombre de la persona';
  end if;
  if p_codigo is null or p_codigo <> btrim(p_codigo) or char_length(p_codigo) < 8 then
    raise exception 'El código debe tener al menos 8 caracteres, sin espacios al inicio ni al final';
  end if;
  if exists (
    select 1 from public.codigos_acceso
     where activo and codigo_hash = extensions.crypt(p_codigo, codigo_hash)
  ) then
    raise exception 'Ese código ya está en uso; elige otro';
  end if;

  insert into public.codigos_acceso (nombre, codigo_hash)
  values (btrim(p_nombre), extensions.crypt(p_codigo, extensions.gen_salt('bf', 10)))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.crear_codigo_acceso(text, text) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- canjear_codigo_acceso
-- Qué hace: si el código coincide con uno activo, liga la sesión actual a ese
-- código y devuelve el nombre de la persona; si no, devuelve null.
-- Cómo lo hace: toma un candado para que los intentos se revisen de a uno;
-- rechaza si esta sesión lleva 5 fallos en 15 minutos o si entre todas las
-- sesiones hay 20 fallos en 15 minutos; compara el código con cada hash
-- activo; anota el intento (bueno o malo) y, si acertó, guarda la sesión.
-- Por qué: es la única puerta para entrar sin Google, así que limita los
-- intentos (también entre sesiones, porque crear sesiones anónimas nuevas es
-- fácil). Un código malo devuelve null en vez de un error para que el
-- intento fallido sí quede anotado (un error desharía la anotación). No
-- verifica es_usuario_autorizado porque justamente es la que autoriza.
-- -----------------------------------------------------------------------------
create function public.canjear_codigo_acceso(
  p_codigo text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid;
  v_codigo public.codigos_acceso;
begin
  v_usuario := auth.uid();
  if v_usuario is null then
    raise exception 'Hace falta una sesión para usar un código';
  end if;

  perform pg_advisory_xact_lock(hashtext('canjear_codigo_acceso'));

  if (select count(*) from public.intentos_codigo
       where usuario_id = v_usuario and not exitoso and momento > now() - interval '15 minutes') >= 5
     or (select count(*) from public.intentos_codigo
       where not exitoso and momento > now() - interval '15 minutes') >= 20 then
    raise exception 'Demasiados intentos con códigos incorrectos. Espera 15 minutos y vuelve a intentar.';
  end if;

  select * into v_codigo
    from public.codigos_acceso
   where activo and p_codigo is not null and codigo_hash = extensions.crypt(p_codigo, codigo_hash)
   limit 1;

  insert into public.intentos_codigo (usuario_id, exitoso) values (v_usuario, v_codigo.id is not null);

  if v_codigo.id is null then
    return null;
  end if;

  insert into public.sesiones_codigo (usuario_id, codigo_id)
  values (v_usuario, v_codigo.id)
  on conflict (usuario_id) do update set codigo_id = excluded.codigo_id, creado_en = now();

  return v_codigo.nombre;
end;
$$;

alter function public.canjear_codigo_acceso(text) owner to postgres;
revoke all on function public.canjear_codigo_acceso(text) from public, anon;
grant execute on function public.canjear_codigo_acceso(text) to authenticated;


-- -----------------------------------------------------------------------------
-- es_usuario_autorizado (reemplazo)
-- Qué hace: dice si quien consulta puede entrar: su correo está en la lista
-- de autorizados activos, o su sesión entró con un código que sigue activo.
-- Cómo lo hace: dos EXISTS; el segundo une sesiones_codigo con
-- codigos_acceso por auth.uid().
-- Por qué: todas las políticas y funciones ya dependen de esta función; al
-- ampliarla aquí, el acceso con código funciona en todo sin tocar nada más.
-- Se reemplaza (no se borra) porque las políticas dependen de ella.
-- -----------------------------------------------------------------------------
create or replace function public.es_usuario_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.usuarios_autorizados as u
     where u.correo = public.correo_del_token()
       and u.activo
  ) or exists (
    select 1
      from public.sesiones_codigo as s
      join public.codigos_acceso as c on c.id = s.codigo_id
     where s.usuario_id = auth.uid()
       and c.activo
  );
$$;

alter function public.es_usuario_autorizado() owner to postgres;
revoke all on function public.es_usuario_autorizado() from public, anon;
grant execute on function public.es_usuario_autorizado() to authenticated;


-- -----------------------------------------------------------------------------
-- usuario_actual
-- Qué hace: devuelve cómo se nombra en la bitácora a quien hace el cambio.
-- Cómo lo hace: el correo del token; si no hay (sesión con código), el nombre
-- del código seguido de "(código)".
-- Por qué: la bitácora exige un usuario no vacío y debe decir quién fue
-- también cuando se entró con código.
-- -----------------------------------------------------------------------------
create function public.usuario_actual()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    nullif(public.correo_del_token(), ''),
    (select c.nombre || ' (código)'
       from public.sesiones_codigo as s
       join public.codigos_acceso as c on c.id = s.codigo_id
      where s.usuario_id = auth.uid()),
    'desconocido'
  );
$$;

revoke all on function public.usuario_actual() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- anotar_bitacora (reemplazo)
-- Qué hace: igual que antes, pero el usuario sale de usuario_actual().
-- Por qué: con un código no hay correo; así la bitácora dice "Ana (código)".
-- -----------------------------------------------------------------------------
create or replace function public.anotar_bitacora(
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
  values (public.usuario_actual(), p_accion, p_tabla, p_registro_id, p_antes, p_despues, p_motivo, auth.uid());
end;
$$;

revoke all on function public.anotar_bitacora(text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
