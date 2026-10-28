"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { REVERSED, SCALE_FACES, WELLBEING_FIELDS, checkinWeekStart, formatWeek } from "@/lib/checkin";
import { appLocale, tr } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";
import { cleanDecimal, toNumber } from "@/lib/numbers";

const EMPTY = {
  sleep: null, energy: null, stress: null, mood: null, hunger: null,
  training_adherence: 80, diet_adherence: 80,
  pain: false, pain_area: "", pain_level: 3,
  weight_kg: "", comment: "",
};

const card = "rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-4";
const label = "text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3";

export function Scale({ field, value, onChange }) {
  const faces = REVERSED.has(field.key) ? [...SCALE_FACES].reverse() : SCALE_FACES;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-ink text-sm font-medium">{tr(field.label)}</p>
        <p className="text-muted text-[10px]">{tr(field.hint)}</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`rounded-xl py-2 flex flex-col items-center gap-0.5 transition-all active:scale-95 ${value === n ? "bg-accent text-app" : "bg-white/[0.04] border border-white/[0.06] text-soft"}`}
          >
            <span className="text-lg leading-none">{faces[n - 1]}</span>
            <span className="text-[11px] font-semibold tabular-nums">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Percent({ title, value, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-ink text-sm font-medium">{title}</p>
        <p className="text-accent text-sm font-semibold tabular-nums">{value}%</p>
      </div>
      <input type="range" min="0" max="100" step="10" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-accent" />
    </div>
  );
}

// Formulario del check-in semanal del alumno
export function CheckinScreen({ userId, onClose, healthConsent = true }) {
  const weekStart = checkinWeekStart();
  const [form, setForm] = useState(EMPTY);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("weekly_checkins").select("*").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
      if (data) {
        setExisting(data);
        setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] ?? EMPTY[k]])), weight_kg: data.weight_kg ?? "", pain_area: data.pain_area || "", comment: data.comment || "" });
      }
      setLoading(false);
    }
    load();
  }, [userId, weekStart]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError("");
    const missing = WELLBEING_FIELDS.filter((f) => !form[f.key]);
    if (missing.length) return setError(tr("Responda: {p0}.", { p0: missing.map((f) => tr(f.label)).join(", ") }));
    if (form.pain && !form.pain_area.trim()) return setError(tr("Cuéntenos dónde tuvo el dolor."));
    setSaving(true);
    const values = {
      user_id: userId,
      week_start: weekStart,
      sleep: form.sleep, energy: form.energy, stress: form.stress, mood: form.mood, hunger: form.hunger,
      training_adherence: form.training_adherence,
      diet_adherence: form.diet_adherence,
      pain: form.pain,
      pain_area: form.pain ? form.pain_area.trim().slice(0, 200) : null,
      pain_level: form.pain ? form.pain_level : null,
      weight_kg: toNumber(form.weight_kg),
      comment: form.comment.trim().slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = existing
      ? await supabase.from("weekly_checkins").update(values).eq("id", existing.id)
      : await supabase.from("weekly_checkins").insert(values);
    setSaving(false);
    if (err) return setError(tr("No se pudo guardar el check-in: ") + err.message);
    // El peso del check-in pasa solo a su historial de peso corporal (lo hace la base de datos)
    onClose(true);
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-3 pb-6">
      <button onClick={() => onClose(false)} aria-label={tr("Volver")} className="w-9 h-9 rounded-full bg-card border border-white/[0.06] flex items-center justify-center mb-4">
        <ChevronLeft size={18} className="text-ink" />
      </button>
      <p className="text-accent text-xs font-medium mb-1">{formatWeek(weekStart, appLocale())}</p>
      <h1 className="text-ink text-2xl font-semibold tracking-tight mb-1">{tr("Check-in semanal")}</h1>
      <p className="text-soft text-sm mb-6">{tr("Dos minutos para contarle a su coach cómo le fue esta semana.")}</p>

      {existing?.coach_reply && (
        <div className={`${card} mb-5 border-accent/25`}>
          <p className="text-accent text-xs font-medium mb-1">{tr("Respuesta de su coach")}</p>
          <p className="text-ink text-sm whitespace-pre-wrap">{existing.coach_reply}</p>
        </div>
      )}

      {loading ? (
        <Skeleton rows={4} height="h-20" />
      ) : (
        <div className="space-y-6">
          <section>
            <p className={label}>{tr("¿Cómo se sintió?")}</p>
            <div className={`${card} space-y-5`}>
              {WELLBEING_FIELDS.map((f) => (
                <Scale key={f.key} field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          </section>

          <section>
            <p className={label}>{tr("Cumplimiento")}</p>
            <div className={`${card} space-y-5`}>
              <Percent title={tr("Entrenamientos")} value={form.training_adherence} onChange={(v) => set("training_adherence", v)} />
              <Percent title={tr("Alimentación")} value={form.diet_adherence} onChange={(v) => set("diet_adherence", v)} />
            </div>
          </section>

          {healthConsent && <section>
            <p className={label}>{tr("Dolor o molestias")}</p>
            <div className={`${card} space-y-4`}>
              <div className="grid grid-cols-2 gap-2">
                {[false, true].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => set("pain", v)}
                    className={`rounded-xl py-2.5 text-sm font-medium ${form.pain === v ? "bg-accent text-app" : "bg-white/[0.04] border border-white/[0.06] text-soft"}`}
                  >
                    {v ? tr("Sí tuve") : tr("No tuve")}
                  </button>
                ))}
              </div>
              {form.pain && (
                <>
                  <input
                    value={form.pain_area}
                    onChange={(e) => set("pain_area", e.target.value)}
                    maxLength={200}
                    placeholder={tr("¿Dónde? Ej: rodilla derecha al hacer sentadilla")}
                    className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none focus:border-accent/50"
                  />
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-ink text-sm font-medium">{tr("¿Qué tan fuerte?")}</p>
                      <p className={`text-sm font-semibold tabular-nums ${form.pain_level >= 7 ? "text-danger" : "text-soft"}`}>{form.pain_level}/10</p>
                    </div>
                    <input type="range" min="1" max="10" value={form.pain_level} onChange={(e) => set("pain_level", Number(e.target.value))} className="w-full accent-danger" />
                  </div>
                </>
              )}
            </div>
          </section>}

          <section>
            <p className={label}>{tr("Peso y comentarios")}</p>
            <div className={`${card} space-y-3`}>
              <input
                type="text"
                inputMode="decimal"
                value={form.weight_kg}
                onChange={(e) => set("weight_kg", cleanDecimal(e.target.value))}
                placeholder={tr("Peso de esta semana en kg (opcional)")}
                className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none focus:border-accent/50"
              />
              <textarea
                value={form.comment}
                onChange={(e) => set("comment", e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={tr("¿Qué salió bien? ¿Qué le costó? ¿Algo que su coach deba saber?")}
                className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none focus:border-accent/50 resize-none"
              />
            </div>
          </section>

          {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{error}</p>}
          <button onClick={save} disabled={saving} className="block w-full bg-accent text-app font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60">
            {saving ? tr("Guardando...") : existing ? tr("Actualizar check-in") : tr("Enviar check-in")}
          </button>
        </div>
      )}
    </div>
  );
}
