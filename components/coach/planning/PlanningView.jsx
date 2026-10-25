"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  PHASE_TYPES, phaseType, phaseDisplayName, sortPhases, totalPlanWeeks, expandPlanWeeks,
  parseDate, toDateStr, addDays, mondayOf, weekStartDate, planWeekForDate, formatShortDate, planStatus,
} from "@/lib/planning";
import { Plus, Trash2, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search, Copy, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

let phaseKeyCounter = 0;
const newPhaseKey = () => `ph${Date.now()}_${phaseKeyCounter++}`;

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const matches = (q, ...fields) => {
  const words = norm(q).trim().split(/\s+/).filter(Boolean);
  const hay = norm(fields.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
};

const inputCls = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none";

function toEditablePhases(phases) {
  return sortPhases(phases).map((p) => ({ key: newPhaseKey(), phase_type: p.phase_type, name: p.name || "", weeks: String(p.weeks) }));
}

function cleanPhases(phases) {
  return phases
    .map((p, i) => ({ order_index: i, phase_type: p.phase_type, name: (p.name || "").trim() || null, weeks: Math.max(1, Math.min(52, Number(p.weeks) || 0)) }))
    .filter((p) => Number(p.weeks) > 0);
}

function monthsLabel(weeks) {
  if (!weeks) return "0 semanas";
  const months = Math.round((weeks / 4.345) * 10) / 10;
  return `${weeks} semana${weeks === 1 ? "" : "s"} · ≈ ${String(months).replace(".", ",")} mes${months === 1 ? "" : "es"}`;
}

function PhaseTypeDot({ type, size = 10 }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: phaseType(type).color }} />;
}

