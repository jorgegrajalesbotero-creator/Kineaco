"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, Play } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { blockTypeLabel } from "@/lib/blocks";
import { localDateString } from "@/lib/dates";
import { appLocale, dayLetters, tr } from "@/lib/i18n";
import { addDays, currentOrNextPlan, dayLabelOf, loadSchedule, mondayOf, planFor, planLastDay, planStart, planWeekOf, routinesForDate } from "@/lib/trainingPlan";
import { downloadPlanPdf, downloadRoutinePdf, loadRoutineDetails } from "@/lib/planPdf";

const card = "rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06]";

// Calendario del alumno: el mes con los días de entreno (del plan o de sus días fijos), lo que ya hizo y el detalle de cada día
export function CalendarScreen({ userId, studentName, healthConsent, onClose, onOpenDay }) {
  const [schedule, setSchedule] = useState(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => localDateString());
  const [trained, setTrained] = useState(new Set());
  const [details, setDetails] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    loadSchedule(supabase, userId, "id, title, duration_minutes, goal").then(setSchedule);
  }, [userId]);

  // Días entrenados en el mes que se está viendo
  useEffect(() => {
    const from = addDays(month, -7);
    const to = addDays(new Date(month.getFullYear(), month.getMonth() + 1, 1), 7);
    supabase
      .from("progress")
      .select("completed_at")
      .eq("user_id", userId)
      .gte("completed_at", from.toISOString())
      .lt("completed_at", to.toISOString())
      .limit(3000)
      .then(({ data }) => setTrained(new Set((data || []).map((p) => localDateString(new Date(p.completed_at))))));
  }, [userId, month]);

  const plans = schedule?.plans || [];
  const fixed = schedule?.fixed || [];
  const plan = currentOrNextPlan(plans);
  const today = new Date();
  const todayKey = localDateString(today);
  const weekStart = mondayOf(today);

  // 6 semanas visibles, empezando el lunes de la semana del día 1
  const cells = useMemo(() => {
    const start = mondayOf(month);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const selDate = new Date(`${selected}T00:00:00`);
  const selInfo = schedule ? routinesForDate(plans, fixed, selDate) : { items: [] };
  const selIds = selInfo.items.map((a) => a.routines?.id).filter(Boolean);
  const inThisWeek = selDate >= weekStart && selDate < addDays(weekStart, 7);

  // Detalle (ejercicios) de las rutinas del día elegido
  useEffect(() => {
    const missing = selIds.filter((id) => !details[id]);
    if (missing.length === 0) return;
    loadRoutineDetails(supabase, missing).then((d) => setDetails((prev) => ({ ...prev, ...d })));
  }, [selected, schedule]);

  const locale = appLocale();
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const monthTitle = cap(month.toLocaleDateString(locale, { month: "long", year: "numeric" }));
  const fmt = (d, opts) => d.toLocaleDateString(locale, opts);

  const planPdf = async () => {
    setBusy("plan");
    try {
      await downloadPlanPdf({ supabase, userId, plan, studentName, t: tr, locale, includeHealth: healthConsent });
    } catch (e) {
      alert(tr("No se pudo generar el PDF: ") + e.message);
    }
    setBusy(null);
  };
  const dayPdf = async () => {
    setBusy("day");
    try {
      const raw = fmt(selDate, { weekday: "long", day: "numeric", month: "long" });
      await downloadRoutinePdf({ supabase, routineIds: selIds, dayTitle: raw.charAt(0).toUpperCase() + raw.slice(1), t: tr, locale });
    } catch (e) {
      alert(tr("No se pudo generar el PDF: ") + e.message);
    }
    setBusy(null);
  };

  const planWeek = plan ? planWeekOf(plan, today) : null;

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-3 pb-8">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onClose} aria-label={tr("Volver")} className="w-10 h-10 rounded-full bg-card border border-white/[0.06] flex items-center justify-center text-soft">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-ink text-xl font-semibold tracking-tight">{tr("Calendario")}</h1>
      </div>

      {plan && (
        <div className={`${card} p-4 mb-4`}>
          <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-1">{tr("Mi plan")}</p>
          <p className="text-ink text-base font-semibold">{plan.name || tr("Plan de {p0} semanas", { p0: plan.weeks })}</p>
          <p className="text-soft text-xs mt-0.5">
            {fmt(planStart(plan), { day: "numeric", month: "short" })} – {fmt(planLastDay(plan), { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {planWeek ? (
            <>
              <div className="flex items-center justify-between mt-3 mb-1.5">
                <p className="text-ink text-sm">{tr("Semana {p0} de {p1}", { p0: planWeek, p1: plan.weeks })}</p>
                <p className="text-muted text-xs tabular-nums">{Math.round((planWeek / plan.weeks) * 100)}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(planWeek / plan.weeks) * 100}%` }} />
              </div>
            </>
          ) : (
            <p className="text-accent text-xs mt-2">{tr("Empieza el {p0}", { p0: fmt(planStart(plan), { weekday: "long", day: "numeric", month: "long" }) })}</p>
          )}
          <button onClick={planPdf} disabled={busy === "plan"} className="mt-4 w-full flex items-center justify-center gap-2 bg-accent text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-60">
            <Download size={15} /> {busy === "plan" ? tr("Generando PDF...") : tr("Descargar mi plan en PDF")}
          </button>
          <p className="text-muted text-[11px] mt-2 text-center">{tr("Incluye su progreso, medidas, nutrición y todas las rutinas.")}</p>
        </div>
      )}

      <div className={`${card} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={tr("Mes anterior")} className="w-8 h-8 rounded-lg bg-white/[0.04] text-soft flex items-center justify-center"><ChevronLeft size={16} /></button>
          <p className="text-ink text-sm font-semibold">{monthTitle}</p>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={tr("Mes siguiente")} className="w-8 h-8 rounded-lg bg-white/[0.04] text-soft flex items-center justify-center"><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayLetters().map((d, i) => <p key={i} className="text-muted text-[10px] text-center font-medium">{d}</p>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const key = localDateString(d);
            const inMonth = d.getMonth() === month.getMonth();
            const info = schedule ? routinesForDate(plans, fixed, d) : { items: [] };
            const has = info.items.length > 0;
            const done = trained.has(key);
            const isSel = key === selected;
            const isToday = key === todayKey;
            const inPlan = !!planFor(plans, d);
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-[13px] tabular-nums transition ${
                  isSel ? "bg-accent text-app font-semibold" : inPlan ? "bg-accent/[0.07] text-ink" : "text-soft"
                } ${!inMonth && !isSel ? "opacity-35" : ""} ${isToday && !isSel ? "ring-1 ring-accent" : ""}`}
              >
                {d.getDate()}
                {has && !done && <span className={`absolute bottom-1.5 w-1 h-1 rounded-full ${isSel ? "bg-app" : "bg-accent"}`} />}
                {done && (
                  <span className={`absolute bottom-1 w-3 h-3 rounded-full flex items-center justify-center ${isSel ? "bg-app" : "bg-accent"}`}>
                    <Check size={8} strokeWidth={4} className={isSel ? "text-accent" : "text-app"} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> {tr("Día de entreno")}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-accent flex items-center justify-center"><Check size={8} strokeWidth={4} className="text-app" /></span> {tr("Hecho")}</span>
          {plans.length > 0 && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/20" /> {tr("Fechas del plan")}</span>}
        </div>
      </div>

      {/* Detalle del día elegido */}
      <div className={`${card} p-4`}>
        <p className="text-ink text-base font-semibold">{cap(fmt(selDate, { weekday: "long", day: "numeric", month: "long" }))}</p>
        <p className="text-muted text-xs mt-0.5">
          {selInfo.plan ? tr("Semana {p0} del plan", { p0: selInfo.week }) : tr("Días fijos")}
          {trained.has(selected) && <span className="text-accent"> · {tr("Entrenó este día")}</span>}
        </p>

        {selInfo.items.length === 0 ? (
          <p className="text-soft text-sm mt-3">{tr("Día de descanso.")}</p>
        ) : (
          <>
            {selIds.map((id) => {
              const r = details[id];
              const base = selInfo.items.find((a) => a.routines?.id === id)?.routines;
              return (
                <div key={id} className="mt-4">
                  <p className="text-ink text-sm font-semibold">{r?.title || base?.title}</p>
                  {r ? (
                    r.blocks.length > 0 ? (
                      r.blocks.map((b) => (
                        <div key={b.id} className="mt-2">
                          <p className="text-accent text-[11px] font-medium uppercase tracking-wider">
                            {b.title || tr(blockTypeLabel(b.block_type))}{Number(b.sets) > 0 ? ` · ${tr("{p0} series", { p0: b.sets })}` : ""}
                          </p>
                          {b.exercises.map((ex, i) => (
                            <p key={i} className="text-soft text-xs mt-1">• {ex.name}{ex.reps ? ` — ${tr("{p0} reps", { p0: ex.reps })}` : ""}{ex.kg != null ? ` · ${ex.kg} kg` : ""}</p>
                          ))}
                        </div>
                      ))
                    ) : (
                      r.list.map((ex, i) => (
                        <p key={i} className="text-soft text-xs mt-1">• {ex.name}{Number(ex.sets) > 0 ? ` — ${ex.sets} × ${ex.reps || "—"}` : ex.reps ? ` — ${tr("{p0} reps", { p0: ex.reps })}` : ""}{ex.kg != null ? ` · ${ex.kg} kg` : ""}</p>
                      ))
                    )
                  ) : (
                    <p className="text-muted text-xs mt-1">{tr("Cargando...")}</p>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2 mt-4">
              {inThisWeek && (
                <button onClick={() => onOpenDay(dayLabelOf(selDate))} className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-app text-sm font-semibold rounded-xl py-2.5">
                  <Play size={14} fill="currentColor" /> {tr("Abrir rutina")}
                </button>
              )}
              <button onClick={dayPdf} disabled={busy === "day"} className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.06] text-soft text-sm rounded-xl py-2.5 disabled:opacity-60">
                <Download size={14} /> {busy === "day" ? tr("Generando...") : tr("PDF de este día")}
              </button>
            </div>
            {!inThisWeek && <p className="text-muted text-[11px] mt-2">{tr("Puede registrar sus series los días de esta semana.")}</p>}
          </>
        )}
      </div>
    </div>
  );
}
