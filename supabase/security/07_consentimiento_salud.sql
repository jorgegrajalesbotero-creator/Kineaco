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
-- ⚠️ REQUIERE ver primero las políticas ACTUALES de cada tabla de salud, para
-- no romperlas. Ejecuta antes (solo lectura) y revisa el resultado:
--
--   select tablename, policyname, cmd, qual, with_check
--     from pg_policies
--    where schemaname = 'public'
--      and tablename in ('body_measurements','intake_forms',
--                        'progress_photo_sets','progress_photos',
--                        'weekly_checkins','daily_checkins')
--    order by tablename, cmd;
--
-- Con el patrón actual (auth.uid() = user_id  OR  is_coach()), la forma de
-- imponer el consentimiento es AÑADIR " and public.has_health_consent(user_id) "
-- a la condición. Para cada política SELECT e INSERT (y UPDATE donde aplique),
-- recréala conservando su nombre y su lógica, p. ej.:
--
--   drop policy if exists "<nombre actual>" on public.body_measurements;
--   create policy "<nombre actual>" on public.body_measurements
--     for select to authenticated
--     using (
--       ( (select auth.uid()) = user_id or public.is_coach() )
--       and public.has_health_consent(user_id)
--     );
--
-- Repite para: intake_forms, progress_photo_sets, progress_photos y el acceso
-- al dolor en los check-ins. Para las FOTOS, aplica la misma condición a la
-- política SELECT del bucket 'progress-photos' en storage.objects, derivando el
-- user_id de la carpeta:  public.has_health_consent( ((storage.foldername(name))[1])::uuid ).
--
-- DECISIÓN LEGAL (confirmar con el responsable): al retirar el consentimiento,
--   (a) OCULTAR los datos (RLS, lo de arriba) — reversible si lo vuelve a dar, o
--   (b) BORRARLOS (job/Edge Function) — irreversible, cumplimiento más estricto.
-- El mínimo recomendado es (a); (b) requiere además un proceso de borrado.
-- =====================================================================
