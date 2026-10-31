-- =====================================================================
-- 08 · SEG — Versionar las funciones SQL que faltan en el repo   [MEDIO]
-- =====================================================================
-- is_coach(), has_active_access() y delete_my_account() NO están en el repo, así
-- que no se pueden auditar ni reconstruir ante un desastre. delete_my_account()
-- es crítica para el derecho de supresión (Ley 1581).
--
-- PASO 1 — Exporta sus definiciones desde Supabase (SQL Editor) y PÉGALAS abajo:
--
--   select pg_get_functiondef(p.oid) as def
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('is_coach', 'has_active_access', 'delete_my_account')
--    order by p.proname;
--
-- PASO 2 — Revisa delete_my_account() contra esta checklist (Ley 1581):
--   [ ] Usa auth.uid() internamente (NO recibe un id del cliente que podría
--       falsificarse para borrar la cuenta de otra persona).
--   [ ] Borra TODAS las filas del usuario: profiles, legal_consents,
--       body_measurements, intake_forms, progress_photo_sets/progress_photos,
--       check-ins, messages, notifications, training_plans, routine_assignments,
--       meal_logs, body_weight_logs, etc.
--   [ ] Borra los archivos del usuario en Storage (avatars/<uid>/,
--       progress-photos/<uid>/), o deja ese borrado a un proceso que sí lo haga.
--   [ ] Borra la cuenta de auth.users (o documenta que se hace aparte).
--   [ ] security definer con search_path fijo.
--
-- PASO 3 — Pega aquí las definiciones (create or replace function ...) para
-- dejarlas bajo control de versiones. Mantén este archivo actualizado si cambian.
-- =====================================================================


-- Exportadas desde Supabase el 2026-10-31 (MCP). Mantener sincronizadas si cambian.

-- ----- is_coach() -----
create or replace function public.is_coach()
  returns boolean
  language sql
  security definer
  set search_path to 'public'
as $function$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'coach'
  );
$function$;


-- ----- has_active_access() -----
create or replace function public.has_active_access()
  returns boolean
  language sql
  security definer
  set search_path to 'public'
as $function$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and (role = 'coach' or (access_until is not null and access_until > now()))
  );
$function$;


-- ----- delete_my_account() -----
-- Revisión Ley 1581 (2026-10-31):
--   [x] Usa auth.uid() internamente (no recibe id del cliente).
--   [x] Borra las filas del usuario recorriendo las FK a auth.users/public.profiles
--       (3 pasadas por dependencias) + profiles + auth.users.
--   [x] security definer con search_path fijo.
--   [ ] NO borra los archivos de Storage (avatars/<uid>/, progress-photos/<uid>/)
--       -> quedan fotos huérfanas. Pendiente: borrarlas en un paso cliente/Edge Function
--       antes de llamar a esta RPC, o añadir el borrado aquí vía storage API.
create or replace function public.delete_my_account()
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'auth'
as $function$
declare
  uid uuid := auth.uid();
  r record;
  pass int;
begin
  if uid is null then raise exception 'Sin sesión'; end if;
  if public.is_coach() then raise exception 'La cuenta del coach no se elimina desde la app'; end if;
  -- Borra lo del alumno en tablas cuya relación no se borra sola
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
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end $function$;
