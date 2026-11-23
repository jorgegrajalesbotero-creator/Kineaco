// Check-out después de entrenar (opcional): cómo le fue, si le molestó algún ejercicio, dónde, cómo y cuánto.
// Tabla workout_checkouts (uno por alumno, semana y día). Si hay molestia o comentario, al coach le llega un aviso.
// Si la tabla todavía no existe, la app sigue igual (el check-out simplemente no aparece).

export const ISSUE_ZONES = [
  { key: "cuello", label: "Cuello" },
  { key: "hombro", label: "Hombro" },
  { key: "codo", label: "Codo" },
  { key: "muneca", label: "Muñeca o mano" },
  { key: "espalda_alta", label: "Espalda alta" },
  { key: "espalda_baja", label: "Espalda baja" },
  { key: "cadera", label: "Cadera" },
  { key: "rodilla", label: "Rodilla" },
  { key: "tobillo", label: "Tobillo o pie" },
  { key: "otra", label: "Otra zona" },
];

export const ISSUE_KINDS = [
  { key: "punzante", label: "Dolor punzante" },
  { key: "molestia", label: "Molestia o tensión" },
  { key: "ardor", label: "Ardor" },
  { key: "inestabilidad", label: "Inestabilidad" },
  { key: "hormigueo", label: "Hormigueo" },
  { key: "otro", label: "Otro" },
];

export const ISSUE_SIDES = [
  { key: "izquierdo", label: "Izquierdo" },
  { key: "derecho", label: "Derecho" },
  { key: "ambos", label: "Ambos" },
];

export const ISSUE_TIMES = [
  { key: "durante", label: "Durante el ejercicio" },
  { key: "despues", label: "Después" },
];

const labelOf = (list, key) => list.find((x) => x.key === key)?.label || "";
export const zoneLabel = (k) => labelOf(ISSUE_ZONES, k);
export const kindLabel = (k) => labelOf(ISSUE_KINDS, k);
export const sideLabel = (k) => labelOf(ISSUE_SIDES, k);
export const timeLabel = (k) => labelOf(ISSUE_TIMES, k);

// Texto corto de una molestia: "Sentadilla · Rodilla (lado derecho) · Dolor punzante 6/10 · durante el ejercicio"
export function describeIssue(i, t = (x) => x) {
  const side = i.side === "ambos" ? t("ambos lados") : i.side ? `${t("lado")} ${t(sideLabel(i.side)).toLowerCase()}` : "";
  const zone = [t(zoneLabel(i.zone)), side ? `(${side})` : ""].filter(Boolean).join(" ");
  return [i.name, zone, [t(kindLabel(i.kind)), i.intensity ? `${i.intensity}/10` : ""].filter(Boolean).join(" "), i.when ? t(timeLabel(i.when)).toLowerCase() : "", i.note || ""]
    .filter(Boolean)
    .join(" · ");
}

// Molestia fuerte = 7 o más (se resalta en rojo para el coach)
export const isStrongIssue = (i) => Number(i?.intensity) >= 7;

export async function loadCheckout(supabase, userId, weekStart, dayLabel) {
  const { data, error } = await supabase
    .from("workout_checkouts")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .eq("day_label", dayLabel)
    .maybeSingle();
  if (error) return { data: null, missing: true };
  return { data, missing: false };
}

export async function saveCheckout(supabase, { userId, weekStart, dayLabel, effort, issues, comment }) {
  const clean = (issues || []).map((i) => ({
    exercise_id: i.exercise_id ?? null,
    item_key: i.item_key ?? null,
    routine_id: i.routine_id ?? null,
    name: String(i.name || "").slice(0, 120),
    zone: i.zone || null,
    side: i.side || null,
    kind: i.kind || null,
    intensity: i.intensity ? Math.max(1, Math.min(10, Number(i.intensity))) : null,
    when: i.when || null,
    note: String(i.note || "").trim().slice(0, 300) || null,
  }));
  return supabase
    .from("workout_checkouts")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        day_label: dayLabel,
        effort: effort ? Math.max(1, Math.min(10, Number(effort))) : null,
        had_issue: clean.length > 0,
        issues: clean,
        comment: String(comment || "").trim().slice(0, 1000) || null,
      },
      { onConflict: "user_id,week_start,day_label" }
    )
    .select("*")
    .single();
}
