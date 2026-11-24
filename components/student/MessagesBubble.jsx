"use client";

import { MessageCircle } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useBackClose } from "@/lib/backStack";
import { MessagesScreen } from "@/components/student/MessagesScreen";

// Mensajes con el coach como burbuja flotante (abajo a la derecha, encima de la barra de abajo).
// Al tocarla se abre el chat en una ventana; "atrás" o la X la cierran.
// El coach en su vista de alumno no se escribe a sí mismo: la burbuja lo lleva a su bandeja de Mensajes.
export function MessagesBubble({ userId, unread = 0, open, onOpenChange, onRead, isCoach = false, hidden = false }) {
  useBackClose(open, () => onOpenChange(false));

  const badge = unread > 0 && (
    <span className="absolute -top-1 -right-1 bg-danger text-app text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center ring-2 ring-app">
      {unread > 99 ? "99+" : unread}
    </span>
  );
  const bubbleCls = "fixed z-40 right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6 w-14 h-14 rounded-full bg-accent text-app flex items-center justify-center shadow-[0_12px_30px_-6px_rgba(0,0,0,0.75)] active:scale-90 transition-transform animate-fade-in";

  return (
    <>
      {!open && !hidden && (isCoach ? (
        <a href="/admin?tab=mensajes" aria-label={tr("Mensajes")} title={tr("Mensajes")} className={bubbleCls}>
          <MessageCircle size={24} strokeWidth={2.25} />
        </a>
      ) : (
        <button type="button" onClick={() => onOpenChange(true)} aria-label={tr("Mensajes")} title={tr("Mensajes")} className={bubbleCls}>
          <MessageCircle size={24} strokeWidth={2.25} />
          {badge}
        </button>
      ))}
      {open && !isCoach && (
        <div className="fixed inset-0 z-[75] md:bg-black/50 flex md:items-end md:justify-end md:p-6" onClick={() => onOpenChange(false)}>
          <div role="dialog" aria-label={tr("Mensajes")} onClick={(e) => e.stopPropagation()}
            className="w-full h-full md:w-[400px] md:h-[min(640px,85dvh)] bg-app md:bg-panel md:border md:border-white/[0.08] md:rounded-2xl flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] md:pt-0 pb-[env(safe-area-inset-bottom)] md:pb-0 animate-fade-in shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]">
            <MessagesScreen userId={userId} onMessagesRead={onRead} onClose={() => onOpenChange(false)} />
          </div>
        </div>
      )}
    </>
  );
}
