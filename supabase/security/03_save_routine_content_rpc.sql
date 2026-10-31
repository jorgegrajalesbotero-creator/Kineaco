-- =====================================================================
-- 03 · BUG-M1 — RPC transaccional save_routine_content()
-- =====================================================================
-- Problema: writeRoutineContent() borraba todo el contenido de la rutina
-- y luego lo insertaba fila por fila SIN transacción. Si una inserción
-- intermedia fallaba, la rutina quedaba vacía o a medias (pérdida de datos).
--
-- Solución: una función plpgsql corre dentro de UNA sola transacción, así
-- que si algo falla se revierte TODO y la rutina conserva su contenido anterior.
--
-- Columnas (verificadas contra components/coach/routines/routineHelpers.js):
--   routine_blocks    : routine_id, block_type, title, sets, notes, order_index
--   routine_exercises : routine_id, block_id, exercise_id, sets, reps,
--                       order_index, target_weight_kg, rest_minutes, item_key
--
-- Forma del JSON que envía el cliente:
--   p_mode   = 'bloques' | 'lista'
--   p_blocks = [{ block_type, title, sets, notes,
--                 exercises: [{ exercise_id, reps, target_weight_kg,
--                               rest_minutes, item_key }] }]
--   p_list   = [{ exercise_id, sets, reps, target_weight_kg,
--                 rest_minutes, item_key }]
-- =====================================================================

create or replace function public.save_routine_content(
  p_routine_id uuid,
  p_mode       text,
  p_blocks     jsonb default '[]'::jsonb,
  p_list       jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block        jsonb;
  v_ex           jsonb;
  v_new_block_id uuid;
  v_block_idx    int := 0;
  v_order        int := 0;
  v_block_sets   int;
begin
  -- Solo el coach puede editar el contenido de rutinas.
  if not public.is_coach() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  -- (SEG · IDOR entre coaches) Además de ser coach, debe ser el dueño de la
  -- rutina. Evita que un coach sobreescriba rutinas creadas por otro coach.
  -- La columna dueña es routines.created_by (verificada en RoutinesView.jsx).
  if not exists (
    select 1 from public.routines r
     where r.id = p_routine_id
       and r.created_by = (select auth.uid())
  ) then
    raise exception 'No autorizado para esta rutina' using errcode = '42501';
  end if;

  -- Todo lo que sigue va en la misma transacción: si algo falla, se revierte.
  delete from public.routine_exercises where routine_id = p_routine_id;
  delete from public.routine_blocks    where routine_id = p_routine_id;

  if p_mode = 'bloques' then
    for v_block in select * from jsonb_array_elements(p_blocks)
    loop
      v_block_sets := nullif((v_block->>'sets'), '')::int;
      if v_block_sets is not null and v_block_sets <= 0 then
        v_block_sets := null;
      end if;

      insert into public.routine_blocks
        (routine_id, block_type, title, sets, notes, order_index)
      values (
        p_routine_id,
        v_block->>'block_type',
        nullif(trim(coalesce(v_block->>'title', '')), ''),
        v_block_sets,
        nullif(trim(coalesce(v_block->>'notes', '')), ''),
        v_block_idx
      )
      returning id into v_new_block_id;

      for v_ex in select * from jsonb_array_elements(coalesce(v_block->'exercises', '[]'::jsonb))
      loop
        insert into public.routine_exercises
          (routine_id, block_id, exercise_id, sets, reps, order_index,
           target_weight_kg, rest_minutes, item_key)
        values (
          p_routine_id,
          v_new_block_id,
          (v_ex->>'exercise_id')::uuid,
          v_block_sets,
          nullif(v_ex->>'reps', ''),
          v_order,
          nullif(v_ex->>'target_weight_kg', '')::numeric,
          nullif(v_ex->>'rest_minutes', '')::numeric,
          nullif(v_ex->>'item_key', '')
        );
        v_order := v_order + 1;
      end loop;

      v_block_idx := v_block_idx + 1;
    end loop;

  else -- modo 'lista'
    for v_ex in select * from jsonb_array_elements(p_list)
    loop
      insert into public.routine_exercises
        (routine_id, exercise_id, sets, reps, order_index,
         target_weight_kg, rest_minutes, item_key)
      values (
        p_routine_id,
        (v_ex->>'exercise_id')::uuid,
        coalesce(nullif(v_ex->>'sets', '')::int, 0),
        nullif(v_ex->>'reps', ''),
        v_order,
        nullif(v_ex->>'target_weight_kg', '')::numeric,
        nullif(v_ex->>'rest_minutes', '')::numeric,
        nullif(v_ex->>'item_key', '')
      );
      v_order := v_order + 1;
    end loop;
  end if;
end;
$$;

revoke all on function public.save_routine_content(uuid, text, jsonb, jsonb) from public;
grant execute on function public.save_routine_content(uuid, text, jsonb, jsonb) to authenticated;

-- NOTA: ajusta el tipo de exercise_id / routine_id si en tu esquema no son uuid.
--
-- ⚠️ IMPORTANTE (check de dueño): si hay rutinas ANTIGUAS con created_by = NULL
-- (creadas antes de que existiera esa columna), el coach ya no podrá editarlas
-- con esta versión. Antes de aplicar, rellena el dueño de las rutinas huérfanas,
-- por ejemplo asignándolas al coach principal:
--
--   update public.routines
--      set created_by = '<UUID-DEL-COACH>'
--    where created_by is null;
--
-- Comprueba primero cuántas hay:  select count(*) from public.routines where created_by is null;
-- Si Kineaco tiene un único coach, el check es defensa en profundidad (riesgo bajo),
-- pero el backfill es necesario igualmente para no bloquear la edición.
