// Detalles de cada mensaje del chat: quién lo envió, cuándo y si ya lo leyeron (lógica pura, con pruebas).

// "Hoy 11:08 p. m." · "Ayer 9:15 a. m." · "24 nov 7:30 p. m."
export function chatWhen(iso, { now = new Date(), locale = "es-CO", today = "Hoy", yesterday = "Ayer" } = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hour = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const day = (x) => x.toDateString();
  const ayer = new Date(now);
  ayer.setDate(ayer.getDate() - 1);
  if (day(d) === day(now)) return `${today} ${hour}`;
  if (day(d) === day(ayer)) return `${yesterday} ${hour}`;
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })} ${hour}`;
}

// Primer nombre (para no ocupar tanto espacio en la burbuja)
export const firstName = (full) => String(full || "").trim().split(/\s+/)[0] || "";
