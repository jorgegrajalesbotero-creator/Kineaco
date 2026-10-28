"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { intakeHasAlert } from "@/lib/intake";
import { matchesSearch } from "@/lib/search";
import { ChevronRight, Dumbbell, MessageCircle } from "lucide-react";
import { SearchInput } from "@/components/ui/Search";
import { StudentDetail } from "./StudentDetail";
import { planWeekOf } from "@/lib/trainingPlan";
import { localDateString } from "@/lib/dates";
import { Skeleton } from "@/components/ui/Skeleton";

// Nombres que usan las notificaciones para abrir directamente una sección de la ficha
const ACTION_TO_PANEL = { messages: "messages", progress: "compare", nutrition: "nutrition", access: "access", photos: "photos", progression: "progression", checkin: "checkin", measurements: "measurements" };

// Lista de alumnos del coach; cada tarjeta abre la ficha del alumno
export function StudentsView({ initialAction, onInitialActionDone }) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null); // { student, initialPanel }

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    const myId = user?.id || "00000000-0000-0000-0000-000000000000";
    const [{ data: profiles }, { data: assignments }, { data: unreadMessages }, { data: intakeRows }, { data: painRows }, { data: planRows }, { data: dailyRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, access_until, role").or(`role.eq.alumno,id.eq.${myId}`),
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
        const isSelf = p.id === myId && p.role === "coach";
        return {
          id: p.id,
          isSelf,
          name: p.full_name || "Sin nombre",
          daysAssigned: new Set(mine.map((a) => a.day_label)).size,
          accessUntil: p.access_until,
          accessActive: isSelf || accessActive,
          accessLabel: isSelf ? "Coach" : !until ? "Sin acceso" : accessActive ? `Hasta ${until.toLocaleDateString()}` : "Vencido",
          unreadCount: unreadCounts[p.id] || 0,
          hasIntake: isSelf || !!intakeMap[p.id],
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

  // Abrir la ficha (y una sección puntual) desde una notificación o el reporte semanal
  useEffect(() => {
    if (!initialAction || students.length === 0) return;
    const target = students.find((s) => s.id === initialAction.id);
    if (target) setOpen({ student: target, initialPanel: ACTION_TO_PANEL[initialAction.action] || null });
    onInitialActionDone?.();
  }, [initialAction, students]);

  if (open) {
    return <StudentDetail student={open.student} initialPanel={open.initialPanel} onClose={() => setOpen(null)} onChanged={loadData} />;
  }

  const me = students.find((s) => s.isSelf);
  const filtered = students.filter((s) => !s.isSelf && matchesSearch(query, s.name));

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-ink text-xl font-semibold mb-1">Alumnos</h2>
      <p className="text-muted text-sm mb-6">Toque un alumno para abrir su ficha: entrenamiento, progreso, nutrición y más.</p>

      {me && (
        <div className="bg-card rounded-xl p-4 mb-6 border border-accent/25 lg:max-w-[calc(50%-0.375rem)]">
          <p className="text-accent text-[11px] font-medium uppercase tracking-[0.14em] mb-1">Mi entrenamiento</p>
          <p className="text-ink text-sm font-medium">{me.name}</p>
          <p className="text-muted text-xs mt-0.5">
            {me.planLabel ? <span className="text-accent">{me.planLabel}</span> : `${me.daysAssigned} / 7 días con rutina`} · No cuenta en el reporte ni en los anuncios
          </p>
          <div className="flex items-center gap-2 mt-3">
            <a href="/" className="flex items-center justify-center gap-2 bg-field text-accent text-sm font-medium rounded-lg py-2 px-4">
              <Dumbbell size={15} /> Entrenar
            </a>
            <button onClick={() => setOpen({ student: me, initialPanel: null })} className="flex-1 bg-accent text-app text-sm font-semibold rounded-lg py-2">
              Planearme
            </button>
          </div>
        </div>
      )}

      <SearchInput value={query} onChange={setQuery} placeholder="Buscar alumno..." className="mb-4 max-w-md" />

      {loading ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <div
                key={s.id}
                onClick={() => setOpen({ student: s, initialPanel: null })}
                className="bg-card rounded-xl p-4 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium flex items-center gap-1.5 flex-wrap">
                      {s.name}
                      {!s.hasIntake ? (
                        <span className="text-[10px] text-muted bg-field rounded px-1.5 py-0.5">Sin ficha</span>
                      ) : s.intakeAlert ? (
                        <span className="text-[10px] text-danger bg-danger/10 rounded px-1.5 py-0.5">⚠ Ficha</span>
                      ) : null}
                      {s.checkinAlert && <span className="text-[10px] text-danger bg-danger/10 rounded px-1.5 py-0.5">⚠ Dolor</span>}
                    </p>
                    <p className="text-muted text-xs mt-0.5">
                      {s.planLabel ? <span className="text-accent">{s.planLabel}</span> : `${s.daysAssigned} / 7 días con rutina`}
                      {" · "}
                      <span className={s.accessActive ? "text-accent" : "text-danger"}>{s.accessLabel}</span>
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-muted shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpen({ student: s, initialPanel: "messages" }); }}
                    className="flex items-center justify-center gap-2 bg-field text-accent text-sm font-medium rounded-lg py-2 px-4"
                  >
                    <MessageCircle size={15} /> Mensajes
                    {s.unreadCount > 0 && (
                      <span className="bg-danger text-app text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{s.unreadCount}</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpen({ student: s, initialPanel: null }); }}
                    className="flex-1 bg-accent text-app text-sm font-semibold rounded-lg py-2"
                  >
                    Abrir ficha
                  </button>
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
