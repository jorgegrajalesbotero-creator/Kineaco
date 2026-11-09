-- =====================================================================
-- 11 · PERFILES DE USUARIO — FASE 2: acotar cada coach a SUS alumnos
-- =====================================================================
-- Requiere la FASE 1 (10_roles_perfiles_fase1.sql) ya aplicada: usa el
-- helper is_staff_for(uuid) y la columna profiles.coach_id creados allí.
--
-- QUÉ HACE: en las tablas de datos POR-ALUMNO (Grupo A), reemplaza el
-- is_coach() "ve todo" por is_staff_for(user_id) = (admin) O (soy el coach
-- de ese alumno) O (soy yo mismo). Resultado:
--   · admin  -> sigue viéndolo/editándolo TODO.
--   · coach  -> solo SUS alumnos (los de profiles.coach_id = su id).
--   · alumno -> igual que antes (sus propias filas).
--
-- QUÉ NO TOCA:
--   · Grupo B (contenido COMPARTIDO): exercises, routines, routine_blocks,
--     routine_exercises, programs, program_days, plan_templates (+ fases/días),
--     announcements, announcement_recipients. Siguen en is_coach() (= personal).
--   · Políticas de FILA PROPIA con el patrón
--       (auth.uid() = user_id AND (has_active_access() OR is_coach()))
--     body_weight_logs (insert/update/delete), progress_sets (alumno …),
--     progress ("crear mi progreso"), weekly_checkins ("alumno crea su checkin").
--     Ahí is_coach() solo exime del muro de acceso a MIS propios datos; si se
--     cambiara por is_staff_for(user_id) se colaría el caso "yo mismo" y un
--     alumno con acceso vencido podría seguir escribiendo. SE DEJAN IGUAL.
--
-- !!! ORDEN DE APLICACIÓN (IMPORTANTE) !!!
--   En producción el script 09 NO está aplicado (las políticas en vivo aún no
--   tienen has_health_consent). Si decides aplicar 09, hazlo ANTES que este 11,
--   porque 09 RE-CREA (drop+create) las políticas de coach de estas tablas y
--   volvería a dejarlas en is_coach() (sin acotar):
--       body_measurements, daily_checkins, intake_forms, progress_photo_sets,
--       progress_photos, weekly_checkins, storage.objects (fotos).
--   Orden correcto:  09  ->  10 (Fase 1)  ->  11 (Fase 2, este).
--   Si aplicas 09 después de este archivo, vuelve a ejecutar este 11.
--
-- CÓMO APLICAR: Supabase Studio -> SQL Editor (con backup previo).
-- Es idempotente: drop policy if exists + create. Al final, verificación.
-- =====================================================================


-- =====================================================================
-- profiles — el personal ve/edita a SUS alumnos (admin, a todos)
-- =====================================================================
drop policy if exists "coach ve todos los perfiles" on public.profiles;
create policy "coach ve todos los perfiles" on public.profiles
  for select to authenticated
  using ( public.is_staff_for(id) );

drop policy if exists "coach edita acceso de alumnos" on public.profiles;
create policy "coach edita acceso de alumnos" on public.profiles
  for update to authenticated
  using ( public.is_staff_for(id) )
  with check ( public.is_staff_for(id) );


-- =====================================================================
-- intake_forms / legal_consents / meal_logs / nutrition_profiles — SELECT coach
-- =====================================================================
drop policy if exists "coach ve fichas" on public.intake_forms;
create policy "coach ve fichas" on public.intake_forms
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach ve autorizaciones" on public.legal_consents;
create policy "coach ve autorizaciones" on public.legal_consents
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach ve comidas de alumnos" on public.meal_logs;
create policy "coach ve comidas de alumnos" on public.meal_logs
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach ve nutricion de alumnos" on public.nutrition_profiles;
create policy "coach ve nutricion de alumnos" on public.nutrition_profiles
  for select to authenticated
  using ( public.is_staff_for(user_id) );


-- =====================================================================
-- daily_checkins / weekly_checkins — lectura y respuesta del coach
-- =====================================================================
drop policy if exists "coach ve check-ins diarios" on public.daily_checkins;
create policy "coach ve check-ins diarios" on public.daily_checkins
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach ve checkins" on public.weekly_checkins;
create policy "coach ve checkins" on public.weekly_checkins
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach responde checkins" on public.weekly_checkins;
create policy "coach responde checkins" on public.weekly_checkins
  for update to authenticated
  using ( public.is_staff_for(user_id) )
  with check ( public.is_staff_for(user_id) );


