"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { intakeHasAlert } from "@/lib/intake";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/ui/Search";
import { AccessPanel } from "./AccessPanel";
import { CheckinPanel } from "./CheckinPanel";
import { ComparePanel } from "./ComparePanel";
import { DaysPanel } from "./DaysPanel";
import { MeasurementsPanel } from "./MeasurementsPanel";
import { MessagesPanel } from "./MessagesPanel";
import { NutritionPanel } from "./NutritionPanel";
import { PhotosPanel } from "./PhotosPanel";
import { PlanPanel } from "./PlanPanel";
import { planWeekOf } from "@/lib/trainingPlan";
import { localDateString } from "@/lib/dates";
import { ProgressionPanel } from "./ProgressionPanel";
import { Skeleton } from "@/components/ui/Skeleton";

const PANELS = {
  checkin: CheckinPanel,
  days: DaysPanel,
  plan: PlanPanel,
  compare: ComparePanel,
  nutrition: NutritionPanel,
  progression: ProgressionPanel,
  photos: PhotosPanel,
  access: AccessPanel,
  messages: MessagesPanel,
  measurements: MeasurementsPanel,
};

// Nombres que usan las notificaciones para abrir directamente una sección
const ACTION_TO_PANEL = { messages: "messages", progress: "compare", nutrition: "nutrition", access: "access", photos: "photos", progression: "progression", checkin: "checkin", measurements: "measurements" };

// Lista de alumnos del coach; cada botón abre el detalle correspondiente
export function StudentsView({ initialAction, onInitialActionDone }) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState(null); // { type, student }

  async function loadData() {
    const [{ data: profiles }, { data: assignments }, { data: unreadMessages }, { data: intakeRows }, { data: painRows }, { data: planRows }, { data: dailyRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, access_until").eq("role", "alumno"),
      supabase.from("routine_assignments").select("user_id, day_label"),
      supabase.from("messages").select("user_id").eq("read_by_coach", false),
      supabase.from("intake_forms").select("user_id, current_injury, medical_restriction"),
      supabase.from("weekly_checkins").select("user_id").eq("pain", true).gte("pain_level", 7).is("coach_reply", null),
      supabase.from("training_plans").select("user_id, start_date, weeks"),
      supabase.from("daily_checkins").select("user_id, sleep, energy, soreness, pain, pain_level").eq("check_date", localDateString()),
    ]);

    const intakeMap = {};
    (intakeRows || []).forEach((r) => { intakeMap[r.user_id] = r; });
    const unreadCounts = {};
    (unreadMessages || []).forEach((m) => { unreadCounts[m.user_id] = (unreadCounts[m.user_id] || 0) + 1; });

    setStudents(
      (profiles || []).map((p) => {
        const mine = (assignments || []).filter((a) => a.user_id === p.id);
        const until = p.access_until ? new Date(p.access_until) : null;
        const accessActive = !!(until && until > new Date());
        const activePlan = (planRows || []).find((pl) => pl.user_id === p.id && planWeekOf(pl, new Date()));
        return {
          id: p.id,
          name: p.full_name || "Sin nombre",
          daysAssigned: new Set(mine.map((a) => a.day_label)).size,
          accessUntil: p.access_until,
          accessActive,
          accessLabel: !until ? "Sin acceso" : accessActive ? `Hasta ${until.toLocaleDateString()}` : "Vencido",
          unreadCount: unreadCounts[p.id] || 0,
          hasIntake: !!intakeMap[p.id],
          intakeAlert: intakeHasAlert(intakeMap[p.id]),
          checkinAlert:
            (painRows || []).some((r) => r.user_id === p.id) ||
            (dailyRows || []).some((d) => d.user_id === p.id && ((d.pain && d.pain_level >= 7) || d.energy === 1 || d.sleep === 1 || d.soreness === 5)),
          planLabel: activePlan ? `Plan: semana ${planWeekOf(activePlan, new Date())} de ${activePlan.weeks}` : null,
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  // Abrir una sección directamente desde una notificación o el reporte semanal
  useEffect(() => {
    if (!initialAction || students.length === 0) return;
    const target = students.find((s) => s.id === initialAction.id);
    const type = ACTION_TO_PANEL[initialAction.action];
    if (target && type) setPanel({ type, student: target });
    onInitialActionDone?.();
  }, [initialAction, students]);

  if (panel) {
    const Panel = PANELS[panel.type];
    return <Panel student={panel.student} onClose={() => setPanel(null)} onChanged={loadData} />;
  }

  const filtered = students.filter((s) => matchesSearch(query, s.name));

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-ink text-xl font-semibold mb-1">Alumnos</h2>
      <p className="text-muted text-sm mb-6">Asignales una rutina distinta para cada día de la semana.</p>

      <SearchInput value={query} onChange={setQuery} placeholder="Buscar alumno..." className="mb-4 max-w-md" />

      {loading ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-card rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium flex items-center gap-1.5 flex-wrap">
                      {s.name}
                      {!s.hasIntake ? (
                        <span className="text-[10px] text-muted bg-field rounded px-1.5 py-0.5">Sin ficha</span>
                      ) : s.intakeAlert ? (
                        <span className="text-[10px] text-danger bg-danger/10 rounded px-1.5 py-0.5">⚠ Ficha</span>
                      ) : null}
                    </p>
                    <p className="text-muted text-xs mt-0.5">
                      {s.planLabel ? <span className="text-accent">{s.planLabel}</span> : `${s.daysAssigned} / 7 días con rutina`}
                    </p>
                  </div>
                  <button onClick={() => setPanel({ type: "access", student: s })} className={`text-xs shrink-0 ${s.accessActive ? "text-accent" : "text-danger"}`}>{s.accessLabel}</button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button onClick={() => setPanel({ type: "messages", student: s })} className="flex items-center justify-center gap-2 bg-field text-accent text-sm font-medium rounded-lg py-2.5">
                    Mensajes
                    {s.unreadCount > 0 && (
                      <span className="bg-danger text-app text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{s.unreadCount}</span>
                    )}
                  </button>
                  <button onClick={() => setPanel({ type: "checkin", student: s })} className="flex items-center justify-center gap-2 bg-field text-accent text-sm font-medium rounded-lg py-2.5">
                    Check-in
                    {s.checkinAlert && <span className="text-danger text-xs">⚠</span>}
                  </button>
                  <button onClick={() => setPanel({ type: "measurements", student: s })} className="flex items-center justify-center gap-2 bg-field text-accent text-sm font-medium rounded-lg py-2.5">
                    Medidas
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["Plan", "plan"],
                    ["Días", "days"],
                    ["Progreso", "compare"],
                    ["Nutrición", "nutrition"],
                    ["ATR", "progression"],
                    ["Fotos", "photos"],
                    ["Acceso", "access"],
                  ].map(([label, type]) => (
                    <button key={label} onClick={() => setPanel({ type, student: s })} className="bg-field text-soft text-xs rounded-lg py-2">{label}</button>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-muted text-sm">No hay alumnos registrados todavía.</p>}
          </div>
        </>
      )}
    </div>
  );
}
