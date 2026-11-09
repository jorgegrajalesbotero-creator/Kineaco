-- =====================================================================
-- 10 · PERFILES DE USUARIO (alumno / coach / admin) — FASE 1: FUNDACIÓN
-- =====================================================================
-- Objetivo del cambio (acordado):
--   · alumno : usa la app solo con SUS datos (sin cambios).
--   · coach  : usa la app como usuario + entrena a SUS alumnos (los que elige).
--   · admin  : superconjunto total (coach + usuario), rol de SOPORTE.
--
-- Modelo multi-coach: un coach tiene MUCHOS alumnos; cada alumno tiene UN
-- coach (columna profiles.coach_id). La biblioteca de CONTENIDO (ejercicios,
-- rutinas, programas, plantillas, anuncios) es COMPARTIDA entre todo el
-- personal (decisión: Grupo B = compartido), así que NO se toca su RLS aquí.
--
-- ESTA FASE 1 NO reescribe las 68 políticas que usan is_coach(). En su lugar,
-- redefine is_coach() para que signifique "PERSONAL" (coach O admin). Así:
--   · Las 68 políticas siguen funcionando sin tocarlas.
--   · El admin obtiene acceso total de inmediato (superconjunto correcto).
--   · El coach se comporta igual que hoy (ve todo) HASTA la Fase 2.
-- La Fase 2 (archivo aparte) acotará al coach a SUS alumnos en las tablas
-- de datos por-alumno, cambiando is_coach() -> is_staff_for(user_id).
--
-- CÓMO APLICAR (cuando se apruebe):
--   1. Supabase Studio -> Database -> Backups: haz un backup.
--   2. Supabase Studio -> SQL Editor: pega TODO este archivo y ejecútalo.
--      (El MCP de la sesión es solo-lectura; se aplica aquí a mano.)
--   3. Verifica con las consultas del final y con:  npm run pentest:rls
--
-- Es seguro re-ejecutarlo: usa IF NOT EXISTS / create or replace / drop+create.
-- =====================================================================


-- =====================================================================
-- 1) profiles.role — permitir 'admin' y blindar valores válidos
-- =====================================================================
-- Hoy role es text sin restricción. Añadimos un CHECK para que solo existan
-- los tres roles previstos. (No se usa un ENUM para no migrar el tipo de la
-- columna ni romper funciones existentes que la leen como text.)
-- Esquemas antiguos traían 'profiles_role_valido' (solo alumno/coach): se elimina
-- porque la reemplaza 'profiles_role_check' (que ya incluye 'admin').
alter table public.profiles drop constraint if exists profiles_role_valido;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('alumno', 'coach', 'admin'));


-- =====================================================================
-- 2) profiles.coach_id — a qué coach pertenece cada alumno
-- =====================================================================
-- Uno-a-muchos: el alumno apunta a su coach. El personal (coach/admin) tiene
-- coach_id = NULL. ON DELETE SET NULL: si se borra un coach, sus alumnos
-- quedan "sin coach" (el admin los reasigna) en vez de borrarse en cascada.
alter table public.profiles
  add column if not exists coach_id uuid references public.profiles(id) on delete set null;

-- Nadie es su propio coach.
alter table public.profiles drop constraint if exists profiles_coach_not_self;
alter table public.profiles
  add constraint profiles_coach_not_self check (coach_id is null or coach_id <> id);

-- Índice: las políticas de la Fase 2 filtrarán por coach_id.
create index if not exists profiles_coach_id_idx on public.profiles (coach_id);

-- Backfill: hoy hay UN solo coach y 9 alumnos sin coach asignado. Les ponemos
-- ese coach para que no queden huérfanos al activar el acotamiento (Fase 2).
-- Si hubiera varios coaches, NO se adivina el dueño: se avisa y se deja a mano.
do $$
declare
  v_coach uuid;
  v_n     int;
begin
  select count(*) into v_n from public.profiles where role = 'coach';
  if v_n = 1 then
    select id into v_coach from public.profiles where role = 'coach';
    update public.profiles
       set coach_id = v_coach
     where role = 'alumno' and coach_id is null;
    raise notice 'Backfill: alumnos asignados al coach %.', v_coach;
  elsif v_n > 1 then
    raise notice 'Hay % coaches: asigna profiles.coach_id de cada alumno a mano antes de la Fase 2.', v_n;
  else
    raise notice 'No hay coaches: nada que backfillear.';
  end if;
end $$;


-- =====================================================================
-- 3) Helpers de rol
-- =====================================================================
-- is_admin(): ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- is_coach(): AHORA significa "PERSONAL" = coach O admin.
-- (Mantiene el nombre para no tocar las 68 políticas que ya lo usan.)
create or replace function public.is_coach()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('coach', 'admin')
  );
$$;
revoke all on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated;

