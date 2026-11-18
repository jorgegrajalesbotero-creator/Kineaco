"use client";

import { Timer } from "lucide-react";
import { CLOCK_DEFAULTS, CLOCK_FIELDS, normalizeConfig, normalizeTimer, visibleFields } from "@/lib/clock";
import { ClockField } from "@/components/ui/ClockField";

const MODES = [
  ["", "Sin reloj programado"],
  ["tabata", "Tabata"],
  ["intervals", "Intervalos (intermitentes)"],
  ["amrap", "AMRAP"],
  ["rest", "Descanso"],
  ["stopwatch", "Cronómetro"],
];

// Configurar el reloj que el alumno verá programado en un bloque. value = { mode, ...valores } o null.
export function TimerSettings({ value, onChange, compact = false }) {
  const t = normalizeTimer(value);
  const mode = t?.mode || "";
  const setMode = (m) => onChange(m ? { mode: m, ...normalizeConfig(m, CLOCK_DEFAULTS[m]) } : null);
  const setField = (f, v) => onChange({ mode, ...normalizeConfig(mode, { ...t, [f.key]: v }) });

  return (
    <div className={compact ? "" : "bg-field/50 rounded-lg p-3"}>
      <div className="flex flex-wrap gap-1.5 mb-2" role="radiogroup" aria-label="Reloj">
        {MODES.map(([m, label]) => (
          <button key={m || "none"} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
            className={`text-xs rounded-full px-3 py-1.5 transition-colors ${mode === m ? "bg-accent text-app font-semibold" : "bg-field text-soft hover:text-ink"}`}>
            {m === "" ? "Sin reloj" : label}
          </button>
        ))}
      </div>
      {t && CLOCK_FIELDS[mode].length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {visibleFields(mode, t).map((f) => (
            <ClockField key={`${mode}-${f.key}`} field={f} value={t[f.key]} onChange={(v) => setField(f, v)} size="sm" />
          ))}
        </div>
      )}
      {t && CLOCK_FIELDS[mode].some((f) => f.unit === "time") && (
        <p className="text-muted text-[11px] mt-1.5">Tocá el tiempo para escribirlo exacto (7, 0:08, 1:30…). Mantené − o + para ir más rápido.</p>
      )}
      {!t && !compact && (
        <p className="text-muted text-[11px] flex items-center gap-1"><Timer size={12} /> Sin reloj programado, el alumno usa el reloj normal.</p>
      )}
    </div>
  );
}
