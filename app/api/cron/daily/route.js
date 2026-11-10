// Recordatorios automáticos de la mañana (Vercel Cron, ver vercel.json: 11:00 UTC = 6:00 a. m. Colombia).
// Crea en la campanita de cada alumno con acceso vigente los mismos avisos que la app crea al abrirse
// ("Hoy le toca entrenar", check-in del domingo, acceso por vencer), con la misma dedupe_key:
// así no se repiten cuando el alumno abre la app. Al crearse, Supabase los manda al celular.
import { sameSecret, supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadSchedule, routinesForDate } from "@/lib/trainingPlan";
import { checkinWeekStart, isCheckinDay } from "@/lib/checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COLOMBIA_OFFSET_MS = 5 * 3600 * 1000;

// "Hoy" en Colombia, como fecha local del servidor (Vercel corre en UTC)
function colombiaToday() {
  const co = new Date(Date.now() - COLOMBIA_OFFSET_MS);
  return new Date(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate(), 12);
}

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function noticesFor(db, student, today) {
  const uid = student.id;
  const todayIso = isoDate(today);
  const rows = [];

  const schedule = await loadSchedule(db, uid, "id, title");
  const items = routinesForDate(schedule.plans, schedule.fixed, today).items || [];
  const titles = items.map((a) => a.routines?.title).filter(Boolean);
  if (titles.length > 0) {
    rows.push({ recipient_id: uid, type: "day", link: "home", dedupe_key: `day:${todayIso}`, title: "Hoy le toca entrenar", body: titles.join(" + ") });
  } else {
    rows.push({ recipient_id: uid, type: "rest", link: "home", dedupe_key: `day:${todayIso}`, title: "Hoy es su día de descanso", body: "Aproveche para recuperarse." });
  }

  if (isCheckinDay(today)) {
    const week = checkinWeekStart(today);
    const { data: ck } = await db.from("weekly_checkins").select("id").eq("user_id", uid).eq("week_start", week).maybeSingle();
    if (!ck) {
      rows.push({
        recipient_id: uid, type: "checkin", link: "checkin", dedupe_key: `checkin:${week}`,
        title: "Hoy toca su check-in semanal", body: "Cuéntele a su coach cómo le fue esta semana (2 minutos).",
      });
    }
  }

  if (student.access_until) {
    const until = new Date(student.access_until);
    const days = Math.ceil((until - today) / 86400000);
    if (days >= 0 && days <= 5) {
      rows.push({
        recipient_id: uid, type: "access", link: "messages", dedupe_key: `access:${student.access_until.slice(0, 10)}`,
        title: "Su acceso vence pronto",
        body: `Vence el ${until.toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "America/Bogota" })}. Hable con su coach para renovarlo.`,
      });
    }
  }
  return rows;
}

export async function GET(request) {
  const auth = request.headers.get("authorization") || "";
  if (!sameSecret(auth.replace(/^Bearer\s+/i, ""), process.env.CRON_SECRET)) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const today = colombiaToday();
  const { data: students, error } = await db
    .from("profiles")
    .select("id, access_until")
    .eq("role", "alumno")
    .gt("access_until", new Date().toISOString());
  if (error) return Response.json({ error: "no se pudieron leer los alumnos" }, { status: 500 });

  let created = 0;
  let failed = 0;
  for (const student of students || []) {
    try {
      const rows = await noticesFor(db, student, today);
      const { data } = await db
        .from("notifications")
        .upsert(rows, { onConflict: "recipient_id,dedupe_key", ignoreDuplicates: true })
        .select("id");
      created += (data || []).length;
    } catch {
      failed++;
    }
  }
  return Response.json({ students: (students || []).length, created, failed });
}
