-- =====================================================================
-- 04 · PLANTILLA RLS PARA TABLAS NUEVAS — Kineaco
-- =====================================================================
-- Las 33 tablas actuales YA tienen RLS correcta (ver 04_estado_real.md).
-- Esta plantilla NO hay que ejecutarla tal cual: es el patrón estándar
-- de Kineaco para aplicar seguridad a CUALQUIER tabla NUEVA que crees en
-- el futuro. Copia el bloque que encaje, reemplaza <tabla> / <columna>
-- y ejecútalo en Supabase Studio → SQL Editor.
--
-- Patrón de Kineaco (el mismo que ya usan las tablas existentes):
--   · Alumno: ve y edita SOLO sus filas  →  (select auth.uid()) = user_id
--             y además debe tener acceso activo  →  has_active_access()
--   · Coach:  acceso completo  →  is_coach()
--   Helpers is_coach() y has_active_access() son SECURITY DEFINER y YA
--   EXISTEN en la base (no los recrees aquí).
--
-- Buenas prácticas aplicadas (Supabase RLS performance):
--   · auth.uid() envuelto en (select auth.uid()) → se evalúa una vez por
--     consulta (initPlan), no una vez por fila. 10-100x más rápido.
--   · Políticas por operación (select/insert/update/delete), no FOR ALL,
--     para poder afinar cada caso (p. ej. INSERT con WITH CHECK distinto).
--   · Rol explícito TO authenticated → la policy no corre para 'anon'.
--   · Índice en la columna dueña (user_id) usada en las políticas.
-- =====================================================================


-- =====================================================================
-- CASO A (el más común) — Tabla propiedad del alumno
--   Fila con columna 'user_id' que apunta a auth.users.id.
--   Ej.: check-ins, mediciones, logs de entrenamiento, fotos, nutrición.
-- =====================================================================

-- 0) Reemplaza <tabla> y, si tu columna dueña no se llama 'user_id',
--    cámbiala en TODO el bloque.

-- 1) Activar RLS (imprescindible; sin esto las políticas no aplican).
alter table public.<tabla> enable row level security;
-- Opcional pero recomendable: que ni el dueño de la tabla se salte RLS.
alter table public.<tabla> force row level security;

-- 2) Índice en la columna dueña (acelera tanto las queries como la RLS).
create index if not exists <tabla>_user_id_idx on public.<tabla> (user_id);

-- 3) SELECT — el alumno ve sus filas (con acceso activo); el coach, todas.
drop policy if exists "<tabla>_select" on public.<tabla>;
create policy "<tabla>_select" on public.<tabla>
  for select to authenticated
  using (
    public.is_coach()
    or ((select auth.uid()) = user_id and public.has_active_access())
  );

-- 4) INSERT — el alumno solo puede crear filas a su propio nombre.
--    WITH CHECK valida la fila NUEVA (no deja poner user_id ajeno).
drop policy if exists "<tabla>_insert" on public.<tabla>;
create policy "<tabla>_insert" on public.<tabla>
  for insert to authenticated
  with check (
    public.is_coach()
    or ((select auth.uid()) = user_id and public.has_active_access())
  );

-- 5) UPDATE — USING filtra qué filas puede tocar; WITH CHECK impide que
--    al editar se cambie user_id a otra persona.
drop policy if exists "<tabla>_update" on public.<tabla>;
create policy "<tabla>_update" on public.<tabla>
  for update to authenticated
  using (
    public.is_coach()
    or ((select auth.uid()) = user_id and public.has_active_access())
  )
  with check (
    public.is_coach()
    or ((select auth.uid()) = user_id and public.has_active_access())
  );

-- 6) DELETE — el alumno borra solo lo suyo; el coach, lo que sea.
drop policy if exists "<tabla>_delete" on public.<tabla>;
create policy "<tabla>_delete" on public.<tabla>
  for delete to authenticated
  using (
    public.is_coach()
    or ((select auth.uid()) = user_id and public.has_active_access())
  );


