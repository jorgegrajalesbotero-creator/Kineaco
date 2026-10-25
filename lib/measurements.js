// Medidas corporales con cinta métrica: qué se mide, cómo se mide y qué resultados salen.
// Fórmulas usadas:
// - % de grasa: fórmula de la Marina de EE. UU. (Hodgdon y Beckett, 1984), versión en centímetros.
// - Percentil de % de grasa por edad y sexo: normas del Cooper Institute (publicadas por el ACSM).
// - Rango saludable de % de grasa por edad: Gallagher et al., Am J Clin Nutr 2000.
// - IMC y cintura (riesgo): Organización Mundial de la Salud. Cintura/cadera: OMS 2008.
// - Cintura/estatura: Ashwell (punto de corte 0,5).
// - Índice de masa libre de grasa (FFMI) normalizado a 1,80 m: Kouri et al., 1995.

// Traducción por defecto (panel del coach): solo reemplaza {p0}, {p1}...
export const plain = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? "").toString()) : text);

export const MEASURE_DAYS = 28; // recordatorio cada 4 semanas

// Datos base (primera pantalla del registro)
export const BASE_FIELDS = [
  { key: "height_cm", label: "Estatura", unit: "cm", min: 100, max: 250 },
  { key: "weight_kg", label: "Peso", unit: "kg", min: 25, max: 400 },
];

// Medidas con cinta. `side: true` = se mide derecha e izquierda.
// `y` = altura en la figura (0 = coronilla, 1 = planta de los pies).
export const TAPE_FIELDS = [
  {
    key: "neck", label: "Cuello", y: 0.145, min: 15, max: 80,
    how: "Cinta justo debajo de la manzana de Adán (laringe), un poco inclinada hacia abajo por delante. Cabeza recta, mirando al frente y hombros relajados.",
  },
  {
    key: "shoulders", label: "Hombros", y: 0.19, min: 50, max: 200,
    how: "Alrededor de la parte más ancha de los hombros, pasando por encima de los dos deltoides. Brazos relajados a los lados. Es más fácil si otra persona ayuda.",
  },
  {
    key: "chest", label: "Pecho", y: 0.265, min: 50, max: 200,
    how: "Hombres: a la altura de los pezones. Mujeres: en la parte más prominente del busto, con un brasier sin relleno. Brazos abajo; anotar al final de una respiración normal.",
  },
  {
    key: "waist", label: "Cintura", y: 0.365, min: 40, max: 220,
    how: "En la parte más estrecha del torso, entre la última costilla y el hueso de la cadera. Sin meter el abdomen; anotar al final de una respiración normal.",
  },
  {
    key: "abdomen", label: "Abdomen", y: 0.405, min: 40, max: 220,
    how: "A la altura del ombligo, con el abdomen relajado. Anotar al final de una respiración normal.",
  },
  {
    key: "hip", label: "Cadera", y: 0.48, min: 50, max: 220,
    how: "En la parte más prominente de los glúteos, con los pies juntos. La cinta debe quedar paralela al piso por delante y por detrás.",
  },
  {
    key: "arm", label: "Brazo relajado", y: 0.285, side: true, limb: "arm", min: 10, max: 80,
    how: "Brazo colgando relajado. Cinta en el punto medio entre el hombro y el codo.",
  },
  {
    key: "arm_flex", label: "Brazo contraído", y: 0.285, side: true, limb: "arm", min: 10, max: 80,
    how: "Brazo doblado a 90° con el puño cerrado, apretando el bíceps con fuerza. Cinta en la parte más gruesa del bíceps.",
  },
  {
    key: "forearm", label: "Antebrazo", y: 0.42, side: true, limb: "arm", min: 10, max: 60,
    how: "Brazo estirado, palma hacia arriba y mano relajada. Cinta en la parte más gruesa, cerca del codo.",
  },
  {
    key: "thigh", label: "Muslo", y: 0.56, side: true, limb: "leg", min: 20, max: 120,
    how: "De pie, con el peso repartido en las dos piernas. Cinta justo debajo del pliegue del glúteo, en la parte más gruesa del muslo.",
  },
  {
    key: "calf", label: "Pantorrilla", y: 0.8, side: true, limb: "leg", min: 15, max: 80,
    how: "De pie, con el peso repartido en las dos piernas. Cinta en la parte más gruesa de la pantorrilla.",
  },
];

