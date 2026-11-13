// Camaleón compañero: su estado (y su color) sale SOLO de las respuestas del check-in diario.
// Reglas (en este orden, gana la primera que se cumpla):
//   1. Estrés 4 o 5                                  → Estresado (rojo)
//   2. Sueño, energía o ánimo en 1 o 2               → Cansado (morado)
//   3. Promedio de sueño, energía, (6 − dolor muscular), (6 − estrés) y ánimo:
//        ≥ 4,5 → Con toda (lima) · ≥ 3,5 → Bien (verde) · si no → Normal (azul)
// Escalas (tabla daily_checkins): todo 1–5; en estrés y dolor muscular más alto es peor.

export const PET_STATES = {
  1: { key: "estresado", name: "Estresado", color: "#E24B4A" },
  2: { key: "cansado", name: "Cansado", color: "#9B8CE8" },
  3: { key: "normal", name: "Normal", color: "#3FA7D6" },
  4: { key: "bien", name: "Bien", color: "#3FBF7F" },
  5: { key: "con-toda", name: "Con toda", color: "#D6FF5C" },
};

// Lo que dice el camaleón en el saludo de Inicio, según su estado
export const PET_SAYINGS = {
  1: "Respire hondo. Una serie a la vez, juntos.",
  2: "Hoy suave, pero hoy cuenta. Aquí estoy.",
  3: "Paso a paso. Lo importante es empezar.",
  4: "Buen día para entrenar. ¿Arrancamos?",
  5: "¡Hoy vamos con todo! Yo cuento las series.",
};

// Estado del día a partir de un check-in diario (o null si no hay respuestas suficientes)
export function petMood(c) {
  if (!c) return null;
  const n = (v) => (v == null ? null : Number(v));
  const sleep = n(c.sleep), energy = n(c.energy), sore = n(c.soreness), stress = n(c.stress), mood = n(c.mood);
  if (stress != null && stress >= 4) return 1;
  if ([sleep, energy, mood].some((v) => v != null && v <= 2)) return 2;
  const vals = [sleep, energy, sore == null ? null : 6 - sore, stress == null ? null : 6 - stress, mood].filter((v) => v != null);
  if (!vals.length) return 3;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg >= 4.5) return 5;
  if (avg >= 3.5) return 4;
  return 3;
}

// Estado "en vivo" mientras el alumno responde una pregunta (para que el camaleón reaccione)
export function petMoodForAnswer(field, v) {
  if (v == null) return null;
  if (field === "stress") return v >= 4 ? 1 : v === 3 ? 3 : 4;
  if (field === "soreness") return v <= 2 ? 4 : v === 3 ? 3 : 2;
  if (field === "energy") return v === 5 ? 5 : v === 4 ? 4 : v === 3 ? 3 : 2;
  if (field === "mood") return v <= 2 ? 2 : v;
  if (field === "sleep") return v >= 4 ? 4 : v === 3 ? 3 : 2;
  return null;
}

export const PET_NAME_MAX = 20;
