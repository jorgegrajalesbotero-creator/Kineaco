"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { localDateString } from "@/lib/dates";
import { BADGE_GROUPS, computeBadges, loadBadgeData } from "@/lib/badges";
import { downloadReportPdf } from "@/lib/planPdf";
import { currentOrNextPlan, loadSchedule } from "@/lib/trainingPlan";
import { PanelLayout } from "./PanelLayout";
import { Skeleton } from "@/components/ui/Skeleton";

// Últimos ejercicios marcados: peso sugerido vs. peso real, y logros del alumno
export function ComparePanel({ student, onClose }) {
  const [comparisonData, setComparisonData] = useState([]);
  const [coachBadges, setCoachBadges] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Informe completo del alumno en PDF: progreso, medidas, nutrición y entrenamientos (con o sin plan)
  const downloadReport = async () => {
    setPdfBusy(true);
    try {
      const { plans, fixed } = await loadSchedule(supabase, student.id, "id, title");
      await downloadReportPdf({ supabase, userId: student.id, plan: currentOrNextPlan(plans), fixed, studentName: student.name, includeLoads: true });
    } catch {
      alert("No se pudo generar el PDF: ");
    }
    setPdfBusy(false);
  };

  useEffect(() => {
    async function load() {
      setLoadingComparison(true);
      const { data: progressRows } = await supabase
        .from("progress")
        .select("*, exercises(name)")
        .eq("user_id", student.id)
        .order("completed_at", { ascending: false })
        .limit(30);

      const routineIds = [...new Set((progressRows || []).map((p) => p.routine_id).filter(Boolean))];
      const targetMap = {};
      if (routineIds.length > 0) {
        const { data: targets } = await supabase
          .from("routine_exercises")
          .select("routine_id, exercise_id, item_key, target_weight_kg")
          .in("routine_id", routineIds);
        (targets || []).forEach((t) => {
          targetMap[`${t.routine_id}_${t.exercise_id}`] = t.target_weight_kg;
          if (t.item_key) targetMap[`item_${t.item_key}`] = t.target_weight_kg;
        });
      }

      // Series registradas (peso × reps) de esos mismos ejercicios
      const rowsList = progressRows || [];
      const oldest = rowsList.length ? rowsList[rowsList.length - 1].completed_at : null;
      const setsMap = {};
      if (oldest) {
        const since = new Date(oldest);
        since.setHours(0, 0, 0, 0);
        const { data: sets } = await supabase
          .from("progress_sets")
          .select("routine_id, exercise_id, item_key, day_label, set_number, weight_kg, reps, completed_at")
          .eq("user_id", student.id)
          .gte("completed_at", since.toISOString())
          .order("set_number");
        (sets || []).forEach((st) => {
          const key = `${st.routine_id}|${st.day_label}|${st.item_key || st.exercise_id}|${localDateString(new Date(st.completed_at))}`;
          (setsMap[key] = setsMap[key] || []).push(st);
        });
      }
      const setsFor = (p) => setsMap[`${p.routine_id}|${p.day_label}|${p.item_key || p.exercise_id}|${localDateString(new Date(p.completed_at))}`] || [];

      setComparisonData(
        rowsList.map((p) => ({
          sets: setsFor(p),
          name: p.exercises?.name || p.exercise_name || "Ejercicio eliminado",
          day: p.day_label,
          date: p.completed_at,
          actual: p.weight_kg,
          target: (p.item_key ? targetMap[`item_${p.item_key}`] : undefined) ?? targetMap[`${p.routine_id}_${p.exercise_id}`] ?? null,
        }))
      );
      setCoachBadges(computeBadges(await loadBadgeData(supabase, student.id)));
      setLoadingComparison(false);
    }
    load();
  }, [student.id]);

  return (
    <PanelLayout title="Peso sugerido vs. real" subtitle={student.name} onClose={onClose} width="max-w-2xl">
      <div className="bg-card rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">Informe completo en PDF</p>
          <p className="text-muted text-xs mt-0.5">Progreso, medidas, nutrición y entrenamientos.</p>
        </div>
        <button onClick={downloadReport} disabled={pdfBusy} className="bg-accent text-app text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2 shrink-0 disabled:opacity-60">
          <Download size={15} /> {pdfBusy ? "Generando..." : "Descargar"}
        </button>
      </div>
      {loadingComparison ? (
        <Skeleton />
      ) : comparisonData.length === 0 ? (
        <p className="text-muted text-sm">Este alumno todavía no marcó ningún ejercicio.</p>
      ) : (
        <div className="bg-card rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_90px_90px] gap-2 px-4 py-2.5 text-muted text-xs border-b border-field">
            <span>Ejercicio y series</span><span>Día</span><span>Sugerido</span><span>Mejor peso</span>
          </div>
          {comparisonData.map((c, i) => {
            const match = c.target != null && c.actual != null && Number(c.actual) >= Number(c.target);
            const short = c.target != null && c.actual != null && Number(c.actual) < Number(c.target);
            return (
              <div key={i} className="grid grid-cols-[1fr_80px_90px_90px] gap-2 px-4 py-2.5 items-center border-b border-field last:border-0">
                <div>
                  <p className="text-ink text-sm">{c.name}</p>
                  <p className="text-muted text-[10px]">{new Date(c.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}</p>
                  {c.sets.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.sets.map((st) => (
                        <span key={st.set_number} className="text-[10px] text-soft bg-field rounded-md px-1.5 py-0.5 tabular-nums">
                          {st.weight_kg != null ? `${st.weight_kg} kg` : "—"} × {st.reps ?? "—"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-soft text-xs">{c.day}</span>
                <span className="text-soft text-xs">{c.target != null ? `${c.target} kg` : "—"}</span>
                <span className={`text-xs font-medium ${match ? "text-accent" : short ? "text-danger" : "text-soft"}`}>
                  {c.actual != null ? `${c.actual} kg` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loadingComparison && coachBadges.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-ink text-sm font-medium">Logros del alumno</p>
            <span className="text-soft text-xs">{coachBadges.filter((b) => b.unlocked).length} / {coachBadges.length}</span>
          </div>
          <div className="bg-card rounded-xl p-4 space-y-4">
            {BADGE_GROUPS.map((g) => (
              <div key={g.key}>
                <p className="text-soft text-xs mb-2">{g.label}</p>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {coachBadges.filter((b) => b.group === g.key).map((b) => {
                    const Icon = b.icon;
                    return (
                      <div
                        key={b.key}
                        className={`rounded-lg p-2 flex flex-col items-center text-center ${b.unlocked ? "bg-accent/10 border border-accent/30" : "bg-field"}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${b.unlocked ? "bg-accent" : "bg-card"}`}>
                          <Icon size={14} className={b.unlocked ? "text-app" : "text-muted"} />
                        </div>
                        <p className={`text-[11px] leading-tight ${b.unlocked ? "text-ink" : "text-soft"}`}>{b.title}</p>
                        <p className={`text-[10px] mt-0.5 ${b.unlocked ? "text-accent" : "text-muted"}`}>
                          {b.unlocked ? "Lograda" : `${b.current} / ${b.target}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelLayout>
  );
}
