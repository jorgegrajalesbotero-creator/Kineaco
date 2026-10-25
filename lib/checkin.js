import { localDateString } from "@/lib/dates";

// Check-in semanal: se llena el domingo (o el lunes, si se le pasó) y cuenta para la semana lunes–domingo.

export const WELLBEING_FIELDS = [
  { key: "sleep", label: "Sueño", hint: "1 = muy mal · 5 = excelente" },
  { key: "energy", label: "Energía", hint: "1 = sin energía · 5 = con mucha energía" },
  { key: "stress", label: "Estrés", hint: "1 = nada · 5 = muchísimo" },
  { key: "mood", label: "Ánimo", hint: "1 = muy bajo · 5 = excelente" },
  { key: "hunger", label: "Hambre", hint: "1 = nada · 5 = mucha" },
];

export const SCALE_FACES = ["😫", "😕", "😐", "🙂", "😄"];
// En estrés, hambre y dolor muscular, más alto es peor: las caritas van al revés
export const REVERSED = new Set(["stress", "hunger", "soreness"]);

// Check-in diario (opcional) antes del entrenamiento de hoy
export const DAILY_FIELDS = [
  { key: "sleep", label: "Sueño", hint: "1 = muy mal · 5 = excelente" },
  { key: "energy", label: "Energía", hint: "1 = sin energía · 5 = con mucha energía" },
  { key: "soreness", label: "Dolor muscular", hint: "1 = nada · 5 = mucho" },
  { key: "stress", label: "Estrés", hint: "1 = nada · 5 = muchísimo" },
  { key: "mood", label: "Ánimo", hint: "1 = muy bajo · 5 = excelente" },
];

// Se recuerda en el navegador si hoy ya lo respondió o lo saltó, para no volver a preguntar
export const dailyCheckinKey = (userId, date) => `daily_checkin_${userId}_${date}`;

// ¿Hoy se puede hacer el check-in? Domingo, o lunes para la semana que terminó
export function isCheckinDay(date = new Date()) {
  const d = date.getDay();
  return d === 0 || d === 1;
}

// Lunes (YYYY-MM-DD) de la semana a la que corresponde el check-in de hoy
export function checkinWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  if (d.getDay() === 1) d.setDate(d.getDate() - 1); // el lunes cuenta para la semana anterior
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return localDateString(d);
}

export function formatWeek(weekStart, locale = "es-CO") {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const f = (x) => x.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return `${f(start)} – ${f(end)}`;
}
