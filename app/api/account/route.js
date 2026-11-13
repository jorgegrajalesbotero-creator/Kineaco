// Datos de la cuenta (nombre y correo) de un usuario.
// - El propio usuario puede ver/cambiar los suyos.
// - El coach (o admin) puede ver/cambiar los de SUS alumnos (misma regla que la base: is_coach() + is_staff_for()).
// El correo vive en Supabase Auth, por eso se cambia aquí con la clave secreta (en el servidor).
// El cambio de correo queda confirmado de una vez (no se manda correo de confirmación).
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const json = (body, status = 200) => Response.json(body, { status });

function callerClient(token) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Quién llama y si puede tocar la cuenta "id"
async function authorize(request, id) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: json({ error: "Sin sesión" }, 401) };
  const db = supabaseAdmin();
  const { data: { user } = {}, error } = await db.auth.getUser(token);
  if (error || !user) return { error: json({ error: "Sin sesión" }, 401) };
  const asCaller = callerClient(token);
  if (!id || id === user.id) return { db, asCaller, user, targetId: user.id, self: true };

  // Se pregunta a la base con la sesión de quien llama, para usar exactamente las mismas reglas
  const [{ data: coach }, { data: staff }] = await Promise.all([
    asCaller.rpc("is_coach"),
    asCaller.rpc("is_staff_for", { p_user: id }),
  ]);
  if (!coach || !staff) return { error: json({ error: "No autorizado" }, 403) };
  const { data: target } = await db.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!target || target.role !== "alumno") return { error: json({ error: "Solo se pueden editar alumnos" }, 403) };
  return { db, asCaller, user, targetId: id, self: false };
}

// Borra todos los archivos de una carpeta (y subcarpetas) de un bucket
async function removeFolder(db, bucket, prefix) {
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  const files = [];
  for (const item of data || []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) files.push(path);
    else await removeFolder(db, bucket, path); // carpeta
  }
  if (files.length) await db.storage.from(bucket).remove(files);
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id");
  const auth = await authorize(request, id);
  if (auth.error) return auth.error;
  const { data, error } = await auth.db.auth.admin.getUserById(auth.targetId);
  if (error || !data?.user) return json({ error: "No se encontró la cuenta" }, 404);
  const { data: profile } = await auth.db.from("profiles").select("full_name").eq("id", auth.targetId).maybeSingle();
  return json({ id: auth.targetId, email: data.user.email || "", full_name: profile?.full_name || "" });
}

export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Pedido inválido" }, 400);
  }
  const auth = await authorize(request, body?.id);
  if (auth.error) return auth.error;
  const { db, targetId } = auth;

  if (body.full_name !== undefined) {
    const name = String(body.full_name || "").trim();
    if (!name) return json({ error: "Escriba un nombre." }, 400);
    if (name.length > 80) return json({ error: "El nombre puede tener hasta 80 caracteres." }, 400);
    const { error } = await db.from("profiles").update({ full_name: name }).eq("id", targetId);
    if (error) return json({ error: "No se pudo guardar el nombre." }, 500);
  }

  if (body.email !== undefined) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: "El correo no es válido." }, 400);
    const { data: current } = await db.auth.admin.getUserById(targetId);
    if ((current?.user?.email || "").toLowerCase() !== email) {
      const { error } = await db.auth.admin.updateUserById(targetId, { email, email_confirm: true });
      if (error) {
        const taken = /already|registered|exists/i.test(error.message || "");
        return json({ error: taken ? "Ese correo ya lo usa otra cuenta." : "No se pudo cambiar el correo." }, taken ? 409 : 500);
      }
    }
  }

  return json({ ok: true });
}

// Elimina la cuenta de un alumno (coach de ese alumno o admin): primero sus archivos y luego todo lo demás
export async function DELETE(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Pedido inválido" }, 400);
  }
  if (!body?.id) return json({ error: "Falta el alumno" }, 400);
  const auth = await authorize(request, body.id);
  if (auth.error) return auth.error;
  if (auth.self) return json({ error: "Su propia cuenta no se elimina desde aquí" }, 400);

  try {
    await removeFolder(auth.db, "progress-photos", auth.targetId);
    await removeFolder(auth.db, "avatars", auth.targetId);
  } catch {
    // si falla Storage, igual se borra la cuenta
  }
  const { error } = await auth.asCaller.rpc("delete_student_account", { p_user: auth.targetId });
  if (error) return json({ error: `No se pudo eliminar: ${error.message}` }, 500);
  return json({ ok: true });
}
