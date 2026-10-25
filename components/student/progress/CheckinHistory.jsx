"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { checkinWeekStart, formatWeek, isCheckinDay } from "@/lib/checkin";
import { appLocale, tr } from "@/lib/i18n";

const avg = (c) => Math.round(((c.sleep + c.energy + (6 - c.stress) + c.mood) / 4) * 10) / 10;

// Historial de check-ins del alumno, con las respuestas de su coach
export function CheckinHistory({ userId, onOpenCheckin }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    supabase
      .from("weekly_checkins")
      .select("id, week_start, sleep, energy, stress, mood, training_adherence, diet_adherence, pain, pain_level, coach_reply")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(8)
      .then(({ data }) => setItems(data || []));
  }, [userId]);

  if (!items) return null;
  const thisWeekDone = items.some((c) => c.week_start === checkinWeekStart());

  return (
    <div className="mb-7">
      <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3">{tr("Check-ins semanales")}</p>
      {isCheckinDay() && !thisWeekDone && (
        <button onClick={onOpenCheckin} className="w-full rounded-2xl bg-accent/[0.08] border border-accent/25 p-4 mb-2.5 flex items-center gap-3 text-left">
          <ClipboardCheck size={18} className="text-accent shrink-0" />
          <span className="flex-1 text-ink text-sm font-medium">{tr("Hacer el check-in de esta semana")}</span>
          <ChevronRight size={16} className="text-accent" />
        </button>
      )}
      {items.length === 0 ? (
        <p className="text-muted text-sm">{tr("Todavía no ha hecho ningún check-in. Se habilita los domingos.")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-ink text-sm font-medium">{formatWeek(c.week_start, appLocale())}</p>
                <p className="text-soft text-xs tabular-nums">{tr("Bienestar")} {avg(c)}/5</p>
              </div>
              <p className="text-muted text-xs">
                {tr("Entrenos")} {c.training_adherence}% · {tr("Alimentación")} {c.diet_adherence}%
                {c.pain ? ` · ${tr("Dolor")} ${c.pain_level}/10` : ""}
              </p>
              {c.coach_reply && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                  <p className="text-accent text-[11px] font-medium mb-0.5">{tr("Respuesta de su coach")}</p>
                  <p className="text-ink text-sm whitespace-pre-wrap">{c.coach_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
