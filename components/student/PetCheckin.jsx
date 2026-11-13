"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { localDateString } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { cleanDecimal, toNumber } from "@/lib/numbers";
import { PET_NAME_MAX, PET_STATES, petMood, petMoodForAnswer } from "@/lib/chameleon";
import { Chameleon } from "@/components/ui/Chameleon";

// Preguntas del check-in diario (1–5). En dolor muscular y estrés, más alto es peor.
const QUESTIONS = [
  { key: "sleep", q: "¿Cómo durmió?", labels: ["Muy mal", "Mal", "Regular", "Bien", "Muy bien"],
    say: ["Uf… a mí tampoco me alcanzó la noche.", "Hoy vamos con calma.", "Ni bien ni mal, ¿cierto?", "¡Buen descanso!", "¡Durmió como un camaleón en su rama!"] },
  { key: "energy", q: "¿Cuánta energía tiene?", labels: ["Nada", "Poca", "Media", "Buena", "Mucha"],
    say: ["Hoy suave, pero hoy cuenta.", "Arrancamos despacio.", "Suficiente para empezar.", "¡Eso!", "¡Hoy vamos con todo!"] },
  { key: "soreness", q: "¿Tiene dolor muscular?", labels: ["Nada", "Poco", "Algo", "Bastante", "Mucho"],
    say: ["¡Como nuevo!", "Normal después de entrenar.", "Le cuento a su coach.", "Vamos con cuidado.", "Su coach lo va a ver hoy."] },
  { key: "stress", q: "¿Cómo está su estrés?", labels: ["Nada", "Poco", "Algo", "Bastante", "Mucho"],
    say: ["Tranquilo como la rama.", "Bien llevado.", "Respiramos y seguimos.", "Me puse rojo… ¡a soltarlo entrenando!", "Respire hondo. Una serie a la vez."] },
  { key: "mood", q: "¿Y su ánimo hoy?", labels: ["Mal", "Bajo", "Normal", "Bien", "Con toda"],
    say: ["Aquí estoy con usted.", "Hoy suave, pero hoy cuenta.", "Paso a paso.", "¡Buen día para entrenar!", "¡Hoy vamos con todo!"] },
];

const btn = "block w-full rounded-2xl py-3.5 text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-60";

