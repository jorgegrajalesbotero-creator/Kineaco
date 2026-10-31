# Auditoría de seguridad del código (2026-10-31)

Revisión estática (SAST) del código del cliente + scripts SQL del repo. **No se
pudo probar contra la base real** (sin acceso a Supabase en la sesión), así que
todo lo que depende de RLS o de funciones SQL ausentes del repo queda marcado
como **"no verificable — probar en Supabase"**.

## Veredicto

**No hay brechas críticas ni altas abiertas en el CÓDIGO del cliente.** Sin XSS
(no hay `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`), sin
secretos (solo `NEXT_PUBLIC_*`, nunca `service_role`), sin open redirect (los
`location.href` son literales), sin CSRF (tokens Bearer, no cookies propias),
sin fugas en mensajes de error. Lo pendiente son **controles de servidor (RLS y
funciones SQL)**, no cambios de código.

## Hallazgos priorizados

| Sev. | Dónde | Problema | Acción |
|------|-------|----------|--------|
| ✅ Resuelto | Supabase | **SEG-A1/A2:** `01` (trigger anti-escalada de rol) y `02` (bucket avatars privado) **aplicados en Supabase el 2026-10-31** (confirmado por el responsable). | **Pendiente verificar** con `npm run pentest:rls` o el checklist manual del README. |
| 🟠 Medio | `legal_consents` + tablas de salud | **Retirar el consentimiento de datos de salud solo se aplica en la UI.** Si no hay RLS que consulte `health_data_consent`, tras retirarlo el coach (o la consola del alumno) puede seguir leyendo/escribiendo fotos, medidas, `intake_forms` y el dolor de `daily_checkins`. (Ley 1581) | Crear `has_health_consent(uid)` y usarla en las políticas de las tablas de salud. Ver `05_recomendaciones_seguridad.sql` (A). |
| 🟠 Medio | `02_storage_rls.sql:30-33` | **El bucket `avatars` deja a cualquier autenticado leer cualquier avatar** (política `using (bucket_id='avatars')`, sin carpeta). Con el UUID ajeno se firma `<uuid>/avatar.jpg`. | Restringir a carpeta propia + coach. Ver `05_...sql` (B). **Antes de aplicar:** confirmar que ningún alumno necesite ver el avatar de otro usuario (p. ej. del coach). |
| 🟠 Medio | `save_routine_content` (`03`) | **Posible IDOR entre coaches.** La RPC solo valida `is_coach()`, no que la rutina (`p_routine_id`) pertenezca al coach que llama. Si hay varios coaches, uno puede sobreescribir rutinas de otro. (Si hay un único coach, riesgo bajo.) | Verificar dueño de la rutina dentro de la RPC. Ver `05_...sql` (C). |
| 🟠 Medio | funciones SQL | **`is_coach`, `has_active_access`, `delete_my_account` no están versionadas** en el repo → no auditables; `delete_my_account` es clave para el derecho de supresión (Ley 1581). | Versionar su definición en `supabase/security/`. |
| 🟡 Bajo | `PrivacySection.jsx:44-55` | Borrado de cuenta **no atómico**: se borran archivos desde el cliente y luego el RPC; no se revisa el `error` de `remove()` → posibles fotos huérfanas. | Revisar errores de `remove()` o mover el borrado a una Edge Function/job. |
| 🟡 Bajo | `ExercisesView.jsx:28` | Validación del link de video **solo en cliente** (`video_url` se guarda sin normalizar). El lado alumno ya está protegido con `safeHttpUrl`. | `CHECK (video_url ~* '^https://')` en la base; normalizar con `safeHttpUrl` al guardar. |
| 🟡 Bajo | `lib/images.js`, inputs de peso | Sin validar tipo/tamaño de archivo ni rango numérico antes de procesar (auto-daño/DoS local; datos basura). El servidor recodifica a JPEG y limita el bucket. | Validar `file.type`/`file.size`; usar `lib/numbers.js` + `CHECK` de rango. |
| ℹ️ Info | `npm audit` | 2 críticos **solo en devDependencies** (tinypool, vía vitest). `npm audit --omit=dev` → 0. | Sin urgencia; no llega a producción. |

## Qué está bien (revisado y descartado)

- **Secretos:** ninguno en código ni en el historial git.
- **XSS / inyección:** sin sinks peligrosos; enlaces con `safeHttpUrl`; `target=_blank` con `noopener`.
- **IDOR cliente:** las consultas dependen de RLS (patrón `auth.uid()=user_id` / `is_coach()`); Storage por carpeta de usuario.
- **Gating de rol:** la UI solo mejora UX; el servidor manda (`is_coach()`, trigger de `01`).
- **Fugas en errores:** mensajes genéricos; el reseteo de contraseña no revela si el correo existe.

## Pruebas automatizadas

Suite de **81 tests** (`npm test`) sobre la lógica pura, incluidas pruebas de
seguridad/validación: `safeHttpUrl` (rechaza `javascript:`/`data:`/otros),
`validateConsent`/`ageFrom` (edad mínima, acudiente de menores).

## Ataques dinámicos (pendiente de entorno)

Las pruebas de penetración reales (intentar escalar rol, leer datos ajenos,
saltar RLS desde la consola del navegador) **requieren la app corriendo con
usuarios de prueba**. No se pudieron ejecutar en esta sesión.

Hay un script listo: **`scripts/pentest-rls.mjs`** (`npm run pentest:rls`).
Simula a un alumno malicioso e intenta 6 ataques (escalar rol, extender acceso,
leer perfiles ajenos, usar la RPC de coach, escribir datos a nombre de otro,
suplantar remitente). Se ejecuta con un usuario alumno de prueba y la clave
anon; cada ataque PASA si Supabase lo bloquea. Recomendado contra un entorno de
pruebas. Ver las instrucciones en la cabecera del script. También está el
checklist manual del README (`SEG-A1`, `SEG-A2`).