export const TIPS = [
  "Use una cinta métrica flexible (de costura), no metálica.",
  "Mida en la mañana, antes de comer y de entrenar, con ropa mínima.",
  "La cinta debe quedar pegada a la piel, sin apretarla y paralela al piso.",
  "Mida siempre en el mismo orden y en las mismas condiciones. Si duda, mida dos veces.",
];

// Columna de la base para una medida (y lado)
export const col = (key, side) => (side ? `${key}_${side}_cm` : `${key}_cm`);

export const ALL_COLUMNS = TAPE_FIELDS.flatMap((f) => (f.side ? [col(f.key, "r"), col(f.key, "l")] : [col(f.key)]));

const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const round1 = (v) => Math.round(v * 10) / 10;

// ---------- Tablas de referencia ----------

// Percentiles de % de grasa (Cooper Institute / ACSM). Percentil alto = menos grasa.
const COOPER_P = [99, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 1];
const COOPER = {
  hombre: {
    20: [4.2, 6.3, 7.9, 9.2, 10.5, 11.5, 12.7, 13.9, 14.8, 15.8, 16.6, 17.4, 18.6, 19.6, 20.6, 21.9, 23.1, 24.6, 26.3, 28.9, 33.3],
    30: [7.0, 9.9, 11.9, 13.3, 14.5, 15.5, 16.5, 17.4, 18.2, 19.0, 19.7, 20.5, 21.3, 22.1, 23.0, 23.9, 24.9, 26.2, 27.8, 30.2, 34.3],
    40: [9.2, 12.8, 14.9, 16.3, 17.4, 18.4, 19.1, 19.9, 20.6, 21.3, 21.9, 22.6, 23.4, 24.1, 24.8, 25.7, 26.6, 27.7, 29.2, 31.2, 35.0],
    50: [10.9, 14.4, 16.7, 18.0, 19.1, 19.9, 20.7, 21.3, 22.1, 22.7, 23.2, 23.9, 24.6, 25.3, 26.0, 26.8, 27.8, 28.9, 30.3, 32.5, 36.4],
  },
  mujer: {
    20: [9.8, 13.6, 14.8, 15.8, 16.5, 17.3, 18.0, 18.7, 19.4, 20.1, 21.0, 21.9, 22.7, 23.6, 24.5, 25.9, 27.1, 28.9, 31.4, 35.2, 38.9],
    30: [11.0, 14.0, 15.6, 16.6, 17.4, 18.2, 19.1, 20.0, 20.8, 21.7, 22.6, 23.5, 24.6, 25.6, 26.7, 27.7, 29.1, 30.9, 33.0, 35.8, 39.4],
    40: [12.6, 15.6, 17.2, 18.6, 19.8, 20.8, 21.9, 22.8, 23.8, 24.8, 25.6, 26.5, 27.6, 28.5, 29.6, 30.7, 31.9, 33.5, 35.4, 37.4, 39.8],
    50: [14.6, 17.2, 19.4, 20.9, 22.5, 23.8, 25.1, 26.0, 27.0, 27.9, 28.8, 29.7, 30.4, 31.4, 32.5, 33.4, 34.5, 35.6, 36.7, 38.3, 40.4],
  },
};

const cooperGroup = (age) => (age >= 50 ? 50 : age >= 40 ? 40 : age >= 30 ? 30 : 20);