function PhasesEditor({ phases, setPhases }) {
  const update = (key, field, value) => setPhases((list) => list.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  const move = (index, dir) =>
    setPhases((list) => {
      const target = index + dir;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const remove = (key) => setPhases((list) => list.filter((p) => p.key !== key));
  const add = () => {
    const order = ["acumulacion", "transformacion", "realizacion", "descarga"];
    const last = phases[phases.length - 1]?.phase_type;
    const next = last ? order[(order.indexOf(last) + 1) % order.length] || "acumulacion" : "acumulacion";
    setPhases((list) => [...list, { key: newPhaseKey(), phase_type: next, name: "", weeks: next === "descarga" ? "1" : "4" }]);
  };

  return (
    <div>
      <div className="space-y-2">
        {phases.map((p, i) => (
          <div key={p.key} className="bg-field/50 border border-field rounded-xl p-3" style={{ borderLeft: `4px solid ${phaseType(p.phase_type).color}` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-soft text-xs">Fase {i + 1}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="w-7 h-7 flex items-center justify-center text-soft disabled:opacity-30"><ChevronUp size={16} /></button>
                <button onClick={() => move(i, 1)} disabled={i === phases.length - 1} aria-label="Bajar" className="w-7 h-7 flex items-center justify-center text-soft disabled:opacity-30"><ChevronDown size={16} /></button>
                <button onClick={() => remove(p.key)} aria-label="Quitar fase" className="w-7 h-7 flex items-center justify-center text-danger"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_80px] sm:grid-cols-[1fr_1fr_90px] gap-2">
              <div>
                <p className="text-muted text-[10px] mb-1">Tipo</p>
                <select value={p.phase_type} onChange={(e) => update(p.key, "phase_type", e.target.value)} className={inputCls}>
                  {PHASE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1 order-3 sm:order-none">
                <p className="text-muted text-[10px] mb-1">Nombre (opcional)</p>
                <input value={p.name} onChange={(e) => update(p.key, "name", e.target.value)} placeholder={phaseType(p.phase_type).label} className={inputCls} />
              </div>
              <div className="order-2 sm:order-none">
                <p className="text-muted text-[10px] mb-1">Semanas</p>
                <input type="number" min="1" max="52" value={p.weeks} onChange={(e) => update(p.key, "weeks", e.target.value)} className={`${inputCls} text-center`} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 w-full border border-dashed border-field text-accent text-sm rounded-xl py-2.5 flex items-center justify-center gap-1.5">
        <Plus size={15} /> Agregar fase
      </button>
      <p className="text-muted text-xs mt-2 text-center">Total: {monthsLabel(totalPlanWeeks(phases))}</p>
    </div>
  );
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function PlanCalendar({ plan }) {
  const today = new Date();
  const weeks = expandPlanWeeks(plan.phases);
  const total = weeks.length;
  const start = parseDate(plan.start_date);
  const status = planStatus(plan, today);
  const initial = status.state === "active" ? today : status.state === "done" ? addDays(start, total * 7 - 1) : start;
  const [month, setMonth] = useState({ y: initial.getFullYear(), m: initial.getMonth() });

  const first = new Date(month.y, month.m, 1, 12);
  const gridStart = mondayOf(first);
  const lastDay = new Date(month.y, month.m + 1, 0, 12);
  const gridEnd = addDays(mondayOf(lastDay), 6);
  const days = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const shift = (n) => setMonth(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const monthName = first.toLocaleDateString("es-CO", { month: "long" });
  const title = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${month.y}`;
  const todayStr = toDateStr(today);

  return (
    <div className="bg-card rounded-xl p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => shift(-1)} aria-label="Mes anterior" className="w-9 h-9 flex items-center justify-center rounded-lg bg-field text-ink"><ChevronLeft size={18} /></button>
        <p className="text-ink font-medium">{title}</p>
        <button onClick={() => shift(1)} aria-label="Mes siguiente" className="w-9 h-9 flex items-center justify-center rounded-lg bg-field text-ink"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => <p key={i} className="text-muted text-[10px] text-center">{d}</p>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === month.m;
          const w = planWeekForDate(plan.start_date, d);
          const info = w >= 1 && w <= total ? weeks[w - 1] : null;
          const color = info ? phaseType(info.phase.phase_type).color : null;
          const isWeekStart = info && Math.round((d - start) / 86400000) % 7 === 0;
          const isPhaseStart = isWeekStart && info.weekInPhase === 1;
          const isToday = toDateStr(d) === todayStr;
          return (
            <div
              key={toDateStr(d)}
              className={`relative h-12 md:h-16 rounded-md px-1 py-0.5 overflow-hidden ${inMonth ? "" : "opacity-35"} ${isToday ? "ring-2 ring-accent" : ""}`}
              style={{ background: color ? `${color}30` : "#25332C40", borderTop: color ? `3px solid ${color}` : "3px solid transparent" }}
            >
              <p className={`text-[11px] ${isToday ? "text-accent font-semibold" : "text-ink"}`}>{d.getDate()}</p>
              {isWeekStart && (
                <p className="text-[9px] leading-tight text-soft">S{w}</p>
              )}
              {isPhaseStart && (
                <p className="hidden md:block text-[9px] leading-tight truncate" style={{ color }}>{phaseDisplayName(info.phase)}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {sortPhases(plan.phases).map((p, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] text-soft"><PhaseTypeDot type={p.phase_type} size={8} />{phaseDisplayName(p)}</span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-soft"><span className="inline-block w-2.5 h-2.5 rounded-sm ring-2 ring-accent" />Hoy</span>
      </div>
    </div>
  );
}

function PhaseSummary({ plan }) {
  let week = 1;
  const status = planStatus(plan);
  return (
    <div className="bg-card rounded-xl overflow-hidden">
      {sortPhases(plan.phases).map((p, i) => {
        const from = weekStartDate(plan.start_date, week);
        const to = addDays(from, Number(p.weeks) * 7 - 1);
        const firstWeek = week;
        week += Number(p.weeks);
        const current = status.state === "active" && status.week >= firstWeek && status.week < week;
        return (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 border-b border-field last:border-0 ${current ? "bg-field/60" : ""}`}>
            <PhaseTypeDot type={p.phase_type} />
            <div className="flex-1 min-w-0">
              <p className="text-ink text-sm truncate">{phaseDisplayName(p)} {current && <span className="text-accent text-xs">· en curso</span>}</p>
              <p className="text-muted text-xs">
                {p.name ? `${phaseType(p.phase_type).label} · ` : ""}Semanas {firstWeek}–{week - 1} · {formatShortDate(from)} al {formatShortDate(to)}
              </p>
            </div>
            <p className="text-soft text-xs shrink-0">{p.weeks} sem</p>
          </div>
        );
      })}
    </div>
  );
}

export default function PlanningView({ onOpenProgression }) {
  const [section, setSection] = useState("alumnos");
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [plans, setPlans] = useState({});
  const [templates, setTemplates] = useState([]);
  const [query, setQuery] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState(null); // { id, name, phases }
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null); // { name, start_date, phases }
  const [newPlanTemplateId, setNewPlanTemplateId] = useState("");
  const [newPlanStart, setNewPlanStart] = useState(toDateStr(mondayOf(new Date())));

  async function loadData() {
    setLoading(true);
    const [{ data: profiles }, { data: planRows }, { data: templateRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "alumno"),
      supabase.from("student_plans").select("id, user_id, name, start_date, student_plan_phases(phase_type, name, weeks, order_index)"),
      supabase.from("plan_templates").select("id, name, created_at, plan_template_phases(phase_type, name, weeks, order_index)").order("created_at", { ascending: true }),
    ]);
    const map = {};
    (planRows || []).forEach((p) => {
      map[p.user_id] = { id: p.id, user_id: p.user_id, name: p.name, start_date: p.start_date, phases: sortPhases(p.student_plan_phases) };
    });
    setStudents((profiles || []).map((p) => ({ id: p.id, name: p.full_name || "Sin nombre" })).sort((a, b) => a.name.localeCompare(b.name)));
    setPlans(map);
    setTemplates((templateRows || []).map((t) => ({ id: t.id, name: t.name, phases: sortPhases(t.plan_template_phases) })));
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ---------- Plantillas ----------
  const startNewTemplate = () =>
    setEditingTemplate({
      id: null,
      name: "",
      phases: [
        { key: newPhaseKey(), phase_type: "acumulacion", name: "", weeks: "4" },
        { key: newPhaseKey(), phase_type: "transformacion", name: "", weeks: "3" },
        { key: newPhaseKey(), phase_type: "realizacion", name: "", weeks: "2" },
        { key: newPhaseKey(), phase_type: "descarga", name: "", weeks: "1" },
      ],
    });

  const saveTemplate = async () => {
    const phases = cleanPhases(editingTemplate.phases);
    if (!editingTemplate.name.trim()) return alert("Ponele un nombre a la plantilla.");
    if (phases.length === 0) return alert("Agregá al menos una fase.");
    setSaving(true);
    let id = editingTemplate.id;
    if (id) {
      const { error } = await supabase.from("plan_templates").update({ name: editingTemplate.name.trim() }).eq("id", id);
      if (error) { setSaving(false); return alert("Error al guardar: " + error.message); }
      await supabase.from("plan_template_phases").delete().eq("template_id", id);
    } else {
      const { data, error } = await supabase.from("plan_templates").insert({ name: editingTemplate.name.trim() }).select("id").single();
      if (error) { setSaving(false); return alert("Error al guardar: " + error.message); }
      id = data.id;
    }
    const { error: phErr } = await supabase.from("plan_template_phases").insert(phases.map((p) => ({ ...p, template_id: id })));
    setSaving(false);
    if (phErr) return alert("Error al guardar las fases: " + phErr.message);
    setEditingTemplate(null);
    loadData();
  };

  const deleteTemplate = async (t) => {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"? Los planes que ya creaste con ella no se borran.`)) return;
    await supabase.from("plan_templates").delete().eq("id", t.id);
    loadData();
  };

  // ---------- Plan de alumno ----------
  const writePlanPhases = async (planId, phases) => {
    await supabase.from("student_plan_phases").delete().eq("plan_id", planId);
    if (phases.length === 0) return null;
    const { error } = await supabase.from("student_plan_phases").insert(phases.map((p) => ({ ...p, plan_id: planId })));
    return error;
  };

  const createPlan = async () => {
    const template = templates.find((t) => t.id === newPlanTemplateId);
    const phases = template
      ? cleanPhases(template.phases)
      : [{ order_index: 0, phase_type: "acumulacion", name: null, weeks: 4 }];
    if (!newPlanStart) return alert("Elegí la fecha de inicio.");
    setSaving(true);
    const { data, error } = await supabase
      .from("student_plans")
      .insert({ user_id: selectedStudentId, name: template?.name || null, start_date: newPlanStart })
      .select("id")
      .single();
    if (error) { setSaving(false); return alert("Error al crear el plan: " + error.message); }
    const phErr = await writePlanPhases(data.id, phases);
    setSaving(false);
    if (phErr) alert("Error al guardar las fases: " + phErr.message);
    await loadData();
    if (!template) {
      setEditingPlan({ name: "", start_date: newPlanStart, phases: toEditablePhases(phases) });
    }
  };

  const savePlan = async () => {
    const plan = plans[selectedStudentId];
    const phases = cleanPhases(editingPlan.phases);
    if (!editingPlan.start_date) return alert("Elegí la fecha de inicio.");
    if (phases.length === 0) return alert("Agregá al menos una fase.");
    setSaving(true);
    const { error } = await supabase
      .from("student_plans")
      .update({ name: editingPlan.name.trim() || null, start_date: editingPlan.start_date, updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) { setSaving(false); return alert("Error al guardar: " + error.message); }
    const phErr = await writePlanPhases(plan.id, phases);
    setSaving(false);
    if (phErr) return alert("Error al guardar las fases: " + phErr.message);
    setEditingPlan(null);
    loadData();
  };

  const deletePlan = async () => {
    const plan = plans[selectedStudentId];
    if (!plan || !confirm("¿Seguro que querés eliminar el plan de este alumno? La progresión de cargas no se borra.")) return;
    await supabase.from("student_plans").delete().eq("id", plan.id);
    setEditingPlan(null);
    loadData();
  };

  const saveAsTemplate = async () => {
    const plan = plans[selectedStudentId];
    const name = prompt("Nombre de la plantilla nueva:", plan?.name || "");
    if (!name || !name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("plan_templates").insert({ name: name.trim() }).select("id").single();
    if (!error) {
      await supabase.from("plan_template_phases").insert(cleanPhases(toEditablePhases(plan.phases)).map((p) => ({ ...p, template_id: data.id })));
    }
    setSaving(false);
    if (error) return alert("Error: " + error.message);
    alert("Plantilla guardada.");
    loadData();
  };

  if (loading) {
    return <div className="p-4 md:p-8"><Skeleton /></div>;
  }

  // ---------- Pantalla: editar plantilla ----------
  if (editingTemplate) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-ink text-xl font-semibold">{editingTemplate.id ? "Editar plantilla" : "Nueva plantilla"}</h2>
          <button onClick={() => setEditingTemplate(null)} className="text-muted"><X size={20} /></button>
        </div>
        <div className="bg-card rounded-xl p-4 mb-4">
          <p className="text-muted text-xs mb-1">Nombre de la plantilla</p>
          <input value={editingTemplate.name} onChange={(e) => setEditingTemplate((t) => ({ ...t, name: e.target.value }))} placeholder="Ej. Fuerza 3 meses" className={inputCls} />
        </div>
        <PhasesEditor phases={editingTemplate.phases} setPhases={(fn) => setEditingTemplate((t) => ({ ...t, phases: typeof fn === "function" ? fn(t.phases) : fn }))} />
        <button onClick={saveTemplate} disabled={saving} className="block w-full mt-5 bg-accent text-app font-medium text-sm rounded-lg py-2.5 disabled:opacity-60">
          {saving ? "Guardando..." : "Guardar plantilla"}
        </button>
      </div>
    );
  }

  // ---------- Pantalla: plan de un alumno ----------
  if (selectedStudentId) {
    const student = students.find((s) => s.id === selectedStudentId);
    const plan = plans[selectedStudentId];
    const status = planStatus(plan);
    const close = () => { setSelectedStudentId(null); setEditingPlan(null); };

    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="min-w-0">
            <h2 className="text-ink text-xl font-semibold truncate">Planeación de {student?.name}</h2>
            {plan && <p className="text-muted text-sm">{plan.name ? `${plan.name} · ` : ""}{status.label}</p>}
          </div>
          <button onClick={close} className="text-muted shrink-0"><X size={20} /></button>
        </div>

        {!plan ? (
          <div className="bg-card rounded-xl p-5">
            <p className="text-ink text-sm mb-1">Este alumno todavía no tiene un plan.</p>
            <p className="text-muted text-xs mb-4">Elegí una plantilla (después la podés ajustar solo para este alumno) o empezá uno en blanco.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-muted text-[10px] mb-1">Partir de</p>
                <select value={newPlanTemplateId} onChange={(e) => setNewPlanTemplateId(e.target.value)} className={inputCls}>
                  <option value="">Plan en blanco</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({totalPlanWeeks(t.phases)} sem)</option>)}
                </select>
              </div>
              <div>
                <p className="text-muted text-[10px] mb-1">Fecha de inicio</p>
                <input type="date" value={newPlanStart} onChange={(e) => setNewPlanStart(e.target.value)} className={inputCls} />
              </div>
            </div>
            <p className="text-muted text-[10px] mb-4">Tip: si arranca un lunes, las semanas del plan coinciden con las semanas de la app.</p>
            <button onClick={createPlan} disabled={saving} className="block w-full bg-accent text-app font-medium text-sm rounded-lg py-2.5 disabled:opacity-60">
              {saving ? "Creando..." : "Crear plan"}
            </button>
          </div>
        ) : editingPlan ? (
          <div>
            <div className="bg-card rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-muted text-[10px] mb-1">Nombre del plan (opcional)</p>
                <input value={editingPlan.name} onChange={(e) => setEditingPlan((p) => ({ ...p, name: e.target.value }))} placeholder="Ej. Preparación competencia" className={inputCls} />
              </div>
              <div>
                <p className="text-muted text-[10px] mb-1">Fecha de inicio</p>
                <input type="date" value={editingPlan.start_date} onChange={(e) => setEditingPlan((p) => ({ ...p, start_date: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <PhasesEditor phases={editingPlan.phases} setPhases={(fn) => setEditingPlan((p) => ({ ...p, phases: typeof fn === "function" ? fn(p.phases) : fn }))} />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditingPlan(null)} className="flex-1 bg-field text-ink text-sm rounded-lg py-2.5">Cancelar</button>
              <button onClick={savePlan} disabled={saving} className="flex-1 bg-accent text-app font-medium text-sm rounded-lg py-2.5 disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {status.state === "active" && (
              <div className="bg-card rounded-xl p-4 flex items-center gap-3" style={{ borderLeft: `4px solid ${phaseType(status.phase.phase_type).color}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-muted text-[10px]">Hoy</p>
                  <p className="text-ink text-sm font-medium">{status.label}</p>
                </div>
              </div>
            )}
            <PlanCalendar key={`${plan.id}_${plan.start_date}_${totalPlanWeeks(plan.phases)}`} plan={plan} />
            <PhaseSummary plan={plan} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => setEditingPlan({ name: plan.name || "", start_date: plan.start_date, phases: toEditablePhases(plan.phases) })}
                className="bg-accent text-app font-medium text-sm rounded-lg py-2.5 flex items-center justify-center gap-1.5"
              >
                <Pencil size={14} /> Editar plan
              </button>
              {onOpenProgression && (
                <button onClick={() => onOpenProgression(selectedStudentId)} className="bg-field text-accent text-sm rounded-lg py-2.5">
                  Cargar pesos (Progresión)
                </button>
              )}
              <button onClick={saveAsTemplate} disabled={saving} className="bg-field text-ink text-sm rounded-lg py-2.5 flex items-center justify-center gap-1.5">
                <Copy size={14} /> Guardar como plantilla
              </button>
              <button onClick={deletePlan} className="text-danger text-sm rounded-lg py-2.5 flex items-center justify-center gap-1.5">
                <Trash2 size={14} /> Eliminar plan
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- Pantalla principal ----------
  const filtered = students.filter((s) => matches(query, s.name, planStatus(plans[s.id]).label, plans[s.id]?.name));
  const filteredTemplates = templates.filter((t) => matches(templateQuery, t.name, ...t.phases.map((p) => phaseDisplayName(p))));

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5">
        <h2 className="text-ink text-xl font-semibold">Planeación</h2>
        <p className="text-muted text-sm">Fases por meses de cada alumno. Solo la ves vos.</p>
      </div>

      <div className="flex bg-card rounded-xl p-1 mb-5 max-w-sm">
        {[{ key: "alumnos", label: "Por alumno" }, { key: "plantillas", label: "Plantillas" }].map((t) => (
          <button key={t.key} onClick={() => setSection(t.key)} className={`flex-1 text-sm rounded-lg py-2 ${section === t.key ? "bg-field text-accent" : "text-soft"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {section === "alumnos" ? (
        <>
          <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 mb-4 max-w-sm">
            <Search size={15} className="text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar alumno, plan o fase" className="bg-transparent text-ink text-sm outline-none flex-1" />
            {query && <button onClick={() => setQuery("")} aria-label="Borrar búsqueda" className="text-muted"><X size={14} /></button>}
          </div>
          {filtered.length === 0 ? (
            <p className="text-muted text-sm">{query ? `No hay alumnos que coincidan con "${query}".` : "No hay alumnos."}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((s) => {
                const st = planStatus(plans[s.id]);
                const color = st.state === "active" ? phaseType(st.phase.phase_type).color : st.state === "none" ? "#25332C" : "#5E6B63";
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudentId(s.id); setNewPlanTemplateId(""); setNewPlanStart(toDateStr(mondayOf(new Date()))); }}
                    className="text-left bg-card rounded-xl p-4 flex items-center gap-3 hover:bg-card-hover"
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-ink text-sm font-medium truncate">{s.name}</p>
                      <p className={`text-xs truncate ${st.state === "none" ? "text-muted" : "text-soft"}`}>{st.label}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <button onClick={startNewTemplate} className="mb-4 bg-accent text-app font-medium text-sm rounded-lg px-4 py-2.5 flex items-center gap-1.5">
            <Plus size={15} /> Nueva plantilla
          </button>
          {templates.length > 0 && (
            <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 mb-4 max-w-sm">
              <Search size={15} className="text-muted" />
              <input value={templateQuery} onChange={(e) => setTemplateQuery(e.target.value)} placeholder="Buscar plantilla o fase" className="bg-transparent text-ink text-sm outline-none flex-1" />
              {templateQuery && <button onClick={() => setTemplateQuery("")} aria-label="Borrar búsqueda" className="text-muted"><X size={14} /></button>}
            </div>
          )}
          {templates.length === 0 ? (
            <p className="text-muted text-sm">Todavía no tenés plantillas. Creá una para reutilizarla con varios alumnos.</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-muted text-sm">No hay plantillas que coincidan con "{templateQuery}".</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTemplates.map((t) => {
                const total = totalPlanWeeks(t.phases);
                return (
                  <div key={t.id} className="bg-card rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium truncate">{t.name}</p>
                        <p className="text-muted text-xs">{monthsLabel(total)}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setEditingTemplate({ id: t.id, name: t.name, phases: toEditablePhases(t.phases) })} aria-label="Editar" className="w-8 h-8 flex items-center justify-center rounded-lg bg-field text-ink"><Pencil size={14} /></button>
                        <button onClick={() => deleteTemplate(t)} aria-label="Eliminar" className="w-8 h-8 flex items-center justify-center rounded-lg bg-field text-danger"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-2">
                      {t.phases.map((p, i) => (
                        <div key={i} style={{ flex: Number(p.weeks), background: phaseType(p.phase_type).color }} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {t.phases.map((p, i) => (
                        <span key={i} className="flex items-center gap-1 text-[11px] text-soft"><PhaseTypeDot type={p.phase_type} size={7} />{phaseDisplayName(p)} · {p.weeks}s</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
