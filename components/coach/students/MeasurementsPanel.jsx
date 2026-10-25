"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { daysSince } from "@/lib/dates";
import { MEASURE_DAYS } from "@/lib/measurements";
import { Skeleton } from "@/components/ui/Skeleton";
import { MeasurementWizard } from "@/components/measurements/MeasurementWizard";
import { MeasurementsOverview, formatMeasureDate, loadMeasurements } from "@/components/measurements/MeasurementsOverview";
import { PanelLayout } from "./PanelLayout";

// Medidas corporales del alumno: resultados, comparación y registro hecho por el coach
export function MeasurementsPanel({ student, onClose }) {
  const [rows, setRows] = useState(null);
  const [sex, setSex] = useState("mujer");
  const [adding, setAdding] = useState(false);

  async function load() {
    setRows(await loadMeasurements(student.id));
  }

  useEffect(() => {
    load();
    supabase.from("nutrition_profiles").select("gender").eq("user_id", student.id).maybeSingle().then(({ data }) => {
      if (data?.gender === "hombre" || data?.gender === "mujer") setSex(data.gender);
    });
  }, [student.id]);

  if (adding) {
    return (
      <PanelLayout title="Registrar medidas" subtitle={student.name} onClose={() => setAdding(false)} width="max-w-xl">
        <div className="-mx-5">
          <MeasurementWizard userId={student.id} coachMode onClose={(saved) => { setAdding(false); if (saved) load(); }} />
        </div>
      </PanelLayout>
    );
  }

  const last = rows?.[0];
  const days = last ? daysSince(last.measured_on) : null;

  return (
    <PanelLayout title="Medidas corporales" subtitle={student.name} onClose={onClose} width="max-w-5xl">
      {!rows ? (
        <Skeleton rows={3} height="h-32" />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className={`text-xs ${!last || days >= MEASURE_DAYS ? "text-warning" : "text-muted"}`}>
              {!last
                ? "Todavía no tiene medidas registradas."
                : `Última: ${formatMeasureDate(last.measured_on)} (hace ${days} días)${days >= MEASURE_DAYS ? " · le toca medirse" : ""}`}
            </p>
            <button onClick={() => setAdding(true)} className="bg-accent text-app text-xs font-semibold rounded-lg px-4 py-2 shrink-0">
              + Registrar
            </button>
          </div>
          <MeasurementsOverview rows={rows} userId={student.id} fallbackSex={sex} wide />
        </>
      )}
    </PanelLayout>
  );
}