export function bodyFatPercentile(bf, sex, age) {
  const row = COOPER[sex]?.[cooperGroup(age || 25)];
  if (!row || bf == null) return null;
  if (bf <= row[0]) return 99;
  if (bf >= row[row.length - 1]) return 1;
  for (let i = 0; i < row.length - 1; i++) {
    if (bf >= row[i] && bf <= row[i + 1]) {
      const t = (bf - row[i]) / (row[i + 1] - row[i] || 1);
      return Math.round(COOPER_P[i] + (COOPER_P[i + 1] - COOPER_P[i]) * t);
    }
  }
  return null;
}

// Rangos de % de grasa por edad (Gallagher 2000): [bajo <, saludable <, elevado <]
const GALLAGHER = {
  hombre: [[39, 8, 20, 25], [59, 11, 22, 28], [200, 13, 25, 30]],
  mujer: [[39, 21, 33, 39], [59, 23, 35, 40], [200, 24, 36, 42]],
};

export function bodyFatRanges(sex, age) {
  const list = GALLAGHER[sex];
  if (!list) return null;
  const [, low, healthy, high] = list.find((r) => (age || 25) <= r[0]);
  return { low, healthy, high };
}

// ---------- Cálculos ----------

// % de grasa, fórmula de la Marina de EE. UU. (centímetros)
export function navyBodyFat({ sex, height_cm, neck_cm, waist_cm, abdomen_cm, hip_cm }) {
  const h = num(height_cm), neck = num(neck_cm), waist = num(waist_cm), abd = num(abdomen_cm), hip = num(hip_cm);
  if (!h || !neck) return null;
  let d;
  if (sex === "hombre") {
    const a = abd ?? waist;
    if (!a || a - neck <= 0) return null;
    d = 1.0324 - 0.19077 * Math.log10(a - neck) + 0.15456 * Math.log10(h);
  } else if (sex === "mujer") {
    const w = waist ?? abd;
    if (!w || !hip || w + hip - neck <= 0) return null;
    d = 1.29579 - 0.35004 * Math.log10(w + hip - neck) + 0.221 * Math.log10(h);
  } else return null;
  const bf = 495 / d - 450;
  return bf > 2 && bf < 70 ? round1(bf) : null;
}

// tone: "good" | "ok" | "warn" | "bad" | "low"
function bmiInfo(bmi) {
  if (bmi < 18.5) return { label: "Bajo peso", tone: "low" };
  if (bmi < 25) return { label: "Normal", tone: "good" };
  if (bmi < 30) return { label: "Sobrepeso", tone: "warn" };
  if (bmi < 35) return { label: "Obesidad grado I", tone: "bad" };
  if (bmi < 40) return { label: "Obesidad grado II", tone: "bad" };
  return { label: "Obesidad grado III", tone: "bad" };
}

function whtrInfo(r) {
  if (r < 0.4) return { label: "Bajo", tone: "low" };
  if (r < 0.5) return { label: "Saludable", tone: "good" };
  if (r < 0.6) return { label: "Riesgo aumentado", tone: "warn" };
  return { label: "Riesgo alto", tone: "bad" };
}

function whrInfo(r, sex) {
  const cut = sex === "hombre" ? 0.9 : 0.85;
  return r < cut ? { label: "Saludable", tone: "good" } : { label: "Riesgo aumentado", tone: "warn" };
}

function waistInfo(w, sex) {
  const [a, b] = sex === "hombre" ? [94, 102] : [80, 88];
  if (w < a) return { label: "Saludable", tone: "good" };
  if (w < b) return { label: "Riesgo aumentado", tone: "warn" };
  return { label: "Riesgo alto", tone: "bad" };
}

function bodyFatInfo(bf, sex, age) {
  const r = bodyFatRanges(sex, age);
  if (!r) return null;
  if (bf < r.low) return { label: "Bajo", tone: "low" };
  if (bf < r.healthy) return { label: "Saludable", tone: "good" };
  if (bf < r.high) return { label: "Elevado", tone: "warn" };
  return { label: "Alto", tone: "bad" };
}

