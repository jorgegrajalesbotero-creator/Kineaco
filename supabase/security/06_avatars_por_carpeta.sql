-- =====================================================================
-- 06 · SEG — Avatares: lectura solo del dueño o del coach  [MEDIO]
-- =====================================================================
-- Estado previo (tras aplicar 02): el bucket 'avatars' es privado, pero la
-- política de lectura deja que CUALQUIER usuario autenticado firme/lea el
-- avatar de CUALQUIER otro usuario (política "avatar lectura autenticada",
-- using bucket_id = 'avatars', sin filtrar por carpeta). Con el UUID ajeno se
-- puede firmar <uuid>/avatar.jpg y ver la foto de rostro de otra persona.
--
-- Este script restringe la lectura a la carpeta propia del usuario (su UUID)
-- o al coach (que necesita ver los avatares de sus alumnos en el panel).
--
-- VERIFICADO antes de aplicar:
--   · La ruta de cada avatar es <uuid>/... (foldername[1] = user id).
--   · En el lado ALUMNO solo se muestra el avatar PROPIO (Navigation, HomeScreen,
--     ProfileScreen reciben el avatarUrl del usuario logueado). Ningún alumno
--     necesita ver el avatar de otro usuario (ni del coach). => seguro restringir.
--
-- ⚠️ Si en el futuro un alumno debe ver el avatar del coach (p. ej. foto del
--    coach en el chat), añade esa excepción a la condición USING.
-- =====================================================================

drop policy if exists "avatar lectura autenticada" on storage.objects;

create policy "avatar lectura propia o coach" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_coach()
    )
  );

-- Las políticas de subir/actualizar/borrar avatar por carpeta propia ya existen
-- (creadas antes de 02) y no se tocan aquí.
