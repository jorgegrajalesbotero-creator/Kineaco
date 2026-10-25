"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Ruler } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { localDateString } from "@/lib/dates";
import { plain, ALL_COLUMNS, TAPE_FIELDS, TIPS, col, computeResults } from "@/lib/measurements";
import { BodyFigure } from "@/components/ui/BodyFigure";
import { Skeleton } from "@/components/ui/Skeleton";
import { cleanDecimal } from "@/lib/numbers";

const inputCls =
  "w-full min-w-0 bg-app/60 border border-white/[0.07] text-ink text-lg text-center rounded-xl px-3 py-3 outline-none focus:border-accent/60 tabular-nums";
const card = "rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-4";

const n = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const fmt = (v) => (v == null ? "" : String(Number(v)));

/**
 * Registro de medidas paso a paso: una medida por pantalla, con la figura marcando dónde va la cinta.
 * coachMode: el coach registra las medidas de un alumno (puede elegir la fecha).
 */
export function MeasurementWizard({ userId, onClose, t = plain, coachMode = false }) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ sex: "", age: "", height_cm: "", weight_kg: "", note: "" });
  const [last, setLast] = useState(null);
  const [date, setDate] = useState(localDateString());
  const [step, setStep] = useState(0);
  const [focusSide, setFocusSide] = useState("r");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const steps = ["intro", "base", ...TAPE_FIELDS.map((f) => f.key), "summary"];
  const current = steps[step];
  const field = TAPE_FIELDS.find((f) => f.key === current);
  const tapeIndex = TAPE_FIELDS.findIndex((f) => f.key === current);

  // Trae datos para prellenar: nutrición (sexo, edad, estatura), último peso y la medición anterior
  useEffect(() => {
    async function load() {
      const [{ data: np }, { data: bw }, { data: rows }] = await Promise.all([
        supabase.from("nutrition_profiles").select("gender, age, height_cm, weight_kg").eq("user_id", userId).maybeSingle(),
        supabase.from("body_weight_logs").select("weight_kg").eq("user_id", userId).order("logged_at", { ascending: false }).limit(1),
        supabase.from("body_measurements").select("*").eq("user_id", userId).order("measured_on", { ascending: false }).limit(2),
      ]);
      const today = (rows || []).find((r) => r.measured_on === date);
      const previous = (rows || []).find((r) => r.measured_on !== date) || null;
      const w = bw?.[0]?.weight_kg ?? np?.weight_kg ?? null;
      setLast(previous);
      const base = today || {};
      setDraft({
        sex: base.sex || previous?.sex || (np?.gender === "hombre" || np?.gender === "mujer" ? np.gender : ""),
        age: fmt(base.age ?? np?.age ?? previous?.age),
        height_cm: fmt(base.height_cm ?? previous?.height_cm ?? np?.height_cm),
        weight_kg: fmt(base.weight_kg ?? w),
        note: base.note || "",
        ...Object.fromEntries(ALL_COLUMNS.map((c) => [c, fmt(base[c])])),
      });
      setLoading(false);
    }
    load();
  }, [userId]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const validate = () => {
    if (current === "base") {
      if (!draft.sex) return t("Elija el sexo: lo usan las fórmulas.");
      const h = n(draft.height_cm), w = n(draft.weight_kg), a = n(draft.age);
      if (!h || h < 100 || h > 250) return t("Escriba la estatura en centímetros (por ejemplo 165).");
      if (w != null && (w < 25 || w > 400)) return t("Revise el peso: debe estar en kilogramos.");
      if (a != null && (a < 10 || a > 100)) return t("Revise la edad.");
    }
    if (field) {
      const cols = field.side ? [col(field.key, "r"), col(field.key, "l")] : [col(field.key)];
      for (const c of cols) {
        const v = n(draft[c]);
        if (v != null && (v < field.min || v > field.max)) return t("Revise el valor: debe estar entre {p0} y {p1} cm.", { p0: field.min, p1: field.max });
      }
    }
    return "";
  };

  const next = () => {
    const err = validate();
    if (err) return setError(err);
    setError("");
    setFocusSide("r");
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };
  const skip = () => {
    const cols = field.side ? [col(field.key, "r"), col(field.key, "l")] : [col(field.key)];
    setDraft((d) => ({ ...d, ...Object.fromEntries(cols.map((c) => [c, ""])) }));
    setError("");
    setFocusSide("r");
    setStep((s) => s + 1);
  };
  const back = () => {
    setError("");
    if (step === 0) return onClose(false);
    setStep((s) => s - 1);
  };

  const filledCount = ALL_COLUMNS.filter((c) => n(draft[c]) != null).length;

  const save = async () => {
    if (filledCount === 0) return setError(t("Registre al menos una medida."));
    setSaving(true);
    setError("");
    const row = {
      user_id: userId,
      measured_on: date,
      sex: draft.sex || null,
      age: n(draft.age) != null ? Math.round(n(draft.age)) : null,
      height_cm: n(draft.height_cm),
      weight_kg: n(draft.weight_kg),
      note: draft.note.trim().slice(0, 500) || null,
      ...Object.fromEntries(ALL_COLUMNS.map((c) => [c, n(draft[c])])),
    };
    const { error: err } = await supabase.from("body_measurements").upsert(row, { onConflict: "user_id,measured_on" });
    if (err) {
      setSaving(false);
      return setError(t("No se pudieron guardar las medidas: ") + err.message);
    }
    // El peso pasa solo al historial de peso corporal del alumno (lo hace la base de datos)
    setSaving(false);
    onClose(true);
  };

  const sex = draft.sex || "mujer";
  const figureValues = { ...draft, sex };
  const prevHint = (c) => (last?.[c] != null ? t("Anterior: {p0}", { p0: fmt(last[c]) }) : "cm");

  if (loading) return <div className="p-5"><Skeleton rows={3} height="h-24" /></div>;

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-3 pb-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={back} aria-label={t("Volver")} className="w-9 h-9 rounded-full bg-card border border-white/[0.06] flex items-center justify-center shrink-0">
          <ChevronLeft size={18} className="text-ink" />
        </button>
        {step > 0 && (
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-field overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(step / (steps.length - 1)) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {current === "intro" && (
        <>
          <div>
            <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
              <Ruler size={20} className="text-accent" />
            </div>
          </div>
          <h1 className="text-ink text-2xl font-semibold tracking-tight mb-1">{coachMode ? t("Registrar medidas") : t("Medidas corporales")}</h1>
          <p className="text-soft text-sm mb-5">
            {t("Solo necesita una cinta métrica. Le mostramos dónde va la cinta en cada medida; si no puede tomar alguna, la puede omitir.")}
          </p>
          <div className={`${card} mb-5`}>
            <p className="text-ink text-sm font-medium mb-2">{t("Antes de empezar")}</p>
            <ul className="space-y-2">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2 text-soft text-sm">
                  <span className="text-accent">•</span>
                  {t(tip)}
                </li>
              ))}
            </ul>
          </div>
          {coachMode && (
            <label className="block mb-5">
              <span className="text-muted text-xs">{t("Fecha de la medición")}</span>
              <input type="date" value={date} max={localDateString()} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none" />
            </label>
          )}
          <button onClick={next} className="block w-full bg-accent text-app font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform">
            {t("Empezar")}
          </button>
        </>
      )}

      {current === "base" && (
        <>
          <p className="text-accent text-xs font-medium mb-1">{t("Datos básicos")}</p>
          <h1 className="text-ink text-2xl font-semibold tracking-tight mb-5">{t("Sexo, edad, estatura y peso")}</h1>
          <div className={`${card} space-y-4 mb-5`}>
            <div>
              <p className="text-muted text-xs mb-1.5">{t("Sexo")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[["mujer", t("Mujer")], ["hombre", t("Hombre")]].map(([v, label]) => (
                  <button key={v} type="button" onClick={() => set("sex", v)} className={`rounded-xl py-2.5 text-sm font-medium ${draft.sex === v ? "bg-accent text-app" : "bg-white/[0.04] border border-white/[0.06] text-soft"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["age", t("Edad"), t("años")],
                ["height_cm", t("Estatura"), "cm"],
                ["weight_kg", t("Peso"), "kg"],
              ].map(([k, label, unit]) => (
                <label key={k} className="block">
                  <span className="text-muted text-xs">{label}</span>
                  <input type="text" inputMode="decimal" value={draft[k]} placeholder={unit} onChange={(e) => set(k, cleanDecimal(e.target.value))} className={`${inputCls} mt-1 text-base! py-2.5!`} />
                </label>
              ))}
            </div>
            <p className="text-muted text-[11px]">{t("Estatura: descalzo, de espaldas a la pared, mirando al frente. Peso: en la mañana, después de ir al baño.")}</p>
          </div>
        </>
      )}

      {field && (
        <>
          <p className="text-accent text-xs font-medium mb-1">{t("Medida {p0} de {p1}", { p0: tapeIndex + 1, p1: TAPE_FIELDS.length })}</p>
          <h1 className="text-ink text-2xl font-semibold tracking-tight mb-3">{t(field.label)}</h1>
          <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] gap-4 items-start mb-4">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
              <BodyFigure sex={sex} values={figureValues} highlight={{ key: field.key, side: field.side ? focusSide : null }} t={t} className="w-full h-64 sm:h-80 py-2" />
            </div>
            <div>
              <p className="text-soft text-sm leading-relaxed mb-4">{t(field.how)}</p>
              {field.side ? (
                <div className="grid grid-cols-2 gap-2">
                  {[["r", t("Derecho")], ["l", t("Izquierdo")]].map(([s, label]) => (
                    <label key={s} className="block">
                      <span className={`text-xs ${focusSide === s ? "text-accent" : "text-muted"}`}>{label}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft[col(field.key, s)]}
                        onFocus={() => setFocusSide(s)}
                        onChange={(e) => set(col(field.key, s), cleanDecimal(e.target.value))}
                        placeholder={prevHint(col(field.key, s))}
                        className={`${inputCls} mt-1 placeholder:text-sm`}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <label className="block">
                  <span className="text-muted text-xs">{t("Centímetros")}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft[col(field.key)]}
                    onChange={(e) => set(col(field.key), cleanDecimal(e.target.value))}
                    placeholder={prevHint(col(field.key))}
                    className={`${inputCls} mt-1 placeholder:text-sm`}
                  />
                </label>
              )}
            </div>
          </div>
        </>
      )}

      {current === "summary" && (
        <>
          <p className="text-accent text-xs font-medium mb-1">{t("Último paso")}</p>
          <h1 className="text-ink text-2xl font-semibold tracking-tight mb-4">{t("Revise y guarde")}</h1>
          <div className={`${card} mb-4`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {TAPE_FIELDS.map((f) => {
                const v = f.side
                  ? [n(draft[col(f.key, "r")]), n(draft[col(f.key, "l")])]
                  : [n(draft[col(f.key)])];
                const has = v.some((x) => x != null);
                return (
                  <button key={f.key} onClick={() => setStep(steps.indexOf(f.key))} className="flex items-baseline justify-between gap-2 text-left">
                    <span className="text-soft text-xs">{t(f.label)}</span>
                    <span className={`tabular-nums text-xs ${has ? "text-ink" : "text-muted"}`}>{has ? v.map((x) => (x == null ? "—" : x)).join(" · ") : t("Omitida")}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-muted text-[11px] mt-3">{t("Toque una medida para corregirla.")}</p>
          </div>
          {(() => {
            const r = computeResults({ ...draft, sex: draft.sex || null });
            return r.bodyFat ? (
              <div className="rounded-2xl bg-accent/[0.08] border border-accent/25 p-4 mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-ink text-sm font-medium">{t("Su % de grasa estimado")}</p>
                  <p className="text-soft text-xs">{t("Al guardar verá todos los resultados.")}</p>
                </div>
                <p className="text-accent text-2xl font-semibold tabular-nums">{r.bodyFat.value}%</p>
              </div>
            ) : null;
          })()}
          <textarea
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("Nota opcional (por ejemplo: medido después de entrenar)")}
            className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none focus:border-accent/50 resize-none mb-4"
          />
        </>
      )}

      {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mb-3">{error}</p>}

      {current !== "intro" && current !== "summary" && (
        <div className="flex gap-2">
          {field && !(field.side ? [col(field.key, "r"), col(field.key, "l")] : [col(field.key)]).some((c) => n(draft[c]) != null) && (
            <button
              onClick={skip}
              className="flex-1 bg-white/[0.04] border border-white/[0.06] text-soft font-medium py-3.5 rounded-2xl"
            >
              {t("Omitir")}
            </button>
          )}
          <button onClick={next} className="flex-[2] bg-accent text-app font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform">
            {t("Siguiente")}
          </button>
        </div>
      )}
      {current === "summary" && (
        <button onClick={save} disabled={saving} className="block w-full bg-accent text-app font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60">
          {saving ? t("Guardando...") : t("Guardar medidas")}
        </button>
      )}
    </div>
  );
}
