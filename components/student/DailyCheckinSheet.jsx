"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { DAILY_FIELDS, dailyCheckinKey } from "@/lib/checkin";
import { localDateString } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { cleanDecimal, toNumber } from "@/lib/numbers";
import { Scale } from "@/components/student/CheckinScreen";

// Check-in diario (opcional): aparece al tocar "Empezar" la rutina de hoy. Se puede saltar.
export function DailyCheckinSheet({ userId, healthConsent = true, onDone }) {
  const today = localDateString();
  const [form, setForm] = useState({ sleep: null, sleep_hours: "", energy: null, soreness: null, stress: null, mood: null, pain: false, pain_area: "", pain_level: 3 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const remember = () => {
    try { localStorage.setItem(dailyCheckinKey(userId, today), "1"); } catch { }
  };
  const skip = () => {
    remember();
    onDone();
  };

  const save = async () => {
    const answered = DAILY_FIELDS.some((f) => form[f.key] != null) || form.pain || form.sleep_hours;
    if (!answered) return skip();
    if (form.pain && !form.pain_area.trim()) return setError(tr("Cuéntenos dónde le duele."));
    setSaving(true);
    setError("");
    const hours = toNumber(form.sleep_hours);
    const row = {
      user_id: userId,
      check_date: today,
      sleep: form.sleep,
      sleep_hours: hours != null && hours >= 0 && hours <= 16 ? hours : null,
      energy: form.energy,
      soreness: form.soreness,
      stress: form.stress,
      mood: form.mood,
      pain: healthConsent ? form.pain : false,
      pain_area: healthConsent && form.pain ? form.pain_area.trim().slice(0, 200) : null,
      pain_level: healthConsent && form.pain ? form.pain_level : null,
    };
    const { error: e } = await supabase.from("daily_checkins").upsert(row, { onConflict: "user_id,check_date" });
    setSaving(false);
    if (e) return setError(tr("No se pudo guardar: "));
    remember();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-night/80 flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-gradient-to-b from-card to-deep border border-white/[0.06] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-ink text-lg font-semibold tracking-tight">{tr("¿Cómo llega hoy?")}</p>
            <p className="text-soft text-xs mt-0.5">{tr("Opcional · menos de 30 segundos. Su coach lo usa para ajustar el entreno.")}</p>
          </div>
          <button onClick={skip} aria-label={tr("Saltar")} className="w-9 h-9 shrink-0 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-soft">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 mt-4">
          {DAILY_FIELDS.map((f) => (
            <div key={f.key}>
              <Scale field={f} value={form[f.key]} onChange={(v) => set(f.key, form[f.key] === v ? null : v)} />
              {f.key === "sleep" && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-muted text-xs">{tr("Horas que durmió (opcional)")}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.sleep_hours}
                    onChange={(e) => set("sleep_hours", cleanDecimal(e.target.value, 1))}
                    placeholder="7,5"
                    className="w-20 bg-app/60 border border-white/[0.07] text-ink text-sm rounded-lg px-3 py-1.5 outline-none text-center"
                  />
                </div>
              )}
            </div>
          ))}

          {healthConsent && (
            <div>
              <p className="text-ink text-sm font-medium mb-2">{tr("¿Tiene algún dolor o molestia?")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[false, true].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => set("pain", v)}
                    className={`rounded-xl py-2.5 text-sm font-medium ${form.pain === v ? "bg-accent text-app" : "bg-white/[0.04] border border-white/[0.06] text-soft"}`}
                  >
                    {v ? tr("Sí") : tr("No")}
                  </button>
                ))}
              </div>
              {form.pain && (
                <div className="space-y-3 mt-3">
                  <input
                    value={form.pain_area}
                    onChange={(e) => set("pain_area", e.target.value)}
                    maxLength={200}
                    placeholder={tr("¿Dónde? Ej: rodilla derecha")}
                    className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none focus:border-accent/50"
                  />
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-ink text-sm">{tr("¿Qué tan fuerte?")}</p>
                      <p className={`text-sm font-semibold tabular-nums ${form.pain_level >= 7 ? "text-danger" : "text-soft"}`}>{form.pain_level}/10</p>
                    </div>
                    <input type="range" min="1" max="10" value={form.pain_level} onChange={(e) => set("pain_level", Number(e.target.value))} className="w-full accent-danger" />
                  </div>
                  {form.pain_level >= 7 && (
                    <p className="text-danger text-xs">{tr("Con un dolor así, avísele a su coach antes de entrenar y no fuerce esa zona.")}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">{error}</p>}

        <div className="grid grid-cols-[1fr_2fr] gap-2 mt-5">
          <button onClick={skip} className="bg-white/[0.04] border border-white/[0.06] text-soft text-sm rounded-2xl py-3">{tr("Saltar")}</button>
          <button onClick={save} disabled={saving} className="bg-accent text-app text-sm font-semibold rounded-2xl py-3 disabled:opacity-60">
            {saving ? tr("Guardando...") : tr("Guardar y empezar")}
          </button>
        </div>
      </div>
    </div>
  );
}
