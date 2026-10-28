// Devuelve la URL solo si es http(s); si no (p. ej. "javascript:...",
// "data:...", valor inválido), devuelve null. Defensa al renderizar enlaces
// cuyo valor viene de la base de datos.
export function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(String(value).trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
