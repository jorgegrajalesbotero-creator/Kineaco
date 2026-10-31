# Seguridad de Supabase — Kineaco

Scripts SQL para cerrar las brechas de seguridad de la auditoría (SEG-A1, SEG-A2)
y el bug de atomicidad de rutinas (BUG-M1). Toda la seguridad real de la app vive
en Supabase (RLS + políticas de Storage), no en el código del repo.

## Orden de aplicación

Ejecuta los scripts en Supabase Studio → **SQL Editor**, en este orden:

> **Actualización (2026-10-28):** se ejecutó el diagnóstico. La base **ya tiene
> RLS completa y bien hecha**. Solo quedan **2 hallazgos confirmados** (`01` y `02`).
> Ver `04_estado_real.md` para el detalle de lo que ya está cubierto.
>
> **Actualización (2026-10-31):** `01` y `02` **aplicados en Supabase** (confirmado).
> **Verificado con `npm run pentest:rls`: 6/6 ataques bloqueados.** SEG-A1 confirmado
> en vivo (no se puede escalar `role` ni extender `access_until`). El pentest también
> confirma que `save_routine_content` (BUG-M1) ya existe y rechaza a alumnos, y que
> las políticas de `profiles`, `body_measurements` y `messages` bloquean IDOR y
> suplantación de remitente. Nueva auditoría de código en `05_auditoria_codigo.md` +
> mejoras recomendadas en `05_recomendaciones_seguridad.sql`.

| Archivo | Qué hace | Riesgo que cierra |
|---|---|---|
| `00_diagnostico.sql` | **Solo lectura.** Estado actual (RLS, políticas, buckets, RPCs). | — |
| `01_profiles_rls.sql` | Trigger que impide que un alumno cambie su `role`/`access_until`. | SEG-A1 (crítico) |
| `02_storage_rls.sql` | Privatiza el bucket `avatars` + lectura solo autenticada. | SEG-A2 |
| `03_save_routine_content_rpc.sql` | RPC transaccional para guardar rutinas sin corromperlas. | BUG-M1 |
| `04_estado_real.md` | Resumen de qué ya estaba cubierto y qué no. | — |
| `04_tablas_rls_plantilla.sql` | Plantilla del patrón RLS estándar para tablas **nuevas** (no ejecutar tal cual). | Prevención |
| `05_auditoria_codigo.md` | Informe de la auditoría de seguridad del código (2026-10-31), priorizado. | — |
| `05_recomendaciones_seguridad.sql` | Resumen original de mejoras recomendadas (reemplazado por `06`–`08`, ya afinados). | SEG varios |
| `06_avatars_por_carpeta.sql` | **Listo para aplicar.** Lectura de avatar solo del dueño o del coach. | IDOR avatares (medio) |
| `07_consentimiento_salud.sql` | Parte 1 (función `has_health_consent`) lista; parte 2 (políticas por tabla) requiere ver las RLS actuales. | Consentimiento salud / Ley 1581 (medio) |
| `08_funciones_versionadas.sql` | Plantilla para versionar `is_coach`, `has_active_access`, `delete_my_account` (exportar desde Supabase). | Auditabilidad / supresión (medio) |

> **Hallazgos medios (afinados 2026-10-31):** scripts `06`–`08` preparados contra
> el esquema real del código. Pendiente de aplicar en Supabase:
> - **IDOR entre coaches:** ya integrado en `03` (check `routines.created_by`). Re-aplicar `03`. ⚠️ Rellenar antes `created_by` en rutinas antiguas (ver `03`).
> - **Avatares por carpeta:** aplicar `06`.
> - **Consentimiento de salud:** aplicar parte 1 de `07`; la parte 2 necesita las políticas RLS actuales (correr el `select from pg_policies` del propio `07`).
> - **Versionar funciones:** correr el export de `08` y pegar las definiciones.

## Antes de aplicar — IMPORTANTE

1. Ya no se recrean políticas existentes: `01` solo añade un trigger y `02` solo
   privatiza `avatars`. No duplican lo que ya tienes.
2. **Haz una copia de seguridad** (Supabase → Database → Backups) por si acaso.
3. Aplica `02` solo con el cambio de código a URLs firmadas ya desplegado
   (ya está hecho en `lib/avatars.js`).

## Cambios en el código ya aplicados

- `03` requiere que el cliente llame a la RPC: **ya está hecho** en
  `components/coach/routines/routineHelpers.js` (`writeRoutineContent`).
- `02` (bucket `avatars` privado): **ya hecho**. Se cambió `getPublicUrl` por
  URLs firmadas (`lib/avatars.js` + `ProfileScreen.jsx`, `ProfileView.jsx`,
  `app/page.js`). Ahora se guarda la ruta en `profiles.avatar_url` y se firma al
  mostrar; las URLs públicas antiguas siguen funcionando. Ya es seguro aplicar `02`.

## Cómo verificar que funcionó

- **SEG-A1:** inicia sesión como alumno de prueba y ejecuta en la consola del
  navegador `supabase.from('profiles').update({ role: 'coach' }).eq('id', TU_ID)`.
  El `role` debe seguir siendo `alumno`.
- **SEG-A2:** intenta abrir la URL pública de un avatar ajeno; debe fallar.
- **BUG-M1:** edita una rutina y, si una inserción falla, la rutina conserva su
  contenido anterior (ya no queda vacía).
