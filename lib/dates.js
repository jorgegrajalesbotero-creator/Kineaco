export const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function currentWeekStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

export function todayDayLabel() {
  const jsDay = new Date().getDay();
  const index = (jsDay + 6) % 7;
  return WEEK_DAYS[index];
}

export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysSince(dateStr) {
  const then = new Date(dateStr + "T00:00:00");
  const now = new Date(localDateString() + "T00:00:00");
  return Math.round((now - then) / 86400000);
}
