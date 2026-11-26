// Aviso de que el acceso a la app está por vencer (lógica pura, con pruebas).
// El acceso vale hasta el final del día de access_until (el coach lo guarda a las 23:59), así que el
// día del vencimiento todavía puede entrar: ese día el aviso dice "vence hoy".
// Las fechas se cuentan en hora de Colombia, igual que el resto de avisos automáticos.

export const ACCESS_CARD_DAYS = 7; // la tarjeta de Inicio aparece desde 7 días antes
export const ACCESS_REMINDER_DAYS = [3, 0]; // avisos al celular: 3 días antes y el mismo día
export const ACCESS_TZ = "America/Bogota";

// "AAAA-MM-DD" de una fecha en Colombia
export function colombiaDateISO(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: ACCESS_TZ });
}

// Días que le quedan (0 = vence hoy, negativo = ya venció, null = sin fecha)
export function accessDaysLeft(accessUntil, now = new Date()) {
  if (!accessUntil) return null;
  const until = colombiaDateISO(accessUntil);
  const today = colombiaDateISO(now);
  if (!until || !today) return null;
  return Math.round((Date.parse(`${until}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
}

// Cómo se ve la tarjeta: null (no se muestra) · "soon" (quedan 3 a 7 días) · "urgent" (1 o 2) · "today"
export function accessStage(days) {
  if (days == null || days < 0 || days > ACCESS_CARD_DAYS) return null;
  if (days === 0) return "today";
  return days <= 2 ? "urgent" : "soon";
}

// Aviso al celular para ese día (o null). La dedupe_key lleva la fecha de vencimiento y los días,
// así cada aviso llega una sola vez aunque lo creen la app al abrirse y el cron de la mañana.
export function accessReminderRow(uid, accessUntil, now = new Date()) {
  const days = accessDaysLeft(accessUntil, now);
  if (!ACCESS_REMINDER_DAYS.includes(days)) return null;
  const until = colombiaDateISO(accessUntil);
  const date = new Date(`${until}T12:00:00Z`).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "UTC" });
  return days === 0
    ? { recipient_id: uid, type: "access", link: "messages", dedupe_key: `access:${until}:0`, title: "Su acceso vence hoy", body: "Hoy es su último día. Escríbale a su coach para renovarlo." }
    : { recipient_id: uid, type: "access", link: "messages", dedupe_key: `access:${until}:${days}`, title: "Su acceso vence pronto", body: `Vence el ${date}. Hable con su coach para renovarlo.` };
}

// Resumen para el coach (los lunes): sus alumnos que vencen en los próximos 7 días, por fecha
export function weeklyExpiring(students, now = new Date()) {
  return (students || [])
    .map((s) => ({ ...s, days: accessDaysLeft(s.access_until, now) }))
    .filter((s) => s.days != null && s.days >= 0 && s.days <= ACCESS_CARD_DAYS)
    .sort((a, b) => a.days - b.days || String(a.full_name || "").localeCompare(String(b.full_name || "")));
}
