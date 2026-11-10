// Envía al celular (notificación push) cada aviso nuevo de la campanita.
// Lo llama Supabase (disparador send_push en la tabla notifications) con el id del aviso
// y el encabezado x-push-secret. El contenido se lee aquí desde la base, no del pedido,
// así que nadie puede usar esta ruta para mandar textos inventados.
import { sameSecret, supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWebPush } from "@/lib/webpush";
import { setLang, tr } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Avisos que se quedan solo en la campanita (no suenan en el celular)
const QUIET_TYPES = new Set(["rest"]);
// Avisos que deben llegar rápido aunque el celular esté ahorrando batería
const URGENT_TYPES = new Set(["message", "announcement", "checkin_alert", "daily_alert"]);

function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:jorgegrajalesbotero@gmail.com";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

// Los avisos del panel (sobre un alumno) abren /admin; los del entrenamiento propio abren la app
function targetUrl(n, role) {
  const staff = role === "coach" || role === "admin";
  const toPanel = staff && (n.student_id || n.link === "access");
  return `${toPanel ? "/admin" : "/"}?aviso=${encodeURIComponent(n.id)}`;
}

function texts(n, language) {
  if (language !== "en") return { title: n.title, body: n.body || "" };
  setLang("en");
  try {
    return { title: tr(n.title), body: n.body ? tr(n.body) : "" };
  } finally {
    setLang("es");
  }
}

export async function POST(request) {
  if (!sameSecret(request.headers.get("x-push-secret"), process.env.PUSH_WEBHOOK_SECRET)) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }
  const vapid = vapidConfig();
  if (!vapid) return Response.json({ error: "faltan las claves VAPID" }, { status: 500 });

  let id;
  try {
    ({ id } = await request.json());
  } catch {
    return Response.json({ error: "pedido inválido" }, { status: 400 });
  }
  if (!id) return Response.json({ error: "falta el id" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: n } = await db
    .from("notifications")
    .select("id, recipient_id, type, title, body, link, student_id, dedupe_key, read_at, hidden_at")
    .eq("id", id)
    .maybeSingle();
  if (!n || n.read_at || n.hidden_at || QUIET_TYPES.has(n.type)) return Response.json({ sent: 0 });

  const [{ data: profile }, { data: subs }] = await Promise.all([
    db.from("profiles").select("role, language").eq("id", n.recipient_id).maybeSingle(),
    db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", n.recipient_id),
  ]);
  if (!subs || subs.length === 0) return Response.json({ sent: 0 });

  const { title, body } = texts(n, profile?.language);
  const payload = {
    title: title || "Kineaco",
    body,
    url: targetUrl(n, profile?.role),
    tag: n.dedupe_key || n.id,
    id: n.id,
  };
  const options = { urgency: URGENT_TYPES.has(n.type) ? "high" : "normal", topic: n.dedupe_key || undefined };

  let sent = 0;
  const gone = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await sendWebPush(s, payload, vapid, options);
        if (r.ok) sent++;
        else if (r.gone) gone.push(s.id);
      } catch {
        // un celular con problemas no frena a los demás
      }
    }),
  );
  // Celulares que ya no reciben (se desinstaló la app o se quitó el permiso): se borran
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  return Response.json({ sent, removed: gone.length });
}
