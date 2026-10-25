"use client";

import { plain, TAPE_FIELDS, col } from "@/lib/measurements";

// Figura del cuerpo (hombre o mujer) que se dibuja con las medidas reales:
// si la cintura, la cadera o los brazos cambian, la silueta cambia.
// Vista de frente: el lado derecho de la persona queda a la izquierda de la pantalla.

// Colores de la marca (iguales a app/globals.css)
const C = { body: "#25332c", hair: "#3a4a41", accent: "#d6ff5c", soft: "#8a9690", muted: "#5e6b63", ink: "#f2f5f0" };

const VB_W = 360;
const VB_H = 470;
const CX = 180;
const TOP = 16;
const H = 436;

// Medidas típicas (cm) para lo que todavía no se ha medido
const DEFAULTS = {
  hombre: { ref: 175, neck: 38, shoulders: 116, chest: 98, waist: 84, abdomen: 88, hip: 98, arm: 32, arm_flex: 35, forearm: 28, thigh: 56, calf: 37 },
  mujer: { ref: 162, neck: 32, shoulders: 102, chest: 90, waist: 70, abdomen: 80, hip: 98, arm: 28, arm_flex: 29.5, forearm: 24, thigh: 56, calf: 35 },
};

const n = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

function dims(m, sex) {
  const d = DEFAULTS[sex] || DEFAULTS.mujer;
  const height = n(m?.height_cm) || d.ref;
  const k = height / d.ref;
  const get = (key) => {
    const f = TAPE_FIELDS.find((x) => x.key === key);
    if (f?.side) {
      const r = n(m?.[col(key, "r")]), l = n(m?.[col(key, "l")]);
      const v = r && l ? (r + l) / 2 : r || l;
      return v || d[key] * k;
    }
    return n(m?.[col(key)]) || d[key] * k;
  };
  const out = { height };
  ["neck", "shoulders", "chest", "waist", "abdomen", "hip", "arm", "forearm", "thigh", "calf"].forEach((key) => (out[key] = get(key)));
  return out;
}

