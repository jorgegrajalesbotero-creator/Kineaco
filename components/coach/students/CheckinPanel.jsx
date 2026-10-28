"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DAILY_FIELDS, WELLBEING_FIELDS, formatWeek } from "@/lib/checkin";
import { Skeleton } from "@/components/ui/Skeleton";
import { PanelLayout } from "./PanelLayout";

// Color según el valor: en estrés y hambre, alto es malo
const HIGH_IS_BAD = new Set(["stress", "hunger", "soreness"]);
const tone = (key, v) => {
  if (v == null) return "text-muted";
  const good = HIGH_IS_BAD.has(key) ? v <= 2 : v >= 4;
  const bad = HIGH_IS_BAD.has(key) ? v >= 4 : v <= 2;
  return good ? "text-accent" : bad ? "text-danger" : "text-ink";
};

const dayTitle = (d) => {
  const x = new Date(`${d}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" });
  return x.charAt(0).toUpperCase() + x.slice(1);
};

// ¿Llegó mal? (mismo criterio que el aviso al coach)
const dailyAlert = (c) => (c.pain && c.pain_level >= 7) || c.energy === 1 || c.sleep === 1 || c.soreness === 5;

// Check-ins diarios (antes de entrenar) del alumno
function DailyList({ student }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    supabase
      .from("daily_checkins")
      .select("*")
      .eq("user_id", student.id)
      .order("check_date", { ascending: false })
      .limit(30)
      .then(({ data }) => setItems(data || []));
  }, [student.id]);

  if (!items) return <Skeleton rows={3} height="h-24" />;
  if (items.length === 0)
    return (
      <div className="bg-card rounded-xl p-5">
        <p className="text-muted text-sm">Todavía no respondió ningún check-in diario. Se le pregunta (opcional) al empezar la rutina de cada día.</p>
      </div>
    );

  // Promedio de los últimos 7 registros
  const last = items.slice(0, 7);
  const avg = (k) => {
    const v = last.map((c) => c[k]).filter((x) => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-2xl p-4">
        <p className="text-muted text-xs mb-2">Promedio de los últimos {last.length} días con respuesta</p>
        <div className="grid grid-cols-5 gap-2">
          {DAILY_FIELDS.map((f) => {
            const v = avg(f.key);
            return (
              <div key={f.key} className="bg-field/60 rounded-xl py-2 text-center">
                <p className={`text-lg font-semibold tabular-nums leading-none ${tone(f.key, v == null ? null : Math.round(v))}`}>{v ?? "—"}</p>
                <p className="text-muted text-[10px] mt-1">{f.label}</p>
              </div>
            );
          })}
        </div>
      </div>
      {items.map((c) => (
        <div key={c.id} className={`bg-card rounded-2xl p-4 ${dailyAlert(c) ? "border border-danger/30" : ""}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-ink text-sm font-medium">{dayTitle(c.check_date)}</p>
            {dailyAlert(c) && <span className="text-[11px] text-danger bg-danger/10 rounded px-1.5 py-0.5">⚠ Llegó mal</span>}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DAILY_FIELDS.map((f) => (
              <div key={f.key} className="bg-field/60 rounded-xl py-2 text-center">
                <p className={`text-lg font-semibold tabular-nums leading-none ${tone(f.key, c[f.key])}`}>{c[f.key] ?? "—"}</p>
                <p className="text-muted text-[10px] mt-1">{f.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mt-3">
            {c.sleep_hours != null && <p className="text-soft">Durmió <span className="text-ink">{String(c.sleep_hours).replace(".", ",")} h</span></p>}
            <p className="text-soft">
              Dolor:{" "}
              <span className={c.pain ? (c.pain_level >= 7 ? "text-danger" : "text-ink") : "text-ink"}>
                {c.pain ? `${c.pain_area || "sin detalle"} · ${c.pain_level}/10` : "no"}
              </span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Check-ins del alumno: diario (antes de entrenar) y semanal (con respuesta del coach)
export function CheckinPanel({ student, onClose }) {
  const [tab, setTab] = useState("diario");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  async function load() {
    const { data } = await supabase
      .from("weekly_checkins")
      .select("*")
      .eq("user_id", student.id)
      .order("week_start", { ascending: false })
      .limit(12);
    setItems(data || []);
    setDrafts(Object.fromEntries((data || []).map((c) => [c.id, c.coach_reply || ""])));
    setLoading(false);
  }

  useEffect(() => { load(); }, [student.id]);

  const saveReply = async (c) => {
    setSavingId(c.id);
    const { error } = await supabase
      .from("weekly_checkins")
      .update({ coach_reply: drafts[c.id].trim() || null })
      .eq("id", c.id);
    setSavingId(null);
    if (error) return alert("No se pudo guardar la respuesta: ");
    load();
  };

  return (
    <PanelLayout title="Check-ins" subtitle={student.name} onClose={onClose} width="max-w-2xl">
      <div className="flex gap-2 mb-4">
        {[["diario", "Diario"], ["semanal", "Semanal (domingos)"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-lg text-sm ${tab === k ? "bg-accent text-app font-medium" : "bg-card text-soft"}`}>{l}</button>
        ))}
      </div>
      {tab === "diario" ? (
        <DailyList student={student} />
      ) : loading ? (
        <Skeleton rows={3} height="h-32" />
      ) : items.length === 0 ? (
        <div className="bg-card rounded-xl p-5">
          <p className="text-muted text-sm">Este alumno todavía no envió ningún check-in. Se le habilita los domingos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-ink text-sm font-medium">Semana {formatWeek(c.week_start)}</p>
                {c.pain && c.pain_level >= 7 && (
                  <span className="text-[11px] text-danger bg-danger/10 rounded px-1.5 py-0.5">⚠ Dolor {c.pain_level}/10</span>
                )}
              </div>

              <div className="grid grid-cols-5 gap-2 mb-3">
                {WELLBEING_FIELDS.map((f) => (
                  <div key={f.key} className="bg-field/60 rounded-xl py-2 text-center">
                    <p className={`text-lg font-semibold tabular-nums leading-none ${tone(f.key, c[f.key])}`}>{c[f.key]}</p>
                    <p className="text-muted text-[10px] mt-1">{f.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs mb-3">
                <div><p className="text-muted">Entrenos</p><p className="text-ink">{c.training_adherence}%</p></div>
                <div><p className="text-muted">Alimentación</p><p className="text-ink">{c.diet_adherence}%</p></div>
                <div><p className="text-muted">Peso</p><p className="text-ink">{c.weight_kg != null ? `${c.weight_kg} kg` : "—"}</p></div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-muted">Dolor o molestias</p>
                  <p className={c.pain ? (c.pain_level >= 7 ? "text-danger" : "text-ink") : "text-ink"}>
                    {c.pain ? `${c.pain_area || "Sin detalle"} · ${c.pain_level}/10` : "No"}
                  </p>
                </div>
              </div>

              {c.comment && (
                <p className="text-ink text-sm bg-field/60 rounded-xl px-3 py-2 mb-3 whitespace-pre-wrap">"{c.comment}"</p>
              )}

              <textarea
                value={drafts[c.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                rows={2}
                maxLength={2000}
                placeholder="Respuesta para el alumno (le llega un aviso)..."
                className="w-full bg-field text-ink text-sm rounded-xl px-3 py-2 outline-none resize-none mb-2"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => saveReply(c)}
                  disabled={savingId === c.id || (drafts[c.id] ?? "") === (c.coach_reply || "")}
                  className="bg-accent text-app text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-40"
                >
                  {savingId === c.id ? "Guardando..." : c.coach_reply ? "Actualizar respuesta" : "Responder"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelLayout>
  );
}
