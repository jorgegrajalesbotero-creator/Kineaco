"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { appLocale, tr } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";

const formatDate = (iso) => new Date(iso).toLocaleDateString(appLocale(), { day: "numeric", month: "long" });

async function loadAnnouncements(userId) {
  const { data } = await supabase
    .from("announcement_recipients")
    .select("read_at, announcements(id, title, body, created_at)")
    .eq("user_id", userId);
  return (data || [])
    .filter((r) => r.announcements)
    .map((r) => ({ ...r.announcements, read_at: r.read_at }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const markRead = (userId, ids) =>
  ids.length
    ? supabase.from("announcement_recipients").update({ read_at: new Date().toISOString() }).eq("user_id", userId).in("announcement_id", ids)
    : Promise.resolve();

// Inicio: el anuncio más reciente sin leer, hasta que el alumno toque "Entendido"
export function AnnouncementCard({ userId, onOpenAll, onRead }) {
  const [items, setItems] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (userId) loadAnnouncements(userId).then(setItems);
  }, [userId]);

  const unread = (items || []).filter((a) => !a.read_at);
  if (!unread.length) return null;
  const a = unread[0];
  const long = a.body.length > 140 || a.body.includes("\n");

  const done = async () => {
    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setExpanded(false);
    await markRead(userId, [a.id]);
    onRead?.();
  };

  return (
    <div className="mb-7 rounded-2xl bg-gradient-to-b from-card to-deep border border-accent/25 p-4 animate-fade-up">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <Megaphone size={15} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-accent text-[11px] font-medium">{tr("Anuncio de su coach")} · {formatDate(a.created_at)}</p>
          <p className="text-ink text-sm font-semibold leading-tight">{a.title}</p>
        </div>
      </div>
      <p className={`text-soft text-sm whitespace-pre-wrap ${expanded ? "" : "line-clamp-4"}`}>{a.body}</p>
      {long && !expanded && (
        <button onClick={() => setExpanded(true)} className="text-accent text-xs mt-1">{tr("Leer completo")}</button>
      )}
      <div className="flex items-center justify-between gap-3 mt-3">
        {unread.length > 1 ? (
          <button onClick={onOpenAll} className="text-soft text-xs">
            {tr("+{p0} anuncios más", { p0: unread.length - 1 })}
          </button>
        ) : (
          <span />
        )}
        <button onClick={done} className="bg-accent text-app text-sm font-semibold rounded-xl px-4 py-2">
          {tr("Entendido")}
        </button>
      </div>
    </div>
  );
}

// Todos los anuncios; al abrir quedan marcados como leídos
export function AnnouncementsScreen({ userId, onClose }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    loadAnnouncements(userId).then(async (list) => {
      setItems(list);
      await markRead(userId, list.filter((a) => !a.read_at).map((a) => a.id));
    });
  }, [userId]);

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-3 pb-6">
      <button onClick={onClose} aria-label={tr("Volver")} className="w-9 h-9 rounded-full bg-card border border-white/[0.06] flex items-center justify-center mb-4">
        <ChevronLeft size={18} className="text-ink" />
      </button>
      <h1 className="text-ink text-2xl font-semibold tracking-tight mb-1">{tr("Anuncios")}</h1>
      <p className="text-soft text-sm mb-6">{tr("Mensajes de su coach para todos sus alumnos.")}</p>
      {!items ? (
        <Skeleton rows={3} height="h-24" />
      ) : items.length === 0 ? (
        <p className="text-muted text-sm">{tr("Todavía no hay anuncios.")}</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className={`rounded-2xl p-4 border ${a.read_at ? "bg-card border-white/[0.06]" : "bg-gradient-to-b from-card to-deep border-accent/25"}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-ink text-sm font-semibold">{a.title}</p>
                {!a.read_at && <span className="text-[10px] font-medium text-app bg-accent rounded-full px-2 py-0.5 shrink-0">{tr("Nuevo")}</span>}
              </div>
              <p className="text-muted text-[11px] mb-2">{formatDate(a.created_at)}</p>
              <p className="text-soft text-sm whitespace-pre-wrap">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