// Curva suave que pasa por todos los puntos (Catmull-Rom → Bézier)
function smooth(pts) {
  const len = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < len; i++) {
    const p0 = pts[(i - 1 + len) % len], p1 = pts[i], p2 = pts[(i + 1) % len], p3 = pts[(i + 2) % len];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

const Y = (f) => TOP + f * H;

export function bodyGeometry(m, sex) {
  const D = dims(m, sex);
  const s = H / D.height; // px por cm
  const female = sex === "mujer";
  const half = (circ, factor = 1) => (circ / Math.PI / 2) * factor * s;

  const neckH = half(D.neck);
  const shoulderH = half(D.shoulders, female ? 1.13 : 1.2);
  const chestH = half(D.chest, 1.12);
  const waistH = half(D.waist, female ? 1.1 : 1.12);
  const abdH = half(D.abdomen, 1.12);
  const hipH = half(D.hip, female ? 1.15 : 1.07);
  const thighH = half(D.thigh);
  const calfH = half(D.calf);
  const kneeH = thighH * 0.62;
  const ankleH = (female ? 3 : 3.3) * s;
  const upperArmH = half(D.arm);
  const forearmH = half(D.forearm);
  const elbowH = forearmH * 0.85;
  const wristH = (female ? 2.5 : 2.8) * s;
  const handH = (female ? 3.8 : 4.3) * s;
  const gap = 1.2 * s;

  // Torso (lado derecho de arriba abajo; el izquierdo es el espejo)
  const torsoR = [
    [neckH * 0.95, 0.118],
    [neckH, 0.145],
    [neckH * 1.3, 0.16],
    [shoulderH * 0.8, 0.173],
    [shoulderH * 0.96, 0.192],
    [chestH, 0.245],
    [chestH * (female ? 1.0 : 0.99), 0.285],
    [waistH, 0.365],
    [abdH, 0.405],
    [hipH, 0.48],
    [hipH * 0.95, 0.515],
    [gap, 0.535],
  ];
  const torso = [
    ...torsoR.map(([x, f]) => [CX + x, Y(f)]),
    ...torsoR.slice().reverse().map(([x, f]) => [CX - x, Y(f)]),
  ];

  // Piernas
  const thighC = Math.max(thighH + gap * 0.5, hipH - thighH);
  const kneeC = Math.max(kneeH + gap, thighC - 2 * s);
  const calfC = kneeC + 0.3 * s;
  const ankleC = Math.max(ankleH + 1.5 * s, kneeC - 1.5 * s);
  const legR = [
    [hipH * 0.97, 0.49],
    [thighC + thighH, 0.56],
    [kneeC + kneeH * 1.05, 0.715],
    [calfC + calfH, 0.79],
    [ankleC + ankleH * 1.1, 0.93],
    [ankleC + ankleH * 1.7, 0.99],
    [ankleC + ankleH * 0.6, 1.0],
    [ankleC - ankleH * 0.9, 0.995],
    [ankleC - ankleH, 0.94],
    [calfC - calfH * 0.92, 0.8],
    [kneeC - kneeH, 0.72],
    [thighC - thighH, 0.57],
    [gap * 0.5, 0.54],
    [hipH * 0.4, 0.5],
  ];
  const leg = (sign) => legR.map(([x, f]) => [CX + sign * x, Y(f)]);

  // Brazos
  const sx = shoulderH - upperArmH * 0.9;
  const elbowC = Math.max(sx + 1 * s, waistH + elbowH + 1.2 * s);
  const wristC = elbowC + 2 * s;
  const handC = wristC + 0.6 * s;
  const foreC = (elbowC + wristC) / 2;
  const armR = [
    [shoulderH * 0.82, 0.175],
    [shoulderH + 0.4 * s, 0.205],
    [sx + upperArmH, 0.285],
    [elbowC + elbowH, 0.375],
    [foreC + forearmH, 0.42],
    [wristC + wristH, 0.495],
    [handC + handH, 0.535],
    [handC + handH * 0.55, 0.578],
    [handC - handH * 0.3, 0.585],
    [handC - handH * 0.85, 0.54],
    [wristC - wristH, 0.495],
    [foreC - forearmH * 0.9, 0.42],
    [elbowC - elbowH, 0.375],
    [sx - upperArmH, 0.285],
    [sx - upperArmH * 0.5, 0.235],
    [shoulderH * 0.6, 0.2],
  ];
  const arm = (sign) => armR.map(([x, f]) => [CX + sign * x, Y(f)]);

  // Cabeza y pelo
  const headRy = 0.062 * H;
  const headRx = headRy * 0.78;
  const headCy = TOP + headRy;

  // Dónde va cada medida: centro y medio ancho, por lado
  const marks = {
    neck: [{ cx: CX, hw: neckH, y: Y(0.145) }],
    shoulders: [{ cx: CX, hw: shoulderH + 0.4 * s, y: Y(0.198) }],
    chest: [{ cx: CX, hw: chestH, y: Y(0.265) }],
    waist: [{ cx: CX, hw: waistH, y: Y(0.365) }],
    abdomen: [{ cx: CX, hw: abdH, y: Y(0.405) }],
    hip: [{ cx: CX, hw: hipH, y: Y(0.48) }],
    arm: [{ side: "r", cx: CX - sx, hw: upperArmH, y: Y(0.285) }, { side: "l", cx: CX + sx, hw: upperArmH, y: Y(0.285) }],
    arm_flex: [{ side: "r", cx: CX - sx, hw: upperArmH * 1.05, y: Y(0.3) }, { side: "l", cx: CX + sx, hw: upperArmH * 1.05, y: Y(0.3) }],
    forearm: [{ side: "r", cx: CX - foreC, hw: forearmH, y: Y(0.42) }, { side: "l", cx: CX + foreC, hw: forearmH, y: Y(0.42) }],
    thigh: [{ side: "r", cx: CX - thighC, hw: thighH, y: Y(0.56) }, { side: "l", cx: CX + thighC, hw: thighH, y: Y(0.56) }],
    calf: [{ side: "r", cx: CX - calfC, hw: calfH, y: Y(0.79) }, { side: "l", cx: CX + calfC, hw: calfH, y: Y(0.79) }],
  };

  const shapes = [smooth(torso), smooth(leg(1)), smooth(leg(-1)), smooth(arm(1)), smooth(arm(-1))];
  return { shapes, head: { cx: CX, cy: headCy, rx: headRx, ry: headRy }, marks, neckH, female };
}

function Hair({ head, female }) {
  const { cx, cy, rx, ry } = head;
  if (female) {
    // Pelo hasta los hombros
    const d = `M${cx - rx * 1.08},${cy + ry * 0.1}
      C${cx - rx * 1.25},${cy - ry * 1.15} ${cx + rx * 1.25},${cy - ry * 1.15} ${cx + rx * 1.08},${cy + ry * 0.1}
      C${cx + rx * 1.15},${cy + ry * 0.9} ${cx + rx * 1.3},${cy + ry * 1.45} ${cx + rx * 1.05},${cy + ry * 1.75}
      C${cx + rx * 0.7},${cy + ry * 1.5} ${cx - rx * 0.7},${cy + ry * 1.5} ${cx - rx * 1.05},${cy + ry * 1.75}
      C${cx - rx * 1.3},${cy + ry * 1.45} ${cx - rx * 1.15},${cy + ry * 0.9} ${cx - rx * 1.08},${cy + ry * 0.1}Z`;
    return <path d={d} fill={C.hair} />;
  }
  const d = `M${cx - rx * 1.02},${cy - ry * 0.05}
    C${cx - rx * 1.12},${cy - ry * 1.2} ${cx + rx * 1.12},${cy - ry * 1.2} ${cx + rx * 1.02},${cy - ry * 0.05}
    C${cx + rx * 0.7},${cy - ry * 0.55} ${cx - rx * 0.7},${cy - ry * 0.55} ${cx - rx * 1.02},${cy - ry * 0.05}Z`;
  return <path d={d} fill={C.hair} />;
}

function Silhouette({ geo, ghost }) {
  if (ghost) {
    return (
      <g fill="none" stroke={C.soft} strokeWidth="1" strokeDasharray="3 3" opacity="0.7">
        {geo.shapes.map((d, i) => <path key={i} d={d} />)}
      </g>
    );
  }
  return (
    <g>
      {geo.female && <Hair head={geo.head} female />}
      <g fill={C.body}>
        {geo.shapes.map((d, i) => <path key={i} d={d} />)}
        <rect x={CX - geo.neckH} y={geo.head.cy + geo.head.ry * 0.6} width={geo.neckH * 2} height={geo.head.ry * 0.8} />
        <ellipse {...geo.head} />
      </g>
      {!geo.female && <Hair head={geo.head} />}
    </g>
  );
}

// Banda de la cinta sobre una parte del cuerpo
function Band({ mark, active }) {
  const { cx, hw, y } = mark;
  return (
    <g>
      <ellipse cx={cx} cy={y} rx={hw + 1.5} ry={Math.max(2.2, hw * 0.16)} fill={active ? C.accent : "none"} fillOpacity={active ? 0.18 : 0} stroke={C.accent} strokeWidth={active ? 2.6 : 1.3} opacity={active ? 1 : 0.85} />
      {active && (
        <ellipse cx={cx} cy={y} rx={hw + 1.5} ry={Math.max(2.2, hw * 0.16)} fill="none" stroke={C.accent} strokeWidth="2" className="animate-ping origin-center [transform-box:fill-box]" opacity="0.5" />
      )}
    </g>
  );
}

const fmt = (v) => (v == null ? "—" : Number(v).toFixed(1).replace(/\.0$/, ""));

// Etiquetas sin encimarse: reparte las alturas con un mínimo de separación
function spread(items, minGap, top, bottom) {
  const list = items.slice().sort((a, b) => a.y - b.y).map((it) => ({ ...it, ly: it.y }));
  for (let i = 1; i < list.length; i++) list[i].ly = Math.max(list[i].ly, list[i - 1].ly + minGap);
  const overflow = list.length ? list[list.length - 1].ly - bottom : 0;
  if (overflow > 0) for (let i = list.length - 1; i >= 0; i--) list[i].ly = Math.min(list[i].ly, bottom - (list.length - 1 - i) * minGap);
  list.forEach((it) => (it.ly = Math.max(it.ly, top)));
  return list;
}

/**
 * sex: "hombre" | "mujer"
 * values: fila de body_measurements (o borrador)
 * previous: medición anterior (se dibuja punteada detrás) — opcional
 * highlight: { key, side } para el registro paso a paso — opcional
 * labels: muestra los valores de cada medida a los lados
 * t: función de traducción
 */
export function BodyFigure({ sex = "mujer", values, previous, highlight, labels = false, t = plain, className = "" }) {
  const geo = bodyGeometry(values, sex);
  const prevGeo = previous ? bodyGeometry(previous, sex) : null;

  const measured = (key) => {
    const f = TAPE_FIELDS.find((x) => x.key === key);
    return f.side ? n(values?.[col(key, "r")]) || n(values?.[col(key, "l")]) : n(values?.[col(key)]);
  };

  let bands = [];
  if (highlight) {
    const ms = geo.marks[highlight.key] || [];
    bands = ms.filter((m) => !highlight.side || !m.side || m.side === highlight.side).map((m) => ({ mark: m, active: true }));
  } else if (labels) {
    bands = TAPE_FIELDS.filter((f) => f.key !== "arm_flex" && measured(f.key)).flatMap((f) => geo.marks[f.key].map((m) => ({ mark: m })));
  }

  // Etiquetas: tronco a la derecha de la pantalla, brazos y piernas a la izquierda
  let right = [], left = [];
  if (labels && !highlight) {
    const deltaOf = (column) => {
      const a = n(values?.[column]), b = n(previous?.[column]);
      return a != null && b != null ? Math.round((a - b) * 10) / 10 : null;
    };
    TAPE_FIELDS.forEach((f) => {
      if (!measured(f.key)) return;
      const ms = geo.marks[f.key];
      if (f.side) {
        const m = ms[0];
        const r = n(values?.[col(f.key, "r")]), l = n(values?.[col(f.key, "l")]);
        left.push({
          key: f.key, y: m.y, ax: m.cx - m.hw, ay: m.y,
          name: t(f.label),
          value: `${fmt(r)} · ${fmt(l)}`,
          sub: t("der. · izq."),
          d: deltaOf(col(f.key, "r")),
        });
      } else {
        const m = ms[0];
        right.push({ key: f.key, y: m.y, ax: m.cx + m.hw, ay: m.y, name: t(f.label), value: `${fmt(values[col(f.key)])} cm`, d: deltaOf(col(f.key)) });
      }
    });
    right = spread(right, previous ? 40 : 34, 30, VB_H - 20);
    left = spread(left, 40, 40, VB_H - 20);
  }

  const Label = ({ it, side }) => {
    const x = side === "right" ? VB_W - 4 : 4;
    const anchor = side === "right" ? "end" : "start";
    const lineEnd = side === "right" ? VB_W - 74 : 74;
    const dText = it.d == null || it.d === 0 ? null : `${it.d > 0 ? "+" : ""}${fmt(it.d)}`;
    return (
      <g>
        <polyline points={`${it.ax},${it.ay} ${(it.ax + lineEnd) / 2},${it.ly} ${lineEnd},${it.ly}`} fill="none" stroke={C.accent} strokeOpacity="0.45" strokeWidth="0.8" />
        <circle cx={it.ax} cy={it.ay} r="1.8" fill={C.accent} />
        <text x={x} y={it.ly - 9} textAnchor={anchor} fontSize="9" fill={C.soft}>{it.name}</text>
        <text x={x} y={it.ly + 4} textAnchor={anchor} fontSize="11.5" fontWeight="600" fill={C.ink}>{it.value}</text>
        {(dText || it.sub) && (
          <text x={x} y={it.ly + 15} textAnchor={anchor} fontSize="8.5" fill={dText ? C.accent : C.muted}>
            {dText ? `${dText} ${t("vs. anterior")}` : it.sub}
          </text>
        )}
      </g>
    );
  };

  // Con una medida resaltada se hace zoom a esa zona del cuerpo
  let viewBox = labels ? `0 0 ${VB_W} ${VB_H}` : `95 6 170 ${VB_H - 8}`;
  if (highlight && bands.length) {
    const y = bands[0].mark.y;
    const h = 270;
    const top = Math.min(Math.max(0, y - h / 2), VB_H - h);
    viewBox = `75 ${top} 210 ${h}`;
  }

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={t("Figura con sus medidas")}>
      {prevGeo && <Silhouette geo={prevGeo} ghost />}
      <Silhouette geo={geo} />
      {bands.map((b, i) => <Band key={i} {...b} />)}
      {right.map((it) => <Label key={it.key} it={it} side="right" />)}
      {left.map((it) => <Label key={it.key} it={it} side="left" />)}
    </svg>
  );
}
