# Estado real de RLS tras el diagnóstico (2026-10-28)

El diagnóstico (`00_diagnostico.sql`) confirmó que **la base ya tiene RLS
activada en las 33 tablas** y un conjunto de políticas coherente. Esto
reduce mucho el alcance pendiente. Resumen:

## Ya cubierto correctamente (no hay que hacer nada)

- **RLS activada** en todas las tablas de `public`.
- Patrón consistente: alumno `auth.uid() = user_id` + `has_active_access()`,
  coach `is_coach()`. Helpers `is_coach()` y `has_active_access()` son
  `SECURITY DEFINER` (evitan recursión) y están bien escritos.
- **messages**: INSERT exige `auth.uid() = sender_id` → no se puede suplantar
  al remitente. (SEG-M2 **no aplica**.)
- **notifications**: INSERT exige `auth.uid() = recipient_id` → no se pueden
  enviar avisos a terceros. (SEG-M2 **no aplica**.)
- **legal_consents**: solo SELECT e INSERT, sin UPDATE/DELETE → ya es
  append-only. (SEG-M1 **no aplica**.)
- **Storage progress-photos**: privado, acceso por carpeta propia + coach.
- **Buckets**: límites de tamaño (avatars 2 MB, progress-photos 5 MB) y
  `allowed_mime_types` (jpeg/png/webp) ya configurados. (SEG-M3 **no aplica**.)
- **RPC** `assign_program_for_user` valida `auth.uid() = p_user_id OR is_coach()`
  (sin IDOR) y `delete_my_account` usa `auth.uid()`. (SEG-B3 IDOR **no aplica**.)

## Lo que SÍ falta (2 hallazgos confirmados)

1. **SEG-A1 (crítico):** la policy UPDATE de `profiles` no restringe columnas,
   así que un alumno puede cambiar su `role`/`access_until`.
   → Lo cierra `01_profiles_rls.sql` (trigger de columnas protegidas).

2. **SEG-A2:** el bucket `avatars` es público.
   → Lo cierra `02_storage_rls.sql` (privatizar) + el cambio de código a URLs
     firmadas (ya aplicado).

## Mejora de robustez (no es brecha)

- **BUG-M1:** `03_save_routine_content_rpc.sql` da atomicidad al guardar
  rutinas. Opcional pero recomendado.
