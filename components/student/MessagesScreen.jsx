"use client";

import { useEffect, useState } from "react";
import { fetchAllRows } from "@/lib/fetchAll";
import { appLocale, tr } from "@/lib/i18n";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/Skeleton";

export function MessagesScreen({ userId, onMessagesRead }) {
  const [topic, setTopic] = useState("general");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

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
        .select("id, sender_id, topic, content, created_at")
        .eq("user_id", userId)
        .eq("topic", t)
        .order("created_at", { ascending: true })
    );
    setMessages(data);
    setLoading(false);
  };

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
      alert(tr("No se pudo enviar el mensaje: ") + error.message);
      return;
    }
    setNewMessage("");
    loadMessages(topic);
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 flex flex-col">
      <h1 className="text-ink text-xl font-semibold mb-4">{tr("Mensajes")}</h1>

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
              <div key={m.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${fromMe ? "self-end bg-accent text-app" : "self-start bg-field text-ink"}`}>
                {m.content}
                <p className={`text-[10px] mt-1 ${fromMe ? "text-app/60" : "text-muted"}`}>
                  {new Date(m.created_at).toLocaleString(appLocale(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
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
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
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
