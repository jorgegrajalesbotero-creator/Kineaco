"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { BADGE_GROUPS, computeBadges, loadBadgeData } from "@/lib/badges";
import { buildReportPdf } from "@/lib/planPdf";
import { usePdfPreview } from "@/components/ui/PdfPreview";
import { currentOrNextPlan, loadSchedule } from "@/lib/trainingPlan";
import { PanelLayout } from "./PanelLayout";
import { Skeleton } from "@/components/ui/Skeleton";

// Logros del alumno e informe completo en PDF (el peso sugerido vs. real está en Progreso por ejercicio)
export function ComparePanel({ student, onClose, onOpenPanel }) {
  const [coachBadges, setCoachBadges] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showPdf, pdfPreview] = usePdfPreview();

  // Informe completo del alumno en PDF: progreso, medidas, nutrición y entrenamientos (con o sin plan)
  const downloadReport = async () => {
    setPdfBusy(true);
    try {
      const { plans, fixed } = await loadSchedule(supabase, student.id, "id, title");
      showPdf(await buildReportPdf({ supabase, userId: student.id, plan: currentOrNextPlan(plans), fixed, studentName: student.name, includeLoads: true }));
    } catch {
      alert("No se pudo generar el PDF: ");
    }
    setPdfBusy(false);
  };

  useEffect(() => {
    async function load() {
      setLoadingComparison(true);
      setCoachBadges(computeBadges(await loadBadgeData(supabase, student.id)));
      setLoadingComparison(false);
    }
    load();
  }, [student.id]);

  return (
    <PanelLayout title="Logros e informe" subtitle={student.name} onClose={onClose} width="max-w-2xl">
      <div className="bg-card rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">Informe completo en PDF</p>
          <p className="text-muted text-xs mt-0.5">Progreso, medidas, nutrición y entrenamientos.</p>
        </div>
        <button onClick={downloadReport} disabled={pdfBusy} className="bg-accent text-app text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2 shrink-0 disabled:opacity-60">
          <Download size={15} /> {pdfBusy ? "Generando..." : "Descargar"}
        </button>
      </div>
      {onOpenPanel && (
        <button onClick={() => onOpenPanel("exercises")} className="w-full bg-card rounded-xl px-4 py-3 mb-4 text-left text-soft text-sm hover:text-ink">
          El peso sugerido vs. real ahora está en <span className="text-accent">Progreso por ejercicio</span> →
        </button>
      )}
      {loadingComparison && <Skeleton />}
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
      {pdfPreview}
    </PanelLayout>
  );
}