-- =====================================================================
-- body_measurements / exercise_history — ALL del coach
-- =====================================================================
drop policy if exists "coach maneja medidas" on public.body_measurements;
create policy "coach maneja medidas" on public.body_measurements
  for all to authenticated
  using ( public.is_staff_for(user_id) )
  with check ( public.is_staff_for(user_id) );

drop policy if exists "coach maneja historial de ejercicios" on public.exercise_history;
create policy "coach maneja historial de ejercicios" on public.exercise_history
  for all to authenticated
  using ( public.is_staff_for(user_id) )
  with check ( public.is_staff_for(user_id) );


-- =====================================================================
-- messages — el coach solo ve/escribe los hilos de SUS alumnos
--   user_id = alumno dueño del hilo; sender_id = quien envía.
-- =====================================================================
drop policy if exists "coach ve todos los mensajes" on public.messages;
create policy "coach ve todos los mensajes" on public.messages
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach marca mensajes como leidos" on public.messages;
create policy "coach marca mensajes como leidos" on public.messages
  for update to authenticated
  using ( public.is_staff_for(user_id) )
  with check ( public.is_staff_for(user_id) );

drop policy if exists "coach envia mensajes a cualquier alumno" on public.messages;
create policy "coach envia mensajes a cualquier alumno" on public.messages
  for insert to authenticated
  with check ( public.is_staff_for(user_id) and auth.uid() = sender_id );


-- =====================================================================
-- progress_photo_sets / progress_photos / progress_sets — SELECT coach
-- =====================================================================
drop policy if exists "coach ve registros de fotos" on public.progress_photo_sets;
create policy "coach ve registros de fotos" on public.progress_photo_sets
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach ve fotos de progreso" on public.progress_photos;
create policy "coach ve fotos de progreso" on public.progress_photos
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach ve series de alumnos" on public.progress_sets;
create policy "coach ve series de alumnos" on public.progress_sets
  for select to authenticated
  using ( public.is_staff_for(user_id) );


-- =====================================================================
-- body_weight_logs — SOLO la lectura cruzada del coach (las de escritura
-- son de fila propia y NO se tocan, ver cabecera).
-- =====================================================================
drop policy if exists "usuario ve su peso" on public.body_weight_logs;
create policy "usuario ve su peso" on public.body_weight_logs
  for select to authenticated
  using ( auth.uid() = user_id or public.is_staff_for(user_id) );


-- =====================================================================
-- routine_assignments — el coach asigna/ve/borra rutinas de SUS alumnos
-- =====================================================================
drop policy if exists "coach ve asignaciones" on public.routine_assignments;
create policy "coach ve asignaciones" on public.routine_assignments
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach asigna rutinas" on public.routine_assignments;
create policy "coach asigna rutinas" on public.routine_assignments
  for insert to authenticated
  with check ( public.is_staff_for(user_id) );

drop policy if exists "coach borra asignaciones" on public.routine_assignments;
create policy "coach borra asignaciones" on public.routine_assignments
  for delete to authenticated
  using ( public.is_staff_for(user_id) );


-- =====================================================================
-- student_exercise_weights — pesos personalizados de SUS alumnos
-- =====================================================================
drop policy if exists "coach ve pesos personalizados" on public.student_exercise_weights;
create policy "coach ve pesos personalizados" on public.student_exercise_weights
  for select to authenticated
  using ( public.is_staff_for(user_id) );

drop policy if exists "coach crea pesos personalizados" on public.student_exercise_weights;
create policy "coach crea pesos personalizados" on public.student_exercise_weights
  for insert to authenticated
  with check ( public.is_staff_for(user_id) );

drop policy if exists "coach edita pesos personalizados" on public.student_exercise_weights;
create policy "coach edita pesos personalizados" on public.student_exercise_weights
  for update to authenticated
  using ( public.is_staff_for(user_id) )
  with check ( public.is_staff_for(user_id) );

