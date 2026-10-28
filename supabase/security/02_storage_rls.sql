-- =====================================================================
-- 02 · SEG-A2 (CONFIRMADO) — Hacer privado el bucket de avatares
-- =====================================================================
-- Hallazgo confirmado con el diagnóstico:
--   storage.buckets: avatars.public = TRUE
--   + policy SELECT "avatar publico para leer" con rol {public}.
--   => la foto de rostro de cualquier usuario es accesible por URL sin
--      autenticación si se conoce el UUID (<uid>/avatar.jpg).
--
-- El bucket progress-photos YA es privado y sus políticas por carpeta
-- (foldername[1] = auth.uid() + coach) están correctas: NO se tocan.
-- Los límites de tamaño/tipo YA están puestos en ambos buckets: NO se tocan.
--
-- REQUISITO DE CÓDIGO (ya aplicado): la app pasó de getPublicUrl() a URLs
-- firmadas en lib/avatars.js (ProfileScreen, ProfileView, app/page.js), así
-- que al privatizar el bucket los avatares siguen viéndose.
-- =====================================================================

-- 1) Privatizar el bucket de avatares
update storage.buckets
   set public = false
 where id = 'avatars';

-- 2) La lectura de avatares debe quedar para usuarios autenticados (no anónimos),
--    suficiente para generar URLs firmadas. Sustituimos la policy pública.
drop policy if exists "avatar publico para leer" on storage.objects;

drop policy if exists "avatar lectura autenticada" on storage.objects;
create policy "avatar lectura autenticada" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

-- (Las políticas de subir/actualizar/borrar avatar por carpeta propia ya existen
--  y siguen vigentes: "cada quien sube/actualiza/borra su propia foto".)
