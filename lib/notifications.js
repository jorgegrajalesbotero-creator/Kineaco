// Campanita de avisos (compartida entre la pantalla del alumno y el panel del coach).
// Casi todos los avisos los crea la base de datos con disparadores; algunos (día de entreno,
// insignias, acceso por vencer, fotos) los crea la app al abrirse con addNotifications().
import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, X, CheckCheck, Trash2 } from "lucide-react";

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

const POLL_MS = 60000;
const CLOSE_MS = 150; // debe coincidir con la duración de panel-out / fade-out en globals.css
const LEAVE_MS = 260; // lo que tarda un aviso en deslizarse y cerrarse al quitarlo
const CONFIRM_MS = 3500; // tiempo para el segundo toque de "Limpiar todo"

// Luz tenue que sigue al cursor dentro de cada aviso (no vuelve a dibujar el componente)
const spotlight = (e) => {
  const box = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - box.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - box.top}px`);
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

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

// t: traductor (el alumno usa el suyo; el coach, español). format: arma título y texto de cada aviso.
export function NotificationBell({ supabase, userId, onNavigate, refreshKey = 0, t = plainT, locale = "es-CO", format }) {
  const show = format || ((n) => ({ title: n.title, body: n.body }));
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [items, setItems] = useState(null); // null = todavía no se ha cargado la lista
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState("all");
  const [ringKey, setRingKey] = useState(0); // cambia cada vez que llega un aviso nuevo: hace sonar la campana
  const [leaving, setLeaving] = useState(() => new Set()); // avisos que se están quitando (animación de salida)
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const ticket = useRef(0);      // descarta respuestas viejas (o anteriores a un cambio hecho aquí)
  const lastCount = useRef(0);
  const loaded = useRef(false);
  const closeTimer = useRef(null);
  const confirmTimer = useRef(null);

  // Trae el contador de no leídos y, si hace falta, la lista. La lista se deja precargada
  // para que el panel abra al instante; después solo se vuelve a pedir cuando el contador cambia.
  const refresh = useCallback(async (withList) => {
    if (!userId) return;
    const mine = ++ticket.current;
    const wantList = withList || !loaded.current;
    const [countRes, listRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null),
      wantList
        ? supabase
          .from("notifications")
          .select("id, type, title, body, link, student_id, dedupe_key, created_at, read_at")
          .eq("recipient_id", userId)
          .is("hidden_at", null)
          .order("created_at", { ascending: false })
          .limit(50)
        : null,
    ]);
    if (mine !== ticket.current) return;

    let changed = false;
    if (!countRes.error) {
      const count = countRes.count || 0;
      changed = count !== lastCount.current;
      if (count > lastCount.current) setRingKey((k) => k + 1);
      lastCount.current = count;
      setUnread(count);
    }
    if (listRes) {
      if (!listRes.error) loaded.current = true;
      setItems((current) => (listRes.error ? current || [] : listRes.data || []));
    } else if (changed) {
      refresh(true);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    refresh(false);
    // Con la pestaña oculta no se consulta; al volver, se actualiza de una vez
    const tick = () => { if (document.visibilityState === "visible") refresh(false); };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId, refreshKey, refresh]);

  useEffect(() => () => {
    clearTimeout(closeTimer.current);
    clearTimeout(confirmTimer.current);
  }, []);

  const openPanel = () => {
    clearTimeout(closeTimer.current);
    setClosing(false);
    setFilter("all");
    setConfirmClear(false);
    setOpen(true);
    refresh(true); // muestra lo que ya hay y lo actualiza por detrás
  };

  const closePanel = useCallback(() => {
    setClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") closePanel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  // Los cambios se pintan de inmediato y se guardan por detrás; si el guardado falla, se recarga.
  const applyLocal = (count, mapItems) => {
    ticket.current++;
    lastCount.current = count;
    setUnread(count);
    setItems((list) => (list || []).map(mapItems));
  };

  const markAll = () => {
    const now = new Date().toISOString();
    applyLocal(0, (n) => (n.read_at ? n : { ...n, read_at: now }));
    supabase.from("notifications").update({ read_at: now }).eq("recipient_id", userId).is("read_at", null)
      .then(({ error }) => { if (error) refresh(true); });
  };

  const clickItem = (n) => {
    if (!n.read_at) {
      const now = new Date().toISOString();
      applyLocal(Math.max(0, lastCount.current - 1), (item) => (item.id === n.id ? { ...item, read_at: now } : item));
      supabase.from("notifications").update({ read_at: now }).eq("id", n.id)
        .then(({ error }) => { if (error) refresh(true); });
    }
    closePanel();
    if (onNavigate) onNavigate(n);
  };

  // "Limpiar" oculta el aviso (hidden_at) en vez de borrarlo: si se borrara, los avisos que la app
  // crea al abrirse (día de entreno, insignias, fotos...) volverían a aparecer. También queda leído,
  // para que el próximo mensaje genere un aviso nuevo en lugar de actualizar uno oculto.
  const dismiss = (n) => {
    const now = new Date().toISOString();
    ticket.current++;
    if (!n.read_at) {
      lastCount.current = Math.max(0, lastCount.current - 1);
      setUnread(lastCount.current);
    }
    setLeaving((set) => new Set(set).add(n.id));
    supabase.from("notifications").update({ hidden_at: now, read_at: n.read_at || now }).eq("id", n.id)
      .then(({ error }) => { if (error) refresh(true); });
    setTimeout(() => {
      setItems((current) => (current || []).filter((item) => item.id !== n.id));
      setLeaving((set) => {
        const next = new Set(set);
        next.delete(n.id);
        return next;
      });
    }, LEAVE_MS);
  };

  // Pide un segundo toque para no limpiar todo por accidente
  const clearAll = () => {
    clearTimeout(confirmTimer.current);
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), CONFIRM_MS);
      return;
    }
    const now = new Date().toISOString();
    setConfirmClear(false);
    setClearing(true);
    ticket.current++;
    lastCount.current = 0;
    setUnread(0);
    supabase.from("notifications").update({ read_at: now }).eq("recipient_id", userId).is("read_at", null)
      .then(() => supabase.from("notifications").update({ hidden_at: now }).eq("recipient_id", userId).is("hidden_at", null))
      .then(({ error }) => { if (error) refresh(true); });
    setTimeout(() => {
      setItems([]);
      setClearing(false);
    }, LEAVE_MS + 8 * 30);
  };

  const list = items || [];
  const unreadInList = list.filter((n) => !n.read_at).length;
  const visible = filter === "unread" ? list.filter((n) => !n.read_at) : list;
  const tabs = [
    { id: "all", label: t("Todos") },
    { id: "unread", label: t("Sin leer"), count: unread },
  ];

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={t("Avisos")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative w-10 h-10 rounded-full bg-card hover:bg-card-hover active:scale-90 transition duration-150 flex items-center justify-center shrink-0"
      >
        <Bell
          key={ringKey}
          size={18}
          className={`origin-top transition-colors ${unread > 0 ? "text-accent" : "text-soft"} ${ringKey > 0 ? "animate-bell-ring" : ""}`}
        />
        {unread > 0 && (
          <span
            key={unread}
            className="absolute -top-0.5 -right-0.5 bg-danger text-app text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center animate-check-pop"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        // Se dibuja directo en la página para que ningún otro elemento quede por encima
        <div className="fixed inset-0 z-[100] flex justify-end items-start">
          <div
            className={`absolute inset-0 bg-black/60 ${closing ? "animate-fade-out" : "animate-fade-in"}`}
            onClick={closePanel}
          />
          <div
            role="dialog"
            aria-label={t("Avisos")}
            className={`relative w-[calc(100%-1.5rem)] md:w-96 mx-3 md:mx-4 mt-[calc(0.75rem+env(safe-area-inset-top))] md:mt-4 bg-deep border border-field rounded-2xl shadow-2xl flex flex-col max-h-[80dvh] overflow-hidden origin-top-right transition-colors duration-300 hover:border-field-strong ${closing ? "animate-panel-out" : "animate-panel-in"}`}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-ink font-semibold">{t("Avisos")}</p>
              <div className="flex items-center gap-1">
                {unreadInList > 0 && (
                  <button
                    type="button"
                    onClick={markAll}
                    className="flex items-center gap-1 text-accent text-xs px-2 py-1 rounded-full hover:bg-accent/10 active:scale-95 transition animate-fade-in"
                  >
                    <CheckCheck size={14} />
                    {t("Marcar todo como leído")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePanel}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-field active:scale-90 transition"
                  aria-label={t("Cerrar")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 px-4 pb-3 border-b border-field">
              {tabs.map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full active:scale-95 transition ${active ? "bg-accent text-app" : "bg-field text-soft hover:bg-field-hover hover:text-ink"}`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center ${active ? "bg-app/20" : "bg-danger text-app"}`}>
                        {tab.count > 99 ? "99+" : tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto overscroll-contain">
              {items === null ? (
                <div className="px-4 py-3 space-y-3" aria-label={t("Cargando...")}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <div className="w-9 h-9 rounded-xl shrink-0 bg-gradient-to-r from-card via-field/70 to-card bg-[length:200%_100%] animate-shimmer" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 rounded bg-gradient-to-r from-card via-field/70 to-card bg-[length:200%_100%] animate-shimmer" />
                        <div className="h-2.5 w-1/2 rounded bg-gradient-to-r from-card via-field/70 to-card bg-[length:200%_100%] animate-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <div key={filter} className="flex flex-col items-center gap-3 px-6 py-10 animate-fade-up">
                  <span className="w-12 h-12 rounded-full bg-field flex items-center justify-center text-soft">
                    {filter === "unread" ? <CheckCheck size={20} className="text-accent" /> : <Bell size={20} />}
                  </span>
                  <p className="text-muted text-sm text-center">
                    {filter === "unread" ? t("Está al día: no tiene avisos sin leer.") : t("No tiene avisos por ahora.")}
                  </p>
                </div>
              ) : (
                <div key={filter}>
                  {visible.map((n, i) => {
                    const shown = show(n);
                    const today = isToday(n.created_at);
                    const newGroup = i === 0 || today !== isToday(visible[i - 1].created_at);
                    const gone = clearing || leaving.has(n.id);
                    const delay = clearing ? `${Math.min(i, 8) * 30}ms` : undefined;
                    return (
                      <Fragment key={n.id}>
                        {newGroup && (
                          <p className={`sticky top-0 z-20 bg-deep/95 backdrop-blur px-4 pt-3 pb-1.5 text-muted text-[10px] font-semibold uppercase tracking-wider transition-opacity duration-200 ${clearing ? "opacity-0" : ""}`}>
                            {today ? t("Hoy") : t("Anteriores")}
                          </p>
                        )}
                        {/* Al quitarlo: se desliza a la derecha, se desvanece y su espacio se cierra */}
                        <div
                          style={{ transitionDuration: `${LEAVE_MS}ms`, transitionDelay: delay }}
                          className={`grid transition-[grid-template-rows,opacity] ease-out ${gone ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"}`}
                        >
                          <div
                            style={{ transitionDuration: `${LEAVE_MS}ms`, transitionDelay: delay }}
                            className={`min-h-0 overflow-hidden transition-transform ease-out ${gone ? "translate-x-10" : ""}`}
                          >
                            <div
                              onMouseMove={spotlight}
                              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                              className={`group relative animate-fade-up transition-colors duration-200 hover:bg-card-hover ${n.read_at ? "" : "bg-card/60"}`}
                            >
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                style={{ background: "radial-gradient(170px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 70%)" }}
                              />
                              <span className={`absolute left-0 w-0.5 rounded-full bg-accent transition-all duration-300 ${n.read_at ? "top-1/2 bottom-1/2 opacity-0 group-hover:top-3 group-hover:bottom-3 group-hover:opacity-40" : "top-2 bottom-2 opacity-100 group-hover:top-1 group-hover:bottom-1"}`} />
                              <button
                                type="button"
                                onClick={() => clickItem(n)}
                                disabled={gone}
                                className="relative w-full text-left flex gap-3 pl-4 pr-12 py-3 active:bg-field/60 transition-colors"
                              >
                                <span className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-base leading-none shrink-0 transition duration-200 group-hover:scale-110 group-hover:-rotate-6 group-active:scale-95 ${n.read_at ? "bg-field/60" : "bg-accent/10"}`}>
                                  {ICONS[n.type] || "🔔"}
                                  {!n.read_at && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2">
                                      <span className="absolute inset-0 rounded-full bg-accent opacity-60 animate-ping" />
                                      <span className="absolute inset-0 rounded-full bg-accent" />
                                    </span>
                                  )}
                                </span>
                                <span className="flex-1 min-w-0 transition-transform duration-200 group-hover:translate-x-0.5">
                                  <span className={`block text-sm transition-colors duration-200 group-hover:text-ink ${n.read_at ? "text-soft" : "text-ink font-medium"}`}>{shown.title}</span>
                                  {shown.body && <span className="block text-muted text-xs mt-0.5 line-clamp-2 transition-colors duration-200 group-hover:text-soft">{shown.body}</span>}
                                  <span className="block text-muted text-[10px] mt-1">{timeAgo(n.created_at, t, locale)}</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => dismiss(n)}
                                disabled={gone}
                                aria-label={t("Quitar aviso")}
                                title={t("Quitar aviso")}
                                className="notice-dismiss absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 hover:rotate-90 active:scale-90 transition duration-200"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {list.length > 0 && (
              <div className="flex justify-center border-t border-field px-3 py-2">
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={clearing}
                  className={`group flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full active:scale-95 transition duration-200 ${confirmClear ? "bg-danger/15 text-danger" : "text-soft hover:text-danger hover:bg-danger/10"}`}
                >
                  <Trash2 size={14} className={`transition-transform duration-200 group-hover:-rotate-12 ${confirmClear ? "animate-bell-ring" : ""}`} />
                  {confirmClear ? t("Toque de nuevo para confirmar") : t("Limpiar todo")}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