// Check-in diario con el camaleón. La primera vez es obligatorio (le pone nombre al camaleón y responde);
// después es opcional (optional = muestra "Ahora no" → onSkip). El nombre se puede cambiar una vez desde Perfil.
export function PetCheckin({ userId, petName, healthConsent = true, optional = false, onPetNamed, onDone, onSkip }) {
  const needsName = !petName;
  const [step, setStep] = useState(needsName ? -1 : 0);
  const [name, setName] = useState("");
  const [form, setForm] = useState({ sleep: null, sleep_hours: "", energy: null, soreness: null, stress: null, mood: null, pain: false, pain_area: "", pain_level: 3 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const pet = petName || name.trim() || tr("Su camaleón");
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(""); };

  const steps = QUESTIONS.length + (healthConsent ? 1 : 0); // preguntas + dolor en zona
  const isPain = healthConsent && step === QUESTIONS.length;
  const q = step >= 0 && step < QUESTIONS.length ? QUESTIONS[step] : null;

  // Estado que muestra el camaleón mientras responde
  const liveMood = saved
    ? petMood(saved)
    : q && form[q.key] != null
      ? petMoodForAnswer(q.key, form[q.key])
      : petMood(form) && QUESTIONS.some((x) => form[x.key] != null) ? petMood(form) : 4;

  const saveName = async () => {
    const v = name.trim().slice(0, PET_NAME_MAX);
    if (!v) return setError(tr("Escriba un nombre para continuar."));
    setSaving(true);
    const { error: e } = await supabase.from("profiles").update({ pet_name: v }).eq("id", userId);
    setSaving(false);
    if (e) return setError(tr("No se pudo guardar: "));
    onPetNamed?.(v);
    setStep(0);
  };

  const finish = async () => {
    if (form.pain && !form.pain_area.trim()) return setError(tr("Cuéntenos dónde le duele."));
    setSaving(true);
    const hours = toNumber(form.sleep_hours);
    const row = {
      user_id: userId,
      check_date: localDateString(),
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
    setSaved(row);
  };

  const next = () => {
    if (q && form[q.key] == null) return setError(tr("Elija una opción para seguir."));
    setError("");
    if (step + 1 >= steps) return finish();
    setStep(step + 1);
  };

  let title, say, body;
  if (saved) {
    const k = petMood(saved);
    title = tr("¡Listo! {p0} ya sabe cómo llega", { p0: pet });
    say = tr("Estado de hoy: {p0}", { p0: tr(PET_STATES[k].name) });
    body = (
      <>
        <p className="text-soft text-sm text-center mb-5">
          {k === 1 ? tr("Hoy estará rojo, como usted: vamos a soltar ese estrés entrenando.") : tr("Hoy lo va a acompañar así en su Inicio y durante la rutina.")}
        </p>
        <button onClick={() => onDone(saved)} className={`${btn} bg-accent text-app`}>{tr("Continuar")}</button>
      </>
    );
  } else if (step === -1) {
    title = tr("Conozca a su compañero");
    say = tr("Lo va a acompañar en cada entrenamiento y cambia de color según cómo llegue cada día.");
    body = (
      <>
        <label className="block text-soft text-xs mb-1.5" htmlFor="pet-name">{tr("Póngale un nombre")}</label>
        <input
          id="pet-name"
          value={name}
          maxLength={PET_NAME_MAX}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder={tr("Ej: Kiko")}
          className="w-full bg-app/60 border border-white/[0.08] text-ink text-base rounded-xl px-3.5 py-3 outline-none focus:border-accent/50"
        />
        <p className="text-muted text-[11px] mt-1.5 mb-5">{tr("Podrá cambiarlo una sola vez, por si se equivoca.")}</p>
        <button onClick={saveName} disabled={saving} className={`${btn} bg-accent text-app`}>{saving ? tr("Guardando...") : tr("Continuar")}</button>
      </>
    );
  } else if (isPain) {
    title = tr("¿Le duele alguna zona?");
    say = form.pain ? `${pet}: ${tr("“Le aviso a su coach para cuidarlo.”")}` : `${pet}: ${tr("“Si algo le duele, cuénteme.”")}`;
    body = (
      <>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" onClick={() => set("pain", v)}
              className={`rounded-xl py-3 text-sm font-medium ${form.pain === v ? "bg-accent text-app" : "bg-white/[0.04] border border-white/[0.06] text-soft"}`}>
              {v ? tr("Sí") : tr("No")}
            </button>
          ))}
        </div>
        {form.pain && (
          <div className="space-y-3 mb-3">
            <input value={form.pain_area} onChange={(e) => set("pain_area", e.target.value)} maxLength={200} placeholder={tr("¿Dónde? Ej: rodilla derecha")}
              className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none focus:border-accent/50" />
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-ink text-sm">{tr("¿Qué tan fuerte?")}</p>
                <p className={`text-sm font-semibold tabular-nums ${form.pain_level >= 7 ? "text-danger" : "text-soft"}`}>{form.pain_level}/10</p>
              </div>
              <input type="range" min="1" max="10" value={form.pain_level} onChange={(e) => set("pain_level", Number(e.target.value))} className="w-full accent-danger" />
            </div>
            {form.pain_level >= 7 && <p className="text-danger text-xs">{tr("Con un dolor así, avísele a su coach antes de entrenar y no fuerce esa zona.")}</p>}
          </div>
        )}
        <button onClick={next} disabled={saving} className={`${btn} bg-accent text-app mt-2`}>{saving ? tr("Guardando...") : tr("Terminar")}</button>
        <button onClick={() => setStep(step - 1)} className="block w-full text-muted text-xs py-3">{tr("Atrás")}</button>
      </>
    );
  } else if (q) {
    const v = form[q.key];
    title = tr(q.q);
    say = v != null ? `${pet}: “${tr(q.say[v - 1])}”` : tr("{p0} está esperando su respuesta.", { p0: pet });
    body = (
      <>
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {q.labels.map((label, i) => (
            <button key={label} type="button" onClick={() => set(q.key, i + 1)}
              className={`rounded-xl py-2.5 px-0.5 flex flex-col items-center gap-0.5 transition-colors ${v === i + 1 ? "bg-accent text-app" : "bg-white/[0.04] border border-white/[0.06] text-soft"}`}>
              <span className="text-base font-semibold leading-none">{i + 1}</span>
              <span className="text-[10px] leading-tight text-center">{tr(label)}</span>
            </button>
          ))}
        </div>
        {q.key === "sleep" && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-muted text-xs">{tr("Horas que durmió (opcional)")}</span>
            <input type="text" inputMode="decimal" value={form.sleep_hours} onChange={(e) => set("sleep_hours", cleanDecimal(e.target.value, 1))} placeholder="7,5"
              className="w-20 bg-app/60 border border-white/[0.07] text-ink text-sm rounded-lg px-3 py-1.5 outline-none text-center" />
          </div>
        )}
        <button onClick={next} disabled={saving} className={`${btn} bg-accent text-app mt-2`}>
          {saving ? tr("Guardando...") : step + 1 >= steps ? tr("Terminar") : tr("Siguiente")}
        </button>
        {step > 0 && <button onClick={() => setStep(step - 1)} className="block w-full text-muted text-xs py-3">{tr("Atrás")}</button>}
      </>
    );
  }

  const progress = step < 0 ? 0 : saved ? steps : step;
  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8">
      <div className="max-w-md mx-auto">
        {step >= 0 && (
          <div className="flex gap-1 mb-5" aria-hidden="true">
            {Array.from({ length: steps }, (_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i < progress ? "bg-accent" : "bg-white/10"}`} />
            ))}
          </div>
        )}
        {optional && !saved && (
          <div className="flex justify-end -mt-2 mb-2">
            <button onClick={onSkip} className="text-soft text-xs bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5">{tr("Ahora no")}</button>
          </div>
        )}
        <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] text-center">{step === -1 ? tr("Bienvenida") : tr("Check-in de hoy")}</p>
        <h1 className="text-ink text-xl font-semibold tracking-tight text-center mt-1">{title}</h1>
        <p className="text-soft text-sm text-center mt-1 min-h-[20px]">{say}</p>
        <div className="my-3 flex justify-center">
          <Chameleon mood={liveMood || 4} size={230} />
        </div>
        {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mb-3">{error}</p>}
        {body}
      </div>
    </div>
  );
}
