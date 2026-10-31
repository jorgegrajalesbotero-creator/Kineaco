-- =====================================================================
-- 07 · SEG — Consentimiento de datos de salud impuesto por el servidor [MEDIO]
-- =====================================================================
-- Problema (Ley 1581 de Colombia): hoy, cuando un alumno RETIRA el
-- consentimiento de datos de salud, solo se oculta en la UI. Si no hay RLS que
-- consulte la última decisión, el coach (o la consola del navegador) puede
-- seguir leyendo/escribiendo datos de salud: fotos de progreso, medidas
-- corporales, ficha de ingreso (intake) y el dolor de los check-ins.
--
-- Esquema verificado contra el código:
--   legal_consents(user_id, health_data_consent bool, doc_version, created_at, ...)
--   La decisión vigente = la fila más reciente por created_at (así lo lee la app:
--   app/page.js, AccessPanel.jsx, PrivacySection.jsx -> order created_at desc limit 1).
--
-- Tablas de datos de salud (verificadas en el código):
--   body_measurements, intake_forms, progress_photo_sets, progress_photos,
--   y el campo de dolor en los check-ins (weekly_checkins / daily_checkins),
--   más el bucket privado 'progress-photos' en storage.objects.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PARTE 1 — Función de consentimiento vigente   [SEGURA, lista para aplicar]
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- PARTE 2 — Aplicar el consentimiento en las políticas RLS
-- ---------------------------------------------------------------------
-- GENERADO 2026-10-31 recreando las políticas REALES (exportadas de pg_policies)
-- y añadiendo " and public.has_health_consent(<user_id>) ". Se conservan nombre,
-- rol y lógica originales; se moderniza auth.uid() -> (select auth.uid()) (perf RLS).
--
-- CRITERIO:
--   · Se gatea SELECT / INSERT / UPDATE (y el ALL del coach) con el consentimiento.
--   · Los DELETE se dejan SIN gatear: el alumno debe poder borrar sus propios
--     datos aunque haya retirado el consentimiento (derecho de supresión, Ley 1581).
--   · Para el coach, el consentimiento comprobado es el del DUEÑO del dato (user_id).
--
-- DECISIÓN LEGAL (confirmar): esto implementa la opción (a) OCULTAR (reversible).
-- Para la opción (b) BORRAR haría falta además un job/Edge Function de borrado.
--
-- ⚠️ Aplicar en Supabase Studio -> SQL Editor (el MCP de esta sesión es solo-lectura).
--    Haz backup antes. Si algún alumno SIN consentimiento vigente tiene datos, tras
--    aplicar dejarán de verse hasta que lo vuelva a otorgar.
-- =====================================================================

-- ===================== body_measurements =====================
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
-- DELETE "alumno borra sus medidas": SIN cambios (derecho de supresión).

-- ===================== daily_checkins (campo de dolor) =====================
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

-- ===================== intake_forms (ficha de ingreso) =====================
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

-- ===================== progress_photo_sets =====================
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

-- ===================== progress_photos =====================
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

-- ===================== weekly_checkins =====================
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

-- ===================== Storage: bucket privado 'progress-photos' =====================
-- El user_id se deriva de la carpeta: (storage.foldername(name))[1].
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
-- INSERT/DELETE de fotos en storage: SIN cambios (subida y supresión por el dueño).
-- =====================================================================
