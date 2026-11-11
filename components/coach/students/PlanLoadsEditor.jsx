"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Plus, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { EPLEY_MAX_REPS, cellKey, fmtNum, loadFor, phaseType, rmOf } from "@/lib/loadCalc";
import { applyPlanChanges } from "@/lib/planChanges";
import { blockTypeLabel } from "@/lib/blocks";
import { cleanInt } from "@/lib/numbers";
import { Select } from "@/components/ui/Select";
import { SearchSelect } from "@/components/ui/Search";
import { UnitToggle, WeightInput } from "@/components/ui/WeightInput";
import { fromKg, roundingStep, useWeightUnit } from "@/lib/weightUnits";

const CELL_W = 76;
const newKey = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// Cargas del plan, por rutina y por bloque, con los cambios de ejercicios del alumno.
// weeks = planWeeks(...) · loads = [{ exercise_id, from_week, base_type: "rm" | "work" | "reps", weight_kg, reps, rounding }]
// cells = { "exId:week": { value, reps, sets } } · weekOv = { [week]: { pct, reps, sets } }
// routines = [{ id, title, blocks: [{ id, block_type, title }], items: [routine_exercises con exercises(name)] }]
// changes = [{ routine_id, from_week, action: "remove" | "replace" | "add", item_key, exercise_id, after_item_key, new_item_key, sets, reps, exercises: { name } }]
// extra = ejercicios con cargas guardadas que ya no están en las rutinas del plan [{ exercise_id, name }]
export function PlanLoadsEditor({ weeks, routines, catalog, changes, onChanges, extra = [], loads, cells, weekOv, onLoads, onCells, onWeekOv }) {
  const [routineId, setRoutineId] = useState(routines[0]?.id || null);
  const [form, setForm] = useState(null); // { kind, itemKey?, afterKey?, exerciseId, fromWeek, sets, reps }
  const [unit] = useWeightUnit();
  const total = weeks.length;
  const field = "bg-field text-ink text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-accent";

  useEffect(() => {
    if (!routines.some((r) => r.id === routineId)) setRoutineId(routines[0]?.id || null);
  }, [routines, routineId]);

  // ---------- Bases y casillas ----------
  const loadsOf = (exId) =>
    loads.filter((l) => String(l.exercise_id) === String(exId)).sort((a, b) => (Number(a.from_week) || 1) - (Number(b.from_week) || 1));
  const updateLoad = (target, patch) => onLoads(loads.map((l) => (l === target ? { ...l, ...patch } : l)));
  const addBase = (exId) => {
    const existing = loadsOf(exId).filter((l) => l.base_type !== "reps");
    const first = existing[0];
    const last = existing[existing.length - 1];
    const from = last ? Math.min(total, (Number(last.from_week) || 1) + 1) : 1;
    if (last && existing.some((l) => Number(l.from_week) === from)) return;
    onLoads([...loads.filter((l) => !(String(l.exercise_id) === String(exId) && l.base_type === "reps")), { exercise_id: exId, from_week: from, base_type: "rm", weight_kg: "", reps: "", rounding: first?.rounding ?? 2.5 }]);
  };
  const removeLoad = (target) => onLoads(loads.filter((l) => l !== target));
  const setRounding = (exId, rounding) => onLoads(loads.map((l) => (String(l.exercise_id) === String(exId) ? { ...l, rounding } : l)));
  const setMode = (exId, mode) => {
    const others = loads.filter((l) => String(l.exercise_id) !== String(exId));
    if (mode === "reps") onLoads([...others, { exercise_id: exId, from_week: 1, base_type: "reps", weight_kg: "", reps: "", rounding: 2.5 }]);
    else onLoads(others);
  };
  const setCell = (exId, week, patch) => {
    const k = cellKey(exId, week);
    const next = { ...(cells[k] || {}), ...patch };
    const copy = { ...cells };
    if ((next.value === "" || next.value == null) && !(next.reps || "").trim() && !String(next.sets || "").trim()) delete copy[k];
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
    if ((next.pct === "" || next.pct == null) && !(next.reps || "").trim() && !String(next.sets || "").trim()) delete copy[week];
    else copy[week] = next;
    onWeekOv(copy);
  };

  // ---------- Rutina elegida, con sus cambios ----------
  const routine = routines.find((r) => r.id === routineId) || null;
  const rChanges = useMemo(() => (changes || []).filter((c) => String(c.routine_id) === String(routineId)), [changes, routineId]);
  // Todos los lugares que existen en algún momento del plan: los de la rutina + los agregados
  const slots = useMemo(() => {
    if (!routine) return [];
    const adds = rChanges.filter((c) => c.action === "add");
    return applyPlanChanges(routine.items, adds.map((c) => ({ ...c, from_week: 1 })), routine.id, 1);
  }, [routine, rChanges]);
  const blocksOrder = useMemo(() => routine?.blocks || [], [routine]);
  const groups = useMemo(() => {
    const out = blocksOrder.map((b) => ({ key: b.id, label: b.title || blockTypeLabel(b.block_type), items: [] }));
    const loose = { key: "sin-bloque", label: blocksOrder.length ? "Sin bloque" : "Ejercicios", items: [] };
    slots.forEach((s) => {
      const g = out.find((x) => x.key === s.block_id);
      (g || loose).items.push(s);
    });
    return [...out, ...(loose.items.length || out.length === 0 ? [loose] : [])];
  }, [slots, blocksOrder]);

  const itemName = (key) => {
    const s = slots.find((x) => String(x.item_key) === String(key));
    return s?.exercises?.name || "";
  };
  const changesOf = (key) => rChanges.filter((c) => c.action !== "add" && String(c.item_key) === String(key)).sort((a, b) => (Number(a.from_week) || 1) - (Number(b.from_week) || 1));
  const addChangeOf = (key) => rChanges.find((c) => c.action === "add" && String(c.new_item_key) === String(key));
  const removeChange = (c) => onChanges(changes.filter((x) => x !== c));

  // Ejercicio en otras rutinas del plan (la progresión es la misma: va por ejercicio)
  const otherRoutines = (exId) =>
    routines.filter((r) => r.id !== routineId && applyPlanChanges(r.items, (changes || []).filter((c) => c.action === "add" && String(c.routine_id) === String(r.id)).map((c) => ({ ...c, from_week: 1 })), r.id, 1)
      .concat((changes || []).filter((c) => c.action === "replace" && String(c.routine_id) === String(r.id)))
      .some((i) => String(i.exercise_id) === String(exId))).map((r) => r.title);

  const exerciseOptions = useMemo(() => (catalog || []).map((e) => ({ value: e.id, label: e.name })), [catalog]);
  const weekOptions = weeks.map((w) => <option key={w.week} value={w.week}>Desde la semana {w.week}</option>);

  const saveForm = () => {
    if (!form) return;
    const ex = (catalog || []).find((e) => String(e.id) === String(form.exerciseId));
    if (form.kind !== "remove" && !ex) return alert("Elegí un ejercicio.");
    const base = { routine_id: routineId, from_week: Number(form.fromWeek) || 1, sets: form.sets ? Number(form.sets) : null, reps: (form.reps || "").trim() || null, rest_minutes: null, order_index: (changes || []).length };
    let c;
    if (form.kind === "remove") c = { ...base, action: "remove", item_key: form.itemKey, exercise_id: null };
    else if (form.kind === "replace") c = { ...base, action: "replace", item_key: form.itemKey, exercise_id: ex.id, exercises: { name: ex.name } };
    else c = { ...base, action: "add", item_key: null, after_item_key: form.afterKey || null, new_item_key: newKey(), exercise_id: ex.id, exercises: { name: ex.name } };
    onChanges([...(changes || []), c]);
    setForm(null);
  };

  // ---------- Encabezado de semanas ----------
  const headerRow = (
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

  // ---------- Una fila de progresión (por ejercicio) ----------
  // activeFrom / activeTo: semanas en que ese ejercicio está en la rutina (las demás se ven más tenues)
  const progressRow = (exId, name, { label, activeFrom = 1, activeTo = total } = {}) => {
    const exLoads = loadsOf(exId);
    const repsOnly = exLoads.some((l) => l.base_type === "reps");
    const kgLoads = exLoads.filter((l) => l.base_type !== "reps");
    const rounding = kgLoads[0]?.rounding ?? 2.5;
    const hasManual = Object.keys(cells).some((k) => k.startsWith(`${exId}:`));
    const others = otherRoutines(exId);
    return (
      <div key={`${exId}-${label || ""}`} className="mt-3 first:mt-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            {label && <p className="text-muted text-[11px]">{label}</p>}
            <p className="text-ink text-sm font-medium truncate">{name}</p>
            {others.length > 0 && <p className="text-muted text-[11px]">Misma progresión en: {others.join(", ")}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!repsOnly && (
              <Select size="sm" aria-label="Redondeo" value={String(rounding)} onChange={(e) => setRounding(exId, Number(e.target.value))} disabled={kgLoads.length === 0}>
                <option value="2.5">Redondeo {fmtNum(roundingStep(2.5, unit))} {unit}</option>
                <option value="1">Redondeo {fmtNum(roundingStep(1, unit))} {unit}</option>
              </Select>
            )}
            {hasManual && (
              <button onClick={() => resetRow(exId)} className="text-soft text-xs flex items-center gap-1 hover:text-ink" title="Volver todo al cálculo">
                <RotateCcw size={12} /> Recalcular
              </button>
            )}
          </div>
        </div>

        {/* Tipo de progresión: con peso (RM o peso × reps) o solo series y reps */}
        <div className="flex gap-1 bg-field rounded-lg p-1 mb-3 w-full sm:w-auto sm:inline-flex" role="group" aria-label="Tipo de progresión">
          {[["kg", "Con peso"], ["reps", "Solo series y reps"]].map(([k, l]) => {
            const on = (k === "reps") === repsOnly;
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => { if (!on) setMode(exId, k); }}
                className={`flex-1 sm:flex-none text-xs rounded-md px-3 py-1.5 transition-colors ${on ? "bg-accent text-app font-semibold" : "text-soft hover:text-ink"}`}>
                {l}
              </button>
            );
          })}
        </div>

        {!repsOnly && (kgLoads.length === 0 ? (
          <button onClick={() => addBase(exId)} className="bg-field text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink mb-2">
            <Plus size={13} /> Ingresar RM o peso
          </button>
        ) : (
          <div className="space-y-2 mb-2">
            {kgLoads.map((l, idx) => {
              const rm = rmOf(l);
              const reps = Number(l.reps) || 0;
              return (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <span className="text-soft text-xs">{idx > 0 ? "RM nuevo desde la semana" : "Base"}</span>
                  {idx > 0 && (
                    <Select size="sm" aria-label="Desde la semana" value={l.from_week} onChange={(e) => updateLoad(l, { from_week: Number(e.target.value) })}>
                      {weeks.filter((w) => w.week > 1).map((w) => <option key={w.week} value={w.week}>{w.week}</option>)}
                    </Select>
                  )}
                  <Select size="sm" aria-label="Tipo de base" value={l.base_type} onChange={(e) => updateLoad(l, { base_type: e.target.value })}>
                    <option value="rm">RM (1 repetición)</option>
                    <option value="work">Peso × reps</option>
                  </Select>
                  <WeightInput toggle={false} valueKg={l.weight_kg} onChangeKg={(kg) => updateLoad(l, { weight_kg: kg })} placeholder={unit} wrapperClassName="w-20" className={`${field} w-full py-1.5`} />
                  <span className="text-muted text-xs">{unit}</span>
                  {l.base_type === "work" && (
                    <>
                      <span className="text-muted text-xs">×</span>
                      <input inputMode="numeric" value={l.reps ?? ""} onChange={(e) => updateLoad(l, { reps: cleanInt(e.target.value).slice(0, 2) })} placeholder="reps" className={`${field} w-16 py-1.5`} />
                      <span className="text-muted text-xs">reps</span>
                    </>
                  )}
                  {l.base_type === "work" && rm != null && reps > 1 && (
                    <span className="text-soft text-xs">RM estimado: {fmtNum(Math.round(fromKg(rm, unit) * 10) / 10)} {unit}</span>
                  )}
                  {l.base_type === "work" && reps > EPLEY_MAX_REPS && (
                    <span className="text-warning text-xs flex items-center gap-1"><AlertTriangle size={12} /> Con más de {EPLEY_MAX_REPS} reps la estimación es poco precisa</span>
                  )}
                  <button onClick={() => removeLoad(l)} aria-label="Quitar base" className="w-7 h-7 rounded-md text-soft flex items-center justify-center hover:text-danger"><X size={14} /></button>
                </div>
              );
            })}
            {total > 1 && (
              <button onClick={() => addBase(exId)} className="text-soft text-xs flex items-center gap-1 hover:text-accent">
                <Plus size={12} /> Tomé un RM nuevo (recalcula desde esa semana)
              </button>
            )}
          </div>
        ))}
        {repsOnly && <p className="text-muted text-[11px] mb-2">Sin peso: toma las series y reps de cada fase. Podés cambiar cualquier semana.</p>}

        <div className="overflow-x-auto pb-1">
          <div className="min-w-max">
            {headerRow}
            <div className="flex gap-1 mt-1">
              {weeks.map((w) => {
                const r = loadFor({ weeks, loads, cells, exerciseId: exId, week: w.week, unit });
                const cell = cells[cellKey(exId, w.week)] || {};
                const off = w.week < activeFrom || w.week > activeTo;
                return (
                  <div key={w.week} style={{ width: CELL_W }} className={`shrink-0 ${off ? "opacity-35" : ""}`} title={off ? "Esta semana el ejercicio no está en la rutina" : undefined}>
                    {!repsOnly && (
                      <WeightInput toggle={false} valueKg={cell.value ?? ""} placeholder={r.auto == null ? "kg" : fmtNum(fromKg(r.auto, unit))}
                        onChangeKg={(kg) => setCell(exId, w.week, { value: kg })}
                        aria-label={`Peso semana ${w.week}`}
                        className={`w-full text-center text-sm rounded-md py-1.5 bg-field outline-none focus:ring-1 focus:ring-accent ${r.auto == null ? "placeholder:text-muted" : "placeholder:text-ink"} ${r.manual ? "text-accent ring-1 ring-accent/60" : "text-ink"}`} />
                    )}
                    <div className="flex gap-0.5 mt-1">
                      <input inputMode="numeric" value={cell.sets ?? ""} placeholder={r.setsAuto == null ? "ser." : `${r.setsAuto}s`}
                        onChange={(e) => setCell(exId, w.week, { sets: cleanInt(e.target.value).slice(0, 2) })}
                        aria-label={`Series semana ${w.week}`} title="Series de esta semana"
                        className={`w-[40%] text-center text-[11px] rounded-md py-1 bg-field/60 outline-none focus:ring-1 focus:ring-accent placeholder:text-muted ${r.setsManual ? "text-accent ring-1 ring-accent/60" : "text-ink"}`} />
                      <input maxLength={12} value={cell.reps ?? ""} placeholder={r.repsAuto || "reps"}
                        onChange={(e) => setCell(exId, w.week, { reps: e.target.value })}
                        aria-label={`Reps semana ${w.week}`} title="Reps de esta semana"
                        className={`w-[60%] text-center text-[11px] rounded-md py-1 bg-field/60 outline-none focus:ring-1 focus:ring-accent placeholder:text-muted ${r.repsManual ? "text-accent ring-1 ring-accent/60" : "text-ink"}`} />
                    </div>
                    <p className="text-muted text-[10px] text-center mt-0.5 truncate">{r.kg != null && r.pct != null ? `${fmtNum(r.pct)}%` : ""}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Formulario de cambio (sustituir / quitar / agregar) ----------
  const formBox = (title) => (
    <div className="bg-deep border border-field rounded-xl p-3 mt-3 space-y-2">
      <p className="text-ink text-sm font-medium">{title}</p>
      {form.kind !== "remove" && (
        <SearchSelect options={exerciseOptions} value={form.exerciseId} onChange={(v) => setForm((f) => ({ ...f, exerciseId: v }))} placeholder="Buscar ejercicio del catálogo..." />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select size="sm" aria-label="Desde la semana" value={form.fromWeek} onChange={(e) => setForm((f) => ({ ...f, fromWeek: Number(e.target.value) }))}>
          {weekOptions}
        </Select>
        {form.kind !== "remove" && (
          <>
            <input inputMode="numeric" value={form.sets} onChange={(e) => setForm((f) => ({ ...f, sets: cleanInt(e.target.value).slice(0, 2) }))} placeholder="Series" className={`${field} w-20 py-1.5`} />
            <input value={form.reps} maxLength={20} onChange={(e) => setForm((f) => ({ ...f, reps: e.target.value }))} placeholder="Reps (ej. 10-12)" className={`${field} w-32 py-1.5`} />
          </>
        )}
      </div>
      <p className="text-muted text-[11px]">
        {form.kind === "remove"
          ? "Desde esa semana el alumno ya no ve este ejercicio. La rutina original no cambia."
          : "Series y reps son opcionales: si los dejás vacíos, se usan los de la rutina o los de la progresión. La rutina original no cambia."}
      </p>
      <div className="flex gap-2">
        <button onClick={saveForm} className="bg-accent text-app text-xs font-semibold rounded-lg px-3.5 py-2">Guardar cambio</button>
        <button onClick={() => setForm(null)} className="bg-field text-soft text-xs rounded-lg px-3.5 py-2">Cancelar</button>
      </div>
    </div>
  );

  const slotCard = (s) => {
    const key = String(s.item_key || "");
    const add = s.planChange === "add" ? addChangeOf(key) : null;
    const own = key ? changesOf(key) : [];
    const removedFrom = own.find((c) => c.action === "remove");
    const replaces = own.filter((c) => c.action === "replace");
    const startWeek = add ? Number(add.from_week) || 1 : 1;
    // Rango de semanas de cada ejercicio que pasa por este lugar
    const cuts = [...replaces.map((c) => Number(c.from_week) || 1), removedFrom ? Number(removedFrom.from_week) || 1 : null].filter(Boolean).sort((a, b) => a - b);
    const endOf = (from) => { const next = cuts.find((w) => w > from); return next ? next - 1 : total; };
    const rows = [{ exId: s.exercise_id, name: s.exercises?.name || "Ejercicio", from: startWeek, label: add ? `Agregado desde la semana ${startWeek}` : replaces.length ? "Rutina original" : null }];
    replaces.forEach((c) => rows.push({ exId: c.exercise_id, name: c.exercises?.name || "Ejercicio", from: Number(c.from_week) || 1, label: `Sustituye desde la semana ${Number(c.from_week) || 1}` }));
    const editing = form && (form.itemKey === key || form.afterKey === key) && form.slot === key;

    return (
      <div key={key || s.exercise_id} className={`bg-card rounded-xl p-4 ${add ? "border border-accent/30" : ""}`}>
        {rows.map((r) => progressRow(r.exId, r.name, { label: r.label, activeFrom: r.from, activeTo: removedFrom && Number(removedFrom.from_week) <= endOf(r.from) + 1 ? Math.min(endOf(r.from), Number(removedFrom.from_week) - 1) : endOf(r.from) }))}

        {(own.length > 0 || add) && (
          <div className="mt-3 space-y-1">
            {add && (
              <div className="flex items-center justify-between gap-2 text-xs text-soft">
                <span>Desde S{add.from_week}: se agrega a esta rutina (solo para este alumno)</span>
                <button onClick={() => removeChange(add)} className="text-soft hover:text-danger flex items-center gap-1"><Trash2 size={12} /> Quitar</button>
              </div>
            )}
            {own.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs text-soft">
                <span>{c.action === "remove" ? `Desde S${c.from_week}: se quita` : `Desde S${c.from_week}: se cambia por ${c.exercises?.name || "otro ejercicio"}`}</span>
                <button onClick={() => removeChange(c)} className="text-soft hover:text-ink flex items-center gap-1"><Undo2 size={12} /> Deshacer</button>
              </div>
            ))}
          </div>
        )}

        {key && !editing && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => setForm({ slot: key, kind: "replace", itemKey: add ? null : key, exerciseId: null, fromWeek: 1, sets: "", reps: "" })} disabled={!!add} title={add ? "Para cambiar un ejercicio agregado, quitalo y agregá otro" : undefined}
              className="bg-field text-soft text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:text-ink disabled:opacity-40">
              <ArrowLeftRight size={12} /> Sustituir
            </button>
            {!add && !removedFrom && (
              <button onClick={() => setForm({ slot: key, kind: "remove", itemKey: key, fromWeek: 1 })} className="bg-field text-soft text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:text-danger">
                <Trash2 size={12} /> Quitar
              </button>
            )}
            <button onClick={() => setForm({ slot: key, kind: "add", afterKey: key, exerciseId: null, fromWeek: 1, sets: "", reps: "" })} className="bg-field text-soft text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:text-accent">
              <Plus size={12} /> Agregar después
            </button>
          </div>
        )}
        {!key && <p className="text-muted text-[11px] mt-2">Este ejercicio no tiene clave fija: guardá la rutina una vez (Rutinas → editar → guardar) para poder cambiarlo aquí.</p>}
        {editing && formBox(form.kind === "remove" ? `Quitar ${s.exercises?.name || "ejercicio"}` : form.kind === "replace" ? `Sustituir ${s.exercises?.name || "ejercicio"}` : `Agregar después de ${s.exercises?.name || "este ejercicio"}`)}
      </div>
    );
  };

  const noPct = weeks.every((w) => w.pct == null);

  return (
    <div>
      <div className="bg-card rounded-xl p-4 mb-4">
        <p className="text-ink text-sm font-medium mb-1">%, reps y series de cada semana</p>
        <p className="text-muted text-xs mb-3">
          Salen de las fases. Podés cambiar una semana puntual escribiendo encima; para volver al cálculo, borrá el número.
        </p>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 items-end min-w-max">
            <div className="w-16 shrink-0" />
            {headerRow}
          </div>
          {[["pct", "% del RM", "decimal"], ["reps", "Reps", "text"], ["sets", "Series", "numeric"]].map(([k, label, mode]) => (
            <div key={k} className="flex gap-2 items-center mt-1 min-w-max">
              <span className="w-16 shrink-0 text-muted text-xs">{label}</span>
              <div className="flex gap-1">
                {weeks.map((w) => {
                  const auto = k === "pct" ? (w.pctAuto == null ? "—" : fmtNum(w.pctAuto)) : k === "reps" ? (w.repsAuto || "—") : (w.setsAuto == null ? "Rutina" : String(w.setsAuto));
                  const edited = k === "pct" ? w.pctEdited : k === "reps" ? w.repsEdited : w.setsEdited;
                  return (
                    <input key={w.week} inputMode={mode} maxLength={k === "reps" ? 20 : undefined} style={{ width: CELL_W }}
                      value={weekOv[w.week]?.[k] ?? ""} placeholder={auto}
                      onChange={(e) => {
                        const v = e.target.value;
                        setWeek(w.week, { [k]: k === "sets" ? cleanInt(v).slice(0, 2) : k === "pct" ? v.replace(/[^\d.,]/g, "").slice(0, 5) : v });
                      }}
                      aria-label={`${label} semana ${w.week}`}
                      className={`shrink-0 text-center text-xs rounded-md py-1.5 bg-field outline-none focus:ring-1 focus:ring-accent placeholder:text-soft ${edited ? "text-accent ring-1 ring-accent/60" : "text-ink"}`} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {noPct && <p className="text-warning text-xs mt-3">Ninguna semana tiene %: agregá fases con % de inicio y fin (arriba, en Fases) para que se calculen los pesos.</p>}
      </div>

      {routines.length === 0 ? (
        <p className="text-muted text-sm bg-card rounded-xl p-4">Primero asigná rutinas en las semanas del plan (pestaña «Rutinas por semana»). Acá aparecen todos sus ejercicios.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {routines.map((r) => {
                const n = (changes || []).filter((c) => String(c.routine_id) === String(r.id)).length;
                return (
                  <button key={r.id} onClick={() => { setRoutineId(r.id); setForm(null); }}
                    className={`shrink-0 text-xs rounded-full px-3 py-1.5 ${r.id === routineId ? "bg-accent text-app font-medium" : "bg-card text-soft hover:text-ink"}`}>
                    {r.title}{n > 0 ? ` · ${n} cambio${n > 1 ? "s" : ""}` : ""}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted text-xs">Pesos en</span>
              <UnitToggle />
            </div>
          </div>
          <p className="text-muted text-xs mb-3">
            Los cambios de ejercicios (sustituir, quitar, agregar) son solo para este alumno y valen desde la semana que elijas. La rutina original no cambia.
          </p>

          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="text-soft text-xs font-medium uppercase tracking-wide mb-2">{g.label}</p>
                <div className="space-y-3">
                  {g.items.length === 0 && <p className="text-muted text-xs">Sin ejercicios.</p>}
                  {g.items.map(slotCard)}
                </div>
              </div>
            ))}
            {slots.length === 0 && (
              <div className="bg-card rounded-xl p-4">
                <p className="text-muted text-sm">Esta rutina no tiene ejercicios.</p>
                {!(form && form.slot === "__fin") ? (
                  <button onClick={() => setForm({ slot: "__fin", kind: "add", afterKey: null, exerciseId: null, fromWeek: 1, sets: "", reps: "" })} className="mt-2 bg-field text-soft text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:text-accent">
                    <Plus size={12} /> Agregar ejercicio
                  </button>
                ) : formBox("Agregar ejercicio")}
              </div>
            )}
          </div>
        </>
      )}

      {extra.length > 0 && (
        <div className="mt-6">
          <p className="text-soft text-xs font-medium uppercase tracking-wide mb-2">Con cargas guardadas, ya no están en las rutinas del plan</p>
          <div className="space-y-3">
            {extra.map((e) => <div key={e.exercise_id} className="bg-card rounded-xl p-4">{progressRow(e.exercise_id, e.name)}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
