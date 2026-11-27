"use client";

import { useEffect, useState } from "react";
import { fetchAllRows } from "@/lib/fetchAll";
import { appLocale, tr } from "@/lib/i18n";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/Skeleton";
import { Check, CheckCheck, X } from "lucide-react";
import { chatWhen, firstName } from "@/lib/chatMeta";

// onClose: cuando se abre como ventana (burbuja flotante) muestra la X para cerrarla
export function MessagesScreen({ userId, onMessagesRead, onClose, initialText = "" }) {
  const [topic, setTopic] = useState("general");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState(initialText);
  const [sending, setSending] = useState(false);
  const [names, setNames] = useState({}); // nombre de quien escribe del lado del coach (si se puede leer)

  const topics = [
    { key: "general", get label() { return tr("General"); } },
    { key: "rutina", get label() { return tr("Rutina"); } },
    { key: "nutricion", get label() { return tr("Nutrición"); } },
    { key: "progreso", get label() { return tr("Progreso"); } },
  ];

  const loadMessages = async (t) => {
    setLoading(true);
    const data = await fetchAllRows(() =>
      supabase
        .from("messages")
        .select("id, sender_id, topic, content, created_at, read_by_coach")
        .eq("user_id", userId)
        .eq("topic", t)
        .order("created_at", { ascending: true })
    );
    setMessages(data);
    setLoading(false);
    // Nombre de su coach en cada mensaje (si no se puede leer, dice "Su coach")
    const ids = [...new Set(data.map((m) => m.sender_id).filter((id) => id && id !== userId))].filter((id) => !(id in names));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setNames((n) => ({ ...n, ...Object.fromEntries((ps || []).map((p) => [p.id, firstName(p.full_name)])) }));
    }
  };

  // Mientras está abierto, revisa cada 15 s si llegó algo nuevo o si su coach ya leyó
  useEffect(() => {
    if (!userId) return undefined;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const data = await fetchAllRows(() =>
        supabase.from("messages").select("id, sender_id, topic, content, created_at, read_by_coach").eq("user_id", userId).eq("topic", topic).order("created_at", { ascending: true })
      );
      setMessages(data);
      await supabase.from("messages").update({ read_by_alumno: true }).eq("user_id", userId).eq("read_by_alumno", false);
    }, 15000);
    return () => clearInterval(timer);
  }, [userId, topic]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      await supabase.from("messages").update({ read_by_alumno: true }).eq("user_id", userId).eq("read_by_alumno", false);
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", userId).eq("type", "message").is("read_at", null);
      if (onMessagesRead) onMessagesRead();
      loadMessages(topic);
    })();
  }, [userId]);

  const switchTopic = (t) => {
    setTopic(t);
    loadMessages(t);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      sender_id: userId,
      topic,
      content: newMessage.trim(),
      read_by_alumno: true,
      read_by_coach: false,
    });
    setSending(false);
    if (error) {
      alert(tr("No se pudo enviar el mensaje: "));
      return;
    }
    setNewMessage("");
    loadMessages(topic);
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-ink text-xl font-semibold">{tr("Mensajes")}</h1>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={tr("Cerrar")} className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-soft hover:text-ink">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {topics.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTopic(t.key)}
            className={`text-xs rounded-full px-3 py-1.5 ${topic === t.key ? "bg-accent text-app" : "bg-card text-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-card rounded-xl p-4 mb-3 overflow-y-auto flex flex-col gap-2">
        {loading ? (
          <Skeleton />
        ) : messages.length === 0 ? (
          <p className="text-muted text-sm">{tr("Todavía no hay mensajes en este tema. Escríbale a su coach.")}</p>
        ) : (
          messages.map((m) => {
            const fromMe = m.sender_id === userId;
            return (
              <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${fromMe ? "self-end bg-accent text-app" : "self-start bg-field text-ink"}`}>
                {!fromMe && <p className="text-accent text-[11px] font-semibold mb-0.5">{names[m.sender_id] || tr("Su coach")}</p>}
                <span className="whitespace-pre-wrap break-words">{m.content}</span>
                <p className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${fromMe ? "text-app/70" : "text-muted"}`}>
                  {chatWhen(m.created_at, { locale: appLocale(), today: tr("Hoy"), yesterday: tr("Ayer") })}
                  {fromMe && (m.read_by_coach
                    ? <span className="inline-flex items-center gap-0.5 font-semibold"><CheckCheck size={12} /> {tr("Visto")}</span>
                    : <span className="inline-flex items-center gap-0.5"><Check size={12} /> {tr("Enviado")}</span>)}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
          placeholder={tr("Escriba un mensaje...")}
          className="flex-1 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !newMessage.trim()}
          className="bg-accent text-app font-medium text-sm rounded-lg px-4 disabled:opacity-60"
        >
          {tr("Enviar")}
        </button>
      </div>
    </div>
  );
}