function ffmiInfo(v, sex) {
  const c = sex === "hombre" ? [18, 20, 22, 25] : [15, 17, 19, 21];
  if (v < c[0]) return { label: "Bajo", tone: "low" };
  if (v < c[1]) return { label: "Promedio", tone: "ok" };
  if (v < c[2]) return { label: "Bueno", tone: "good" };
  if (v < c[3]) return { label: "Muy bueno", tone: "good" };
  return { label: "Excepcional", tone: "good" };
}

// Todos los resultados de una medición
export function computeResults(m) {
  if (!m) return {};
  const sex = m.sex, age = num(m.age);
  const h = num(m.height_cm), w = num(m.weight_kg);
  const waist = num(m.waist_cm) ?? num(m.abdomen_cm), hip = num(m.hip_cm);
  const out = { sex, age };

  const bf = navyBodyFat(m);
  if (bf != null) {
    out.bodyFat = { value: bf, ...bodyFatInfo(bf, sex, age), ranges: bodyFatRanges(sex, age), percentile: bodyFatPercentile(bf, sex, age) };
    if (w) {
      const fat = round1((w * bf) / 100);
      const lean = round1(w - fat);
      out.fatKg = fat;
      out.leanKg = lean;
      if (h) {
        const hm = h / 100;
        const ffmi = Math.round((lean / (hm * hm) + 6.1 * (1.8 - hm)) * 10) / 10;
        out.ffmi = { value: ffmi, ...ffmiInfo(ffmi, sex) };
      }
    }
  }
  if (h && w) {
    const bmi = Math.round((w / ((h / 100) ** 2)) * 10) / 10;
    out.bmi = { value: bmi, ...bmiInfo(bmi) };
  }
  if (h && waist) {
    const r = Math.round((waist / h) * 100) / 100;
    out.whtr = { value: r, ...whtrInfo(r) };
  }
  if (waist && hip && sex) {
    const r = Math.round((waist / hip) * 100) / 100;
    out.whr = { value: r, ...whrInfo(r, sex) };
  }
  if (waist && sex) out.waist = { value: waist, ...waistInfo(waist, sex) };

  // Diferencias entre lados de 1 cm o más
  // Diferencias entre lados: todas las medidas que tengan derecho e izquierdo, aunque la diferencia sea 0
  out.asymmetry = TAPE_FIELDS.filter((f) => f.side)
    .map((f) => {
      const r = num(m[col(f.key, "r")]), l = num(m[col(f.key, "l")]);
      if (!r || !l) return null;
      const diff = round1(Math.abs(r - l));
      return {
        key: f.key,
        label: f.label,
        r,
        l,
        diff,
        pct: Math.round((diff / Math.min(r, l)) * 1000) / 10,
        bigger: diff === 0 ? null : r > l ? "derecho" : "izquierdo",
        level: diff === 0 ? "equal" : diff < 1 ? "low" : diff < 2 ? "mid" : "high",
      };
    })
    .filter(Boolean);

  // Qué falta para calcular el % de grasa
  out.missingForFat = [];
  if (!sex) out.missingForFat.push("Sexo");
  if (!h) out.missingForFat.push("Estatura");
  if (!num(m.neck_cm)) out.missingForFat.push("Cuello");
  if (sex === "hombre" && !num(m.abdomen_cm) && !num(m.waist_cm)) out.missingForFat.push("Abdomen");
  if (sex === "mujer" && !num(m.waist_cm) && !num(m.abdomen_cm)) out.missingForFat.push("Cintura");
  if (sex === "mujer" && !hip) out.missingForFat.push("Cadera");
  return out;
}

// Diferencia de una columna contra la medición anterior
export function delta(curr, prev, column) {
  const a = num(curr?.[column]), b = num(prev?.[column]);
  return a != null && b != null ? round1(a - b) : null;
}

export const TONE_CHIP = {
  good: "bg-accent/10 text-accent",
  ok: "bg-white/[0.06] text-ink",
  warn: "bg-warning/10 text-warning",
  bad: "bg-danger/10 text-danger",
  low: "bg-warning/10 text-warning",
};
