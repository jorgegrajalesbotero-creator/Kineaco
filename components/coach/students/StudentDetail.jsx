"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Calendar, Camera, ChevronDown, ChevronRight, ClipboardCheck, Download, Dumbbell, Eye, TrendingUp, Lock, MessageCircle, Ruler, UserCog, Utensils } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { buildReportPdf } from "@/lib/planPdf";
import { usePdfPreview } from "@/components/ui/PdfPreview";
import { currentOrNextPlan, loadSchedule } from "@/lib/trainingPlan";
import { localDateString } from "@/lib/dates";
import { PET_STATES, petMood } from "@/lib/chameleon";
import { Chameleon } from "@/components/ui/Chameleon";
import { AccessPanel } from "./AccessPanel";
import { AccountPanel } from "./AccountPanel";
import { CheckinPanel } from "./CheckinPanel";
import { ComparePanel } from "./ComparePanel";
import { DaysPanel } from "./DaysPanel";
import { ExerciseHistoryPanel } from "./ExerciseHistoryPanel";
import { MeasurementsPanel } from "./MeasurementsPanel";
import { MessagesPanel } from "./MessagesPanel";
import { NutritionPanel } from "./NutritionPanel";
import { PhotosPanel } from "./PhotosPanel";
import { PlanPanel } from "./PlanPanel";
import { RoutinePreviewPanel } from "./RoutinePreviewPanel";

const PANELS = {
  messages: MessagesPanel,
  checkin: CheckinPanel,
  compare: ComparePanel,
  days: DaysPanel,
  plan: PlanPanel,
  routine: RoutinePreviewPanel,
  photos: PhotosPanel,
  access: AccessPanel,
  account: AccountPanel,
  nutrition: NutritionPanel,
  measurements: MeasurementsPanel,
  exercises: ExerciseHistoryPanel,
};

// Grupos de la ficha, por niveles (se despliega solo el que se necesita).
// "Ver su rutina", Mensajes, PDF y el check-in (camaleón) van arriba, así que no se repiten aquí.
const GROUPS = [
  { title: "Entrenamiento", icon: Calendar, items: [["Planeación (fases, rutinas y cargas)", "plan", Calendar], ["Semana base (días fijos)", "days", Activity]] },
  { title: "Progreso", icon: TrendingUp, items: [["Progreso por ejercicio (gráficos e historial)", "exercises", Dumbbell], ["Peso sugerido vs. real y logros", "compare", TrendingUp], ["Medidas", "measurements", Ruler], ["Fotos", "photos", Camera]] },
  { title: "Nutrición", icon: Utensils, items: [["Nutrición y comidas registradas", "nutrition", Utensils]] },
  { title: "Cuenta", icon: Lock, items: [["Acceso y ficha de ingreso", "access", Lock], ["Nombre, correo y eliminar cuenta", "account", UserCog]] },
];

