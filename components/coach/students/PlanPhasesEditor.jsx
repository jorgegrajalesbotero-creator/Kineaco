"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { PHASE_DEFAULTS, PHASE_TYPES, phaseType } from "@/lib/loadCalc";
import { cleanDecimal, cleanInt } from "@/lib/numbers";

export const newPhase = (type = "acumulacion", weeks = 4) => ({ phase_type: type, name: "", weeks: String(weeks), ...stringDefaults(type) });

function stringDefaults(type) {
  const d = PHASE_DEFAULTS[type] || PHASE_DEFAULTS.otro;
  return {
    pct_start: d.pct_start == null ? "" : String(d.pct_start),
    pct_end: d.pct_end == null ? "" : String(d.pct_end),
    reps_start: d.reps_start || "",
    reps_end: d.reps_end || "",
  };
}

export const ATR_PRESET = () => [newPhase("acumulacion", 4), newPhase("transformacion", 3), newPhase("realizacion", 2)];

// Fases del plan: tipo, nombre, semanas, % de inicio y fin, reps de inicio y fin
export function PlanPhasesEditor({ phases, onChange }) {
  const set = (i, patch) => onChange(phases.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const changeType = (i, type) => {
    const p = phases[i];
    const old = stringDefaults(p.phase_type);
    // Si los % siguen siendo los de partida del tipo anterior, se cambian por los del tipo nuevo
    const untouched = ["pct_start", "pct_end", "reps_start", "reps_end"].every((k) => (p[k] || "") === old[k]);
    set(i, { phase_type: type, ...(untouched ? stringDefaults(type) : {}) });
  };
  const move = (i, dir) => {
    const t = i + dir;
    if (t < 0 || t >= phases.length) return;
    const copy = [...phases];
    [copy[i], copy[t]] = [copy[t], copy[i]];
    onChange(copy);
  };
  const field = "w-full bg-field text-ink text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-accent";
  const label = "text-muted text-[11px]";
  // Semana de inicio (acumulada) de cada fase, precalculada sin mutar nada durante el render.
  const phaseStarts = [];
  phases.reduce((acc, p) => {
    phaseStarts.push(acc);
    return acc + (Number(p.weeks) || 0);
  }, 1);

  return (
    <div className="space-y-2">
      {phases.map((p, i) => {
        const t = phaseType(p.phase_type);
        const n = Number(p.weeks) || 0;
        const from = phaseStarts[i];
        return (
          <div key={i} className="bg-field/40 rounded-lg p-3" style={{ borderLeft: `3px solid ${t.color}`, borderRadius: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium" style={{ color: t.color }}>
                {n > 0 ? (n === 1 ? `Semana ${from}` : `Semanas ${from}–${from + n - 1}`) : "Sin semanas"}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir fase" className="w-7 h-7 rounded-md text-soft flex items-center justify-center disabled:opacity-30 hover:text-accent"><ArrowUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === phases.length - 1} aria-label="Bajar fase" className="w-7 h-7 rounded-md text-soft flex items-center justify-center disabled:opacity-30 hover:text-accent"><ArrowDown size={14} /></button>
                <button onClick={() => onChange(phases.filter((_, j) => j !== i))} aria-label="Quitar fase" className="w-7 h-7 rounded-md text-soft flex items-center justify-center hover:text-danger"><X size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="block">
                <span className={label}>Fase</span>
                <select value={p.phase_type} onChange={(e) => changeType(i, e.target.value)} className={field}>
                  {PHASE_TYPES.map((pt) => <option key={pt.key} value={pt.key}>{pt.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={label}>Nombre (opcional)</span>
                <input value={p.name || ""} maxLength={60} onChange={(e) => set(i, { name: e.target.value })} placeholder={t.label} className={field} />
              </label>
              <label className="block">
                <span className={label}>Semanas</span>
                <input inputMode="numeric" value={p.weeks} onChange={(e) => set(i, { weeks: cleanInt(e.target.value).slice(0, 2) })} className={field} />
              </label>
              <div />
              <label className="block">
                <span className={label}>% inicio</span>
                <input inputMode="decimal" value={p.pct_start} onChange={(e) => set(i, { pct_start: cleanDecimal(e.target.value, 1) })} placeholder="—" className={field} />
              </label>
              <label className="block">
                <span className={label}>% fin</span>
                <input inputMode="decimal" value={p.pct_end} onChange={(e) => set(i, { pct_end: cleanDecimal(e.target.value, 1) })} placeholder="—" className={field} />
              </label>
              <label className="block">
                <span className={label}>Reps inicio</span>
                <input value={p.reps_start} maxLength={20} onChange={(e) => set(i, { reps_start: e.target.value })} placeholder="10-12" className={field} />
              </label>
              <label className="block">
                <span className={label}>Reps fin</span>
                <input value={p.reps_end} maxLength={20} onChange={(e) => set(i, { reps_end: e.target.value })} placeholder="8" className={field} />
              </label>
            </div>
          </div>
        );
      })}
      <button onClick={() => onChange([...phases, newPhase(phases.length === 0 ? "acumulacion" : "otro", 1)])} className="bg-field text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink">
        <Plus size={13} /> Agregar fase
      </button>
    </div>
  );
}
