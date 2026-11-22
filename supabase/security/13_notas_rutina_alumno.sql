-- Comentarios de la rutina para UN alumno.
--
-- El coach ya podía dejar observaciones por ejercicio (student_exercise_notes). Esto es lo
-- mismo pero para la nota de cada bloque y para un comentario de todo el día: lo que escriba
-- aquí vale solo para ese alumno y pisa lo que trae la rutina, sin cambiarles nada a los demás.
--
-- El bloque se identifica por su POSICIÓN (block_index) y no por su id, igual que los relojes
-- (ver lib/routineTimers.js): al guardar una rutina, save_routine_content borra y vuelve a
-- crear los bloques, así que sus id cambian y una nota atada al id se perdería.
-- block_index = -1 es el comentario de toda la rutina (misma convención que LIST_TIMER_INDEX).

create table if not exists public.student_routine_notes (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  block_index int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (routine_id, block_index, user_id)
);

create index if not exists student_routine_notes_user_routine
  on public.student_routine_notes (user_id, routine_id);

alter table public.student_routine_notes enable row level security;

-- Mismas reglas que las observaciones por ejercicio: el personal que atiende al alumno las
-- maneja, y el alumno solo ve las suyas.
drop policy if exists "coach maneja notas de rutina" on public.student_routine_notes;
create policy "coach maneja notas de rutina" on public.student_routine_notes
  for all
  using (is_coach() and is_staff_for(user_id))
  with check (is_coach() and is_staff_for(user_id));

drop policy if exists "alumno ve sus notas de rutina" on public.student_routine_notes;
create policy "alumno ve sus notas de rutina" on public.student_routine_notes
  for select
  using (user_id = auth.uid());
