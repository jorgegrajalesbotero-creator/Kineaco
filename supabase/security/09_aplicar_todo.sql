-- =====================================================================
-- 09 · SOLUCIÓN DEFINITIVA — aplica TODOS los hallazgos medios de una vez
-- =====================================================================
-- Consolida e implementa de forma idempotente:
--   A) SEG — Avatares: lectura solo del dueño o del coach            (= 06)
--   B) SEG — IDOR entre coaches en save_routine_content + backfill   (= 03)
--   C) SEG — Consentimiento de datos de salud impuesto por RLS       (= 07)
--   D) Ley 1581 — delete_my_account borra también los archivos Storage (fix)
--
-- CÓMO APLICAR:
--   1. Supabase Studio -> Database -> Backups: haz un backup.
--   2. Supabase Studio -> SQL Editor: pega TODO este archivo y ejecútalo.
--      (El MCP de la sesión es solo-lectura; por eso se aplica aquí a mano.)
--   3. Verifica con: npm run pentest:rls   y las consultas del final de este archivo.
--
-- Es seguro re-ejecutarlo: usa "drop policy if exists" + "create", y
-- "create or replace function". No duplica objetos.
-- =====================================================================


-- =====================================================================
-- A) AVATARES — lectura restringida a carpeta propia o coach   [06]
-- =====================================================================
-- Antes: "avatar lectura autenticada" => using (bucket_id='avatars') deja a
-- cualquier autenticado firmar/leer el avatar de otro usuario. Lo cerramos.
drop policy if exists "avatar lectura autenticada" on storage.objects;
drop policy if exists "avatar lectura propia o coach" on storage.objects;

create policy "avatar lectura propia o coach" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_coach()
    )
  );


-- =====================================================================
-- B) IDOR ENTRE COACHES — save_routine_content valida el dueño   [03]
-- =====================================================================
-- Backfill defensivo: si solo hay UN coach, asigna las rutinas huérfanas
-- (created_by IS NULL) a ese coach para no bloquear su edición. Si hubiera
-- varios coaches no se adivina el dueño (habría que revisarlo a mano).
do $$
declare
  v_coach uuid;
  v_n     int;
begin
  select count(*) into v_n from public.profiles where role = 'coach';
  if v_n = 1 then
    select id into v_coach from public.profiles where role = 'coach';
    update public.routines set created_by = v_coach where created_by is null;
  elsif v_n > 1 and exists (select 1 from public.routines where created_by is null) then
    raise notice 'Hay % coaches y rutinas con created_by NULL: asigna el dueño a mano antes de confiar en el check.', v_n;
  end if;
end $$;

