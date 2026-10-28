-- =====================================================================
-- 01 · SEG-A1 (CONFIRMADO) — Impedir que un alumno escale su rol/acceso
-- =====================================================================
-- Hallazgo confirmado con el diagnóstico (pg_policies):
--   La policy de UPDATE "editar propio perfil" en profiles usa
--     USING (auth.uid() = id)  WITH CHECK (auth.uid() = id)
--   SIN restringir columnas. Por eso un alumno puede ejecutar desde la
--   consola del navegador:
--     supabase.from('profiles').update({ role: 'coach' }).eq('id', miId)
--     supabase.from('profiles').update({ access_until: '2099-01-01' })
--   y escalar a coach o darse acceso gratis.
--
-- NOTA: RLS ya está activada y is_coach()/has_active_access() YA EXISTEN.
--       NO los recreamos ni tocamos las políticas actuales. Solo añadimos
--       un trigger que protege las columnas 'role' y 'access_until'.
-- =====================================================================

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- Un alumno no puede cambiar su rol ni extender su acceso: se ignora el cambio.
    if not public.is_coach() then
      new.role := old.role;
      new.access_until := old.access_until;
    end if;
  elsif tg_op = 'INSERT' then
    -- Si lo crea alguien que no es coach (ej. el alta normal), se fuerza alumno
    -- y sin acceso preconcedido. El coach sí puede fijar estos valores.
    if not public.is_coach() then
      new.role := 'alumno';
      new.access_until := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before insert or update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();

-- Comprobación (como alumno de prueba): debe seguir en 'alumno'
--   update profiles set role = 'coach' where id = auth.uid();
--   select role from profiles where id = auth.uid();
