-- =====================================================================
-- 00 · DIAGNÓSTICO — EJECUTAR PRIMERO (solo lectura, no cambia nada)
-- =====================================================================
-- Objetivo: ver el estado actual de seguridad en Supabase ANTES de
-- aplicar cualquier política. Copia los resultados y revísalos: si ya
-- existen políticas, NO apliques los scripts siguientes a ciegas.
--
-- Cómo usarlo: Supabase Studio → SQL Editor → pega y ejecuta cada bloque.
-- =====================================================================

-- 1) ¿Qué tablas tienen RLS activada?
select n.nspname  as esquema,
       c.relname  as tabla,
       c.relrowsecurity  as rls_activada,
       c.relforcerowsecurity as rls_forzada
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 2) Políticas RLS existentes (todas las columnas relevantes)
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 3) Buckets de Storage y si son públicos
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

-- 4) Funciones SECURITY DEFINER (RPC) y su cuerpo (revisar que usen auth.uid())
select p.proname as funcion,
       p.prosecdef as es_security_definer,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('assign_program_for_user', 'delete_my_account', 'handle_new_user', 'is_coach', 'save_routine_content')
order by p.proname;

-- 5) Triggers sobre auth.users y profiles (creación de perfil)
select event_object_schema as esquema, event_object_table as tabla,
       trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_table in ('users', 'profiles')
order by tabla, trigger_name;

-- 6) Permisos de columna sobre profiles (¿puede 'authenticated' hacer UPDATE de role/access_until?)
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('role', 'access_until')
order by grantee, column_name;