create or replace function public.save_routine_content(
  p_routine_id uuid,
  p_mode       text,
  p_blocks     jsonb default '[]'::jsonb,
  p_list       jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block        jsonb;
  v_ex           jsonb;
  v_new_block_id uuid;
  v_block_idx    int := 0;
  v_order        int := 0;
  v_block_sets   int;
begin
  -- Solo el coach puede editar el contenido de rutinas.
  if not public.is_coach() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- (SEG · IDOR entre coaches) Además debe ser el DUEÑO de la rutina.
  if not exists (
    select 1 from public.routines r
     where r.id = p_routine_id
       and r.created_by = (select auth.uid())
  ) then
    raise exception 'No autorizado para esta rutina' using errcode = '42501';
  end if;

  -- Todo en la misma transacción: si algo falla, se revierte.
  delete from public.routine_exercises where routine_id = p_routine_id;
  delete from public.routine_blocks    where routine_id = p_routine_id;

  if p_mode = 'bloques' then
    for v_block in select * from jsonb_array_elements(p_blocks)
    loop
      v_block_sets := nullif((v_block->>'sets'), '')::int;
      if v_block_sets is not null and v_block_sets <= 0 then
        v_block_sets := null;
      end if;

      insert into public.routine_blocks
        (routine_id, block_type, title, sets, notes, order_index)
      values (
        p_routine_id,
        v_block->>'block_type',
        nullif(trim(coalesce(v_block->>'title', '')), ''),
        v_block_sets,
        nullif(trim(coalesce(v_block->>'notes', '')), ''),
        v_block_idx
      )
      returning id into v_new_block_id;

      for v_ex in select * from jsonb_array_elements(coalesce(v_block->'exercises', '[]'::jsonb))
      loop
        insert into public.routine_exercises
          (routine_id, block_id, exercise_id, sets, reps, order_index,
           target_weight_kg, rest_minutes, item_key)
        values (
          p_routine_id,
          v_new_block_id,
          (v_ex->>'exercise_id')::uuid,
          v_block_sets,
          nullif(v_ex->>'reps', ''),
          v_order,
          nullif(v_ex->>'target_weight_kg', '')::numeric,
          nullif(v_ex->>'rest_minutes', '')::numeric,
          nullif(v_ex->>'item_key', '')
        );
        v_order := v_order + 1;
      end loop;

      v_block_idx := v_block_idx + 1;
    end loop;

  else -- modo 'lista'
    for v_ex in select * from jsonb_array_elements(p_list)
    loop
      insert into public.routine_exercises
        (routine_id, exercise_id, sets, reps, order_index,
         target_weight_kg, rest_minutes, item_key)
      values (
        p_routine_id,
        (v_ex->>'exercise_id')::uuid,
        coalesce(nullif(v_ex->>'sets', '')::int, 0),
        nullif(v_ex->>'reps', ''),
        v_order,
        nullif(v_ex->>'target_weight_kg', '')::numeric,
        nullif(v_ex->>'rest_minutes', '')::numeric,
        nullif(v_ex->>'item_key', '')
      );
      v_order := v_order + 1;
    end loop;
  end if;
end;
$$;

revoke all on function public.save_routine_content(uuid, text, jsonb, jsonb) from public;
grant execute on function public.save_routine_content(uuid, text, jsonb, jsonb) to authenticated;


-- =====================================================================
-- C) CONSENTIMIENTO DE SALUD — impuesto por el servidor (RLS)   [07]
-- =====================================================================
-- Decisión vigente = fila más reciente de legal_consents por created_at.
-- Se gatea SELECT/INSERT/UPDATE (y el ALL del coach). Los DELETE se dejan
-- SIN gatear: el alumno siempre puede borrar sus datos (supresión, Ley 1581).
create or replace function public.has_health_consent(p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select lc.health_data_consent
       from public.legal_consents lc
      where lc.user_id = p_uid
      order by lc.created_at desc
      limit 1),
    false
  );
$$;

revoke all on function public.has_health_consent(uuid) from public, anon;
grant execute on function public.has_health_consent(uuid) to authenticated;

-- ----- body_measurements -----
drop policy if exists "alumno ve sus medidas" on public.body_measurements;
create policy "alumno ve sus medidas" on public.body_measurements
  for select to authenticated
  using (
    ((select auth.uid()) = user_id) and has_active_access()
    and public.has_health_consent(user_id)
  );

drop policy if exists "alumno registra sus medidas" on public.body_measurements;
create policy "alumno registra sus medidas" on public.body_measurements
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id) and has_active_access()
    and (measured_on >= (current_date - 1) and measured_on <= (current_date + 1))
    and public.has_health_consent(user_id)
  );

drop policy if exists "alumno edita sus medidas" on public.body_measurements;
create policy "alumno edita sus medidas" on public.body_measurements
  for update to authenticated
  using (
    ((select auth.uid()) = user_id) and (created_by = (select auth.uid()))
    and has_active_access() and (measured_on >= (current_date - 8))
    and public.has_health_consent(user_id)
  )
  with check (
    ((select auth.uid()) = user_id) and (measured_on >= (current_date - 8))
    and public.has_health_consent(user_id)
  );

drop policy if exists "coach maneja medidas" on public.body_measurements;
create policy "coach maneja medidas" on public.body_measurements
  for all to authenticated
  using ( is_coach() and public.has_health_consent(user_id) )
  with check ( is_coach() and public.has_health_consent(user_id) );
-- DELETE "alumno borra sus medidas": SIN cambios (supresión).

-- ----- daily_checkins (campo de dolor) -----
drop policy if exists "alumno ve su check-in diario" on public.daily_checkins;
create policy "alumno ve su check-in diario" on public.daily_checkins
  for select to authenticated
  using (
    ((select auth.uid()) = user_id) and has_active_access()
    and public.has_health_consent(user_id)
  );

drop policy if exists "coach ve check-ins diarios" on public.daily_checkins;
create policy "coach ve check-ins diarios" on public.daily_checkins
  for select to authenticated
  using ( is_coach() and public.has_health_consent(user_id) );

