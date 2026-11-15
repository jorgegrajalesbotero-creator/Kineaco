"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Select";

const pad = (n) => String(n).padStart(2, "0");
const daysIn = (y, m) => (y && m ? new Date(Number(y), Number(m), 0).getDate() : 31);

// Fecha en tres listas (día · mes · año) con el estilo de la app.
// Reemplaza al <input type="date">, que en iPhone se sale del cuadro y se ve distinto en cada celular.
// value / onChange usan "AAAA-MM-DD" ("" mientras falte alguna parte).
export function DateSelect({ value, onChange, minYear = 1915, maxYear = new Date().getFullYear(), locale = "es-CO", t = (x) => x, tone = "soft", size = "xlTight", className = "" }) {
  const [parts, setParts] = useState(() => split(value));
  // Si el valor cambia desde afuera (por ejemplo al cargar datos guardados), se actualizan las listas
  useEffect(() => {
    const v = split(value);
    if (value && (v.y !== parts.y || v.m !== parts.m || v.d !== parts.d)) setParts(v);
  }, [value]);

  const set = (k, v) => {
    const next = { ...parts, [k]: v };
    // Si el día ya no existe en ese mes (31 de febrero), se corre al último día del mes
    if (next.d && next.m && Number(next.d) > daysIn(next.y || 2000, next.m)) next.d = String(daysIn(next.y || 2000, next.m));
    setParts(next);
    onChange(next.y && next.m && next.d ? `${next.y}-${pad(next.m)}-${pad(next.d)}` : "");
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    // Nombre corto ("Sept", "Ene") para que quepa en la fila del celular
    const name = new Date(2000, i, 1).toLocaleDateString(locale, { month: "short" }).replace(/\.$/, "");
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
  const years = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  const nDays = daysIn(parts.y || 2000, parts.m);
  const empty = "text-muted";

  return (
    <div className={`grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,1.15fr)] gap-2 ${className}`}>
      <Select tone={tone} size={size} aria-label={t("Día")} value={parts.d} onChange={(e) => set("d", e.target.value)} className={`min-w-0 ${parts.d ? "" : empty}`}>
        <option value="">{t("Día")}</option>
        {Array.from({ length: nDays }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
      </Select>
      <Select tone={tone} size={size} aria-label={t("Mes")} value={parts.m} onChange={(e) => set("m", e.target.value)} className="min-w-0">
        <option value="">{t("Mes")}</option>
        {months.map((name, i) => <option key={i + 1} value={String(i + 1)}>{name}</option>)}
      </Select>
      <Select tone={tone} size={size} aria-label={t("Año")} value={parts.y} onChange={(e) => set("y", e.target.value)} className="min-w-0">
        <option value="">{t("Año")}</option>
        {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </Select>
    </div>
  );
}

function split(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : { y: "", m: "", d: "" };
}
