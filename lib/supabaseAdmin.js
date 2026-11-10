// Cliente de Supabase con la clave SECRETA (salta las reglas RLS).
// SOLO para el servidor (rutas de app/api). Nunca importarlo desde un componente:
// la clave no tiene el prefijo NEXT_PUBLIC_, así que en el navegador no existe.
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en el servidor");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Compara secretos sin filtrar información por el tiempo de respuesta
export function sameSecret(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