drop policy if exists "alumno registra su check-in diario" on public.daily_checkins;
create policy "alumno registra su check-in diario" on public.daily_checkins
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id) and has_active_access()
    and (check_date >= (current_date - 1) and check_date <= (current_date + 1))
    and public.has_health_consent(user_id)
  );

drop policy if exists "alumno corrige su check-in diario" on public.daily_checkins;
create policy "alumno corrige su check-in diario" on public.daily_checkins
  for update to authenticated
  using (
    ((select auth.uid()) = user_id) and has_active_access()
    and (check_date >= (current_date - 1) and check_date <= (current_date + 1))
    and public.has_health_consent(user_id)
  )
  with check (
    ((select auth.uid()) = user_id)
    and (check_date >= (current_date - 1) and check_date <= (current_date + 1))
    and public.has_health_consent(user_id)
  );

-- ----- intake_forms (ficha de ingreso) -----
drop policy if exists "alumno ve su ficha" on public.intake_forms;
create policy "alumno ve su ficha" on public.intake_forms
  for select to authenticated
  using ( ((select auth.uid()) = user_id) and public.has_health_consent(user_id) );

drop policy if exists "coach ve fichas" on public.intake_forms;
create policy "coach ve fichas" on public.intake_forms
  for select to authenticated
  using ( is_coach() and public.has_health_consent(user_id) );

drop policy if exists "alumno crea su ficha" on public.intake_forms;
create policy "alumno crea su ficha" on public.intake_forms
  for insert to authenticated
  with check ( ((select auth.uid()) = user_id) and public.has_health_consent(user_id) );

drop policy if exists "alumno actualiza su ficha" on public.intake_forms;
create policy "alumno actualiza su ficha" on public.intake_forms
  for update to authenticated
  using ( ((select auth.uid()) = user_id) and public.has_health_consent(user_id) )
  with check ( ((select auth.uid()) = user_id) and public.has_health_consent(user_id) );

-- ----- progress_photo_sets -----
drop policy if exists "alumno ve sus registros de fotos" on public.progress_photo_sets;
create policy "alumno ve sus registros de fotos" on public.progress_photo_sets
  for select to authenticated
  using (
    ((select auth.uid()) = user_id) and has_active_access()
    and public.has_health_consent(user_id)
  );

drop policy if exists "coach ve registros de fotos" on public.progress_photo_sets;
create policy "coach ve registros de fotos" on public.progress_photo_sets
  for select to authenticated
  using ( is_coach() and public.has_health_consent(user_id) );

drop policy if exists "alumno crea sus registros de fotos" on public.progress_photo_sets;
create policy "alumno crea sus registros de fotos" on public.progress_photo_sets
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id) and has_active_access()
    and public.has_health_consent(user_id)
  );

drop policy if exists "alumno edita sus registros de fotos" on public.progress_photo_sets;
create policy "alumno edita sus registros de fotos" on public.progress_photo_sets
  for update to authenticated
  using (
    ((select auth.uid()) = user_id) and has_active_access()
    and public.has_health_consent(user_id)
  )
  with check ( ((select auth.uid()) = user_id) and public.has_health_consent(user_id) );
-- DELETE "alumno borra sus registros de fotos": SIN cambios (supresión).

-- ----- progress_photos -----
drop policy if exists "alumno ve sus fotos de progreso" on public.progress_photos;
create policy "alumno ve sus fotos de progreso" on public.progress_photos
  for select to authenticated
  using (
    ((select auth.uid()) = user_id) and has_active_access()
    and public.has_health_consent(user_id)
  );

drop policy if exists "coach ve fotos de progreso" on public.progress_photos;
create policy "coach ve fotos de progreso" on public.progress_photos
  for select to authenticated
  using ( is_coach() and public.has_health_consent(user_id) );

drop policy if exists "alumno sube sus fotos de progreso" on public.progress_photos;
create policy "alumno sube sus fotos de progreso" on public.progress_photos
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id) and has_active_access()
    and exists (
      select 1 from public.progress_photo_sets s
       where s.id = progress_photos.set_id and s.user_id = (select auth.uid())
    )
    and public.has_health_consent(user_id)
  );
-- DELETE "alumno borra sus fotos de progreso": SIN cambios (supresión).

-- ----- weekly_checkins -----
drop policy if exists "alumno ve sus checkins" on public.weekly_checkins;
create policy "alumno ve sus checkins" on public.weekly_checkins
  for select to authenticated
  using ( ((select auth.uid()) = user_id) and public.has_health_consent(user_id) );