-- =====================================================================
-- CASO B — Tabla APPEND-ONLY (histórico que no se edita ni borra)
--   Ej.: consentimientos legales (legal_consents), bitácoras, auditoría.
--   Solo SELECT + INSERT; sin UPDATE ni DELETE (nadie puede alterar el
--   histórico, ni siquiera el dueño). El coach lee todo para auditar.
-- =====================================================================

-- alter table public.<tabla> enable row level security;
-- alter table public.<tabla> force row level security;
-- create index if not exists <tabla>_user_id_idx on public.<tabla> (user_id);

-- drop policy if exists "<tabla>_select" on public.<tabla>;
-- create policy "<tabla>_select" on public.<tabla>
--   for select to authenticated
--   using (public.is_coach() or (select auth.uid()) = user_id);

-- drop policy if exists "<tabla>_insert" on public.<tabla>;
-- create policy "<tabla>_insert" on public.<tabla>
--   for insert to authenticated
--   with check ((select auth.uid()) = user_id);

-- (No crear políticas de UPDATE/DELETE: sin policy, RLS las bloquea.)


-- =====================================================================
-- CASO C — Tabla SOLO-COACH (catálogo global que el alumno solo lee)
--   Ej.: catálogo de ejercicios, plantillas de programas, anuncios.
--   Todos los autenticados leen; solo el coach escribe.
-- =====================================================================

-- alter table public.<tabla> enable row level security;
-- alter table public.<tabla> force row level security;

-- drop policy if exists "<tabla>_select" on public.<tabla>;
-- create policy "<tabla>_select" on public.<tabla>
--   for select to authenticated
--   using (true);  -- lectura para cualquier autenticado

-- drop policy if exists "<tabla>_write" on public.<tabla>;
-- create policy "<tabla>_write" on public.<tabla>
--   for all to authenticated
--   using (public.is_coach())
--   with check (public.is_coach());


-- =====================================================================
-- CASO D — Tabla con REMITENTE y DESTINATARIO (mensajería / avisos)
--   Ej.: messages (sender_id/recipient_id), notifications (recipient_id).
--   Cada quien ve lo que envió o recibió; al insertar no puede suplantar
--   al remitente/destinatario. (Patrón ya usado por messages/notifications.)
-- =====================================================================

-- alter table public.<tabla> enable row level security;
-- alter table public.<tabla> force row level security;
-- create index if not exists <tabla>_sender_idx    on public.<tabla> (sender_id);
-- create index if not exists <tabla>_recipient_idx on public.<tabla> (recipient_id);

-- drop policy if exists "<tabla>_select" on public.<tabla>;
-- create policy "<tabla>_select" on public.<tabla>
--   for select to authenticated
--   using (
--     public.is_coach()
--     or (select auth.uid()) = sender_id
--     or (select auth.uid()) = recipient_id
--   );

-- drop policy if exists "<tabla>_insert" on public.<tabla>;
-- create policy "<tabla>_insert" on public.<tabla>
--   for insert to authenticated
--   with check ((select auth.uid()) = sender_id);  -- no suplantar remitente


-- =====================================================================
-- CHECKLIST al crear una tabla nueva (no te saltes ninguno)
-- =====================================================================
--  [ ] enable (y force) row level security  → sin esto, todo queda abierto.
--  [ ] ¿Qué columna identifica al dueño? (user_id / sender_id / ...).
--  [ ] Índice en esa columna.
--  [ ] Política por cada operación que la app necesite (select/insert/
--      update/delete). Lo que no tenga policy, queda BLOQUEADO (es lo seguro).
--  [ ] INSERT/UPDATE con WITH CHECK para que no se pueda poner la fila a
--      nombre de otro usuario.
--  [ ] ¿Columnas privilegiadas (role, access_until, flags)? Si el alumno
--      no debe tocarlas, protégelas con trigger (ver 01_profiles_rls.sql).
--  [ ] Ejecuta 00_diagnostico.sql y confirma: rls_activada = true y que
--      las políticas aparecen en pg_policies con el rol/qual esperados.
--  [ ] Prueba como alumno: no debe ver ni escribir filas de otro usuario.
-- =====================================================================
