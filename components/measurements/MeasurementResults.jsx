"use client";

import { plain, TONE_CHIP, computeResults } from "@/lib/measurements";

const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(/\.0+$/, ""));

function Chip({ info, t }) {
  if (!info?.label) return null;
  return <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap ${TONE_CHIP[info.tone]}`}>{t(info.label)}</span>;
}

function Delta({ value, unit = "", t, d = 1 }) {
  if (value == null || Number(Math.abs(value).toFixed(d)) === 0) return null;
  return (
    <span className="text-soft text-[11px] tabular-nums whitespace-nowrap">
      {value > 0 ? "+" : ""}
      {fmt(value, d)}
      {unit} {t("vs. anterior")}
    </span>
  );
}

// Barra de rangos del % de grasa con la marca del valor
function FatBar({ bf, ranges, sex }) {
  const max = sex === "hombre" ? 40 : 50;
  const pct = (v) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const segs = [
    { from: 0, to: ranges.low, cls: "bg-warning/50" },
    { from: ranges.low, to: ranges.healthy, cls: "bg-accent" },
    { from: ranges.healthy, to: ranges.high, cls: "bg-warning" },
    { from: ranges.high, to: max, cls: "bg-danger" },
  ];
  return (
    <div className="relative pt-3">
      <div className="flex h-2 rounded-full overflow-hidden gap-[2px]">
        {segs.map((s, i) => <div key={i} className={s.cls} style={{ width: `${((s.to - s.from) / max) * 100}%` }} />)}
      </div>
      <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center" style={{ left: pct(bf) }}>
        <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[7px] border-t-ink" />
      </div>
      <div className="relative h-4 mt-1 text-[10px] text-muted tabular-nums">
        {[ranges.low, ranges.healthy, ranges.high].map((v) => (
          <span key={v} className="absolute -translate-x-1/2" style={{ left: pct(v) }}>{v}%</span>
        ))}
      </div>
    </div>
  );
}

function Row({ title, value, info, hint, delta, t, d = 1 }) {
  return (
    <div className="py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink text-sm">{title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-ink text-sm font-semibold tabular-nums">{value}</span>
          <Chip info={info} t={t} />
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 mt-0.5">
        <p className="text-muted text-[11px] leading-snug">{hint}</p>
        <Delta value={delta} t={t} d={d} />
      </div>
    </div>
  );
}

const card = "rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-4";

// Resultados de una medición, con lenguaje claro y las fórmulas citadas
export function MeasurementResults({ m, previous, t = plain }) {
  const r = computeResults(m);
  const p = previous ? computeResults(previous) : {};
  const diff = (a, b) => (a != null && b != null ? Math.round((a - b) * 100) / 100 : null);
  const sexWord = m.sex === "hombre" ? t("hombres") : t("mujeres");

  return (
    <div className="space-y-3">
      {/* % de grasa */}
      <div className={card}>
        <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-2">{t("Grasa corporal")}</p>
        {r.bodyFat ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <p className="text-ink text-4xl font-semibold tracking-tight tabular-nums leading-none">
                {fmt(r.bodyFat.value)}
                <span className="text-soft text-lg font-medium ml-0.5">%</span>
              </p>
              <div className="flex flex-col items-end gap-1">
                <Chip info={r.bodyFat} t={t} />
                <Delta value={diff(r.bodyFat.value, p.bodyFat?.value)} unit="%" t={t} />
              </div>
            </div>
            {r.bodyFat.ranges && <FatBar bf={r.bodyFat.value} ranges={r.bodyFat.ranges} sex={m.sex} />}
            <p className="text-soft text-xs mt-2">
              {t("Rango saludable para su edad: {p0}–{p1} %.", { p0: r.bodyFat.ranges.low, p1: r.bodyFat.ranges.healthy })}
            </p>
            {r.bodyFat.percentile != null && (
              <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <p className="text-ink text-sm font-medium">{t("Percentil {p0}", { p0: r.bodyFat.percentile })}</p>
                  <p className="text-muted text-[10px]">{t("{p0} de su edad", { p0: sexWord })}</p>
                </div>
                <div className="h-1.5 rounded-full bg-field overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${r.bodyFat.percentile}%` }} />
                </div>
                <p className="text-soft text-[11px] mt-1.5 leading-snug">
                  {t("Tiene menos grasa que {p0} de cada 100 {p1} de su edad.", { p0: r.bodyFat.percentile, p1: sexWord })}
                </p>
                <p className="text-muted text-[10px] mt-1 leading-snug">{t("Comparado con personas evaluadas en el Cooper Institute, en su mayoría activas.")}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-soft text-sm">
            {t("Para calcular su % de grasa falta: {p0}.", { p0: r.missingForFat.map((x) => t(x)).join(", ") })}
          </p>
        )}
      </div>

      {/* Composición */}
      {(r.fatKg != null || r.ffmi) && (
        <div className={card}>
          <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3">{t("Composición")}</p>
          <div className="grid grid-cols-2 gap-2 mb-1">
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className="text-ink text-xl font-semibold tabular-nums">{fmt(r.fatKg)} <span className="text-soft text-xs">kg</span></p>
              <p className="text-muted text-[11px]">{t("Masa grasa")}</p>
              <Delta value={diff(r.fatKg, p.fatKg)} unit=" kg" t={t} />
            </div>
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className="text-ink text-xl font-semibold tabular-nums">{fmt(r.leanKg)} <span className="text-soft text-xs">kg</span></p>
              <p className="text-muted text-[11px]">{t("Masa libre de grasa")}</p>
              <Delta value={diff(r.leanKg, p.leanKg)} unit=" kg" t={t} />
            </div>
          </div>
          <p className="text-muted text-[11px] mb-1">{t("Masa libre de grasa = músculo, huesos, agua y órganos.")}</p>
          {r.ffmi && (
            <Row
              t={t}
              title={t("Índice de masa libre de grasa (FFMI)")}
              value={fmt(r.ffmi.value)}
              info={r.ffmi}
              delta={diff(r.ffmi.value, p.ffmi?.value)}
              hint={t("Cuánta masa libre de grasa tiene para su estatura. Sube cuando gana músculo.")}
            />
          )}
        </div>
      )}

      {/* Indicadores de salud */}
      {(r.bmi || r.whtr || r.whr || r.waist) && (
        <div className={card}>
          <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-1">{t("Indicadores de salud")}</p>
          {r.whtr && (
            <Row t={t} title={t("Cintura / estatura")} value={fmt(r.whtr.value, 2)} info={r.whtr} d={2} delta={diff(r.whtr.value, p.whtr?.value)}
              hint={t("Lo ideal es que la cintura mida menos de la mitad de la estatura (menos de 0,5).")} />
          )}
          {r.waist && (
            <Row t={t} title={t("Cintura")} value={`${fmt(r.waist.value)} cm`} info={r.waist} delta={diff(r.waist.value, p.waist?.value)}
              hint={m.sex === "hombre" ? t("OMS: riesgo aumentado desde 94 cm y alto desde 102 cm.") : t("OMS: riesgo aumentado desde 80 cm y alto desde 88 cm.")} />
          )}
          {r.whr && (
            <Row t={t} title={t("Cintura / cadera")} value={fmt(r.whr.value, 2)} info={r.whr} d={2} delta={diff(r.whr.value, p.whr?.value)}
              hint={m.sex === "hombre" ? t("OMS: riesgo aumentado desde 0,90.") : t("OMS: riesgo aumentado desde 0,85.")} />
          )}
          {r.bmi && (
            <Row t={t} title={t("Índice de masa corporal (IMC)")} value={fmt(r.bmi.value)} info={r.bmi} delta={diff(r.bmi.value, p.bmi?.value)}
              hint={t("OMS. Con mucho músculo el IMC puede salir alto aunque tenga poca grasa.")} />
          )}
        </div>
      )}

      {/* Simetría: todas las diferencias entre lado derecho e izquierdo */}
      {r.asymmetry.length > 0 && (() => {
        const withDiff = r.asymmetry.filter((a) => a.diff > 0);
        const right = withDiff.filter((a) => a.bigger === "derecho").length;
        const left = withDiff.length - right;
        const prevBy = Object.fromEntries((p.asymmetry || []).map((a) => [a.key, a]));
        const tone = { equal: "text-accent", low: "text-soft", mid: "text-warning", high: "text-danger" };
        const bar = { equal: "bg-accent", low: "bg-soft", mid: "bg-warning", high: "bg-danger" };
        return (
          <div className={`${card} ${withDiff.length ? "border-warning/30!" : ""}`}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em]">{t("Diferencias entre lados")}</p>
              <span className={`shrink-0 whitespace-nowrap text-[11px] font-medium rounded-full px-2 py-0.5 ${withDiff.length ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent"}`}>
                {withDiff.length ? t("{p0} de {p1} con diferencia", { p0: withDiff.length, p1: r.asymmetry.length }) : t("Lados iguales")}
              </span>
            </div>
            {withDiff.length > 0 && (
              <p className="text-soft text-xs mb-2">
                {right && left
                  ? t("Lado derecho más grande en {p0} y lado izquierdo en {p1}.", { p0: right, p1: left })
                  : right
                    ? t("El lado derecho es más grande en {p0} de ellas.", { p0: right })
                    : t("El lado izquierdo es más grande en {p0} de ellas.", { p0: left })}
              </p>
            )}
            <div className="divide-y divide-white/[0.05]">
              {r.asymmetry.map((a) => {
                const before = prevBy[a.key];
                const change = before ? Math.round((a.diff - before.diff) * 10) / 10 : null;
                return (
                  <div key={a.key} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-ink text-sm">{t(a.label)}</p>
                      <p className={`text-sm font-semibold tabular-nums ${tone[a.level]}`}>
                        {a.diff === 0 ? t("Iguales") : `${fmt(a.diff)} cm`}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-0.5">
                      <p className="text-muted text-[11px] tabular-nums">
                        {t("der.")} {fmt(a.r)} · {t("izq.")} {fmt(a.l)}
                        {a.bigger && <span> · {a.bigger === "derecho" ? t("más grande el derecho") : t("más grande el izquierdo")} ({fmt(a.pct)}%)</span>}
                      </p>
                      {change !== null && change !== 0 && (
                        <p className="text-soft text-[11px] tabular-nums whitespace-nowrap">
                          {change < 0 ? t("{p0} cm menos que antes", { p0: fmt(-change) }) : t("{p0} cm más que antes", { p0: fmt(change) })}
                        </p>
                      )}
                    </div>
                    {a.diff > 0 && (
                      <div className="h-1 rounded-full bg-field mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${bar[a.level]}`} style={{ width: `${Math.min(100, (a.diff / 3) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-muted text-[11px] mt-2">{t("Menos de 1 cm suele ser normal o error de medición; de 1 a 2 cm vale la pena vigilarlo; más de 2 cm conviene trabajarlo con su coach.")}</p>
          </div>
        );
      })()}

      <p className="text-muted text-[10px] leading-relaxed px-1">
        {t("Estimaciones con cinta métrica: sirven para ver su evolución y no reemplazan una evaluación médica. Fórmulas: % de grasa de la Marina de EE. UU. (Hodgdon y Beckett); percentiles del Cooper Institute (ACSM); rangos saludables de Gallagher (2000); IMC, cintura y cintura/cadera de la OMS; cintura/estatura de Ashwell; FFMI de Kouri (1995).")}
      </p>
    </div>
  );
}