drop policy if exists "coach ve checkins" on public.weekly_checkins;
create policy "coach ve checkins" on public.weekly_checkins
  for select to authenticated
  using ( is_coach() and public.has_health_consent(user_id) );

drop policy if exists "alumno crea su checkin" on public.weekly_checkins;
create policy "alumno crea su checkin" on public.weekly_checkins
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_id) and (has_active_access() or is_coach())
    and (week_start >= (current_date - 8) and week_start <= (current_date + 1))
    and public.has_health_consent(user_id)
  );

drop policy if exists "alumno edita su checkin" on public.weekly_checkins;
create policy "alumno edita su checkin" on public.weekly_checkins
  for update to authenticated
  using (
    ((select auth.uid()) = user_id) and (week_start >= (current_date - 8))
    and public.has_health_consent(user_id)
  )
  with check ( ((select auth.uid()) = user_id) and public.has_health_consent(user_id) );

drop policy if exists "coach responde checkins" on public.weekly_checkins;
create policy "coach responde checkins" on public.weekly_checkins
  for update to authenticated
  using ( is_coach() and public.has_health_consent(user_id) )
  with check ( is_coach() and public.has_health_consent(user_id) );

-- ----- Storage: bucket privado 'progress-photos' (user_id = carpeta) -----
drop policy if exists "alumno ve fotos de progreso (storage)" on storage.objects;
create policy "alumno ve fotos de progreso (storage)" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and has_active_access()
    and public.has_health_consent((select auth.uid()))
  );

drop policy if exists "coach ve fotos de progreso (storage)" on storage.objects;
create policy "coach ve fotos de progreso (storage)" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and is_coach()
    and public.has_health_consent( ((storage.foldername(name))[1])::uuid )
  );
-- INSERT/DELETE de fotos en storage: SIN cambios (subida y supresión del dueño).


-- =====================================================================
-- D) DERECHO DE SUPRESIÓN — delete_my_account borra también Storage
-- =====================================================================
-- La versión actual borra filas (FK + profiles + auth.users) pero NO los
-- archivos del usuario en Storage -> quedaban fotos/avatares huérfanos.
-- Aquí se añade el borrado de las filas de storage.objects del usuario en sus
-- carpetas (avatars/<uid>/, progress-photos/<uid>/) dentro de la MISMA
-- transacción, antes de borrar la cuenta.
--
-- NOTA: borrar la fila en storage.objects elimina el objeto gestionado por
-- Supabase Storage. Si tu proyecto usa un backend S3 con limpieza diferida,
-- confirma en Storage que no quedan blobs; si quedaran, complétalo con un
-- job/Edge Function que llame a la API de Storage.
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
  if public.is_coach() then raise exception 'La cuenta del coach no se elimina desde la app'; end if;

  -- Borra lo del alumno en tablas cuya relación no se borra sola (FK a users/profiles)
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

  -- (NUEVO) Borra los archivos del usuario en Storage (avatars + progress-photos)
  delete from storage.objects
   where bucket_id in ('avatars', 'progress-photos')
     and (storage.foldername(name))[1] = uid::text;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end
$$;


-- =====================================================================
-- VERIFICACIÓN (solo lectura) — ejecuta tras aplicar y revisa el resultado
-- =====================================================================
-- 1) Avatares: debe aparecer SOLO "avatar lectura propia o coach"
--    select policyname, cmd from pg_policies
--     where schemaname='storage' and tablename='objects' and policyname ilike '%avatar%';
--
-- 2) IDOR: la RPC debe contener el check de created_by
--    select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname='save_routine_content';
--    select count(*) as rutinas_sin_dueno from public.routines where created_by is null;  -- debe ser 0
--
-- 3) Consentimiento: la función existe y las políticas la usan
--    select proname from pg_proc where proname='has_health_consent';
--    select tablename, policyname from pg_policies
--     where schemaname='public'
--       and tablename in ('body_measurements','intake_forms','progress_photo_sets',
--                         'progress_photos','weekly_checkins','daily_checkins')
--       and (coalesce(qual,'')||coalesce(with_check,'')) ilike '%has_health_consent%'
--     order by tablename;
--
-- 4) Supresión: la función borra storage.objects
--    select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname='delete_my_account';
--
-- 5) Pentest completo:  npm run pentest:rls   (deben seguir pasando 6/6)
-- =====================================================================
