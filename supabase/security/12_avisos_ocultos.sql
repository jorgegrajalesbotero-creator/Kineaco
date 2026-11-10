-- Avisos: permite "limpiar" avisos de la campana sin borrarlos.
-- Se ocultan con hidden_at en vez de eliminarse, porque la app y los disparadores usan
-- dedupe_key para no repetir avisos: si la fila se borrara, el aviso volvería a crearse.
-- Cambio aditivo (columna opcional); la política "marca sus avisos" ya cubre el UPDATE.
alter table public.notifications add column if not exists hidden_at timestamptz;
