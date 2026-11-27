"use client";

import { useEffect, useState } from "react";
import { blockTypeLabel } from "@/lib/blocks";
import { loadRoutineContent } from "@/components/coach/routines/routineHelpers";

// Los ejercicios de una rutina, en corto, para verlos sin salir de la planeación (o de la semana base).
// Se leen una sola vez por rutina mientras la página está abierta.
const cache = new Map();

const line = (e, sets) => [sets ? `${sets} ×` : "", e.reps || ""].filter(Boolean).join(" ") || null;

export function RoutinePeek({ routineId }) {
  const [content, setContent] = useState(() => cache.get(String(routineId)) || null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (content) return;
    let alive = true;
    loadRoutineContent(routineId)
      .then((c) => { cache.set(String(routineId), c); if (alive) setContent(c); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [routineId, content]);

  if (failed) return <p className="text-muted text-xs px-2 py-1.5">No se pudieron cargar los ejercicios.</p>;
  if (!content) return <p className="text-muted text-xs px-2 py-1.5">Cargando ejercicios...</p>;

  const groups = content.mode === "bloques"
    ? content.blocks.map((b) => ({ title: b.title || blockTypeLabel(b.block_type), sets: b.sets, list: b.exercises }))
    : [{ title: null, sets: null, list: content.list }];
  if (!groups.some((g) => g.list.length)) return <p className="text-muted text-xs px-2 py-1.5">Esta rutina no tiene ejercicios.</p>;

  return (
    <div className="px-2 pt-1 pb-2 space-y-1.5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="text-accent text-[10px] font-semibold uppercase tracking-wider">{g.title}{g.sets ? ` · ${g.sets} series` : ""}</p>}
          <ul className="space-y-0.5">
            {g.list.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-ink truncate">{e.name || "Ejercicio"}</span>
                <span className="text-muted shrink-0">{[line(e, g.title ? null : e.sets), e.targetWeight ? `${e.targetWeight} kg` : ""].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
            {g.list.length === 0 && <li className="text-muted text-xs">Sin ejercicios</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
