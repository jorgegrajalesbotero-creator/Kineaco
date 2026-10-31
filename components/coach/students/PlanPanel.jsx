"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Copy, CopyPlus, Download, Layers, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { WEEK_DAYS, localDateString } from "@/lib/dates";
import { supabase } from "@/lib/supabaseClient";
import { addDays, loadSchedule, mondayOf, parseDate, planLastDay, planStart, planWeekOf, plansOverlap, suggestedStart } from "@/lib/trainingPlan";
import { downloadPlanPdf } from "@/lib/planPdf";
import { DayRoutinesEditor } from "@/components/coach/programs/DayRoutinesEditor";
import { PanelLayout } from "./PanelLayout";
import { PlanPhasesEditor, ATR_PRESET } from "./PlanPhasesEditor";
import { PlanLoadsEditor } from "./PlanLoadsEditor";
import { blockUsesProgression } from "@/lib/blocks";
import { cellKey, phaseType, planWeeks } from "@/lib/loadCalc";

const MAX_WEEKS = 52;
const str = (v) => (v == null ? "" : String(v));
const nOrNull = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));
const phaseWeeksTotal = (phases) => phases.reduce((s, p) => s + (Number(p.weeks) || 0), 0);

// Corre todo lo que está en la semana >= desde (índice 1) en "delta" semanas
function shiftWeekKeys(obj, from, delta) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    const w = Number(k);
    if (w >= from) { if (w + delta >= 1) out[w + delta] = v; } else out[w] = v;
  });
  return out;
}
function shiftCells(cells, from, delta) {
  const out = {};
  Object.entries(cells).forEach(([k, v]) => {
    const [ex, wStr] = k.split(":");
    const w = Number(wStr);
    if (w >= from) { if (w + delta >= 1) out[cellKey(ex, w + delta)] = v; } else out[k] = v;
  });
  return out;
}

const fmtDay = (d, withYear = false) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });

function planStatus(plan) {
  const today = new Date();
  const week = planWeekOf(plan, today);
  if (week) return { label: `En curso · semana ${week} de ${plan.weeks}`, tone: "text-accent" };
  if (planStart(plan) > today) return { label: `Empieza el ${fmtDay(planStart(plan))}`, tone: "text-soft" };
  return { label: "Terminado", tone: "text-muted" };
}

const emptyWeeks = (n) => Array.from({ length: n }, () => ({}));

// Pasa los días del plan guardado a [{ Lunes: [ids], ... }, ...]
function weeksFromPlan(plan) {
  const weeks = emptyWeeks(plan.weeks);
  [...(plan.training_plan_days || [])]
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .forEach((d) => {
      const w = weeks[d.week_index - 1];
      if (w) w[d.day_label] = [...(w[d.day_label] || []), d.routine_id];
    });
  return weeks;
}

