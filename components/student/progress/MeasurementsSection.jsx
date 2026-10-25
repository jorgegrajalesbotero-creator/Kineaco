"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Ruler } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { daysSince, localDateString } from "@/lib/dates";
import { MEASURE_DAYS } from "@/lib/measurements";
import { appLocale, tr } from "@/lib/i18n";
import { BodyFigure } from "@/components/ui/BodyFigure";
import { MeasurementsOverview, loadMeasurements } from "@/components/measurements/MeasurementsOverview";

// Progreso → Medidas corporales: figura con sus medidas, resultados y recordatorio cada 4 semanas
export function MeasurementsSection({ userId, onOpen }) {
  const [rows, setRows] = useState(null);
  const [sex, setSex] = useState("mujer");

  useEffect(() => {
    loadMeasurements(userId).then(setRows);
    supabase.from("nutrition_profiles").select("gender").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data?.gender === "hombre" || data?.gender === "mujer") setSex(data.gender);
    });
  }, [userId]);

  if (!rows) return null;
  const last = rows[0];
  const days = last ? daysSince(last.measured_on) : null;
  const due = !last || days >= MEASURE_DAYS;
  const hasToday = last?.measured_on === localDateString() && last.created_by === userId;

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-3">
        <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em]">{tr("Medidas corporales")}</p>
        {last && (
          <button onClick={onOpen} className="text-accent text-xs font-medium">
            {hasToday ? tr("Editar las de hoy") : tr("+ Registrar medidas")}
          </button>
        )}
      </div>

      {!last ? (
        <div className="rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-4 grid grid-cols-[110px_minmax(0,1fr)] gap-4 items-center">
          <BodyFigure sex={sex} t={tr} className="w-full h-44" />
          <div>
            <p className="text-ink text-sm font-medium mb-1">{tr("Tome sus primeras medidas")}</p>
            <p className="text-soft text-xs mb-3">
              {tr("Con una cinta métrica, en unos 10 minutos. Verá su % de grasa, en qué percentil está para su edad y cómo cambia su cuerpo mes a mes.")}
            </p>
            <button onClick={onOpen} className="bg-accent text-app text-sm font-semibold rounded-xl px-4 py-2.5">
              {tr("Empezar")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {due && (
            <button onClick={onOpen} className="w-full rounded-2xl bg-accent/[0.08] border border-accent/25 p-4 mb-2.5 flex items-center gap-3 text-left">
              <Ruler size={18} className="text-accent shrink-0" />
              <span className="flex-1">
                <span className="block text-ink text-sm font-medium">{tr("Le toca tomar sus medidas")}</span>
                <span className="block text-soft text-xs">{tr("Su última medición fue hace {p0} días.", { p0: days })}</span>
              </span>
              <ChevronRight size={16} className="text-accent" />
            </button>
          )}
          <MeasurementsOverview rows={rows} userId={userId} t={tr} locale={appLocale()} fallbackSex={sex} />
        </>
      )}
    </div>
  );
}