-- is_staff_for(p_user): la usará la FASE 2 para acotar al coach a SUS alumnos.
-- true si: soy admin, O soy el coach de ese alumno, O soy yo mismo.
create or replace function public.is_staff_for(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or auth.uid() = p_user
    or exists (
      select 1 from profiles
       where id = p_user and coach_id = auth.uid()
    );
$$;
revoke all on function public.is_staff_for(uuid) from public, anon;
grant execute on function public.is_staff_for(uuid) to authenticated;


-- =====================================================================
-- 4) has_active_access() — que el admin también cuente como "con acceso"
-- =====================================================================
-- Antes solo el coach se trataba como siempre-activo. Incluimos admin.
create or replace function public.has_active_access()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and (role in ('coach', 'admin') or (access_until is not null and access_until > now()))
  );
$$;


-- =====================================================================
-- 5) Trigger de columnas privilegiadas — role, access_until y coach_id
-- =====================================================================
-- Reglas:
--   · role       -> SOLO admin puede cambiarlo (crear coaches, promover).
--   · access_until y coach_id -> el PERSONAL (coach/admin) puede cambiarlos
--     (conceder acceso, asignar alumno a su coach). El alumno, nunca.
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if not public.is_admin() then
      new.role := old.role;               -- solo admin cambia el rol
    end if;
    if not public.is_coach() then         -- is_coach() = personal (coach/admin)
      new.access_until := old.access_until;
      new.coach_id     := old.coach_id;
    end if;
  elsif tg_op = 'INSERT' then
    if not public.is_admin() then
      new.role := 'alumno';               -- alta normal => alumno
    end if;
    if not public.is_coach() then
      new.access_until := null;
      new.coach_id     := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before insert or update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();

-- 5b) Trigger ANTIGUO protect_profile_role (ya existía en la base).
-- Antes revertía SIEMPRE el rol ("solo se cambia desde el SQL Editor"), lo que
-- impedía que el admin cambiara roles desde la app. Se conserva todo lo demás
-- (id, created_at, acceso solo por el personal) y se permite el cambio de rol
-- únicamente al admin.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new; -- cambios hechos por el sistema o desde el SQL Editor
  end if;
  if tg_op = 'INSERT' then
    new.role := 'alumno';
    new.access_until := null;
  else
    new.id := old.id;
    new.created_at := old.created_at;
    if not public.is_admin() then
      new.role := old.role;               -- el rol solo lo cambia un admin
    end if;
    if not public.is_coach() then
      new.access_until := old.access_until; -- solo el personal da o quita acceso
    end if;
  end if;
  return new;
end $function$;


-- =====================================================================
-- 6) delete_my_account() — el admin tampoco se borra desde la app
-- =====================================================================
-- Ya bloquea is_coach(); como is_coach() ahora incluye admin, queda cubierto.
-- Solo ajustamos el mensaje para que sea correcto para ambos.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'storage'
as $$
declare
  uid uuid := auth.uid();
  r record;
  pass int;
begin
  if uid is null then raise exception 'Sin sesión'; end if;
  if public.is_coach() then
    raise exception 'Las cuentas del personal (coach/admin) no se eliminan desde la app';
  end if;

  for pass in 1..3 loop
    for r in
      select con.conrelid::regclass as tbl, att.attname as col
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
      where con.contype = 'f'
        and con.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
        and array_length(con.conkey, 1) = 1
        and con.confdeltype in ('a', 'r')
        and con.conrelid::regclass::text not like 'auth.%'
        and con.conrelid::regclass::text not like 'storage.%'
    loop
      execute format('delete from %s where %I = $1', r.tbl, r.col) using uid;
    end loop;
  end loop;

  delete from storage.objects
   where bucket_id in ('avatars', 'progress-photos')
     and (storage.foldername(name))[1] = uid::text;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end
$$;


-- =====================================================================
-- 7) BOOTSTRAP — crear el PRIMER admin (ejecutar a mano, una sola vez)
-- =====================================================================
-- El trigger impide cambiar 'role' si quien ejecuta no es admin. En el SQL
-- Editor (sin sesión de usuario, auth.uid() = NULL) is_admin() es false, así
-- que para nombrar al primer admin hay que desactivar el trigger un momento.
-- DESCOMENTA, pon el email y ejecútalo SOLO para el primer admin:
--
--   alter table public.profiles disable trigger trg_profiles_guard;
--   update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'TU_EMAIL_ADMIN@dominio.com');
--   alter table public.profiles enable trigger trg_profiles_guard;
--
-- A partir de ahí, ese admin ya puede crear/promover coaches desde la app.


-- =====================================================================
-- VERIFICACIÓN (solo lectura) — ejecuta tras aplicar y revisa el resultado
-- =====================================================================
-- 1) role admitido y CHECK activo:
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid='public.profiles'::regclass and conname='profiles_role_check';
--
-- 2) coach_id creado y backfill hecho (debe ser 0):
--    select count(*) as alumnos_sin_coach
--      from public.profiles where role='alumno' and coach_id is null;
--
-- 3) Helpers existen:
--    select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and proname in ('is_admin','is_coach','is_staff_for','has_active_access');
--
-- 4) is_coach() ya incluye admin:
--    select pg_get_functiondef('public.is_coach()'::regprocedure);
--
-- 5) Pentest de RLS (deben seguir pasando):  npm run pentest:rls
-- =====================================================================
