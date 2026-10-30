"use client";

import { useState } from "react";
import { AlertTriangle, Plus, RotateCcw, X } from "lucide-react";
import { EPLEY_MAX_REPS, cellKey, fmtNum, loadFor, phaseType, rmOf } from "@/lib/loadCalc";
import { cleanDecimal, cleanInt } from "@/lib/numbers";
import { SearchInput } from "@/components/ui/Search";
import { matchesSearch } from "@/lib/search";

const CELL_W = 72;

// Cargas del plan: base de cada ejercicio (RM o peso × reps) y peso calculado de cada semana.
// weeks = planWeeks(...) · loads = [{ exercise_id, from_week, base_type, weight_kg, reps, rounding }]
// cells = { "exId:week": { value, reps } } · weekOv = { [week]: { pct, reps } }
export function PlanLoadsEditor({ weeks, exercises, loads, cells, weekOv, onLoads, onCells, onWeekOv }) {
  const [search, setSearch] = useState("");
  const total = weeks.length;
  const field = "bg-field text-ink text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-accent";

  const loadsOf = (exId) =>
    loads.filter((l) => String(l.exercise_id) === String(exId)).sort((a, b) => (Number(a.from_week) || 1) - (Number(b.from_week) || 1));

  const updateLoad = (target, patch) => onLoads(loads.map((l) => (l === target ? { ...l, ...patch } : l)));
  const addBase = (exId) => {
    const existing = loadsOf(exId);
    const first = existing[0];
    const last = existing[existing.length - 1];
    const from = last ? Math.min(total, (Number(last.from_week) || 1) + 1) : 1;
    if (last && existing.some((l) => Number(l.from_week) === from)) return;
    onLoads([...loads, { exercise_id: exId, from_week: from, base_type: "rm", weight_kg: "", reps: "", rounding: first?.rounding ?? 2.5 }]);
  };
  const removeLoad = (target) => onLoads(loads.filter((l) => l !== target));
  const setRounding = (exId, rounding) =>
    onLoads(loads.map((l) => (String(l.exercise_id) === String(exId) ? { ...l, rounding } : l)));

  const setCell = (exId, week, patch) => {
    const k = cellKey(exId, week);
    const next = { ...(cells[k] || {}), ...patch };
    const copy = { ...cells };
    if ((next.value === "" || next.value == null) && !(next.reps || "").trim()) delete copy[k];
    else copy[k] = next;
    onCells(copy);
  };
  const resetRow = (exId) => {
    const copy = { ...cells };
    Object.keys(copy).forEach((k) => { if (k.startsWith(`${exId}:`)) delete copy[k]; });
    onCells(copy);
  };
  const setWeek = (week, patch) => {
    const next = { ...(weekOv[week] || {}), ...patch };
    const copy = { ...weekOv };
    if ((next.pct === "" || next.pct == null) && !(next.reps || "").trim()) delete copy[week];
    else copy[week] = next;
    onWeekOv(copy);
  };

  const list = exercises.filter((e) => matchesSearch(search, e.name));
  const noPct = weeks.every((w) => w.pct == null);

  // Fila de semanas (encabezado común)
  const Header = () => (
    <div className="flex gap-1">
      {weeks.map((w) => {
        const t = w.phase ? phaseType(w.phase.phase_type) : null;
        return (
          <div key={w.week} style={{ width: CELL_W, borderTop: `3px solid ${t ? t.color : "transparent"}` }} className="shrink-0 text-center bg-card px-1 pt-1 pb-1.5">
            <p className="text-ink text-xs font-medium">S{w.week}</p>
            <p className="text-muted text-[10px] truncate">{t ? (w.phase.name || t.label) : "Sin fase"}</p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="bg-card rounded-xl p-4 mb-4">
        <p className="text-ink text-sm font-medium mb-1">% y reps de cada semana</p>
        <p className="text-muted text-xs mb-3">
          Salen de las fases. Podés cambiar una semana puntual escribiendo encima; para volver al cálculo, borrá el número.
        </p>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 items-end min-w-max">
            <div className="w-16 shrink-0" />
            <Header />
          </div>
          <div className="flex gap-2 items-center mt-1 min-w-max">
            <span className="w-16 shrink-0 text-muted text-xs">% del RM</span>
            <div className="flex gap-1">
              {weeks.map((w) => (
                <input key={w.week} inputMode="decimal" style={{ width: CELL_W }}
                  value={weekOv[w.week]?.pct ?? ""} placeholder={w.pctAuto == null ? "—" : fmtNum(w.pctAuto)}
                  onChange={(e) => setWeek(w.week, { pct: cleanDecimal(e.target.value, 1) })}
                  className={`shrink-0 text-center text-xs rounded-md py-1.5 bg-field outline-none focus:ring-1 focus:ring-accent placeholder:text-soft ${w.pctEdited ? "text-accent ring-1 ring-accent/60" : "text-ink"}`} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center mt-1 min-w-max">
            <span className="w-16 shrink-0 text-muted text-xs">Reps</span>
            <div className="flex gap-1">
              {weeks.map((w) => (
                <input key={w.week} maxLength={20} style={{ width: CELL_W }}
                  value={weekOv[w.week]?.reps ?? ""} placeholder={w.repsAuto || "—"}
                  onChange={(e) => setWeek(w.week, { reps: e.target.value })}
                  className={`shrink-0 text-center text-xs rounded-md py-1.5 bg-field outline-none focus:ring-1 focus:ring-accent placeholder:text-soft ${w.repsEdited ? "text-accent ring-1 ring-accent/60" : "text-ink"}`} />
              ))}
            </div>
          </div>
        </div>
        {noPct && <p className="text-warning text-xs mt-3">Ninguna semana tiene %: agregá fases con % de inicio y fin (arriba, en Fases) para que se calculen los pesos.</p>}
      </div>

      {exercises.length === 0 ? (
        <p className="text-muted text-sm bg-card rounded-xl p-4">
          Primero asigná rutinas en las semanas del plan. Acá aparecen los ejercicios de trabajo principal (y los de rutinas sin bloques).
        </p>
      ) : (
        <>
          {exercises.length > 5 && <div className="mb-3"><SearchInput value={search} onChange={setSearch} placeholder="Buscar ejercicio..." /></div>}
          <div className="space-y-3">
            {list.map((ex) => {
              const exLoads = loadsOf(ex.exercise_id);
              const rounding = exLoads[0]?.rounding ?? 2.5;
              const hasManual = Object.keys(cells).some((k) => k.startsWith(`${ex.exercise_id}:`));
              return (
                <div key={ex.exercise_id} className="bg-card rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-ink text-sm font-medium truncate">{ex.name}{ex.missing ? <span className="text-muted text-xs font-normal"> · ya no está en las rutinas del plan</span> : null}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <select value={String(rounding)} onChange={(e) => setRounding(ex.exercise_id, Number(e.target.value))} disabled={exLoads.length === 0}
                        className="bg-field text-soft text-xs rounded-lg px-2 py-1.5 outline-none disabled:opacity-40" aria-label="Redondeo">
                        <option value="2.5">Redondeo 2,5 kg</option>
                        <option value="1">Redondeo 1 kg</option>
                      </select>
                      {hasManual && (
                        <button onClick={() => resetRow(ex.exercise_id)} className="text-soft text-xs flex items-center gap-1 hover:text-ink" title="Volver todo al cálculo">
                          <RotateCcw size={12} /> Recalcular
                        </button>
                      )}
                    </div>
                  </div>

                  {exLoads.length === 0 ? (
                    <button onClick={() => addBase(ex.exercise_id)} className="bg-field text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink mb-3">
                      <Plus size={13} /> Ingresar RM o peso
                    </button>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {exLoads.map((l, idx) => {
                        const rm = rmOf(l);
                        const reps = Number(l.reps) || 0;
                        return (
                          <div key={idx} className="flex flex-wrap items-center gap-2">
                            {idx > 0 ? (
                              <span className="text-soft text-xs">RM nuevo desde la semana</span>
                            ) : (
                              <span className="text-soft text-xs">Base</span>
                            )}
                            {idx > 0 && (
                              <select value={l.from_week} onChange={(e) => updateLoad(l, { from_week: Number(e.target.value) })} className={`${field} py-1.5 text-xs`}>
                                {weeks.filter((w) => w.week > 1).map((w) => <option key={w.week} value={w.week}>{w.week}</option>)}
                              </select>
                            )}
                            <select value={l.base_type} onChange={(e) => updateLoad(l, { base_type: e.target.value })} className={`${field} py-1.5 text-xs`}>
                              <option value="rm">RM (1 repetición)</option>
                              <option value="work">Peso × reps</option>
                            </select>
                            <input inputMode="decimal" value={l.weight_kg} onChange={(e) => updateLoad(l, { weight_kg: cleanDecimal(e.target.value) })} placeholder="kg" className={`${field} w-20 py-1.5`} />
                            <span className="text-muted text-xs">kg</span>
                            {l.base_type === "work" && (
                              <>
                                <span className="text-muted text-xs">×</span>
                                <input inputMode="numeric" value={l.reps ?? ""} onChange={(e) => updateLoad(l, { reps: cleanInt(e.target.value).slice(0, 2) })} placeholder="reps" className={`${field} w-16 py-1.5`} />
                                <span className="text-muted text-xs">reps</span>
                              </>
                            )}
                            {l.base_type === "work" && rm != null && reps > 1 && (
                              <span className="text-soft text-xs">RM estimado: {fmtNum(Math.round(rm * 10) / 10)} kg</span>
                            )}
                            {l.base_type === "work" && reps > EPLEY_MAX_REPS && (
                              <span className="text-warning text-xs flex items-center gap-1"><AlertTriangle size={12} /> Con más de {EPLEY_MAX_REPS} reps la estimación es poco precisa</span>
                            )}
                            <button onClick={() => removeLoad(l)} aria-label="Quitar base" className="w-7 h-7 rounded-md text-soft flex items-center justify-center hover:text-danger"><X size={14} /></button>
                          </div>
                        );
                      })}
                      {total > 1 && (
                        <button onClick={() => addBase(ex.exercise_id)} className="text-soft text-xs flex items-center gap-1 hover:text-accent">
                          <Plus size={12} /> Tomé un RM nuevo (recalcula desde esa semana)
                        </button>
                      )}
                    </div>
                  )}

                  <div className="overflow-x-auto pb-1">
                    <div className="min-w-max">
                      <Header />
                      <div className="flex gap-1 mt-1">
                        {weeks.map((w) => {
                          const r = loadFor({ weeks, loads, cells, exerciseId: ex.exercise_id, week: w.week });
                          const cell = cells[cellKey(ex.exercise_id, w.week)] || {};
                          return (
                            <div key={w.week} style={{ width: CELL_W }} className="shrink-0">
                              <input inputMode="decimal" value={cell.value ?? ""} placeholder={r.auto == null ? "—" : fmtNum(r.auto)}
                                onChange={(e) => setCell(ex.exercise_id, w.week, { value: cleanDecimal(e.target.value) })}
                                aria-label={`Peso semana ${w.week}`}
                                className={`w-full text-center text-sm rounded-md py-1.5 bg-field outline-none focus:ring-1 focus:ring-accent placeholder:text-ink ${r.manual ? "text-accent ring-1 ring-accent/60" : "text-ink"}`} />
                              <p className="text-muted text-[10px] text-center mt-0.5 truncate">
                                {r.kg != null && r.pct != null ? `${fmtNum(r.pct)}%` : ""}{r.reps ? ` · ${r.reps}` : ""}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {hasManual && <p className="text-muted text-[11px] mt-1">Los pesos en lima los escribiste a mano: el cálculo no los cambia. Para volver al cálculo, borrá el número.</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
