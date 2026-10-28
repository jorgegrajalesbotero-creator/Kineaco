"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { localDateString } from "@/lib/dates";
import { cleanDecimal, cleanInt, toNumber } from "@/lib/numbers";
import { PRECISIONS, buildPoints, exerciseOptionsFrom, formatEntryDate, loadExerciseEntries } from "@/lib/exerciseHistory";
import { ExerciseProgressView } from "@/components/progress/ExerciseProgressView";
import { SearchSelect } from "@/components/ui/Search";
import { Skeleton } from "@/components/ui/Skeleton";
import { PanelLayout } from "./PanelLayout";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1989 }, (_, i) => THIS_YEAR - i);
const NEW_NAME = "__nuevo__";

const emptyForm = (exercise = null) => ({
  id: null,
  exerciseValue: exercise?.exerciseId != null ? String(exercise.exerciseId) : exercise ? `${NEW_NAME}:${exercise.name}` : "",
  exerciseName: exercise?.name || "",
  precision: "month",
  day: localDateString(),
  month: new Date().getMonth(),
  year: THIS_YEAR,
  weight: "",
  reps: "",
  sets: "",
  note: "",
});

// Progreso por ejercicio del alumno, visto por el coach DÍA A DÍA,
// con el historial de antes de la app para cargar, corregir y borrar.
export function ExerciseHistoryPanel({ student, onClose }) {
  const [entries, setEntries] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [exerciseKey, setExerciseKey] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  async function load() {
    const [list, check] = await Promise.all([
      loadExerciseEntries(supabase, student.id),
      supabase.from("exercise_history").select("id", { head: true, count: "exact" }).eq("user_id", student.id),
    ]);
    setTableMissing(!!check.error);
    setEntries(list);
  }

  useEffect(() => {
    load();
    supabase.from("exercises").select("id, name, muscle_group").order("name").then(({ data }) => setCatalog(data || []));
  }, [student.id]);

  const options = useMemo(() => exerciseOptionsFrom(entries || []), [entries]);
  const activeKey = exerciseKey && options.some((o) => o.key === exerciseKey) ? exerciseKey : options[0]?.key;
  const active = options.find((o) => o.key === activeKey);
  const exEntries = useMemo(() => (entries || []).filter((e) => e.exerciseKey === activeKey), [entries, activeKey]);
  const points = useMemo(() => buildPoints(exEntries, "day"), [exEntries]);

  const set = (patch) => {
    setError("");
    setForm((f) => ({ ...f, ...patch }));
  };

  const openNew = () => {
    setError("");
    setForm(emptyForm(active ? { exerciseId: active.exerciseId, name: active.name } : null));
  };

  const openEdit = (e) => {
    setError("");
    const r = e.raw;
    const d = new Date(String(r.performed_on).slice(0, 10) + "T12:00:00");
    setForm({
      id: r.id,
      exerciseValue: r.exercise_id != null ? String(r.exercise_id) : `${NEW_NAME}:${r.exercise_name || ""}`,
      exerciseName: e.exerciseName,
      precision: r.date_precision || "day",
      day: String(r.performed_on).slice(0, 10),
      month: d.getMonth(),
      year: d.getFullYear(),
      weight: r.weight_kg != null ? String(r.weight_kg) : "",
      reps: r.reps != null ? String(r.reps) : "",
      sets: r.sets != null ? String(r.sets) : "",
      note: r.note || "",
    });
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const save = async (addAnother) => {
    if (!form.exerciseValue) return setError("Elegí el ejercicio.");
    const weight = toNumber(form.weight);
    const reps = toNumber(form.reps);
    const sets = toNumber(form.sets);
    if (weight == null && reps == null) return setError("Escribí al menos el peso o las reps.");
    let performedOn;
    if (form.precision === "day") {
      if (!form.day) return setError("Elegí la fecha.");
      if (form.day > localDateString()) return setError("La fecha no puede ser futura.");
      performedOn = form.day;
    } else if (form.precision === "month") {
      if (form.year === THIS_YEAR && form.month > new Date().getMonth()) return setError("El mes no puede ser futuro.");
      performedOn = `${form.year}-${String(form.month + 1).padStart(2, "0")}-01`;
    } else {
      performedOn = `${form.year}-01-01`;
    }
    const isFree = form.exerciseValue.startsWith(NEW_NAME);
    const freeName = isFree ? form.exerciseValue.slice(NEW_NAME.length + 1).trim() : "";
    if (isFree && !freeName) return setError("Escribí el nombre del ejercicio.");
    const exercise = isFree ? null : catalog.find((c) => String(c.id) === form.exerciseValue);
    const row = {
      user_id: student.id,
      exercise_id: isFree ? null : exercise?.id ?? form.exerciseValue,
      exercise_name: isFree ? freeName : exercise?.name || form.exerciseName || null,
      performed_on: performedOn,
      date_precision: form.precision,
      weight_kg: weight,
      reps: reps != null ? Math.round(reps) : null,
      sets: sets != null ? Math.round(sets) : null,
      note: form.note.trim() || null,
    };
    setSaving(true);
    const { error: err } = form.id
      ? await supabase.from("exercise_history").update(row).eq("id", form.id)
      : await supabase.from("exercise_history").insert(row);
    setSaving(false);
    if (err) return setError("No se pudo guardar. Revisá tu conexión y probá de nuevo.");
    setExerciseKey(row.exercise_id != null ? String(row.exercise_id) : `name:${row.exercise_name.toLowerCase()}`);
    await load();
    if (addAnother) {
      // mismo ejercicio y misma forma de fecha; se limpian los números
      setForm((f) => ({ ...f, id: null, weight: "", reps: "", sets: f.sets, note: "" }));
    } else {
      setForm(null);
    }
  };

  const remove = async (e) => {
    if (!confirm(`¿Borrar el registro de ${formatEntryDate(e.date, e.precision)}?`)) return;
    const { error: err } = await supabase.from("exercise_history").delete().eq("id", e.id);
    if (err) return alert("No se pudo borrar. Revisá tu conexión y probá de nuevo.");
    if (form?.id === e.id) setForm(null);
    load();
  };

  const catalogOptions = catalog.map((c) => ({ value: String(c.id), label: c.name, sub: c.muscle_group || "" }));
  // Ejercicios del historial que no están en el catálogo (nombre escrito a mano)
  options.filter((o) => o.exerciseId == null).forEach((o) => catalogOptions.unshift({ value: `${NEW_NAME}:${o.name}`, label: o.name, sub: "sin catálogo" }));
  if (form?.exerciseValue?.startsWith(NEW_NAME) && !catalogOptions.some((o) => o.value === form.exerciseValue)) {
    catalogOptions.unshift({ value: form.exerciseValue, label: form.exerciseValue.slice(NEW_NAME.length + 1), sub: "sin catálogo" });
  }

  const label = "text-muted text-[11px] uppercase tracking-wider mb-1.5 block";
  const chip = (on) => `text-xs rounded-full px-3 py-1.5 ${on ? "bg-accent text-app font-semibold" : "bg-field text-soft"}`;
  const selectCls = "bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none";

  return (
    <PanelLayout title="Progreso por ejercicio" subtitle={student.name} onClose={onClose} width="max-w-3xl">
      {tableMissing && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 mb-4">
          <p className="text-danger text-sm">Falta correr el SQL del historial en Supabase. Mientras tanto se ve lo registrado en la app, pero no se puede cargar historial.</p>
        </div>
      )}

      {/* Formulario: agregar o corregir un registro */}
      {form && (
        <div className="bg-card rounded-2xl p-4 mb-5 border border-accent/25">
          <p className="text-ink font-semibold mb-1">{form.id ? "Corregir registro" : "Agregar registro"}</p>
          <p className="text-muted text-xs mb-4">Solo cuenta para los gráficos (no da insignias).</p>

          <span className={label}>Ejercicio</span>
          <SearchSelect
            options={catalogOptions}
            value={form.exerciseValue}
            onChange={(v, text) => {
              if (v === NEW_NAME) set({ exerciseValue: `${NEW_NAME}:${(text || "").trim()}`, exerciseName: (text || "").trim() });
              else set({ exerciseValue: v, exerciseName: catalogOptions.find((o) => o.value === v)?.label || "" });
            }}
            topOption={{ value: NEW_NAME, label: "+ Usar el nombre escrito (sin catálogo)" }}
            placeholder="Buscar ejercicio..."
            className="mb-4"
          />

          <span className={label}>¿Qué tanto sabés de la fecha?</span>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRECISIONS.map((p) => (
              <button key={p.key} type="button" onClick={() => set({ precision: p.key })} className={chip(form.precision === p.key)}>{p.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {form.precision === "day" && <input type="date" value={form.day} max={localDateString()} onChange={(e) => set({ day: e.target.value })} className={selectCls} />}
            {form.precision === "month" && (
              <select value={form.month} onChange={(e) => set({ month: Number(e.target.value) })} className={selectCls}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            )}
            {form.precision !== "day" && (
              <select value={form.year} onChange={(e) => set({ year: Number(e.target.value) })} className={selectCls}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Stepper label="Peso (kg)" value={form.weight} step={2.5} decimal onChange={(v) => set({ weight: v })} />
            <Stepper label="Reps" value={form.reps} step={1} onChange={(v) => set({ reps: v })} />
            <Stepper label="Series" value={form.sets} step={1} onChange={(v) => set({ sets: v })} />
          </div>

          <span className={label}>Nota (opcional)</span>
          <input value={form.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} placeholder="Ej: con barra olímpica" className={`${selectCls} w-full mb-3`} />

          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving || tableMissing} onClick={() => save(false)} className="bg-accent text-app text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {!form.id && (
              <button type="button" disabled={saving || tableMissing} onClick={() => save(true)} className="bg-field text-ink text-sm rounded-lg px-4 py-2 disabled:opacity-60">
                Guardar y agregar otro
              </button>
            )}
            <button type="button" onClick={() => setForm(null)} className="text-soft text-sm px-3 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {entries === null ? (
        <Skeleton rows={4} height="h-14" />
      ) : options.length === 0 ? (
        <div className="bg-card rounded-2xl p-5 text-center">
          <p className="text-ink font-medium mb-1">Todavía no hay registros</p>
          <p className="text-soft text-sm mb-4">Cargá lo que el alumno ya hacía antes de la app (ej. press de banca con 10 kg en 2023) para que vea todo su avance.</p>
          {!form && <button type="button" onClick={openNew} disabled={tableMissing} className="bg-accent text-app text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60">+ Agregar registro</button>}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <SearchSelect
              options={options.map((o) => ({ value: o.key, label: o.name, sub: `${o.count} ${o.count === 1 ? "registro" : "registros"}` }))}
              value={activeKey}
              onChange={(v) => setExerciseKey(v)}
              placeholder="Buscar ejercicio..."
              className="flex-1"
            />
            {!form && (
              <button type="button" onClick={openNew} disabled={tableMissing} className="bg-accent text-app text-sm font-semibold rounded-lg px-4 py-2 flex items-center justify-center gap-1.5 disabled:opacity-60">
                <Plus size={15} /> Agregar registro
              </button>
            )}
          </div>

          <div className="bg-card rounded-2xl p-4 mb-5">
            <p className="text-muted text-[11px] mb-3">Vista día a día. El alumno ve lo mismo resumido por mes.</p>
            <ExerciseProgressView points={points} showSource />
          </div>

          <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-2">Registros de {active?.name}</p>
          <div className="bg-card rounded-2xl divide-y divide-field">
            {[...exEntries].reverse().map((e) => (
              <div key={e.uid} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm">
                    {[e.weight != null && `${e.weight} kg`, e.reps != null && `${e.reps} reps`, e.sets != null && `${e.sets} ${e.sets === 1 ? "serie" : "series"}`].filter(Boolean).join(" × ")}
                  </p>
                  <p className="text-muted text-xs truncate">
                    {formatEntryDate(e.date, e.precision)}
                    {e.precision !== "day" && <span> · fecha aproximada</span>}
                    {e.note && <span> · {e.note}</span>}
                  </p>
                </div>
                {e.source === "history" ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-accent bg-accent/10 rounded-full px-2 py-0.5 mr-1">Historial</span>
                    <button type="button" onClick={() => openEdit(e)} aria-label="Corregir" className="w-8 h-8 rounded-lg flex items-center justify-center text-soft hover:text-ink hover:bg-field"><Pencil size={14} /></button>
                    <button type="button" onClick={() => remove(e)} aria-label="Borrar" className="w-8 h-8 rounded-lg flex items-center justify-center text-soft hover:text-danger hover:bg-field"><Trash2 size={14} /></button>
                  </div>
                ) : (
                  <span className="text-[10px] text-soft bg-field rounded-full px-2 py-0.5 shrink-0">App</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-muted text-[11px] mt-2">Los registros "App" los cargó el alumno al entrenar; se corrigen desde su entreno. Los de "Historial" los podés corregir o borrar acá.</p>
        </>
      )}
    </PanelLayout>
  );
}

// Campo numérico con botones − y + (cómodo en celular)
function Stepper({ label, value, step, decimal = false, onChange }) {
  const n = toNumber(value);
  const bump = (dir) => {
    const next = Math.max(0, Math.round(((n ?? 0) + dir * step) * 100) / 100);
    onChange(next === 0 && dir < 0 && n == null ? "" : String(next));
  };
  return (
    <div>
      <span className="text-muted text-[11px] uppercase tracking-wider mb-1.5 block">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => bump(-1)} aria-label={`Bajar ${label}`} className="w-10 h-10 shrink-0 rounded-lg bg-field text-ink flex items-center justify-center active:scale-95"><Minus size={16} /></button>
        <input
          inputMode={decimal ? "decimal" : "numeric"}
          value={value}
          onChange={(e) => onChange(decimal ? cleanDecimal(e.target.value) : cleanInt(e.target.value))}
          placeholder="—"
          className="w-full min-w-0 h-10 bg-app/60 border border-white/[0.07] text-ink text-base text-center rounded-lg outline-none focus:border-accent/50"
        />
        <button type="button" onClick={() => bump(1)} aria-label={`Subir ${label}`} className="w-10 h-10 shrink-0 rounded-lg bg-field text-ink flex items-center justify-center active:scale-95"><Plus size={16} /></button>
      </div>
    </div>
  );
}
