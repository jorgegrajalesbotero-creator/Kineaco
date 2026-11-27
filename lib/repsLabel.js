// Texto de las repeticiones: "12" → "12 reps", "8-10" → "8-10 reps". Si el coach ya escribió la unidad
// ("30 reps", "20 seg", '40"', "1 min", "al fallo") se deja tal cual, para no mostrar "30 reps reps".
export function repsLabel(reps, t = (s, p) => s.replace("{p0}", p.p0)) {
  const s = String(reps ?? "").trim();
  if (!s) return "";
  return /^[\d\s\-–xX×,./]+$/.test(s) ? t("{p0} reps", { p0: s }) : s;
}
