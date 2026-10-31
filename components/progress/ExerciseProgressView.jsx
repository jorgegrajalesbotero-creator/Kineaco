"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { firstVsLast, formatEntryDate, markRecords, nextGoal, spanText } from "@/lib/exerciseHistory";

const LIME = "#D6FF5C";
const BG = "#0F1512";
const GRID = "#25332C";
const MUTED = "#5E6B63";
const SOFT = "#8A9690";

// Número con 1 decimal como máximo (coma en español, punto en inglés).
// Fábrica: cada vista crea su propio formateador según su locale, sin estado global.
const makeFmt = (decimalComma) => (n) => {
  if (n == null) return "—";
  const s = String(Math.round(n * 10) / 10);
  return decimalComma ? s.replace(".", ",") : s;
};
const plainT = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? "").toString()) : s);

function niceMax(v) {
  if (v <= 0) return 10;
  const raw = v * 1.15;
  const step = raw <= 20 ? 5 : raw <= 60 ? 10 : raw <= 150 ? 25 : 50;
  return Math.ceil(raw / step) * step;
}

// Vista de progreso de UN ejercicio: escalera de récords + antes vs. ahora.
// points: salida de buildPoints(). La usan el alumno (por mes) y el coach (por día).
export function ExerciseProgressView({ points: allPoints, t = plainT, locale = "es-CO", showSource = false }) {
  const [range, setRange] = useState("all");
  const [selected, setSelected] = useState(null);
  const scrollRef = useRef(null);
  const boxRef = useRef(null);
  const [boxWidth, setBoxWidth] = useState(320);

  useEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  const lastDate = allPoints.length ? allPoints[allPoints.length - 1].date : null;
  const firstDate = allPoints.length ? allPoints[0].date : null;
  const spanMonths = lastDate ? (lastDate - firstDate) / (86400000 * 30.4) : 0;
  const ranges = [
    { key: "all", label: t("Todo"), months: null },
    spanMonths > 12 && { key: "12", label: t("Último año"), months: 12 },
    spanMonths > 6 && { key: "6", label: t("6 meses"), months: 6 },
  ].filter(Boolean);

  const points = useMemo(() => {
    const r = ranges.find((x) => x.key === range);
    if (!r || !r.months || !lastDate) return allPoints;
    const from = new Date(lastDate);
    from.setMonth(from.getMonth() - r.months);
    return allPoints.filter((p) => p.date >= from);
  }, [allPoints, range]);

  // Si el ejercicio nunca tuvo peso (ej. dominadas), el gráfico va por reps
  const metric = points.some((p) => p.weight != null) ? "weight" : "reps";
  const unit = metric === "weight" ? t("kg") : t("reps");
  const valueOf = (p) => (metric === "weight" ? p.weight : p.reps);

  const records = useMemo(() => {
    if (metric === "weight") return markRecords(points);
    // por reps: récord = más reps que antes
    let max = null;
    let prCount = 0;
    const pts = points.map((p, i) => {
      let kind = "normal";
      if (p.reps != null) {
        if (max == null) { max = p.reps; kind = "start"; }
        else if (p.reps > max) { max = p.reps; kind = "pr"; prCount += 1; }
      }
      return { ...p, kind, maxSoFar: max, index: i };
    });
    return { points: pts, prCount, maxWeight: max };
  }, [points, metric]);

  useEffect(() => {
    setSelected(null);
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [points]);

  if (allPoints.length === 0) return null;
  const decimalComma = !String(locale).startsWith("en");
  const fmt = makeFmt(decimalComma);

  const pts = records.points;
  const n = pts.length;
  const sel = pts[selected ?? n - 1];

  // Encabezado: valor actual (récord) y cuánto subió desde el primer registro
  const valued = pts.filter((p) => valueOf(p) != null);
  const firstVal = valued.length ? valueOf(valued[0]) : null;
  const best = records.maxWeight;
  const delta = firstVal != null && best != null ? best - firstVal : null;
  const pct = firstVal ? Math.round((delta / firstVal) * 100) : null;
  const goal = metric === "weight" ? nextGoal(best) : best != null ? best + 1 : null;

  // Dimensiones del gráfico (en píxeles reales; si hay muchos puntos se desplaza de lado)
  const H = 190;
  const padL = 36;
  const padR = 18;
  const padT = 22;
  const padB = 26;
  const minStep = 34;
  const W = Math.max(boxWidth, padL + padR + Math.max(0, n - 1) * minStep + 20);
  const yMax = niceMax(Math.max(...valued.map(valueOf), 1));
  const x = (i) => (n === 1 ? (padL + W - padR) / 2 : padL + 10 + (i * (W - padL - padR - 20)) / (n - 1));
  const y = (v) => H - padB - (v / yMax) * (H - padT - padB);

  // Línea escalonada del récord
  let stair = "";
  pts.forEach((p, i) => {
    if (p.maxSoFar == null) return;
    const px = x(i);
    const py = y(p.maxSoFar);
    if (!stair) stair = `M ${px} ${py}`;
    else stair += ` H ${px} V ${py}`;
  });
  if (stair && n > 1) stair += ` H ${x(n - 1) + 8}`;
  const areaPath = stair && pts[0].maxSoFar != null ? `${stair} V ${H - padB} H ${x(0)} Z` : "";

  const showAllLabels = n <= Math.floor((W - padL) / 70);
  const kindLabel = {
    start: t("Primer registro"),
    pr: metric === "weight" ? t("Récord de peso") : t("Récord de reps"),
    reps: t("Más reps con el mismo peso"),
    normal: t("Entreno"),
  };

  const cmp = firstVsLast(pts);

  return (
    <div>
      {/* Resumen */}
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className="text-muted text-[11px]">{metric === "weight" ? t("Peso máximo") : t("Reps máximas")}</p>
          <p className="text-accent text-[30px] font-semibold leading-none tracking-tight mt-1">
            {fmt(best)} <span className="text-lg">{unit}</span>
          </p>
        </div>
        {delta != null && valued.length >= 2 && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${delta > 0 ? "bg-accent/10 text-accent" : "bg-field text-soft"}`}>
            {delta > 0 ? "+" : ""}{fmt(delta)} {unit}{pct != null && delta > 0 ? ` · +${pct}%` : ""}
          </span>
        )}
      </div>
      {valued.length >= 2 && delta > 0 && (
        <p className="text-soft text-xs mb-3">
          {t("Empezó con {p0} {p1} hace {p2}.", { p0: fmt(firstVal), p1: unit, p2: spanText(valued[0].date, valued[valued.length - 1].date, t) })}
          {firstVal > 0 && best / firstVal >= 1.5 ? " " + t("Hoy levanta {p0} veces ese peso.", { p0: fmt(best / firstVal) }) : ""}
        </p>
      )}

      {ranges.length > 1 && (
        <div className="flex gap-1.5 mb-3">
          {ranges.map((r) => (
            <button key={r.key} type="button" onClick={() => setRange(r.key)} className={`text-xs rounded-full px-3 py-1.5 ${range === r.key ? "bg-accent text-app font-semibold" : "bg-field text-soft"}`}>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Escalera de récords */}
      <div ref={boxRef} className="w-full">
        <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
          <svg width={W} height={H} role="img" aria-label={t("Escalera de récords")} className="block select-none">
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W - padR} y1={y(yMax * f)} y2={y(yMax * f)} stroke={f === 0 ? "#3A4A41" : GRID} strokeWidth="1" strokeDasharray={f === 0 ? "" : "3 4"} />
                <text x={padL - 6} y={y(yMax * f) + 4} fill={MUTED} fontSize="10" textAnchor="end">{fmt(yMax * f)}</text>
              </g>
            ))}
            {areaPath && <path d={areaPath} fill={LIME} fillOpacity="0.07" />}
            {stair && <path d={stair} fill="none" stroke={LIME} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}

            {pts.map((p, i) => {
              const v = valueOf(p);
              const isSel = sel && sel.index === i;
              return (
                <g key={p.key} onClick={() => setSelected(i)} onMouseEnter={() => setSelected(i)} style={{ cursor: "pointer" }}>
                  <rect x={x(i) - minStep / 2} y={padT - 10} width={minStep} height={H - padT - padB + 10} fill="transparent" />
                  {isSel && <line x1={x(i)} x2={x(i)} y1={padT - 8} y2={H - padB} stroke="#3A4A41" strokeWidth="1" />}
                  {v != null && p.kind === "normal" && <circle cx={x(i)} cy={y(v)} r={isSel ? 5 : 3.5} fill={isSel ? SOFT : "#3A4A41"} stroke={BG} strokeWidth="1.5" />}
                  {v != null && p.kind === "reps" && <circle cx={x(i)} cy={y(v)} r={isSel ? 6 : 4.5} fill={BG} stroke={LIME} strokeWidth="2" />}
                  {v != null && (p.kind === "pr" || p.kind === "start") && (
                    <circle cx={x(i)} cy={y(v)} r={isSel ? 7 : p.kind === "start" ? 4.5 : 5.5} fill={LIME} stroke={BG} strokeWidth="2" />
                  )}
                  {(showAllLabels || i === 0 || i === n - 1 || isSel) && (
                    <text x={x(i)} y={H - 8} fill={isSel ? "#F2F5F0" : MUTED} fontSize="10" textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"}>
                      {formatEntryDate(p.date, p.precision, locale)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {n > Math.floor((boxWidth - padL) / minStep) && <p className="text-muted text-[10px] text-center mt-1">{t("← Más fechas hacia la izquierda")}</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-soft mt-2 mb-3">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent" />{kindLabel.pr}</span>
        {metric === "weight" && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-accent" />{kindLabel.reps}</span>}
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-field-strong" />{kindLabel.normal}</span>
      </div>

      {/* Detalle del punto elegido */}
      {sel && (
        <div className="bg-app/60 border border-white/[0.06] rounded-xl px-3.5 py-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ink text-sm font-medium">{formatEntryDate(sel.date, sel.precision, locale)}</p>
            <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${sel.kind === "pr" || sel.kind === "reps" ? "bg-accent/15 text-accent" : "bg-field text-soft"}`}>{kindLabel[sel.kind]}</span>
          </div>
          <p className="text-soft text-sm mt-1">
            {[sel.weight != null && `${fmt(sel.weight)} ${t("kg")}`, sel.reps != null && `${fmt(sel.reps)} ${t("reps")}`, sel.sets != null && (sel.sets === 1 ? t("1 serie") : t("{p0} series", { p0: sel.sets }))].filter(Boolean).join(" × ") || "—"}
          </p>
          {showSource && <p className="text-muted text-[11px] mt-1">{sel.sources.includes("history") && sel.sources.includes("app") ? t("Historial y app") : sel.sources.includes("history") ? t("Historial cargado por el coach") : t("Registrado en la app")}{sel.count > 1 ? ` · ${t("{p0} registros", { p0: sel.count })}` : ""}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-5">
        <div className="bg-app/60 border border-white/[0.06] rounded-xl px-3 py-2.5">
          <p className="text-muted text-[10px] uppercase tracking-wider">{t("Récords")}</p>
          <p className="text-ink text-lg font-semibold">{records.prCount}</p>
        </div>
        <div className="bg-app/60 border border-white/[0.06] rounded-xl px-3 py-2.5">
          <p className="text-muted text-[10px] uppercase tracking-wider">{t("Próxima meta")}</p>
          <p className="text-accent text-lg font-semibold">{goal != null ? `${fmt(goal)} ${unit}` : "—"}</p>
        </div>
      </div>

      {/* Antes vs. ahora */}
      {n >= 2 && (
        <div>
          <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-1">{t("Antes vs. ahora")}</p>
          <p className="text-soft text-xs mb-3">{formatEntryDate(pts[0].date, pts[0].precision, locale)} → {formatEntryDate(pts[n - 1].date, pts[n - 1].precision, locale)}</p>
          <CompareRow label={t("Peso")} unit={t("kg")} data={cmp.weight} fmt={fmt} />
          <CompareRow label={t("Reps por serie")} data={cmp.reps} fmt={fmt} />
          <CompareRow label={t("Series")} data={cmp.sets} fmt={fmt} />
          {cmp.volume && (
            <div className="flex items-center justify-between bg-app/60 border border-white/[0.06] rounded-xl px-3.5 py-2.5 mt-1">
              <span className="text-soft text-xs">{t("Kilos movidos por sesión")}</span>
              <span className="text-sm font-medium"><span className="text-soft">{fmt(cmp.volume.from)}</span> <span className="text-muted">→</span> <span className={cmp.volume.to >= cmp.volume.from ? "text-accent" : "text-ink"}>{fmt(cmp.volume.to)} {t("kg")}</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Una fila de "antes vs. ahora" con barra de inicio a fin
function CompareRow({ label, unit = "", data, fmt }) {
  if (!data) return null;
  const { from, to } = data;
  const max = Math.max(from, to, 1) * 1.1;
  const a = (from / max) * 100;
  const b = (to / max) * 100;
  const up = to > from;
  const same = to === from;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-soft">{label}</span>
        <span className={up ? "text-accent font-medium" : "text-ink"}>{fmt(from)} → {fmt(to)}{unit ? ` ${unit}` : ""}</span>
      </div>
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-field" />
        {!same && <div className={`absolute top-1/2 -translate-y-1/2 h-1 rounded-full ${up ? "bg-accent" : "bg-soft"}`} style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} />}
        <span className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-app ${up ? "border-accent" : "border-soft"}`} style={{ left: `${a}%` }} />
        <span className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${up || same ? "bg-accent" : "bg-soft"}`} style={{ left: `${b}%` }} />
      </div>
    </div>
  );
}
