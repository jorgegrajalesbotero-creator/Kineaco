"use client";

import { useState } from "react";
import { Activity, ArrowLeft, Calendar, Camera, ClipboardCheck, Download, Dumbbell, TrendingUp, Lock, MessageCircle, Ruler, Utensils } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { downloadReportPdf } from "@/lib/planPdf";
import { currentOrNextPlan, loadSchedule } from "@/lib/trainingPlan";
import { AccessPanel } from "./AccessPanel";
import { CheckinPanel } from "./CheckinPanel";
import { ComparePanel } from "./ComparePanel";
import { DaysPanel } from "./DaysPanel";
import { ExerciseHistoryPanel } from "./ExerciseHistoryPanel";
import { MeasurementsPanel } from "./MeasurementsPanel";
import { MessagesPanel } from "./MessagesPanel";
import { NutritionPanel } from "./NutritionPanel";
import { PhotosPanel } from "./PhotosPanel";
import { PlanPanel } from "./PlanPanel";
import { ProgressionPanel } from "./ProgressionPanel";

const PANELS = {
  messages: MessagesPanel,
  checkin: CheckinPanel,
  compare: ComparePanel,
  days: DaysPanel,
  plan: PlanPanel,
  progression: ProgressionPanel,
  photos: PhotosPanel,
  access: AccessPanel,
  nutrition: NutritionPanel,
  measurements: MeasurementsPanel,
  exercises: ExerciseHistoryPanel,
};

// Grupos de opciones de la ficha (lo más usado va arriba, aparte)
const GROUPS = [
  { title: "Entrenamiento", items: [["Plan por semanas", "plan", Calendar], ["Rutinas por día", "days", Activity], ["Progresión de cargas (ATR)", "progression", TrendingUp]] },
  { title: "Seguimiento", items: [["Progreso por ejercicio (gráficos e historial)", "exercises", Dumbbell], ["Progreso", "compare", TrendingUp], ["Medidas", "measurements", Ruler], ["Fotos", "photos", Camera], ["Check-in", "checkin", ClipboardCheck]] },
  { title: "Nutrición", items: [["Nutrición", "nutrition", Utensils]] },
  { title: "Cuenta", items: [["Acceso y ficha", "access", Lock]] },
];

// Ficha de un alumno: 4 accesos principales arriba y el resto agrupado por tema
export function StudentDetail({ student, onClose, onChanged, initialPanel = null }) {
  const [panel, setPanel] = useState(initialPanel);
  const [pdfBusy, setPdfBusy] = useState(false);

  const downloadReport = async () => {
    setPdfBusy(true);
    try {
      const { plans, fixed } = await loadSchedule(supabase, student.id, "id, title");
      await downloadReportPdf({ supabase, userId: student.id, plan: currentOrNextPlan(plans), fixed, studentName: student.name });
    } catch (e) {
      alert("No se pudo generar el PDF: ");
    }
    setPdfBusy(false);
  };

  if (panel) {
    const Panel = PANELS[panel];
    return <Panel student={student} onClose={() => setPanel(null)} onChanged={onChanged} />;
  }

  const tile = "bg-card rounded-xl p-3.5 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform";
  const rowBtn = "w-full bg-card rounded-xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform";

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} aria-label="Volver" className="w-10 h-10 rounded-full bg-card border border-white/[0.06] flex items-center justify-center text-soft shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h2 className="text-ink text-xl font-semibold truncate">{student.isSelf ? "Mi entrenamiento" : student.name}</h2>
          <p className="text-muted text-sm truncate">
            {student.planLabel || `${student.daysAssigned} / 7 días con rutina`} · <span className={student.accessActive ? "text-accent" : "text-danger"}>{student.accessLabel}</span>
          </p>
        </div>
      </div>

      {(!student.hasIntake || student.intakeAlert || student.checkinAlert) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {!student.hasIntake && <span className="text-xs text-muted bg-field rounded-lg px-2.5 py-1.5">Sin ficha de ingreso</span>}
          {student.intakeAlert && <span className="text-xs text-danger bg-danger/10 rounded-lg px-2.5 py-1.5">⚠ Revisar su ficha (lesión o restricción)</span>}
          {student.checkinAlert && <span className="text-xs text-danger bg-danger/10 rounded-lg px-2.5 py-1.5">⚠ Check-in con dolor</span>}
        </div>
      )}

      {/* Lo más usado */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {student.isSelf ? (
          <a href="/" className={tile}>
            <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><Dumbbell size={17} className="text-accent" /></span>
            <span className="text-ink text-sm font-medium">Entrenar (mi vista)</span>
          </a>
        ) : (
        <button onClick={() => setPanel("messages")} className={tile}>
          <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><MessageCircle size={17} className="text-accent" /></span>
          <span className="text-ink text-sm font-medium flex items-center gap-2">
            Mensajes
            {student.unreadCount > 0 && <span className="bg-danger text-app text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{student.unreadCount}</span>}
          </span>
        </button>
        )}
        <button onClick={() => setPanel("plan")} className={tile}>
          <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><Calendar size={17} className="text-accent" /></span>
          <span className="text-ink text-sm font-medium">Entrenamiento</span>
        </button>
        <button onClick={() => setPanel("compare")} className={tile}>
          <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><TrendingUp size={17} className="text-accent" /></span>
          <span className="text-ink text-sm font-medium">Progreso</span>
        </button>
        <button onClick={downloadReport} disabled={pdfBusy} className={`${tile} disabled:opacity-60`}>
          <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><Download size={17} className="text-accent" /></span>
          <span className="text-ink text-sm font-medium">{pdfBusy ? "Generando..." : "Descargar PDF"}</span>
        </button>
      </div>

      {GROUPS.filter((g) => !(student.isSelf && g.title === "Cuenta")).map((g) => (
        <div key={g.title} className="mb-5">
          <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-2">{g.title}</p>
          <div className="space-y-2">
            {g.items.map(([label, type, Icon]) => (
              <button key={type} onClick={() => setPanel(type)} className={rowBtn}>
                <Icon size={16} className="text-soft shrink-0" />
                <span className="text-ink text-sm flex-1">{label}</span>
                {type === "messages" && student.unreadCount > 0 && <span className="bg-danger text-app text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{student.unreadCount}</span>}
                {type === "checkin" && student.checkinAlert && <span className="text-danger text-xs">⚠</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
