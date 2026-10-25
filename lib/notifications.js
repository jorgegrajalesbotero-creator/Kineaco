// Campanita de avisos (compartida entre la pantalla del alumno y el panel del coach).
// Casi todos los avisos los crea la base de datos con disparadores; algunos (día de entreno,
// insignias, acceso por vencer, fotos) los crea la app al abrirse con addNotifications().
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";

const ICONS = {
  message: "💬",
  nutrition: "🥗",
  intake: "📋",
  new_student: "🙋",
  access: "⏳",
  photos: "📸",
  training_done: "✅",
  day: "🏋️",
  rest: "😴",
  badge: "🏅",
  routines: "🔄",
};

export async function addNotifications(supabase, rows) {
  if (!rows || rows.length === 0) return;
  await supabase.from("notifications").upsert(rows, { onConflict: "recipient_id,dedupe_key", ignoreDuplicates: true });
}

const plainT = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? "").toString()) : text);

function timeAgo(iso, t, locale) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return t("ahora");
  if (min < 60) return t("hace {p0} min", { p0: min });
  const h = Math.round(min / 60);
  if (h < 24) return t("hace {p0} h", { p0: h });
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? t("Ayer").toLowerCase() : t("hace {p0} días", { p0: d });
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

// t: traductor (el alumno usa el suyo; el coach, español). format: arma título y texto de cada aviso.
export function NotificationBell({ supabase, userId, onNavigate, refreshKey = 0, t = plainT, locale = "es-CO", format }) {
  const show = format || ((n) => ({ title: n.title, body: n.body }));
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadCount = async () => {
    if (!userId) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null);
    setUnread(count || 0);
  };

  useEffect(() => {
    if (!userId) return;
    loadCount();
    const timer = setInterval(loadCount, 60000);
    return () => clearInterval(timer);
  }, [userId, refreshKey]);

  const openPanel = async () => {
    setOpen(true);
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, student_id, dedupe_key, created_at, read_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data || []);
    setLoading(false);
  };

  const markAll = async () => {
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).eq("recipient_id", userId).is("read_at", null);
    setItems((list) => list.map((n) => ({ ...n, read_at: n.read_at || now })));
    setUnread(0);
  };

  const clickItem = async (n) => {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (onNavigate) onNavigate(n);
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={t("Avisos")}
        className="relative w-10 h-10 rounded-full bg-card flex items-center justify-center shrink-0"
      >
        <Bell size={18} className={unread > 0 ? "text-accent" : "text-soft"} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-danger text-app text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        // Se dibuja directo en la página para que ningún otro elemento quede por encima
        <div className="fixed inset-0 z-[100] flex justify-end items-start">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-[calc(100%-1.5rem)] md:w-96 mx-3 md:mx-4 mt-[calc(0.75rem+env(safe-area-inset-top))] md:mt-4 bg-deep border border-field rounded-2xl shadow-2xl flex flex-col max-h-[80dvh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-field">
              <p className="text-ink font-semibold">{t("Avisos")}</p>
              <div className="flex items-center gap-3">
                {items.some((n) => !n.read_at) && (
                  <button type="button" onClick={markAll} className="text-accent text-xs">{t("Marcar todo como leído")}</button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="text-muted" aria-label="Cerrar"><X size={18} /></button>
              </div>
            </div>
            <div className="overflow-y-auto">
              {loading ? (
                <p className="text-muted text-sm text-center py-8">{t("Cargando...")}</p>
              ) : items.length === 0 ? (
                <p className="text-muted text-sm text-center py-8">{t("No tiene avisos por ahora.")}</p>
              ) : (
                items.map((n) => {
                  const shown = show(n);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => clickItem(n)}
                      className={`w-full text-left flex gap-3 px-4 py-3 border-b border-field last:border-0 ${n.read_at ? "" : "bg-card"}`}
                    >
                      <span className="text-lg leading-none mt-0.5 shrink-0">{ICONS[n.type] || "🔔"}</span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm ${n.read_at ? "text-soft" : "text-ink font-medium"}`}>{shown.title}</span>
                        {shown.body && <span className="block text-muted text-xs mt-0.5 line-clamp-2">{shown.body}</span>}
                        <span className="block text-muted text-[10px] mt-1">{timeAgo(n.created_at, t, locale)}</span>
                      </span>
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
