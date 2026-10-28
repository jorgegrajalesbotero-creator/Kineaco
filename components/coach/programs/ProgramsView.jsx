"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Home, X } from "lucide-react";
import { WEEK_DAYS } from "@/lib/dates";
import { supabase } from "@/lib/supabaseClient";
import { DayRoutinesEditor } from "@/components/coach/programs/DayRoutinesEditor";
import { Skeleton } from "@/components/ui/Skeleton";

export const PROGRAM_GOALS = [
  { key: "deficit", label: "Bajar grasa" },
  { key: "mantener", label: "Mantener" },
  { key: "superavit", label: "Ganar músculo" },
];

export const PROGRAM_LOCATIONS = [
  { key: "casa", label: "Casa" },
  { key: "gym", label: "Gym" },
];

export function ProgramsView() {
  const [routines, setRoutines] = useState([]);
  const [programs, setPrograms] = useState({});
  const [loading, setLoading] = useState(true);
  const [managingKey, setManagingKey] = useState(null);
  const [managingName, setManagingName] = useState("");
  const [managingDays, setManagingDays] = useState({});
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    const { data: routinesData } = await supabase.from("routines").select("id, title").order("title");
    setRoutines(routinesData || []);

    const { data: programsData } = await supabase
      .from("programs")
      .select("id, name, goal, location, program_days(day_label, routine_id, order_index)");

    const map = {};
    (programsData || []).forEach((p) => {
      const key = `${p.goal}_${p.location}`;
      const days = {};
      [...(p.program_days || [])]
        .sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0))
        .forEach((d) => { days[d.day_label] = [...(days[d.day_label] || []), d.routine_id]; });
      map[key] = { id: p.id, name: p.name, days };
    });
    setPrograms(map);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const openManage = (goal, location) => {
    const key = `${goal}_${location}`;
    const existing = programs[key];
    setManagingKey(key);
    setManagingName(existing?.name || `${PROGRAM_GOALS.find((g) => g.key === goal).label} + ${PROGRAM_LOCATIONS.find((l) => l.key === location).label}`);
    setManagingDays(existing?.days || {});
  };

  const closeManage = () => {
    setManagingKey(null);
    setManagingName("");
    setManagingDays({});
  };

  const saveProgram = async () => {
    if (!managingKey) return;
    setSaving(true);
    const [goal, location] = managingKey.split("_");

    const { data: upserted, error } = await supabase
      .from("programs")
      .upsert({ goal, location, name: managingName || "Sin nombre" }, { onConflict: "goal,location" })
      .select()
      .single();

    if (error || !upserted) {
      alert("Error al guardar el programa.");
      setSaving(false);
      return;
    }

    const { error: delDaysErr } = await supabase.from("program_days").delete().eq("program_id", upserted.id);
    if (delDaysErr) {
      alert("Error al guardar los días del programa: ");
      setSaving(false);
      return;
    }

    const rows = WEEK_DAYS.flatMap((day) =>
      (managingDays[day] || []).map((routineId, i) => ({
        program_id: upserted.id,
        day_label: day,
        routine_id: routineId,
        order_index: i,
      }))
    );

    if (rows.length > 0) {
      const { error: insDaysErr } = await supabase.from("program_days").insert(rows);
      if (insDaysErr) {
        alert("Error al guardar los días del programa: ");
        setSaving(false);
        loadAll();
        return;
      }
    }

    setSaving(false);
    closeManage();
    loadAll();
  };

  if (managingKey) {
    const [goal, location] = managingKey.split("_");
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-ink text-xl font-semibold">
            {PROGRAM_GOALS.find((g) => g.key === goal).label} · {PROGRAM_LOCATIONS.find((l) => l.key === location).label}
          </h2>
          <button onClick={closeManage} className="text-muted"><X size={20} /></button>
        </div>

        <div className="bg-card rounded-xl p-4 mb-4">
          <p className="text-muted text-xs mb-1">Nombre del programa</p>
          <input value={managingName} onChange={(e) => setManagingName(e.target.value)} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" />
        </div>

        <p className="text-muted text-xs uppercase tracking-wider mb-2">Rutinas de cada día (en orden)</p>
        <div className="mb-6">
          <DayRoutinesEditor
            days={managingDays}
            routines={routines}
            emptyLabel="Descanso"
            onChangeDay={(day, list) => setManagingDays((d) => ({ ...d, [day]: list }))}
          />
        </div>

        {routines.length === 0 && <p className="text-muted text-xs italic mb-4">Todavía no tenés rutinas creadas — armalas primero en la pestaña "Rutinas".</p>}

        <button onClick={saveProgram} disabled={saving} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-60">
          {saving ? "Guardando..." : "Guardar programa"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-ink text-xl font-semibold mb-1">Programas</h2>
      <p className="text-muted text-sm mb-6">Cuando un alumno cambia su objetivo o lugar de entreno en Nutrición, se le asigna automáticamente el programa correspondiente.</p>

      {loading ? (
        <Skeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROGRAM_GOALS.map((g) =>
            PROGRAM_LOCATIONS.map((l) => {
              const key = `${g.key}_${l.key}`;
              const existing = programs[key];
              const daysCount = existing ? Object.values(existing.days).filter((l) => l.length > 0).length : 0;
              return (
                <button
                  key={key}
                  onClick={() => openManage(g.key, l.key)}
                  className="bg-card rounded-xl p-4 text-left hover:ring-1 hover:ring-accent/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-ink font-medium text-sm">{g.label}</span>
                    <span className="flex items-center gap-1 text-soft text-xs">
                      {l.key === "casa" ? <Home size={12} /> : <Dumbbell size={12} />} {l.label}
                    </span>
                  </div>
                  <p className="text-muted text-xs">
                    {existing ? `${daysCount} día${daysCount === 1 ? "" : "s"} configurado${daysCount === 1 ? "" : "s"}` : "Sin configurar"}
                  </p>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
