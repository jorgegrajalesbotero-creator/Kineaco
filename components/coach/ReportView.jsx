"use client";

import { useEffect, useState } from "react";
import { WEEK_DAYS } from "@/lib/dates";
import { fetchAllRows } from "@/lib/fetchAll";
import { intakeHasAlert } from "@/lib/intake";
import { matchesSearch } from "@/lib/search";
import { supabase } from "@/lib/supabaseClient";
import { addDays, routinesForDate } from "@/lib/trainingPlan";
import { SearchInput } from "@/components/ui/Search";
import { Skeleton } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";

export function reportDayKey(dateLike) {
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ReportView({ onStudentAction }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [reportSearch, setReportSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [expiredCount, setExpiredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7) - weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const lastDay = weekOffset === 0 ? today : weekEnd;
  const elapsedDays = Math.round((lastDay - weekStart) / 86400000) + 1;
  const elapsedLabels = WEEK_DAYS.slice(0, elapsedDays);
  const weekStartKey = reportDayKey(weekStart);
  // El check-in se pide el domingo: en la semana actual solo se espera desde el domingo
  const checkinExpected = weekOffset > 0 || today.getDay() === 0;
  const lastDayKey = reportDayKey(lastDay);

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      setLoading(true);
      const lookback = new Date(weekStart);
      lookback.setDate(lookback.getDate() - 60);
      const rangeEnd = new Date(lastDay);
      rangeEnd.setDate(rangeEnd.getDate() + 1);

      const [{ data: profiles }, { data: assignments }, progressRows, mealRows, { data: photoSets }, { data: unread }, { data: intakes }, { data: checkins }, { data: planRows }] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name, access_until").eq("role", "alumno"),
          supabase.from("routine_assignments").select("user_id, day_label, routine_id"),
          fetchAllRows(() =>
            supabase
              .from("progress")
              .select("user_id, completed_at")
              .gte("completed_at", lookback.toISOString())
              .lt("completed_at", rangeEnd.toISOString())
              .order("completed_at", { ascending: true })
          ),
          fetchAllRows(() =>
            supabase
              .from("meal_logs")
              .select("user_id, log_date")
              .gte("log_date", weekStartKey)
              .lte("log_date", lastDayKey)
              .order("log_date", { ascending: true })
          ),
          supabase.from("progress_photo_sets").select("user_id, taken_on"),
          supabase.from("messages").select("user_id").eq("read_by_coach", false),
          supabase.from("intake_forms").select("user_id, current_injury, medical_restriction"),
          supabase.from("weekly_checkins").select("user_id, sleep, energy, stress, mood, pain, pain_level, coach_reply").eq("week_start", weekStartKey),
          supabase.from("training_plans").select("user_id, start_date, weeks, training_plan_days(week_index, day_label, routine_id)"),
        ]);
      if (cancelled) return;

      const now = new Date();
      const active = (profiles || []).filter((p) => p.access_until && new Date(p.access_until) > now);
      setExpiredCount((profiles || []).length - active.length);

      const result = active.map((p) => {
        // Si esa semana tiene plan, los días con rutina salen del plan; si no, de los días fijos
        const userPlans = (planRows || []).filter((pl) => pl.user_id === p.id);
        const fixedRows = (assignments || []).filter((a) => a.user_id === p.id).map((a) => ({ ...a, routines: { id: a.routine_id } }));
        const assignedLabels = new Set(WEEK_DAYS.filter((_, i) => routinesForDate(userPlans, fixedRows, addDays(weekStart, i)).items.length > 0));
        const expected = elapsedLabels.filter((l) => assignedLabels.has(l)).length;

        const myProgress = progressRows.filter((r) => r.user_id === p.id);
        const trainedDays = new Set(
          myProgress.map((r) => reportDayKey(r.completed_at)).filter((k) => k >= weekStartKey && k <= lastDayKey)
        ).size;
        const lastTraining = myProgress.length > 0 ? new Date(myProgress[myProgress.length - 1].completed_at) : null;
        let daysSinceLast = null;
        if (lastTraining) {
          const lt = new Date(lastTraining);
          lt.setHours(0, 0, 0, 0);
          daysSinceLast = Math.round((lastDay - lt) / 86400000);
        }

        const mealDays = new Set(mealRows.filter((m) => m.user_id === p.id).map((m) => m.log_date)).size;

        const myPhotos = (photoSets || []).filter((s) => s.user_id === p.id).map((s) => s.taken_on).sort();
        const lastPhoto = myPhotos.length > 0 ? myPhotos[myPhotos.length - 1] : null;
        const daysSincePhoto = lastPhoto ? Math.round((today - new Date(lastPhoto + "T00:00:00")) / 86400000) : null;
        const photosDue = daysSincePhoto === null || daysSincePhoto >= 45;

        const unreadCount = (unread || []).filter((m) => m.user_id === p.id).length;
        const intake = (intakes || []).find((i) => i.user_id === p.id);
        const checkin = (checkins || []).find((c) => c.user_id === p.id) || null;

        let status = "ok";
        if (expected > 0 && trainedDays === 0) status = "inactive";
        else if ((expected > 0 && trainedDays < expected / 2) || (daysSinceLast !== null && daysSinceLast >= 5) || (daysSinceLast === null && expected > 0)) status = "attention";

        return {
          id: p.id,
          name: p.full_name || "Sin nombre",
          expected,
          trainedDays,
          daysSinceLast,
          mealDays,
          photosDue,
          daysSincePhoto,
          unreadCount,
          intakeAlert: intakeHasAlert(intake),
          checkin,
          status,
        };
      });

      const order = { inactive: 0, attention: 1, ok: 2 };
      result.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
      setRows(result);
      setLoading(false);
    }
    loadReport();
    return () => { cancelled = true; };
  }, [weekOffset]);

  const statusInfo = {
    inactive: { label: "Sin actividad", dot: "bg-danger-strong", text: "text-danger-strong" },
    attention: { label: "Atención", dot: "bg-danger", text: "text-danger" },
    ok: { label: "Al día", dot: "bg-accent", text: "text-accent" },
  };
  const counts = { inactive: 0, attention: 0, ok: 0 };
  rows.forEach((r) => { counts[r.status] += 1; });

  const fmtShort = (d) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  const weekOptions = Array.from({ length: 8 }, (_, i) => ({
    value: i,
    label: i === 0 ? "Esta semana" : i === 1 ? "Semana pasada" : `Hace ${i} semanas`,
  }));

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between flex-wrap mb-6 gap-4">
        <div>
          <h2 className="text-ink text-xl font-semibold mb-1">Reporte semanal</h2>
          <p className="text-muted text-sm">
            {fmtShort(weekStart)} – {fmtShort(weekOffset === 0 ? today : weekEnd)}
            {weekOffset === 0 && " (hasta hoy)"}
          </p>
        </div>
        <select
          value={weekOffset}
          onChange={(e) => setWeekOffset(Number(e.target.value))}
          className="bg-card text-ink text-sm rounded-lg px-3 py-2 outline-none"
        >
          {weekOptions.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            <div className="rounded-2xl p-4 bg-gradient-to-b from-card to-deep border border-white/[0.06]">
              <p className="text-ink text-3xl font-semibold tracking-tight leading-none"><CountUp value={rows.length} /></p>
              <p className="text-muted text-[11px] uppercase tracking-[0.12em] mt-2">Alumnos activos</p>
            </div>
            {["ok", "attention", "inactive"].map((k) => (
              <div key={k} className="rounded-2xl p-4 bg-gradient-to-b from-card to-deep border border-white/[0.06]">
                <p className={`text-3xl font-semibold tracking-tight leading-none ${statusInfo[k].text}`}><CountUp value={counts[k]} /></p>
                <p className="text-muted text-[11px] uppercase tracking-[0.12em] mt-2 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo[k].dot}`} />
                  {statusInfo[k].label}
                </p>
              </div>
            ))}
          </div>

          {expiredCount > 0 && (
            <p className="text-muted text-xs mb-4">
              {expiredCount} {expiredCount === 1 ? "alumno sin acceso o vencido no aparece" : "alumnos sin acceso o vencidos no aparecen"} en el reporte. Podés habilitarlos desde Alumnos → Acceso.
            </p>
          )}

          {rows.length === 0 ? (
            <div className="bg-card rounded-xl p-5">
              <p className="text-muted text-sm">No hay alumnos con acceso vigente.</p>
            </div>
          ) : (
            <>
              <SearchInput value={reportSearch} onChange={setReportSearch} placeholder="Buscar alumno..." className="mb-3 max-w-md" />
              {reportSearch && rows.filter((r) => matchesSearch(reportSearch, r.name)).length === 0 && (
                <p className="text-muted text-sm mb-3">No hay alumnos que coincidan con &quot;{reportSearch}&quot;.</p>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {rows.filter((r) => matchesSearch(reportSearch, r.name)).map((r) => (
                  <div key={r.id} className="bg-card rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-ink text-sm font-medium flex items-center gap-1.5 flex-wrap">
                        {r.name}
                        {r.intakeAlert && <span className="text-[10px] text-danger bg-danger/10 rounded px-1.5 py-0.5">⚠ Ficha</span>}
                      </p>
                      <span className={`text-xs flex items-center gap-1.5 shrink-0 ${statusInfo[r.status].text}`}>
                        <span className={`w-2 h-2 rounded-full ${statusInfo[r.status].dot}`} />
                        {statusInfo[r.status].label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs mb-3">
                      <div><p className="text-muted">Entrenos</p><p className="text-ink">{r.expected > 0 ? `${r.trainedDays} / ${r.expected}` : `${r.trainedDays} (sin rutina)`}</p></div>
                      <div><p className="text-muted">Último entreno</p><p className={r.daysSinceLast !== null && r.daysSinceLast >= 5 ? "text-danger" : "text-ink"}>{r.daysSinceLast === null ? "+60 días / nunca" : r.daysSinceLast <= 0 ? "Hoy" : r.daysSinceLast === 1 ? "Ayer" : `Hace ${r.daysSinceLast} días`}</p></div>
                      <div><p className="text-muted">Comidas</p><p className="text-ink">{r.mealDays} {r.mealDays === 1 ? "día" : "días"}</p></div>
                      <div><p className="text-muted">Fotos</p><p className={r.photosDue ? "text-danger" : "text-ink"}>{r.photosDue ? (r.daysSincePhoto === null ? "Nunca subió" : "Le toca") : `Hace ${r.daysSincePhoto} d`}</p></div>
                      <div className="col-span-2">
                        <p className="text-muted">Check-in</p>
                        {r.checkin ? (
                          <p className={r.checkin.pain && r.checkin.pain_level >= 7 ? "text-danger" : "text-ink"}>
                            Bienestar {Math.round(((r.checkin.sleep + r.checkin.energy + (6 - r.checkin.stress) + r.checkin.mood) / 4) * 10) / 10}/5
                            {r.checkin.pain ? ` · dolor ${r.checkin.pain_level}/10` : ""}
                            {r.checkin.coach_reply ? " · respondido" : " · sin responder"}
                          </p>
                        ) : (
                          <p className="text-muted">{checkinExpected ? "No lo envió" : "Se habilita el domingo"}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => onStudentAction(r.id, "checkin")} className="bg-field text-accent text-xs rounded-lg py-2">Check-in</button>
                      <button onClick={() => onStudentAction(r.id, "messages")} className="bg-field text-accent text-xs rounded-lg py-2 flex items-center justify-center gap-1.5">
                        Mensaje
                        {r.unreadCount > 0 && <span className="bg-danger text-app text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{r.unreadCount}</span>}
                      </button>
                      <button onClick={() => onStudentAction(r.id, "progress")} className="bg-field text-accent text-xs rounded-lg py-2">Ver progreso</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="text-muted text-[11px] mt-4">
            Sin actividad: no entrenó ningún día de su rutina en la semana. Atención: entrenó menos de la mitad de sus días, o lleva 5 días o más sin entrenar. En la semana actual solo se cuentan los días que ya pasaron.
          </p>
        </>
      )}
    </div>
  );
}
