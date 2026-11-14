"use client";

import { Minus, Plus, Timer } from "lucide-react";
import { CLOCK_DEFAULTS, CLOCK_FIELDS, formatClock, normalizeConfig, normalizeTimer } from "@/lib/clock";

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
          {CLOCK_FIELDS[mode].map((f) => (
            <div key={f.key} className="bg-card rounded-lg px-2 py-1.5 flex items-center gap-1.5">
              <span className="text-soft text-xs flex-1">{f.label}</span>
              <button type="button" onClick={() => setField(f, t[f.key] - f.step)} disabled={t[f.key] <= f.min} aria-label={`Menos ${f.label}`} className="w-7 h-7 rounded-md bg-field text-ink flex items-center justify-center disabled:opacity-40"><Minus size={13} /></button>
              <span className="text-ink text-sm font-semibold tabular-nums w-12 text-center">
                {f.unit === "time" ? formatClock(t[f.key]) : f.unit === "minutes" ? `${t[f.key]} min` : t[f.key]}
              </span>
              <button type="button" onClick={() => setField(f, t[f.key] + f.step)} disabled={t[f.key] >= f.max} aria-label={`Más ${f.label}`} className="w-7 h-7 rounded-md bg-field text-ink flex items-center justify-center disabled:opacity-40"><Plus size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {!t && !compact && (
        <p className="text-muted text-[11px] flex items-center gap-1"><Timer size={12} /> Sin reloj programado, el alumno usa el reloj normal.</p>
      )}
    </div>
  );
}
