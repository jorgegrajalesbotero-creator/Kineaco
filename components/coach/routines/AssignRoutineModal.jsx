"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { WEEK_DAYS } from "@/lib/dates";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/ui/Search";

// Ventana para asignar una rutina a un alumno en uno o varios días de la semana (días fijos)
export function AssignRoutineModal({ routine, onClose }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [days, setDays] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name").eq("role", "alumno").order("full_name").then(({ data }) => {
      setStudents(data || []);
      setLoading(false);
    });
  }, []);

  const toggleDay = (d) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]));

  const assign = async () => {
    if (!studentId) return alert("Elija un alumno.");
    if (days.length === 0) return alert("Elija al menos un día.");
    setSaving(true);
    // order_index: después de las rutinas que ya tiene ese día
    const { data: existing } = await supabase
      .from("routine_assignments")
      .select("day_label, order_index")
      .eq("user_id", studentId);
    const maxByDay = {};
    (existing || []).forEach((a) => { maxByDay[a.day_label] = Math.max(maxByDay[a.day_label] ?? -1, a.order_index ?? 0); });
    const rows = days.map((d) => ({ user_id: studentId, routine_id: routine.id, day_label: d, order_index: (maxByDay[d] ?? -1) + 1 }));
    const { error } = await supabase.from("routine_assignments").insert(rows);
    setSaving(false);
    if (error) return alert("No se pudo asignar: " + error.message);
    setDone(true);
  };

  const name = students.find((s) => s.id === studentId)?.full_name || "el alumno";
  const filtered = students.filter((s) => matchesSearch(query, s.full_name));

  return (
    <div className="fixed inset-0 z-[70] bg-night/80 flex items-end md:items-center justify-center p-0 md:p-4" role="dialog" aria-modal="true">
      <div className="w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-ink text-lg font-semibold tracking-tight">Asignar rutina</p>
            <p className="text-soft text-xs mt-0.5 truncate">{routine.title}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 shrink-0 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-soft"><X size={16} /></button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-3"><Check size={22} className="text-accent" /></div>
            <p className="text-ink text-sm font-medium mb-1">Listo</p>
            <p className="text-soft text-xs mb-5">Se le asignó "{routine.title}" a {name} en {days.length === 1 ? "el día" : "los días"} {days.join(", ")}.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { setDone(false); setStudentId(""); setDays([]); }} className="bg-field text-soft text-sm rounded-xl px-4 py-2.5">Asignar a otro</button>
              <button onClick={onClose} className="bg-accent text-app text-sm font-semibold rounded-xl px-4 py-2.5">Cerrar</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted text-xs mb-2">Alumno</p>
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar alumno..." className="mb-2" />
            <div className="max-h-44 overflow-y-auto space-y-1 mb-4">
              {loading ? (
                <p className="text-muted text-sm px-1">Cargando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted text-sm px-1">No hay alumnos que coincidan.</p>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStudentId(s.id)}
                    className={`w-full text-left text-sm rounded-lg px-3 py-2 flex items-center justify-between ${studentId === s.id ? "bg-accent text-app font-medium" : "bg-field/60 text-ink"}`}
                  >
                    {s.full_name || "Sin nombre"}
                    {studentId === s.id && <Check size={15} />}
                  </button>
                ))
              )}
            </div>

            <p className="text-muted text-xs mb-2">Días de la semana</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-5">
              {WEEK_DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg py-2 text-xs font-medium ${days.includes(d) ? "bg-accent text-app" : "bg-field/60 text-soft"}`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
            <p className="text-muted text-[11px] mb-4">La rutina se suma a ese día (si ya tenía otra, quedan las dos en orden). No reemplaza un plan por semanas que esté activo.</p>

            <button onClick={assign} disabled={saving} className="w-full bg-accent text-app font-semibold text-sm rounded-2xl py-3 disabled:opacity-60">
              {saving ? "Asignando..." : "Asignar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
