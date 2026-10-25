"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { appLocale, tr } from "@/lib/i18n";
import { INTAKE_EXPERIENCE, INTAKE_GOALS } from "@/lib/intake";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/Skeleton";

export function IntakeScreen({ userId, title, subtitle, onSaved, onCancel, onSignOut, healthConsent = true }) {
  const empty = {
    main_goal: "",
    goal_detail: "",
    experience: "",
    days_per_week: "",
    past_injuries: null,
    past_injuries_detail: "",
    current_injury: null,
    current_injury_detail: "",
    medical_conditions: "",
    medications: "",
    medical_restriction: null,
    medical_restriction_detail: "",
    emergency_name: "",
    emergency_phone: "",
    declared_true: false,
  };
  const [form, setForm] = useState(empty);
  const [loadingForm, setLoadingForm] = useState(true);
  const [savingForm, setSavingForm] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("intake_forms")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const filled = { ...empty };
          Object.keys(empty).forEach((k) => {
            if (data[k] !== null && data[k] !== undefined) filled[k] = typeof empty[k] === "string" ? String(data[k]) : data[k];
          });
          setForm(filled);
          setLastUpdate(data.updated_at);
        }
        setLoadingForm(false);
      });
  }, [userId]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const missing = [];
  if (!form.main_goal) missing.push(tr("objetivo"));
  if (!form.experience) missing.push(tr("experiencia"));
  if (!form.days_per_week) missing.push(tr("días por semana"));
  // Las preguntas de salud solo se piden con autorización de datos sensibles
  if (healthConsent) {
    if (form.past_injuries === null) missing.push(tr("lesiones pasadas"));
    if (form.past_injuries && !form.past_injuries_detail.trim()) missing.push(tr("cuáles lesiones tuvo"));
    if (form.current_injury === null) missing.push(tr("lesión actual"));
    if (form.current_injury && !form.current_injury_detail.trim()) missing.push(tr("cuál es su lesión actual"));
    if (form.medical_restriction === null) missing.push(tr("restricción médica"));
    if (form.medical_restriction && !form.medical_restriction_detail.trim()) missing.push(tr("detalle de la restricción"));
  }
  if (!form.declared_true) missing.push(tr("declaración"));

  const saveForm = async () => {
    if (missing.length > 0) return;
    setSavingForm(true);
    const clean = (v) => (typeof v === "string" ? v.trim() || null : v);
    const payload = {
      user_id: userId,
      main_goal: form.main_goal,
      goal_detail: clean(form.goal_detail),
      experience: form.experience,
      days_per_week: Number(form.days_per_week),
      past_injuries: healthConsent ? form.past_injuries : null,
      past_injuries_detail: healthConsent && form.past_injuries ? clean(form.past_injuries_detail) : null,
      current_injury: healthConsent ? form.current_injury : null,
      current_injury_detail: healthConsent && form.current_injury ? clean(form.current_injury_detail) : null,
      medical_conditions: healthConsent ? clean(form.medical_conditions) : null,
      medications: healthConsent ? clean(form.medications) : null,
      medical_restriction: healthConsent ? form.medical_restriction : null,
      medical_restriction_detail: healthConsent && form.medical_restriction ? clean(form.medical_restriction_detail) : null,
      emergency_name: clean(form.emergency_name),
      emergency_phone: clean(form.emergency_phone),
      declared_true: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("intake_forms").upsert(payload, { onConflict: "user_id" });
    setSavingForm(false);
    if (error) {
      alert(tr("No se pudo guardar su ficha: ") + error.message);
      return;
    }
    if (onSaved) onSaved();
  };

  const chip = (active) =>
    `px-3 py-2 rounded-lg text-xs ${active ? "bg-accent text-app font-medium" : "bg-field text-soft"}`;
  const inputCls = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";
  const label = (text, required) => (
    <p className="text-soft text-xs mb-1.5">
      {text} {required && <span className="text-danger">*</span>}
    </p>
  );
  const yesNo = (key) => (
    <div className="flex gap-2">
      <button type="button" onClick={() => set(key, true)} className={`flex-1 ${chip(form[key] === true)}`}>{tr("Sí")}</button>
      <button type="button" onClick={() => set(key, false)} className={`flex-1 ${chip(form[key] === false)}`}>{tr("No")}</button>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-ink text-xl font-semibold">{title}</h1>
        {onCancel && (
          <button onClick={onCancel} className="text-muted"><X size={20} /></button>
        )}
      </div>
      <p className="text-soft text-sm mb-5">{subtitle}</p>
      {lastUpdate && (
        <p className="text-muted text-[11px] -mt-3 mb-4">
          {tr("Última actualización:")} {new Date(lastUpdate).toLocaleDateString(appLocale(), { day: "2-digit", month: "short", year: "numeric" })}
        </p>
      )}

      {loadingForm ? (
        <Skeleton />
      ) : (
        <>
          <div className="bg-card rounded-2xl p-4 mb-4 space-y-4">
            <p className="text-muted text-xs uppercase tracking-wider">{tr("Objetivo y experiencia")}</p>
            <div>
              {label(tr("Objetivo principal"), true)}
              <div className="flex flex-wrap gap-2">
                {INTAKE_GOALS.map((g) => (
                  <button key={g.key} type="button" onClick={() => set("main_goal", g.key)} className={chip(form.main_goal === g.key)}>{tr(g.label)}</button>
                ))}
              </div>
            </div>
            <div>
              {label(tr("Cuéntenos con sus palabras qué quiere lograr"))}
              <textarea value={form.goal_detail} onChange={(e) => set("goal_detail", e.target.value)} rows={2} className={inputCls} />
            </div>
            <div>
              {label(tr("Experiencia entrenando"), true)}
              <div className="grid grid-cols-2 gap-2">
                {INTAKE_EXPERIENCE.map((x) => (
                  <button key={x.key} type="button" onClick={() => set("experience", x.key)} className={chip(form.experience === x.key)}>{tr(x.label)}</button>
                ))}
              </div>
            </div>
            <div>
              {label(tr("Días por semana que puede entrenar"), true)}
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} type="button" onClick={() => set("days_per_week", String(n))} className={`flex-1 ${chip(form.days_per_week === String(n))}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          {!healthConsent && (
            <div className="bg-card rounded-2xl p-4 mb-4">
              <p className="text-soft text-sm">{tr("Las preguntas sobre lesiones y salud están ocultas porque no autorizó el tratamiento de sus datos de salud. Si quiere que su coach las tenga en cuenta, actívelo en Perfil → Privacidad.")}</p>
            </div>
          )}
          {healthConsent && (<>
          <div className="bg-card rounded-2xl p-4 mb-4 space-y-4">
            <p className="text-muted text-xs uppercase tracking-wider">{tr("Lesiones")}</p>
            <div>
              {label(tr("¿Ha tenido lesiones antes?"), true)}
              {yesNo("past_injuries")}
              {form.past_injuries && (
                <textarea value={form.past_injuries_detail} onChange={(e) => set("past_injuries_detail", e.target.value)} rows={2} placeholder={tr("¿Cuáles? Ej: esguince de tobillo en 2022, ya recuperado")} className={`${inputCls} mt-2`} />
              )}
            </div>
            <div>
              {label(tr("¿Tiene alguna lesión o dolor actualmente?"), true)}
              {yesNo("current_injury")}
              {form.current_injury && (
                <textarea value={form.current_injury_detail} onChange={(e) => set("current_injury_detail", e.target.value)} rows={2} placeholder={tr("¿Cuál? ¿Qué movimientos le molestan?")} className={`${inputCls} mt-2`} />
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 mb-4 space-y-4">
            <p className="text-muted text-xs uppercase tracking-wider">{tr("Salud")}</p>
            <div>
              {label(tr("Condiciones médicas (opcional)"))}
              <textarea value={form.medical_conditions} onChange={(e) => set("medical_conditions", e.target.value)} rows={2} placeholder={tr("Ej: hipertensión, asma, diabetes...")} className={inputCls} />
            </div>
            <div>
              {label(tr("Medicamentos que toma (opcional)"))}
              <input value={form.medications} onChange={(e) => set("medications", e.target.value)} className={inputCls} />
            </div>
            <div>
              {label(tr("¿Algún médico le ha restringido la actividad física?"), true)}
              {yesNo("medical_restriction")}
              {form.medical_restriction && (
                <textarea value={form.medical_restriction_detail} onChange={(e) => set("medical_restriction_detail", e.target.value)} rows={2} placeholder={tr("¿Qué le indicó?")} className={`${inputCls} mt-2`} />
              )}
            </div>
          </div>

          </>)}

          <div className="bg-card rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-muted text-xs uppercase tracking-wider">{tr("Contacto de emergencia (opcional)")}</p>
            <input value={form.emergency_name} onChange={(e) => set("emergency_name", e.target.value)} placeholder={tr("Nombre")} className={inputCls} />
            <input value={form.emergency_phone} onChange={(e) => set("emergency_phone", e.target.value)} placeholder={tr("Teléfono")} inputMode="tel" className={inputCls} />
          </div>

          <button
            type="button"
            onClick={() => set("declared_true", !form.declared_true)}
            className="w-full flex items-start gap-3 bg-card rounded-2xl p-4 mb-4 text-left"
          >
            <div className={`w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center ${form.declared_true ? "bg-accent" : "border border-muted"}`}>
              {form.declared_true && <Check size={14} className="text-app" />}
            </div>
            <span className="text-ink text-xs leading-relaxed">
              {tr("Declaro que la información es verdadera y que le avisaré a mi coach si cambia.")} <span className="text-danger">*</span>
            </span>
          </button>

          {missing.length > 0 && (
            <p className="text-muted text-[11px] mb-3">{tr("Falta completar:")} {missing.join(", ")}.</p>
          )}

          <button
            onClick={saveForm}
            disabled={savingForm || missing.length > 0}
            className="block w-full bg-accent text-app font-medium text-sm rounded-xl py-3 disabled:opacity-50"
          >
            {savingForm ? tr("Guardando...") : tr("Guardar ficha")}
          </button>

          {onSignOut && (
            <button onClick={onSignOut} className="block w-full text-muted text-xs underline mt-4">{tr("Cerrar sesión")}</button>
          )}
        </>
      )}
    </div>
  );
}
