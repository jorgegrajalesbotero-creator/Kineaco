"use client";

import { useState } from "react";
import { Check, Download, Flame, TrendingUp } from "lucide-react";
import { appLocale, tr } from "@/lib/i18n";
import { supabase } from "@/lib/supabaseClient";
import { downloadReportPdf } from "@/lib/planPdf";
import { currentOrNextPlan, loadSchedule } from "@/lib/trainingPlan";
import { CountUp } from "@/components/ui/CountUp";
import { BadgesSection } from "@/components/student/progress/BadgesSection";
import { BodyWeightSection } from "@/components/student/progress/BodyWeightSection";
import { CheckinHistory } from "@/components/student/progress/CheckinHistory";
import { MeasurementsSection } from "@/components/student/progress/MeasurementsSection";
import { ProgressPhotosSection } from "@/components/student/progress/ProgressPhotosSection";
import { WeightProgressChart } from "@/components/student/progress/WeightProgressChart";

export function ProgressScreen({ streak, bestStreak, totalCompleted, weekStats, recentActivity, bodyWeightLogs, weightProgress, onAddWeight, onUpdateWeight, onDeleteWeight, userId, fullName, onOpenCheckin, onOpenMeasure, healthConsent = true }) {
  const maxCount = Math.max(1, ...weekStats.map((d) => d.count));
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Descargar todo el informe en PDF: progreso, medidas, nutrición y entrenamientos
  const downloadReport = async () => {
    setPdfBusy(true);
    try {
      const { plans, fixed } = await loadSchedule(supabase, userId, "id, title");
      await downloadReportPdf({ supabase, userId, plan: currentOrNextPlan(plans), fixed, studentName: fullName, t: tr, locale: appLocale(), includeHealth: healthConsent });
    } catch (e) {
      alert(tr("No se pudo generar el PDF: ") + e.message);
    }
    setPdfBusy(false);
  };

  const latest = bodyWeightLogs[0];
  const exerciseOptions = [];
  const seenExerciseIds = new Set();
  weightProgress.forEach((r) => {
    const id = r.exercise_id != null ? String(r.exercise_id) : `name:${r.exercise_name || ""}`;
    if (!seenExerciseIds.has(id)) {
      seenExerciseIds.add(id);
      exerciseOptions.push({ id, name: r.exercises?.name || r.exercise_name || "Ejercicio" });
    }
  });

  const activeExerciseId = selectedExerciseId ?? (exerciseOptions[0] ? exerciseOptions[0].id : null);

  const selectedPoints = weightProgress
    .filter((r) => (r.exercise_id != null ? String(r.exercise_id) : `name:${r.exercise_name || ""}`) === activeExerciseId)
    .map((r) => ({ kg: Number(r.weight_kg), date: new Date(r.completed_at) }))
    .sort((a, b) => a.date - b.date);

  const deltaKg =
    selectedPoints.length >= 2
      ? Math.round((selectedPoints[selectedPoints.length - 1].kg - selectedPoints[0].kg) * 10) / 10
      : 0;


  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
      <h1 className="text-ink text-2xl font-semibold tracking-tight mb-4">{tr("Su progreso")}</h1>

      <button onClick={downloadReport} disabled={pdfBusy} className="w-full flex items-center justify-center gap-2 bg-accent text-app text-sm font-semibold rounded-2xl py-3 mb-2 disabled:opacity-60">
        <Download size={16} /> {pdfBusy ? tr("Generando PDF...") : tr("Descargar todo en PDF")}
      </button>
      <p className="text-muted text-[11px] text-center mb-7">{tr("Incluye su progreso, medidas, nutrición y sus entrenamientos.")}</p>

      <div className="grid grid-cols-3 gap-2.5 mb-7">
        {[
          { icon: Flame, label: tr("Racha"), value: streak, tone: "text-danger", glow: "bg-danger/15" },
          { icon: TrendingUp, label: tr("Récord"), value: bestStreak, tone: "text-accent", glow: "bg-accent/15" },
          { icon: Check, label: tr("Total"), value: totalCompleted, tone: "text-accent", glow: "bg-accent/15" },
        ].map(({ icon: Icon, label, value, tone, glow }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl p-3.5 bg-gradient-to-b from-card to-deep border border-white/[0.06]">
            <div className={`w-8 h-8 rounded-xl ${glow} flex items-center justify-center mb-3`}>
              <Icon size={15} className={tone} />
            </div>
            <p className="text-ink text-[28px] font-semibold leading-none tracking-tight">
              <CountUp value={value} />
            </p>
            <p className="text-muted text-[10px] uppercase tracking-[0.12em] mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3">{tr("Últimos 7 días")}</p>
      <div className="rounded-2xl p-4 mb-7 bg-gradient-to-b from-card to-deep border border-white/[0.06]">
        <div className="flex items-end justify-between gap-2 h-28">
          {weekStats.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div
                className={`w-full max-w-[26px] rounded-full origin-bottom animate-grow-up ${d.count > 0 ? "bg-gradient-to-t from-accent/70 to-accent" : "bg-field"}`}
                style={{ height: `${d.count > 0 ? Math.max(16, (d.count / maxCount) * 96) : 8}px`, animationDelay: `${i * 60}ms` }}
              />
              <span className={`text-[10px] ${d.isToday ? "text-accent font-semibold" : "text-muted"}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {healthConsent ? (
        <MeasurementsSection userId={userId} onOpen={onOpenMeasure} />
      ) : (
        <div className="mb-7">
          <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3">{tr("Medidas y fotos de progreso")}</p>
          <div className="rounded-2xl bg-card border border-white/[0.06] p-4">
            <p className="text-soft text-sm">{tr("Están desactivadas porque no autorizó el tratamiento de sus datos de salud. Puede activarlo en Perfil → Privacidad.")}</p>
          </div>
        </div>
      )}

      <CheckinHistory userId={userId} onOpenCheckin={onOpenCheckin} />

      <BadgesSection userId={userId} />

      <BodyWeightSection logs={bodyWeightLogs} onAdd={onAddWeight} onUpdate={onUpdateWeight} onDelete={onDeleteWeight} />

      {healthConsent && <ProgressPhotosSection userId={userId} latestWeight={latest?.weight_kg} />}

      <p className="text-muted text-xs uppercase tracking-wider mb-3">{tr("Progreso de carga")}</p>
      <div className="bg-card rounded-2xl p-4 mb-6">
        {exerciseOptions.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">
            {tr("Todavía no ha registrado peso en ningún ejercicio.")}
          </p>
        ) : (
          <>
            <select
              value={activeExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="block w-full bg-field text-ink text-sm rounded-xl px-3 py-2 mb-4 outline-none"
            >
              {exerciseOptions.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>

            {selectedPoints.length < 2 ? (
              <p className="text-muted text-sm text-center py-4">
                {tr("Registre el peso al menos 2 veces en este ejercicio para ver su progreso.")}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-ink text-lg font-semibold">
                    {selectedPoints[selectedPoints.length - 1].kg}{tr("kg")}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${deltaKg > 0
                      ? "bg-accent/10 text-accent"
                      : deltaKg < 0
                        ? "bg-danger/10 text-danger"
                        : "bg-field text-soft"
                      }`}
                  >
                    {deltaKg > 0 ? "+" : ""}
                    {deltaKg}{tr("kg desde el inicio")}
                  </span>
                </div>
                <WeightProgressChart points={selectedPoints} />
              </>
            )}
          </>
        )}
      </div>
      <p className="text-muted text-xs uppercase tracking-wider mb-3">{tr("Actividad reciente")}</p>
      <div className="bg-card rounded-2xl p-2 mb-6">
        {recentActivity.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">{tr("Todavía no ha marcado ningún ejercicio.")}</p>
        ) : (
          recentActivity.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-field last:border-0">
              <div>
                <p className="text-ink text-sm">{r.exercises?.name || r.exercise_name || tr("Ejercicio")}</p>
                <p className="text-muted text-xs">{tr(r.day_label)}</p>
              </div>
              <span className="text-muted text-xs">
                {r.weight_kg ? tr("{p0} kg · ", { p0: r.weight_kg }) : ""}
                {new Date(r.completed_at).toLocaleDateString(appLocale(), { day: "2-digit", month: "short" })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