// Coach → alumno → Plan: plan por semanas (hasta 52) con fases, rutinas por día y cargas calculadas
export function PlanPanel({ student, onClose }) {
  const [plans, setPlans] = useState([]);
  const [fixed, setFixed] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id?, name, start, weeks, data: [...] }
  const [week, setWeek] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(null);
  const [tab, setTab] = useState("rutinas"); // rutinas | cargas
  const [templates, setTemplates] = useState([]);
  const [planExercises, setPlanExercises] = useState([]);

  // Ejercicios de trabajo principal (o de rutinas sin bloques) de las rutinas del plan
  const routineKey = editing ? [...new Set(editing.data.flatMap((w) => Object.values(w).flat()))].sort().join(",") : "";
  useEffect(() => {
    if (!editing) return;
    let cancel = false;
    (async () => {
      const ids = routineKey ? routineKey.split(",") : [];
      let rex = [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from("routine_exercises")
          .select("exercise_id, block_id, order_index, routine_blocks(block_type), exercises(name)")
          .in("routine_id", ids);
        rex = data || [];
      }
      const seen = new Set();
      const list = [];
      rex.forEach((r) => {
        if (r.block_id && !blockUsesProgression(r.routine_blocks?.block_type)) return;
        const k = String(r.exercise_id);
        if (seen.has(k)) return;
        seen.add(k);
        list.push({ exercise_id: r.exercise_id, name: r.exercises?.name || "Ejercicio" });
      });
      // Ejercicios con cargas guardadas que ya no están en las rutinas del plan
      const missing = (editing.loads || []).filter((l) => !seen.has(String(l.exercise_id)));
      if (missing.length > 0) {
        const mids = [...new Set(missing.map((l) => l.exercise_id))];
        const { data: exs } = await supabase.from("exercises").select("id, name").in("id", mids);
        (exs || []).forEach((x) => { if (!seen.has(String(x.id))) { seen.add(String(x.id)); list.push({ exercise_id: x.id, name: x.name, missing: true }); } });
      }
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
      if (!cancel) setPlanExercises(list);
    })();
    return () => { cancel = true; };
  }, [routineKey, editing?.id, !!editing]);

  async function load() {
    setLoading(true);
    const [schedule, { data: lib }, { data: tpls }] = await Promise.all([
      loadSchedule(supabase, student.id, "id, title"),
      supabase.from("routines").select("id, title, level, goal").order("title"),
      supabase.from("plan_templates").select("id, name, plan_template_phases(*), plan_template_days(*)").order("name"),
    ]);
    setTemplates(tpls || []);
    setPlans(schedule.plans);
    setFixed(schedule.fixed);
    setRoutines(lib || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [student.id]);

  const startNew = () => {
    setEditing({ id: null, name: "", start: suggestedStart(plans), weeks: 4, data: emptyWeeks(4), phases: [], weekOv: {}, loads: [], cells: {} });
    setTab("rutinas");
    setWeek(0);
  };
  // Plan nuevo desde una plantilla: fases (con %) y rutinas por semana. Las cargas (RM) son de cada alumno.
  const startFromTemplate = (tpl) => {
    const phases = [...(tpl.plan_template_phases || [])]
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((p) => ({ phase_type: p.phase_type, name: p.name || "", weeks: str(p.weeks), pct_start: str(p.pct_start), pct_end: str(p.pct_end), reps_start: p.reps_start || "", reps_end: p.reps_end || "" }));
    const days = tpl.plan_template_days || [];
    const n = Math.min(MAX_WEEKS, Math.max(1, phaseWeeksTotal(phases) || Math.max(4, ...days.map((d) => d.week_index))));
    const data = emptyWeeks(n);
    [...days].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).forEach((d) => {
      const w = data[d.week_index - 1];
      if (w) w[d.day_label] = [...(w[d.day_label] || []), d.routine_id];
    });
    setEditing({ id: null, name: tpl.name, start: suggestedStart(plans), weeks: n, data, phases, weekOv: {}, loads: [], cells: {} });
    setWeek(0);
    setTab("rutinas");
  };

  const saveAsTemplate = async (plan) => {
    const name = prompt("Nombre de la plantilla:", plan.name || `Plan de ${plan.weeks} semanas`);
    if (!name || !name.trim()) return;
    const { data: ph } = await supabase.from("training_plan_phases").select("*").eq("plan_id", plan.id).order("order_index");
    const { data: tpl, error } = await supabase.from("plan_templates").insert({ name: name.trim().slice(0, 80) }).select("id").single();
    if (error || !tpl) return alert("No se pudo crear la plantilla.");
    const phaseRows = (ph || []).map((p) => ({ template_id: tpl.id, order_index: p.order_index, phase_type: p.phase_type, name: p.name, weeks: p.weeks, pct_start: p.pct_start, pct_end: p.pct_end, reps_start: p.reps_start, reps_end: p.reps_end }));
    const dayRows = (plan.training_plan_days || []).map((d) => ({ template_id: tpl.id, week_index: d.week_index, day_label: d.day_label, routine_id: d.routine_id, order_index: d.order_index ?? 0 }));
    const res = await Promise.all([
      phaseRows.length ? supabase.from("plan_template_phases").insert(phaseRows) : { error: null },
      dayRows.length ? supabase.from("plan_template_days").insert(dayRows) : { error: null },
    ]);
    if (res.some((r) => r.error)) alert("La plantilla se creó, pero hubo un error con sus fases o rutinas.");
    else alert(`Plantilla "${name.trim()}" guardada. La encontrás en "Nuevo plan desde plantilla" de cualquier alumno.`);
    load();
  };

  const deleteTemplate = async (tpl) => {
    if (!confirm(`¿Eliminar la plantilla "${tpl.name}"? Los planes creados con ella no cambian.`)) return;
    const { error } = await supabase.from("plan_templates").delete().eq("id", tpl.id);
    if (error) return alert("No se pudo eliminar la plantilla.");
    load();
  };

  const startEdit = async (plan) => {
    const [{ data: ph }, { data: wk }, { data: ld }, { data: cl }] = await Promise.all([
      supabase.from("training_plan_phases").select("*").eq("plan_id", plan.id).order("order_index"),
      supabase.from("training_plan_weeks").select("*").eq("plan_id", plan.id),
      supabase.from("training_plan_loads").select("*").eq("plan_id", plan.id),
      supabase.from("training_plan_load_cells").select("*").eq("plan_id", plan.id),
    ]);
    const weekOv = {};
    (wk || []).forEach((r) => { weekOv[r.week_index] = { pct: str(r.pct), reps: r.reps || "" }; });
    const cells = {};
    (cl || []).forEach((c) => { cells[cellKey(c.exercise_id, c.week_index)] = { value: str(c.value), reps: c.reps || "" }; });
    setEditing({
      id: plan.id, name: plan.name || "", start: plan.start_date, weeks: plan.weeks, data: weeksFromPlan(plan),
      phases: (ph || []).map((p) => ({ phase_type: p.phase_type, name: p.name || "", weeks: str(p.weeks), pct_start: str(p.pct_start), pct_end: str(p.pct_end), reps_start: p.reps_start || "", reps_end: p.reps_end || "" })),
      weekOv,
      loads: (ld || []).map((l) => ({ exercise_id: l.exercise_id, from_week: l.from_week, base_type: l.base_type, weight_kg: str(l.weight_kg), reps: str(l.reps), rounding: Number(l.rounding) || 2.5 })),
      cells,
    });
    setWeek(0);
    setTab("rutinas");
  };

  const setWeeks = (n) =>
    setEditing((e) => ({ ...e, weeks: n, data: Array.from({ length: n }, (_, i) => e.data[i] || {}) }));
  // Con fases, la duración del plan es la suma de sus semanas
  const setPhases = (phases) =>
    setEditing((e) => {
      const n = phases.length > 0 ? Math.min(MAX_WEEKS, Math.max(1, phaseWeeksTotal(phases))) : e.weeks;
      return { ...e, phases, weeks: n, data: Array.from({ length: n }, (_, i) => e.data[i] || {}) };
    });
  // Repetir la semana actual: se duplica (rutinas, % y pesos escritos) y las siguientes se corren una semana
  const repeatWeek = () =>
    setEditing((e) => {
      if (e.weeks >= MAX_WEEKS) return e;
      const at = week + 1; // semana (1..n) que se repite
      const data = [...e.data.slice(0, at), JSON.parse(JSON.stringify(e.data[week] || {})), ...e.data.slice(at)];
      const weekOv = shiftWeekKeys(e.weekOv, at + 1, 1);
      if (e.weekOv[at]) weekOv[at + 1] = { ...e.weekOv[at] };
      const cells = shiftCells(e.cells, at + 1, 1);
      Object.entries(e.cells).forEach(([k, v]) => { const [ex, w] = k.split(":"); if (Number(w) === at) cells[cellKey(ex, at + 1)] = { ...v }; });
      const loads = e.loads.map((l) => (Number(l.from_week) > at ? { ...l, from_week: Number(l.from_week) + 1 } : l));
      let phases = e.phases;
      if (phases.length > 0) {
        let cursor = 0;
        phases = phases.map((p) => {
          const n = Number(p.weeks) || 0;
          const hit = at > cursor && at <= cursor + n;
          cursor += n;
          return hit ? { ...p, weeks: String(n + 1) } : p;
        });
      }
      return { ...e, weeks: e.weeks + 1, data, weekOv, cells, loads, phases };
    });
  // Quitar la semana actual: las siguientes se corren hacia atrás
  const removeWeek = () =>
    setEditing((e) => {
      if (e.weeks <= 1) return e;
      const at = week + 1;
      const weekOv = shiftWeekKeys(Object.fromEntries(Object.entries(e.weekOv).filter(([k]) => Number(k) !== at)), at + 1, -1);
      const cells = shiftCells(Object.fromEntries(Object.entries(e.cells).filter(([k]) => Number(k.split(":")[1]) !== at)), at + 1, -1);
      const loads = e.loads.map((l) => (Number(l.from_week) > at ? { ...l, from_week: Number(l.from_week) - 1 } : l));
      let phases = e.phases;
      if (phases.length > 0) {
        let cursor = 0;
        phases = phases
          .map((p) => {
            const n = Number(p.weeks) || 0;
            const hit = at > cursor && at <= cursor + n;
            cursor += n;
            return hit ? { ...p, weeks: String(n - 1) } : p;
          })
          .filter((p) => Number(p.weeks) > 0);
      }
      return { ...e, weeks: e.weeks - 1, data: e.data.filter((_, i) => i !== week), weekOv, cells, loads, phases };
    });
  const setDay = (day, list) =>
    setEditing((e) => ({ ...e, data: e.data.map((w, i) => (i === week ? { ...w, [day]: list } : w)) }));
  const copyWeek = (toAll) =>
    setEditing((e) => ({
      ...e,
      data: e.data.map((w, i) => (i === week + 1 || (toAll && i > week) ? JSON.parse(JSON.stringify(e.data[week])) : w)),
    }));
  const fillFromFixed = () => {
    const map = {};
    [...fixed].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).forEach((a) => {
      if (a.routine_id) map[a.day_label] = [...(map[a.day_label] || []), a.routine_id];
    });
    setEditing((e) => ({ ...e, data: e.data.map((w, i) => (i === week ? map : w)) }));
  };
  const clearWeek = () => setEditing((e) => ({ ...e, data: e.data.map((w, i) => (i === week ? {} : w)) }));

  // El plan siempre empieza un lunes
  const startMonday = editing ? localDateString(mondayOf(parseDate(editing.start || localDateString()))) : null;

  const save = async () => {
    const candidate = { start_date: startMonday, weeks: editing.weeks };
    const clash = plans.find((p) => p.id !== editing.id && plansOverlap(p, candidate));
    if (clash) return alert(`Las fechas se cruzan con otro plan (${fmtDay(planStart(clash))} – ${fmtDay(planLastDay(clash), true)}). Cambiá la fecha de inicio o la cantidad de semanas.`);
    const total = editing.data.reduce((s, w) => s + Object.values(w).reduce((x, l) => x + l.length, 0), 0);
    if (total === 0 && !confirm("El plan no tiene ninguna rutina. ¿Guardarlo igual?")) return;

    setSaving(true);
    const row = { user_id: student.id, name: editing.name.trim() || null, start_date: startMonday, weeks: editing.weeks };
    let planId = editing.id;
    if (planId) {
      const { error } = await supabase.from("training_plans").update(row).eq("id", planId);
      if (error) { setSaving(false); return alert("No se pudo guardar el plan: "); }
      const { error: delErr } = await supabase.from("training_plan_days").delete().eq("plan_id", planId);
      if (delErr) { setSaving(false); return alert("No se pudieron actualizar los días: "); }
    } else {
      const { data, error } = await supabase.from("training_plans").insert(row).select("id").single();
      if (error || !data) { setSaving(false); return alert("No se pudo crear el plan."); }
      planId = data.id;
    }
    const rows = [];
    editing.data.forEach((w, i) => {
      WEEK_DAYS.forEach((day) => {
        (w[day] || []).forEach((rid, order) => rows.push({ plan_id: planId, week_index: i + 1, day_label: day, routine_id: rid, order_index: order }));
      });
    });
    if (rows.length > 0) {
      const { error } = await supabase.from("training_plan_days").insert(rows);
      if (error) { setSaving(false); return alert("El plan se guardó, pero hubo un error con los días: "); }
    }

    // Fases, % por semana, bases de carga y casillas escritas a mano
    const n = editing.weeks;
    const del = await Promise.all(
      ["training_plan_phases", "training_plan_weeks", "training_plan_loads", "training_plan_load_cells"].map((t) => supabase.from(t).delete().eq("plan_id", planId))
    );
    if (del.some((r) => r.error)) { setSaving(false); return alert("El plan se guardó, pero no se pudieron actualizar las fases y cargas."); }
    const phaseRows = editing.phases
      .filter((p) => Number(p.weeks) > 0)
      .map((p, i) => ({ plan_id: planId, order_index: i, phase_type: p.phase_type, name: p.name.trim() || null, weeks: Number(p.weeks), pct_start: nOrNull(p.pct_start), pct_end: nOrNull(p.pct_end), reps_start: p.reps_start.trim() || null, reps_end: p.reps_end.trim() || null }));
    const weekRows = Object.entries(editing.weekOv)
      .filter(([w]) => Number(w) <= n)
      .map(([w, v]) => ({ plan_id: planId, week_index: Number(w), pct: nOrNull(v.pct), reps: (v.reps || "").trim() || null }))
      .filter((r) => r.pct != null || r.reps);
    const seenBase = new Set();
    const loadRows = editing.loads
      .filter((l) => nOrNull(l.weight_kg) > 0 && Number(l.from_week) <= n && (l.base_type === "rm" || Number(l.reps) > 0))
      .filter((l) => { const k = `${l.exercise_id}:${l.from_week}`; if (seenBase.has(k)) return false; seenBase.add(k); return true; })
      .map((l) => ({ plan_id: planId, exercise_id: l.exercise_id, from_week: Number(l.from_week) || 1, base_type: l.base_type, weight_kg: nOrNull(l.weight_kg), reps: l.base_type === "work" ? Number(l.reps) : null, rounding: Number(l.rounding) || 2.5 }));
    const cellRows = Object.entries(editing.cells)
      .map(([k, v]) => { const [ex, w] = k.split(":"); return { plan_id: planId, exercise_id: ex, week_index: Number(w), value_type: "kg", value: nOrNull(v.value), reps: (v.reps || "").trim() || null }; })
      .filter((c) => c.week_index <= n && (c.value != null || c.reps));
    const inserts = [
      ["training_plan_phases", phaseRows], ["training_plan_weeks", weekRows], ["training_plan_loads", loadRows], ["training_plan_load_cells", cellRows],
    ].filter(([, r]) => r.length > 0);
    const res = await Promise.all(inserts.map(([t, r]) => supabase.from(t).insert(r)));
    if (res.some((r) => r.error)) { setSaving(false); return alert("El plan se guardó, pero hubo un error con las fases o las cargas."); }
    setSaving(false);
    setEditing(null);
    load();
  };

  const remove = async (plan) => {
    if (!confirm(`¿Eliminar el plan del ${fmtDay(planStart(plan))} al ${fmtDay(planLastDay(plan), true)}? El alumno vuelve a ver sus días fijos en esas fechas. Su historial de entrenamientos se conserva.`)) return;
    const { error } = await supabase.from("training_plans").delete().eq("id", plan.id);
    if (error) return alert("No se pudo eliminar: ");
    load();
  };

  const pdf = async (plan) => {
    setPdfBusy(plan.id);
    try {
      await downloadPlanPdf({ supabase, userId: student.id, plan, studentName: student.name, includeLoads: true });
    } catch {
      alert("No se pudo generar el PDF: ");
    }
    setPdfBusy(null);
  };

  const input = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";
  const chip = "bg-field text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink disabled:opacity-40";

  if (editing) {
    const wStart = addDays(parseDate(startMonday), week * 7);
    const countOf = (w) => Object.values(w).reduce((x, l) => x + l.length, 0);
    const weeksInfo = planWeeks(editing.phases, editing.weeks, editing.weekOv);
    return (
      <PanelLayout title={editing.id ? "Editar plan" : "Nuevo plan"} subtitle={student.name} onClose={() => setEditing(null)} width="max-w-4xl">
        <div className="bg-card rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-muted text-xs">Nombre del plan (opcional)</span>
            <input value={editing.name} maxLength={80} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: Mes 1 · Fuerza" className={`${input} mt-1`} />
          </label>
          <label className="block">
            <span className="text-muted text-xs">Empieza</span>
            <input type="date" value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} className={`${input} mt-1`} />
            <span className="text-muted text-[11px]">
              Siempre arranca un lunes: {fmtDay(parseDate(startMonday))} → termina el {fmtDay(addDays(parseDate(startMonday), editing.weeks * 7 - 1), true)}
            </span>
          </label>
          <label className="block">
            <span className="text-muted text-xs">Duración</span>
            {editing.phases.length > 0 ? (
              <p className={`${input} mt-1 text-soft`}>{editing.weeks} semanas (suma de las fases)</p>
            ) : (
              <select value={editing.weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={`${input} mt-1`}>
                {Array.from({ length: MAX_WEEKS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? "semana" : "semanas"}{n === 4 ? " (1 mes)" : n === 6 ? " (mes y medio)" : ""}</option>
                ))}
              </select>
            )}
          </label>
        </div>

        <div className="bg-card rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-ink text-sm font-medium flex items-center gap-2"><Layers size={15} className="text-accent" /> Fases</p>
            {editing.phases.length === 0 && (
              <button onClick={() => setPhases(ATR_PRESET())} className={chip}>Usar ATR (4 · 3 · 2 semanas)</button>
            )}
          </div>
          <p className="text-muted text-xs mb-3">
            Cada fase tiene su % del RM de inicio y de fin: la app los reparte entre sus semanas y calcula los pesos en Cargas. Sin fases, el plan es solo de rutinas.
          </p>
          <PlanPhasesEditor phases={editing.phases} onChange={setPhases} />
        </div>

        <div className="flex gap-1 bg-card rounded-xl p-1 mb-4">
          {[["rutinas", "Rutinas por semana"], ["cargas", "Cargas"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === k ? "bg-accent text-app" : "text-soft hover:text-ink"}`}>{l}</button>
          ))}
        </div>

        {tab === "cargas" ? (
          <div className="mb-6">
            <PlanLoadsEditor
              weeks={weeksInfo}
              exercises={planExercises}
              loads={editing.loads}
              cells={editing.cells}
              weekOv={editing.weekOv}
              onLoads={(loads) => setEditing((e) => ({ ...e, loads }))}
              onCells={(cells) => setEditing((e) => ({ ...e, cells }))}
              onWeekOv={(weekOv) => setEditing((e) => ({ ...e, weekOv }))}
            />
          </div>
        ) : (
        <>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
          {editing.data.map((w, i) => {
            const info = weeksInfo[i];
            const color = info?.phase ? phaseType(info.phase.phase_type).color : null;
            return (
              <button key={i} onClick={() => setWeek(i)} style={color ? { boxShadow: `inset 0 -3px 0 ${color}` } : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${i === week ? "bg-accent text-app" : "bg-card text-soft"}`}>
                Semana {i + 1}
                <span className={`ml-1.5 tabular-nums ${i === week ? "text-app/70" : "text-muted"}`}>{countOf(w)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-muted text-xs mb-3">
          Semana {week + 1}: {fmtDay(wStart)} – {fmtDay(addDays(wStart, 6), true)}
          {weeksInfo[week]?.phase ? ` · ${weeksInfo[week].phase.name || phaseType(weeksInfo[week].phase.phase_type).label}${weeksInfo[week].pct != null ? ` · ${String(weeksInfo[week].pct).replace(".", ",")}%` : ""}` : ""}. Los días sin rutina son de descanso.
        </p>

        <DayRoutinesEditor days={editing.data[week] || {}} routines={routines} onChangeDay={setDay} savingDay={null} emptyLabel="Descanso" />

        <div className="flex flex-wrap gap-2 mt-3 mb-6">
          <button onClick={() => copyWeek(false)} disabled={week >= editing.weeks - 1} className={chip}><Copy size={13} /> Copiar a la semana {week + 2 <= editing.weeks ? week + 2 : ""}</button>
          <button onClick={() => copyWeek(true)} disabled={week >= editing.weeks - 1} className={chip}><Copy size={13} /> Copiar a todas las siguientes</button>
          {fixed.length > 0 && <button onClick={fillFromFixed} className={chip}><CalendarDays size={13} /> Traer sus días fijos</button>}
          <button onClick={clearWeek} className={`${chip} hover:text-danger`}><Trash2 size={13} /> Vaciar semana</button>
          <button onClick={repeatWeek} disabled={editing.weeks >= MAX_WEEKS} className={chip} title="Duplica esta semana y corre las siguientes"><CopyPlus size={13} /> Repetir esta semana</button>
          <button onClick={() => { if (confirm(`¿Quitar la semana ${week + 1}? Las siguientes se corren una semana antes.`)) { removeWeek(); setWeek((w) => Math.max(0, Math.min(w, editing.weeks - 2))); } }} disabled={editing.weeks <= 1} className={`${chip} hover:text-danger`}><Minus size={13} /> Quitar esta semana</button>
        </div>
        </>
        )}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar plan"}
          </button>
          <button onClick={() => setEditing(null)} className="text-muted text-sm px-4">Cancelar</button>
        </div>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout title="Plan de entrenamiento" subtitle={student.name} onClose={onClose}>
      <p className="text-soft text-sm mb-4">
        Armá el plan por semanas: fases (ATR), la rutina de cada día y las cargas, que se calculan solas desde el RM. Mientras el plan está activo reemplaza sus días fijos y avanza solo cada lunes.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={startNew} className="bg-accent text-app font-semibold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2">
          <Plus size={16} /> Nuevo plan
        </button>
        {templates.length > 0 && (
          <select value="" onChange={(e) => { const tpl = templates.find((x) => String(x.id) === e.target.value); if (tpl) startFromTemplate(tpl); }}
            className="bg-field text-ink text-sm rounded-lg px-3 py-2.5 outline-none">
            <option value="">Nuevo plan desde plantilla...</option>
            {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-muted text-sm">Cargando...</p>
      ) : plans.length === 0 ? (
        <p className="text-muted text-sm bg-card rounded-xl p-4">Todavía no tiene planes. Mientras tanto ve sus días fijos.</p>
      ) : (
        <div className="space-y-3">
          {[...plans].reverse().map((p) => {
            const st = planStatus(p);
            const count = (p.training_plan_days || []).length;
            return (
              <div key={p.id} className="bg-card rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium truncate">{p.name || `Plan de ${p.weeks} semanas`}</p>
                    <p className="text-muted text-xs mt-0.5">
                      {fmtDay(planStart(p))} – {fmtDay(planLastDay(p), true)} · {p.weeks} semanas · {count} {count === 1 ? "rutina asignada" : "rutinas asignadas"}
                    </p>
                    <p className={`text-xs mt-1 ${st.tone}`}>{st.label}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => startEdit(p)} className={chip}><Pencil size={13} /> Editar</button>
                  <button onClick={() => pdf(p)} disabled={pdfBusy === p.id} className={chip}><Download size={13} /> {pdfBusy === p.id ? "Generando..." : "PDF"}</button>
                  <button onClick={() => saveAsTemplate(p)} className={chip}><Copy size={13} /> Guardar como plantilla</button>
                  <button onClick={() => remove(p)} className={`${chip} hover:text-danger`}><Trash2 size={13} /> Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {templates.length > 0 && (
        <div className="mt-8">
          <p className="text-ink text-sm font-medium mb-2">Plantillas</p>
          <div className="bg-card rounded-xl">
            {templates.map((tpl) => {
              const ph = [...(tpl.plan_template_phases || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
              const weeksN = ph.reduce((x, p) => x + (p.weeks || 0), 0);
              const routinesN = (tpl.plan_template_days || []).length;
              return (
                <div key={tpl.id} className="px-4 py-3 border-b border-field last:border-0 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-sm truncate">{tpl.name}</p>
                    <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5 max-w-xs bg-field">
                      {ph.map((p, i) => <span key={i} style={{ flex: p.weeks || 1, background: phaseType(p.phase_type).color }} />)}
                    </div>
                    <p className="text-muted text-[11px] mt-1">{weeksN ? `${weeksN} semanas · ` : ""}{ph.length} {ph.length === 1 ? "fase" : "fases"} · {routinesN} {routinesN === 1 ? "rutina" : "rutinas"}</p>
                  </div>
                  <button onClick={() => startFromTemplate(tpl)} className={chip}><Plus size={13} /> Usar</button>
                  <button onClick={() => deleteTemplate(tpl)} aria-label="Eliminar plantilla" className={`${chip} hover:text-danger`}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PanelLayout>
  );
}