// Ficha de un alumno, por niveles: camaleón (check-in) → ver su rutina → Mensajes y PDF → grupos desplegables
export function StudentDetail({ student, onClose, onChanged, initialPanel = null }) {
  const [panel, setPanel] = useState(initialPanel);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showPdf, pdfPreview] = usePdfPreview();
  // Camaleón del alumno: su estado de hoy sale del check-in diario
  const [petToday, setPetToday] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  async function loadPetToday() {
    const [{ data: p, error }, { data: ck }] = await Promise.all([
      supabase.from("profiles").select("pet_name").eq("id", student.id).maybeSingle(),
      supabase.from("daily_checkins").select("*").eq("user_id", student.id).eq("check_date", localDateString()).maybeSingle(),
    ]);
    if (!error) setPetToday({ name: p?.pet_name || "", row: ck || null });
  }
  useEffect(() => { loadPetToday(); }, [student.id]);

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

  if (panel) {
    const Panel = PANELS[panel];
    return <Panel student={student} onClose={() => setPanel(null)} onChanged={onChanged} onOpenPanel={setPanel} onDeleted={() => { onChanged?.(); onClose(); }} />;
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

      {/* 1. Check-in de hoy con el camaleón (al tocarlo se ven las respuestas) */}
      {petToday ? (
        <button onClick={() => setPanel("checkin")} className="w-full bg-card rounded-xl pl-2 pr-4 py-2 mb-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
          <div className="w-24 shrink-0 bg-app rounded-lg p-0.5">
            <Chameleon mood={petToday.row ? petMood(petToday.row) : 3} sleeping={!petToday.row} size="100%" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink text-sm font-medium truncate">{petToday.name || "Camaleón"} · check-in de hoy</p>
            <p className="text-soft text-xs">{petToday.row ? `Llegó «${PET_STATES[petMood(petToday.row)].name}» · ver respuestas` : "Todavía no lo ha hecho hoy · ver historial"}</p>
          </div>
          {student.checkinAlert && <span className="text-danger text-xs shrink-0">⚠</span>}
          <ChevronRight size={16} className="text-muted shrink-0" />
        </button>
      ) : (
        <button onClick={() => setPanel("checkin")} className={`${rowBtn} mb-3`}>
          <ClipboardCheck size={16} className="text-soft shrink-0" />
          <span className="text-ink text-sm flex-1">Check-in</span>
          {student.checkinAlert && <span className="text-danger text-xs">⚠</span>}
          <ChevronRight size={16} className="text-muted shrink-0" />
        </button>
      )}

      {/* 2. Botón grande: su rutina tal como la ve el alumno */}
      <button onClick={() => setPanel("routine")} className="w-full bg-accent text-app rounded-xl px-4 py-3.5 mb-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
        <span className="w-10 h-10 rounded-xl bg-app/10 flex items-center justify-center shrink-0"><Eye size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Ver su rutina (como la ve el alumno)</span>
          <span className="block text-app/70 text-xs">Revisar ejercicios y dejar observaciones, sin cambiar la planeación</span>
        </span>
        <ChevronRight size={18} className="shrink-0" />
      </button>

      {/* 3. Accesos rápidos */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {student.isSelf ? (
          <Link href="/" className={tile}>
            <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><Dumbbell size={17} className="text-accent" /></span>
            <span className="text-ink text-sm font-medium">Entrenar (mi vista)</span>
          </Link>
        ) : (
          <button onClick={() => setPanel("messages")} className={tile}>
            <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><MessageCircle size={17} className="text-accent" /></span>
            <span className="text-ink text-sm font-medium flex items-center gap-2">
              Mensajes
              {student.unreadCount > 0 && <span className="bg-danger text-app text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{student.unreadCount}</span>}
            </span>
          </button>
        )}
        <button onClick={downloadReport} disabled={pdfBusy} className={`${tile} disabled:opacity-60`}>
          <span className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center"><Download size={17} className="text-accent" /></span>
          <span className="text-ink text-sm font-medium">{pdfBusy ? "Generando..." : "Descargar PDF"}</span>
        </button>
      </div>

      {/* 4. Grupos desplegables */}
      <div className="space-y-2">
        {GROUPS.filter((g) => !(student.isSelf && g.title === "Cuenta")).map((g) => {
          const open = openGroup === g.title;
          const GIcon = g.icon;
          return (
            <div key={g.title} className="bg-card rounded-xl overflow-hidden">
              <button onClick={() => setOpenGroup(open ? null : g.title)} aria-expanded={open} className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
                <span className="w-8 h-8 rounded-lg bg-field flex items-center justify-center shrink-0"><GIcon size={15} className="text-soft" /></span>
                <span className="text-ink text-sm font-medium flex-1">{g.title}</span>
                <span className="text-muted text-xs">{g.items.length}</span>
                <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="px-2 pb-2 space-y-1 animate-fade-in">
                  {g.items.map(([label, type, Icon]) => (
                    <button key={type} onClick={() => setPanel(type)} className="w-full rounded-lg px-3 py-2.5 flex items-center gap-3 text-left bg-app/40 hover:bg-field/60 transition-colors">
                      <Icon size={15} className="text-soft shrink-0" />
                      <span className="text-ink text-sm flex-1">{label}</span>
                      <ChevronRight size={15} className="text-muted shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {pdfPreview}
    </div>
  );
}
