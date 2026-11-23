"use client";

import { useEffect, useState } from "react";
import { BookOpen, Eye, Pencil, Plus, Timer, Trash2, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { libraryRoutines } from "@/lib/libraryRoutines";
import { WEEK_DAYS, localDateString } from "@/lib/dates";
import { addDays, mondayOf, parseDate, planFor, planLastDay } from "@/lib/trainingPlan";
import { blockTypeLabel } from "@/lib/blocks";
import { loadTimers, timersFor } from "@/lib/routineTimers";
import { timerLabel } from "@/lib/clock";
import { BlockEditor } from "@/components/coach/routines/BlockEditor";
import { defaultBlockTitle, listToBlocks, loadRoutineContent, tmpKey, writeRoutineContent } from "@/components/coach/routines/routineHelpers";
import { SearchSelect } from "@/components/ui/Search";
import { Skeleton } from "@/components/ui/Skeleton";
import { PanelLayout } from "./PanelLayout";

const DAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
const QUICK_TYPES = [
  ["remate", "Remate"],
  ["intermitentes", "Intermitente"],
  ["principal", "Entreno adicional"],
];
const fmtDate = (s) => parseDate(s).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

function newQuickBlock(type) {
  return { key: tmpKey(), block_type: type, title: defaultBlockTitle(type, []), sets: "", notes: "", exercises: [], timer: type === "intermitentes" ? { mode: "tabata", work: 40, rest: 20, rounds: 10 } : null };
}

function status(x, today) {
  if (x.end_date < today) return { label: "Terminado", cls: "text-muted" };
  if (x.start_date > today) return { label: `Empieza el ${fmtDate(x.start_date)}`, cls: "text-warning" };
  return { label: "Activo", cls: "text-accent" };
}

// Extras de un alumno: remates, intermitentes o entrenos adicionales que se SUMAN a su día.
// No cambian su planeación (ATR): ni semanas, ni cargas, ni ejercicios del plan.
export function ExtrasPanel({ student, onClose, onOpenPanel }) {
  const [extras, setExtras] = useState(null);
  const [timers, setTimers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [library, setLibrary] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(null); // formulario de nuevo / editar
  const [saving, setSaving] = useState(false);
  const today = localDateString();

  async function load() {
    const [{ data, error }, { data: planRows }] = await Promise.all([
      supabase.from("student_extras").select("*, routines(id, title, student_id, routine_blocks(block_type, order_index))").eq("user_id", student.id).order("start_date", { ascending: false }),
      supabase.from("training_plans").select("id, name, start_date, weeks").eq("user_id", student.id),
    ]);
    if (error) {
      setExtras(false);
      return;
    }
    setExtras(data || []);
    setPlans(planRows || []);
    setTimers(await loadTimers(supabase, (data || []).map((x) => x.routine_id), student.id));
  }
  useEffect(() => { load(); }, [student.id]);

  useEffect(() => {
    if (!form || library.length) return;
    Promise.all([
      libraryRoutines(supabase, "id, title, goal", (q) => q.order("title"), { withArchived: true }),
      supabase.from("exercises").select("id, name, muscle_group").order("name"),
    ]).then(([{ data: r }, { data: c }]) => {
      setLibrary(r || []);
      setCatalog(c || []);
    });
  }, [form]);

  const activePlan = planFor(plans, new Date());
  const rangeOptions = [
    ["Solo esta semana", localDateString(addDays(mondayOf(new Date()), 6))],
    ["4 semanas", localDateString(addDays(mondayOf(new Date()), 27))],
    ...(activePlan ? [["Hasta que termine el plan", localDateString(planLastDay(activePlan))]] : []),
  ];

  const startNew = (type) => setForm({
    id: null,
    source: "quick",
    routineId: "",
    privateRoutineId: null,
    title: QUICK_TYPES.find(([k]) => k === type)?.[1] || "Extra",
    blocks: [newQuickBlock(type)],
    days: [WEEK_DAYS[(new Date().getDay() + 6) % 7]],
    start: today,
    end: rangeOptions[rangeOptions.length - 1][1],
  });

  const startEdit = async (x) => {
    const isPrivate = !!x.routines?.student_id;
    const base = { id: x.id, routineId: isPrivate ? "" : x.routine_id, privateRoutineId: isPrivate ? x.routine_id : null, title: x.routines?.title || "", days: x.days || [], start: x.start_date, end: x.end_date, blocks: [] };
    if (!isPrivate) return setForm({ ...base, source: "library" });
    const content = await loadRoutineContent(x.routine_id);
    setForm({ ...base, source: "quick", blocks: content.blocks });
  };

  // Trae una rutina, intermitente o remate de la biblioteca para editarlo SOLO para este alumno:
  // se copia como bloque propio del alumno (la de la biblioteca no cambia).
  const [copying, setCopying] = useState(false);
  const copyFromLibrary = async (routineId) => {
    if (!routineId) return;
    const f = form;
    if (f.source === "quick" && f.blocks.some((b) => b.exercises.length > 0) && !confirm("Se reemplaza lo que armaste por la rutina elegida. ¿Seguir?")) return;
    setCopying(true);
    try {
      const content = await loadRoutineContent(routineId);
      const strip = (arr) => (arr || []).map((e) => ({ ...e, itemKey: null }));
      let blocks = content.mode === "bloques"
        ? content.blocks.map((b) => ({ ...b, key: tmpKey(), exercises: strip(b.exercises) }))
        : listToBlocks(strip(content.list));
      if (content.mode !== "bloques" && content.timer && blocks[0]) blocks = blocks.map((b, i) => (i === 0 ? { ...b, timer: content.timer } : b));
      if (!blocks.length) blocks = [newQuickBlock("remate")];
      const title = library.find((r) => r.id === routineId)?.title || f.title;
      setForm((x) => ({ ...x, source: "quick", routineId: "", title, blocks }));
    } catch {
      alert("No se pudo traer la rutina.");
    }
    setCopying(false);
  };

  const toggleDay = (d) => setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : WEEK_DAYS.filter((w) => w === d || f.days.includes(w)) }));

  const save = async () => {
    const f = form;
    if (f.days.length === 0) return alert("Elegí al menos un día.");
    if (!f.start || !f.end || f.end < f.start) return alert("Revisá las fechas: «Hasta» tiene que ser igual o después de «Desde».");
    if (f.source === "library" && !f.routineId) return alert("Elegí una rutina de la biblioteca.");
    if (f.source === "quick" && !f.blocks.some((b) => b.exercises.length > 0)) return alert("Agregá al menos un ejercicio al bloque.");
    setSaving(true);
    try {
      let routineId = f.routineId;
      if (f.source === "quick") {
        routineId = f.privateRoutineId;
        const title = f.title.trim() || blockTypeLabel(f.blocks[0]?.block_type) || "Extra";
        if (!routineId) {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: r, error } = await supabase
            .from("routines")
            .insert({ title, level: "intermedio", goal: "Extra", duration_minutes: 0, created_by: user?.id, student_id: student.id })
            .select("id")
            .single();
          if (error || !r) throw new Error("No se pudo crear el bloque. Revisá que el SQL de extras esté aplicado en Supabase.");
          routineId = r.id;
        } else {
          await supabase.from("routines").update({ title }).eq("id", routineId);
        }
        const err = await writeRoutineContent(routineId, "bloques", [], f.blocks);
        if (err) throw new Error("No se pudieron guardar los ejercicios: " + (err.message || ""));
      }
      const row = { user_id: student.id, routine_id: routineId, days: f.days, start_date: f.start, end_date: f.end };
      const { error } = f.id
        ? await supabase.from("student_extras").update(row).eq("id", f.id)
        : await supabase.from("student_extras").insert(row);
      if (error) throw new Error("No se pudo guardar el extra. Revisá que el SQL de extras esté aplicado en Supabase.");
      // Si antes era un bloque armado acá y ahora es de la biblioteca, se borra el bloque privado
      if (f.source === "library" && f.privateRoutineId) await supabase.from("routines").delete().eq("id", f.privateRoutineId);
      setForm(null);
      load();
    } catch (e) {
      alert(e.message || "No se pudo guardar.");
    }
    setSaving(false);
  };

  const remove = async (x) => {
    if (!confirm(`¿Eliminar el extra «${x.routines?.title || "Extra"}»? Su plan no cambia.`)) return;
    const { error } = x.routines?.student_id
      ? await supabase.from("routines").delete().eq("id", x.routine_id) // el bloque privado se borra con su extra
      : await supabase.from("student_extras").delete().eq("id", x.id);
    if (error) return alert("No se pudo eliminar.");
    load();
  };

  const createExercise = async (name, group) => {
    const { data, error } = await supabase.from("exercises").insert({ name: name.trim(), muscle_group: group?.trim() || null, video_url: null }).select("id, name, muscle_group").single();
    if (error || !data) {
      alert("No se pudo crear el ejercicio.");
      return null;
    }
    setCatalog((c) => [...c, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const tab = (on) => `flex-1 text-sm rounded-lg py-2 flex items-center justify-center gap-1.5 ${on ? "bg-accent text-app font-semibold" : "text-soft hover:text-ink"}`;
  const input = "bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";

  if (form) {
    return (
      <PanelLayout title={form.id ? "Editar extra" : "Nuevo extra"} subtitle={student.isSelf ? "Mi entrenamiento" : student.name} onClose={() => setForm(null)} width="max-w-2xl">
        <p className="text-muted text-xs mb-4">Se suma al final del día del alumno. Su planeación (fases, cargas, series y ejercicios del ATR) no cambia.</p>

        <div className="flex gap-1 bg-card rounded-xl p-1 mb-4">
          <button type="button" onClick={() => setForm((f) => ({ ...f, source: "quick", blocks: f.blocks.length ? f.blocks : [newQuickBlock("remate")] }))} className={tab(form.source === "quick")}><Wrench size={14} /> Armarlo aquí</button>
          <button type="button" onClick={() => setForm((f) => ({ ...f, source: "library" }))} className={tab(form.source === "library")}><BookOpen size={14} /> Rutina de la biblioteca</button>
        </div>

        {form.source === "library" ? (
          <div className="mb-5">
            <p className="text-soft text-xs mb-1.5">Rutina</p>
            <SearchSelect
              options={library.filter((r) => !r.archived_at || r.id === form.routineId).map((r) => ({ value: r.id, label: `${r.title}${r.archived_at ? " (versión anterior)" : ""}`, sub: r.goal || "" }))}
              value={form.routineId}
              onChange={(id) => setForm((f) => ({ ...f, routineId: id }))}
              placeholder="Buscar rutina..."
            />
            <p className="text-muted text-[11px] mt-1.5">Se usa tal como está en la biblioteca (con su reloj programado, si tiene). Las cargas del ATR no se aplican.</p>
            {form.routineId && (
              <button type="button" onClick={() => copyFromLibrary(form.routineId)} disabled={copying} className="mt-3 w-full flex items-center justify-center gap-1.5 bg-card border border-accent/30 text-accent text-sm font-medium rounded-xl py-2.5 disabled:opacity-60">
                <Pencil size={14} /> {copying ? "Trayendo..." : "Editarla solo para este alumno"}
              </button>
            )}
          </div>
        ) : (
          <div className="mb-2">
            <p className="text-soft text-xs mb-1.5">Partir de una rutina, intermitente o remate que ya tengas (opcional)</p>
            <SearchSelect
              options={library.filter((r) => !r.archived_at).map((r) => ({ value: r.id, label: r.title, sub: r.goal || "" }))}
              value=""
              keepEmpty
              onChange={(id) => copyFromLibrary(id)}
              disabled={copying}
              placeholder={copying ? "Trayendo..." : "Buscar en la biblioteca para copiar y editar..."}
            />
            <p className="text-muted text-[11px] mt-1.5 mb-4">Se copia solo para este alumno: podés cambiar ejercicios, series, reps y reloj sin tocar la de la biblioteca.</p>
            <p className="text-soft text-xs mb-1.5">Nombre (lo ve el alumno)</p>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej: Remate de core" className={`${input} w-full mb-4`} />
            <BlockEditor blocks={form.blocks} setBlocks={(fn) => setForm((f) => ({ ...f, blocks: typeof fn === "function" ? fn(f.blocks) : fn }))} catalog={catalog} onCreateExercise={createExercise} />
          </div>
        )}

        <div className="bg-card rounded-xl p-4 mb-4">
          <p className="text-ink text-sm font-medium mb-2">¿Qué días?</p>
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {WEEK_DAYS.map((d, i) => {
              const on = form.days.includes(d);
              return (
                <button key={d} type="button" onClick={() => toggleDay(d)} aria-pressed={on} aria-label={d}
                  className={`rounded-lg py-2 text-sm font-semibold ${on ? "bg-accent text-app" : "bg-field text-soft hover:text-ink"}`}>{DAY_SHORT[i]}</button>
              );
            })}
          </div>
          <p className="text-ink text-sm font-medium mb-2">¿Desde cuándo y hasta cuándo?</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="text-soft text-xs">Desde
              <input type="date" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className={`${input} w-full mt-1`} />
            </label>
            <label className="text-soft text-xs">Hasta
              <input type="date" value={form.end} min={form.start} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} className={`${input} w-full mt-1`} />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rangeOptions.map(([label, end]) => (
              <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, end, start: f.start > end ? today : f.start }))}
                className={`text-xs rounded-full px-3 py-1.5 ${form.end === end ? "bg-accent/15 text-accent" : "bg-field text-soft hover:text-ink"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setForm(null)} className="flex-1 bg-field text-soft text-sm rounded-xl py-3">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-accent text-app font-semibold text-sm rounded-xl py-3 disabled:opacity-60">{saving ? "Guardando..." : "Guardar extra"}</button>
        </div>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout title="Extras" subtitle={student.isSelf ? "Mi entrenamiento" : student.name} onClose={onClose} width="max-w-2xl">
      <p className="text-muted text-xs mb-4">Remates, intermitentes o entrenos adicionales que se suman a su día, en los días y fechas que elijas. No cambian su planeación (ATR): ni semanas, ni cargas, ni ejercicios.</p>
      {onOpenPanel && (
        <button onClick={() => onOpenPanel("routine")} className="w-full mb-4 bg-card border border-accent/30 text-accent text-sm font-medium rounded-xl py-2.5 flex items-center justify-center gap-1.5">
          <Eye size={15} /> Ver y editar como el alumno (peso, series, ejercicios, observaciones, comentarios y reloj)
        </button>
      )}

      <div className="grid grid-cols-3 gap-2 mb-5">
        {QUICK_TYPES.map(([k, label]) => (
          <button key={k} onClick={() => startNew(k)} disabled={extras === false} className="bg-card rounded-xl p-3 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform disabled:opacity-50">
            <span className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center"><Plus size={16} className="text-accent" /></span>
            <span className="text-ink text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>

      {extras === null ? (
        <Skeleton rows={3} />
      ) : extras === false ? (
        <p className="text-warning text-sm bg-card rounded-xl p-4">Falta aplicar en Supabase el SQL de extras y reloj programado (archivo PEGAR-EN-SUPABASE.sql).</p>
      ) : extras.length === 0 ? (
        <p className="text-muted text-sm bg-card rounded-xl p-4">Todavía no tiene extras.</p>
      ) : (
        <div className="space-y-2">
          {extras.map((x) => {
            const st = status(x, today);
            const isPrivate = !!x.routines?.student_id;
            const blockTypes = [...new Set((x.routines?.routine_blocks || []).sort((a, b) => a.order_index - b.order_index).map((b) => blockTypeLabel(b.block_type)))];
            const tmap = timersFor(timers, x.routine_id, student.id);
            const timerTexts = Object.values(tmap).map((t) => timerLabel(t.timer));
            return (
              <div key={x.id} className="bg-card rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-sm font-medium truncate">{x.routines?.title || "Extra"}</p>
                    <p className="text-muted text-xs">{isPrivate ? "Armado aquí" : "Rutina de la biblioteca"}{blockTypes.length ? ` · ${blockTypes.join(", ")}` : ""}</p>
                  </div>
                  <button onClick={() => startEdit(x)} aria-label="Editar" className="w-8 h-8 rounded-lg bg-field text-soft flex items-center justify-center hover:text-ink shrink-0"><Pencil size={14} /></button>
                  <button onClick={() => remove(x)} aria-label="Eliminar" className="w-8 h-8 rounded-lg bg-field text-soft flex items-center justify-center hover:text-danger shrink-0"><Trash2 size={14} /></button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {WEEK_DAYS.map((d, i) => (
                    <span key={d} className={`w-6 h-6 rounded-md text-[11px] font-semibold flex items-center justify-center ${(x.days || []).includes(d) ? "bg-accent text-app" : "bg-field text-muted"}`}>{DAY_SHORT[i]}</span>
                  ))}
                  <span className="text-soft text-xs ml-1">{fmtDate(x.start_date)} – {fmtDate(x.end_date)}</span>
                  <span className={`text-xs ml-auto ${st.cls}`}>{st.label}</span>
                </div>
                {timerTexts.length > 0 && <p className="text-accent text-[11px] mt-1.5 flex items-center gap-1"><Timer size={12} /> {timerTexts.join(" · ")}</p>}
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => onOpenPanel?.("routine")} className="w-full mt-5 bg-field text-soft text-sm rounded-xl py-3 hover:text-ink">Ver cómo le queda el día (como lo ve el alumno)</button>
    </PanelLayout>
  );
}
