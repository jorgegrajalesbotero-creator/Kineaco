"use client";

import { useEffect, useMemo, useState } from "react";
import { appLocale, tr } from "@/lib/i18n";
import { supabase } from "@/lib/supabaseClient";
import { buildPoints, exerciseOptionsFrom, loadExerciseEntries } from "@/lib/exerciseHistory";
import { ExerciseProgressView } from "@/components/progress/ExerciseProgressView";
import { Skeleton } from "@/components/ui/Skeleton";

// Progreso por ejercicio del alumno: su mejor registro de cada MES
// (incluye el historial que su coach cargó de antes de la app)
export function ExerciseProgressSection({ userId }) {
  const [entries, setEntries] = useState(null);
  const [exerciseKey, setExerciseKey] = useState(null);

  useEffect(() => {
    if (!userId) return;
    loadExerciseEntries(supabase, userId)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [userId]);

  const options = useMemo(() => exerciseOptionsFrom(entries || []), [entries]);
  const activeKey = exerciseKey && options.some((o) => o.key === exerciseKey) ? exerciseKey : options[0]?.key;
  const points = useMemo(() => buildPoints((entries || []).filter((e) => e.exerciseKey === activeKey), "month"), [entries, activeKey]);

  return (
    <div className="mb-7">
      <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3">{tr("Progreso por ejercicio")}</p>
      <div className="rounded-2xl p-4 bg-gradient-to-b from-card to-deep border border-white/[0.06]">
        {entries === null ? (
          <Skeleton rows={3} height="h-16" />
        ) : options.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">{tr("Todavía no ha registrado peso en ningún ejercicio.")}</p>
        ) : (
          <>
            <select
              value={activeKey}
              onChange={(e) => setExerciseKey(e.target.value)}
              className="block w-full bg-field text-ink text-sm rounded-xl px-3 py-2.5 mb-1 outline-none"
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>{o.name}</option>
              ))}
            </select>
            <p className="text-muted text-[11px] mb-4">{tr("Vista por mes: se muestra su mejor registro de cada mes.")}</p>
            {points.length < 2 ? (
              <>
                <ExerciseProgressView points={points} t={tr} locale={appLocale()} />
                <p className="text-muted text-xs text-center mt-1">{tr("Cuando tenga registros de 2 meses distintos, aquí verá cuánto ha avanzado.")}</p>
              </>
            ) : (
              <ExerciseProgressView points={points} t={tr} locale={appLocale()} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
