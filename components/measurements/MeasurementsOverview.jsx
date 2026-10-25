"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { plain, computeResults } from "@/lib/measurements";
import { BodyFigure } from "@/components/ui/BodyFigure";
import { MeasurementResults } from "./MeasurementResults";

const fmt = (v) => (v == null ? "—" : Number(v).toFixed(1).replace(/\.0$/, ""));

export async function loadMeasurements(userId) {
  const { data } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("measured_on", { ascending: false })
    .limit(36);
  return data || [];
}

const shortDate = (d, locale) => new Date(d + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "2-digit" });

export const formatMeasureDate = (d, locale = "es-CO") =>
  new Date(d + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

const selectCls = "w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2 outline-none";

// Figura + resultados + historial de las medidas de un alumno (lo usan el alumno y el coach)
export function MeasurementsOverview({ rows, userId, t = plain, locale = "es-CO", fallbackSex = "mujer", wide = false }) {
  const [sel, setSel] = useState(0);
  const [cmp, setCmp] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setSel(0);
    setCmp(rows.length > 1 ? 1 : -1);
  }, [rows]);

  if (!rows.length) return null;
  const m = rows[sel] || rows[0];
  const prev = cmp >= 0 ? rows[cmp] : null;
  const sex = m.sex || fallbackSex;
  const byCoach = m.created_by && m.created_by !== userId;

  const figure = (
    <div className="rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-3 sm:p-4">
      {rows.length > 1 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="block">
            <span className="text-muted text-[10px] uppercase tracking-wider">{t("Medición")}</span>
            <select value={sel} onChange={(e) => { const v = Number(e.target.value); setSel(v); if (cmp >= 0 && cmp <= v) setCmp(v + 1 < rows.length ? v + 1 : -1); }} className={selectCls}>
              {rows.map((r, i) => <option key={r.id} value={i}>{shortDate(r.measured_on, locale)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-muted text-[10px] uppercase tracking-wider">{t("Comparar con")}</span>
            <select value={cmp} onChange={(e) => setCmp(Number(e.target.value))} className={selectCls}>
              <option value={-1}>{t("Sin comparar")}</option>
              {rows.map((r, i) => (i > sel ? <option key={r.id} value={i}>{shortDate(r.measured_on, locale)}</option> : null))}
            </select>
          </label>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-ink text-sm font-medium">{formatMeasureDate(m.measured_on, locale)}</p>
        <p className="text-muted text-[11px]">
          {[m.weight_kg ? `${fmt(m.weight_kg)} kg` : null, m.height_cm ? `${fmt(m.height_cm)} cm` : null, byCoach ? t("Tomada por su coach") : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <BodyFigure sex={sex} values={{ ...m, sex }} previous={prev ? { ...prev, sex } : null} labels t={t} className="w-full max-w-md mx-auto block" />
      {prev && (
        <p className="text-muted text-[10px] text-center -mt-1">
          <span className="inline-block w-5 border-t border-dashed border-soft align-middle mr-1.5" />
          {t("Silueta del {p0}", { p0: formatMeasureDate(prev.measured_on, locale) })}
        </p>
      )}
      {m.note && <p className="text-soft text-xs bg-white/[0.04] rounded-xl px-3 py-2 mt-3 whitespace-pre-wrap">{m.note}</p>}
    </div>
  );
  const history = rows.length > 1 && (
    <div className="rounded-2xl bg-card border border-white/[0.06] p-4">
      <button onClick={() => setShowHistory((s) => !s)} className="w-full flex items-center justify-between text-sm text-ink">
        {t("Historial")}
        <span className="text-accent text-xs">{showHistory ? t("Ocultar") : t("Ver todo")}</span>
      </button>
      {showHistory && (
        <div className="overflow-x-auto mt-3 -mx-1">
          <table className="w-full text-xs tabular-nums min-w-[420px]">
            <thead>
              <tr className="text-muted text-left">
                {[t("Fecha"), t("Peso"), t("Cintura"), t("Abdomen"), t("Cadera"), t("% grasa")].map((h) => <th key={h} className="font-normal px-1 pb-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} onClick={() => { setSel(i); setCmp(i + 1 < rows.length ? i + 1 : -1); }} className={`cursor-pointer border-t border-white/[0.05] ${i === sel ? "text-accent" : "text-ink"}`}>
                  <td className="px-1 py-2 whitespace-nowrap">{formatMeasureDate(r.measured_on, locale)}</td>
                  <td className="px-1">{fmt(r.weight_kg)}</td>
                  <td className="px-1">{fmt(r.waist_cm)}</td>
                  <td className="px-1">{fmt(r.abdomen_cm)}</td>
                  <td className="px-1">{fmt(r.hip_cm)}</td>
                  <td className="px-1">{fmt(computeResults({ ...r, sex: r.sex || fallbackSex }).bodyFat?.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
  const results = (
    <MeasurementResults m={{ ...m, sex }} previous={prev ? { ...prev, sex } : null} t={t} />
  );

  if (wide) {
    return (
      <div className="grid lg:grid-cols-2 gap-3 items-start">
        <div className="space-y-3">
          {figure}
          {history}
        </div>
        <div>{results}</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {figure}
      {results}
      {history}
    </div>
  );
}
