"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Copy, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { WEEK_DAYS, localDateString } from "@/lib/dates";
import { supabase } from "@/lib/supabaseClient";
import { PLAN_WEEK_OPTIONS, addDays, loadSchedule, mondayOf, parseDate, planLastDay, planStart, planWeekOf, plansOverlap, suggestedStart } from "@/lib/trainingPlan";
import { downloadPlanPdf } from "@/lib/planPdf";
import { DayRoutinesEditor } from "@/components/coach/programs/DayRoutinesEditor";
import { PanelLayout } from "./PanelLayout";

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

// Coach → alumno → Plan: plan de 4 a 8 semanas, con la rutina de cada día de cada semana
export function PlanPanel({ student, onClose }) {
  const [plans, setPlans] = useState([]);
  const [fixed, setFixed] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id?, name, start, weeks, data: [...] }
  const [week, setWeek] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(null);

  async function load() {
    setLoading(true);
    const [schedule, { data: lib }] = await Promise.all([
      loadSchedule(supabase, student.id, "id, title"),
      supabase.from("routines").select("id, title, level, goal").order("title"),
    ]);
    setPlans(schedule.plans);
    setFixed(schedule.fixed);
    setRoutines(lib || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [student.id]);

  const startNew = () => {
    setEditing({ id: null, name: "", start: suggestedStart(plans), weeks: 4, data: emptyWeeks(4) });
    setWeek(0);
  };
  const startEdit = (plan) => {
    setEditing({ id: plan.id, name: plan.name || "", start: plan.start_date, weeks: plan.weeks, data: weeksFromPlan(plan) });
    setWeek(0);
  };

  const setWeeks = (n) =>
    setEditing((e) => ({ ...e, weeks: n, data: Array.from({ length: n }, (_, i) => e.data[i] || {}) }));
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
      await downloadPlanPdf({ supabase, userId: student.id, plan, studentName: student.name });
    } catch (e) {
      alert("No se pudo generar el PDF: ");
    }
    setPdfBusy(null);
  };

  const input = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";
  const chip = "bg-field text-soft text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 hover:text-ink disabled:opacity-40";

  if (editing) {
    const wStart = addDays(parseDate(startMonday), week * 7);
    const countOf = (w) => Object.values(w).reduce((x, l) => x + l.length, 0);
    return (
      <PanelLayout title={editing.id ? "Editar plan" : "Nuevo plan"} subtitle={student.name} onClose={() => setEditing(null)} width="max-w-2xl">
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
            <select value={editing.weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={`${input} mt-1`}>
              {PLAN_WEEK_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} semanas{n === 4 ? " (1 mes)" : n === 6 ? " (mes y medio)" : ""}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
          {editing.data.map((w, i) => (
            <button key={i} onClick={() => setWeek(i)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${i === week ? "bg-accent text-app" : "bg-card text-soft"}`}>
              Semana {i + 1}
              <span className={`ml-1.5 tabular-nums ${i === week ? "text-app/70" : "text-muted"}`}>{countOf(w)}</span>
            </button>
          ))}
        </div>
        <p className="text-muted text-xs mb-3">
          Semana {week + 1}: {fmtDay(wStart)} – {fmtDay(addDays(wStart, 6), true)}. Los días sin rutina son de descanso.
        </p>

        <DayRoutinesEditor days={editing.data[week] || {}} routines={routines} onChangeDay={setDay} savingDay={null} emptyLabel="Descanso" />

        <div className="flex flex-wrap gap-2 mt-3 mb-6">
          <button onClick={() => copyWeek(false)} disabled={week >= editing.weeks - 1} className={chip}><Copy size={13} /> Copiar a la semana {week + 2 <= editing.weeks ? week + 2 : ""}</button>
          <button onClick={() => copyWeek(true)} disabled={week >= editing.weeks - 1} className={chip}><Copy size={13} /> Copiar a todas las siguientes</button>
          {fixed.length > 0 && <button onClick={fillFromFixed} className={chip}><CalendarDays size={13} /> Traer sus días fijos</button>}
          <button onClick={clearWeek} className={`${chip} hover:text-danger`}><Trash2 size={13} /> Vaciar semana</button>
        </div>

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
        Armá un plan de 4 a 8 semanas con la rutina de cada día. Mientras el plan está activo reemplaza sus días fijos y el alumno lo ve en su calendario.
      </p>
      <button onClick={startNew} className="bg-accent text-app font-semibold px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 mb-5">
        <Plus size={16} /> Nuevo plan
      </button>

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
                  <button onClick={() => remove(p)} className={`${chip} hover:text-danger`}><Trash2 size={13} /> Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelLayout>
  );
}
