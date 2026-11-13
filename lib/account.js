// Nombre y correo de una cuenta (la propia o la de un alumno del coach), por la ruta /api/account
import { supabase } from "@/lib/supabaseClient";

async function call(method, { id = null, body = null } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Sin sesión" };
  try {
    const res = await fetch(`/api/account${method === "GET" && id ? `?id=${encodeURIComponent(id)}` : ""}`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "No se pudo completar" };
    return { data };
  } catch {
    return { error: "Sin conexión. Intente de nuevo." };
  }
}

// Elimina la cuenta de un alumno (solo su coach o el admin)
export const deleteAccount = (id) => call("DELETE", { body: { id } });

// { data: { email, full_name } } o { error }
export const getAccount = (id = null) => call("GET", { id });

// changes = { full_name?, email? }; id = null → la propia cuenta
export async function updateAccount(id, changes) {
  const result = await call("PATCH", { body: { id, ...changes } });
  // Si cambió el correo propio, se refresca la sesión para que la app lo vea
  if (!result.error && !id && changes.email !== undefined) await supabase.auth.refreshSession();
  return result;
}
