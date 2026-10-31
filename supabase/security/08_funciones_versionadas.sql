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


-- ----- is_coach() -----
-- (pega aquí la definición exportada)


-- ----- has_active_access() -----
-- (pega aquí la definición exportada)


-- ----- delete_my_account() -----
-- (pega aquí la definición exportada)
