"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/ui/Search";
import { Skeleton } from "@/components/ui/Skeleton";
import { MessagesPanel } from "@/components/coach/students/MessagesPanel";

const TOPIC_LABELS = { general: "General", rutina: "Rutina", nutricion: "Nutrición", progreso: "Progreso" };
const REFRESH_MS = 30000;

function shortTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// Bandeja de entrada del coach: todas las conversaciones en un solo lugar, las que tienen mensajes sin leer arriba.
// initialStudentId: abre directo esa conversación (por ejemplo, al tocar una notificación de mensaje).
export function MessagesInbox({ onUnreadChange, initialStudentId, onInitialDone }) {
  const [convs, setConvs] = useState(null);
  const [others, setOthers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const [{ data: profiles }, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "alumno"),
      supabase
        .from("messages")
        .select("user_id, sender_id, topic, content, created_at, read_by_coach")
        .order("created_at", { ascending: false })
        .limit(1500),
    ]);
    const names = new Map((profiles || []).map((p) => [p.id, p.full_name || "Sin nombre"]));
    const byStudent = new Map();
    (msgs || []).forEach((m) => {
      let c = byStudent.get(m.user_id);
      if (!c) {
        c = { id: m.user_id, name: names.get(m.user_id) || "Alumno", last: m, unread: 0, unreadTopic: null };
        byStudent.set(m.user_id, c);
      }
      if (m.read_by_coach === false && m.sender_id === m.user_id) {
        c.unread += 1;
        if (!c.unreadTopic) c.unreadTopic = m.topic; // el más reciente sin leer
      }
    });
    const list = [...byStudent.values()].sort(
      (a, b) => (b.unread > 0) - (a.unread > 0) || b.last.created_at.localeCompare(a.last.created_at),
    );
    setConvs(list);
    setOthers(
      (profiles || [])
        .filter((p) => !byStudent.has(p.id))
        .map((p) => ({ id: p.id, name: p.full_name || "Sin nombre", last: null, unread: 0 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    onUnreadChange?.(list.reduce((sum, c) => sum + c.unread, 0));
    return list;
  }, [onUnreadChange]);

  useEffect(() => {
    load().then((list) => {
      if (!initialStudentId) return;
      const found = list.find((c) => c.id === initialStudentId);
      if (found) setSelected({ id: found.id, name: found.name, topic: found.unreadTopic || found.last?.topic || "general" });
      onInitialDone?.();
    });
    const tick = () => { if (document.visibilityState === "visible") load(); };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [load, initialStudentId, onInitialDone]);

  const open = (c) => setSelected({ id: c.id, name: c.name, topic: c.unreadTopic || c.last?.topic || "general" });

  const q = search.trim();
  const shown = convs ? convs.filter((c) => !q || matchesSearch(q, c.name)) : [];
  const shownOthers = q ? others.filter((c) => matchesSearch(q, c.name)) : [];
  const totalUnread = (convs || []).reduce((sum, c) => sum + c.unread, 0);

  const row = (c) => {
    const active = selected?.id === c.id;
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => open(c)}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${active ? "bg-accent/[0.10]" : "hover:bg-card"}`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${c.unread ? "bg-accent text-app" : "bg-field text-soft"}`}>
          {initials(c.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm truncate ${c.unread ? "text-ink font-semibold" : "text-ink"}`}>{c.name}</p>
            {c.last && <span className={`text-[11px] shrink-0 ${c.unread ? "text-accent" : "text-muted"}`}>{shortTime(c.last.created_at)}</span>}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={`text-xs truncate ${c.unread ? "text-soft" : "text-muted"}`}>
              {c.last ? (
                <>
                  <span className="text-muted">{TOPIC_LABELS[c.last.topic] || "General"} · </span>
                  {c.last.sender_id !== c.id && <span className="text-muted">Usted: </span>}
                  {c.last.content}
                </>
              ) : (
                "Sin mensajes todavía · toque para escribirle"
              )}
            </p>
            {c.unread > 0 && (
              <span className="bg-accent text-app text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0">{c.unread}</span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 md:p-8">
      <div className="md:grid md:grid-cols-[minmax(260px,340px)_1fr] md:gap-6 md:items-start">
        <div className={selected ? "hidden md:block" : ""}>
          <div className="mb-4">
            <h2 className="text-ink text-xl font-semibold">Mensajes</h2>
            <p className="text-muted text-sm">{totalUnread > 0 ? `${totalUnread} sin leer` : "Todo al día"}</p>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar alumno..." />
          <div className="mt-3 space-y-0.5">
            {convs === null ? (
              <Skeleton />
            ) : shown.length === 0 && shownOthers.length === 0 ? (
              <p className="text-muted text-sm px-3 py-6 text-center">
                {q ? "Ningún alumno coincide con la búsqueda." : "Todavía no hay conversaciones. Busque un alumno para escribirle."}
              </p>
            ) : (
              <>
                {shown.map(row)}
                {shownOthers.length > 0 && <p className="text-muted text-[11px] uppercase tracking-wide px-3 pt-4 pb-1">Otros alumnos</p>}
                {shownOthers.map(row)}
              </>
            )}
          </div>
        </div>

        <div className={selected ? "" : "hidden md:block"}>
          {selected ? (
            <MessagesPanel
              key={selected.id}
              student={selected}
              initialTopic={selected.topic}
              padding=""
              width="max-w-none"
              onClose={() => setSelected(null)}
              onChanged={load}
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center text-center bg-card rounded-2xl h-80 px-6">
              <MessageCircle size={28} className="text-muted mb-3" />
              <p className="text-ink text-sm font-medium">Elija una conversación</p>
              <p className="text-muted text-xs mt-1">Las que tienen mensajes sin leer aparecen arriba.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
