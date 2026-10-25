// ---------- Buscadores ----------
export function normalizeText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function matchesSearch(query, ...fields) {
  const q = normalizeText(query).trim();
  if (!q) return true;
  const hay = normalizeText(fields.filter(Boolean).join(" "));
  return q.split(/\s+/).every((word) => hay.includes(word));
}