drop policy if exists "coach borra pesos personalizados" on public.student_exercise_weights;
create policy "coach borra pesos personalizados" on public.student_exercise_weights
  for delete to authenticated
  using ( public.is_staff_for(user_id) );


-- =====================================================================
-- training_plans (+ tablas hijas por plan_id) — planes de SUS alumnos
-- =====================================================================
drop policy if exists "coach maneja planes" on public.training_plans;
create policy "coach maneja planes" on public.training_plans
  for all to authenticated
  using ( public.is_staff_for(user_id) )
  with check ( public.is_staff_for(user_id) );

-- Hijas: no tienen user_id; el dueño se resuelve por el plan (training_plans.user_id).
-- training_plan_days
drop policy if exists "coach maneja dias del plan" on public.training_plan_days;
create policy "coach maneja dias del plan" on public.training_plan_days
  for all to authenticated
  using ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_days.plan_id and public.is_staff_for(tp.user_id)) )
  with check ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_days.plan_id and public.is_staff_for(tp.user_id)) );

-- training_plan_phases
drop policy if exists "coach plan fases" on public.training_plan_phases;
create policy "coach plan fases" on public.training_plan_phases
  for all to authenticated
  using ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_phases.plan_id and public.is_staff_for(tp.user_id)) )
  with check ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_phases.plan_id and public.is_staff_for(tp.user_id)) );

-- training_plan_weeks
drop policy if exists "coach plan semanas" on public.training_plan_weeks;
create policy "coach plan semanas" on public.training_plan_weeks
  for all to authenticated
  using ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_weeks.plan_id and public.is_staff_for(tp.user_id)) )
  with check ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_weeks.plan_id and public.is_staff_for(tp.user_id)) );

-- training_plan_loads
drop policy if exists "coach plan cargas" on public.training_plan_loads;
create policy "coach plan cargas" on public.training_plan_loads
  for all to authenticated
  using ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_loads.plan_id and public.is_staff_for(tp.user_id)) )
  with check ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_loads.plan_id and public.is_staff_for(tp.user_id)) );

-- training_plan_load_cells
drop policy if exists "coach plan casillas" on public.training_plan_load_cells;
create policy "coach plan casillas" on public.training_plan_load_cells
  for all to authenticated
  using ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_load_cells.plan_id and public.is_staff_for(tp.user_id)) )
  with check ( exists (select 1 from public.training_plans tp
                   where tp.id = training_plan_load_cells.plan_id and public.is_staff_for(tp.user_id)) );


-- =====================================================================
-- Storage: fotos de progreso — el coach solo ve las de SUS alumnos
--   La carpeta[1] del objeto es el uid del alumno dueño.
-- =====================================================================
drop policy if exists "coach ve fotos de progreso (storage)" on storage.objects;
create policy "coach ve fotos de progreso (storage)" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and public.is_staff_for( ((storage.foldername(name))[1])::uuid )
  );


-- =====================================================================
-- VERIFICACIÓN (solo lectura)
-- =====================================================================
-- 1) Ninguna política del Grupo A debe quedar en is_coach() "pelado".
--    Deben aparecer is_staff_for(...) en estas tablas:
--    select tablename, policyname, cmd from pg_policies
--     where schemaname in ('public','storage')
--       and (coalesce(qual,'')||coalesce(with_check,'')) ilike '%is_staff_for%'
--     order by tablename, cmd;
--
-- 2) El Grupo B (contenido compartido) debe SEGUIR en is_coach():
--    select tablename, policyname from pg_policies
--     where schemaname='public'
--       and tablename in ('exercises','routines','routine_blocks','routine_exercises',
--                         'programs','program_days','plan_templates','plan_template_phases',
--                         'plan_template_days','announcements','announcement_recipients')
--       and (coalesce(qual,'')||coalesce(with_check,'')) ilike '%is_coach%'
--     order by tablename;
--
-- 3) Prueba funcional recomendada (en staging):
--    · Crea 2 coaches (A y B) y 2 alumnos (uno de cada coach).
--    · Como coach A: debe ver SOLO su alumno (perfil, medidas, fotos, mensajes,
--      planes). No debe ver nada del alumno de B.
--    · Como admin: debe ver TODO.
--    · Como alumno: solo lo suyo (sin cambios).
--
-- 4) Pentest de RLS:  npm run pentest:rls
-- =====================================================================
