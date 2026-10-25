"use client";

import { useState } from "react";
import { appLocale, tr } from "@/lib/i18n";

export function formatShortDate(date) {
  return date.toLocaleDateString(appLocale(), { day: "numeric", month: "short" });
}

export function WeightProgressChart({ points }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const width = 300;
  const height = 140;
  const padX = 14;
  const padTop = 20;
  const padBottom = 22;

  const kgs = points.map((p) => p.kg);
  const minKg = Math.min(...kgs);
  const maxKg = Math.max(...kgs);
  const range = maxKg - minKg || 1;

  const xStep = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const xFor = (i) => padX + i * xStep;
  const yFor = (kg) => {
    const t = (kg - minKg) / range;
    return height - padBottom - t * (height - padTop - padBottom);
  };

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.kg).toFixed(1)}`)
    .join(" ");
  const active = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" onMouseLeave={() => setHoverIdx(null)}>
        <path d={linePath} fill="none" stroke="#D6FF5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={xFor(i)}
              cy={yFor(p.kg)}
              r="12"
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onTouchStart={() => setHoverIdx(i)}
            />
            {(i === 0 || i === points.length - 1 || i === hoverIdx) && (
              <circle
                cx={xFor(i)}
                cy={yFor(p.kg)}
                r={i === hoverIdx ? 5 : 4}
                fill="#0F1512"
                stroke="#D6FF5C"
                strokeWidth="2"
              />
            )}
          </g>
        ))}
        {active && (
          <line
            x1={xFor(hoverIdx)}
            y1={padTop - 6}
            x2={xFor(hoverIdx)}
            y2={height - padBottom}
            stroke="#25332C"
            strokeWidth="1"
          />
        )}
      </svg>

      <div className="flex justify-between text-[10px] text-muted px-1">
        <span>{formatShortDate(points[0].date)}</span>
        <span>{formatShortDate(points[points.length - 1].date)}</span>
      </div>

      {active && (
        <div
          className="absolute -translate-x-1/2 bg-field text-ink text-xs px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap"
          style={{ left: `${(xFor(hoverIdx) / width) * 100}%`, top: 0 }}
        >
          {active.kg}{tr("kg ·")} {formatShortDate(active.date)}
        </div>
      )}
    </div>
  );
}
