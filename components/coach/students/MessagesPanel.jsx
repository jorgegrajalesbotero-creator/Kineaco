"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import { PanelLayout } from "./PanelLayout";
import { Skeleton } from "@/components/ui/Skeleton";

// Chat con el alumno, separado por temas
export function MessagesPanel({ student, onClose, onChanged }) {
  const [messageTopic, setMessageTopic] = useState("general");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const topics = [
    { key: "general", label: "General" },
    { key: "rutina", label: "Rutina" },
    { key: "nutricion", label: "Nutrición" },
    { key: "progreso", label: "Progreso" },
  ];

  const loadMessages = async (topic) => {
    setLoadingMessages(true);
    const data = await fetchAllRows(() =>
      supabase
        .from("messages")
        .select("id, sender_id, topic, content, created_at")
        .eq("user_id", student.id)
        .eq("topic", topic)
        .order("created_at", { ascending: true })
    );
    setMessages(data);
    setLoadingMessages(false);
  };

  // Al abrir: marca como leídos los mensajes del alumno y su aviso en la campana
  useEffect(() => {
    async function markRead() {
      await supabase.from("messages").update({ read_by_coach: true }).eq("user_id", student.id).eq("read_by_coach", false);
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("type", "message")
        .eq("student_id", student.id)
        .is("read_at", null);
      onChanged?.();
    }
    markRead();
    loadMessages("general");
  }, [student.id]);

  const switchMessageTopic = (topic) => {
    setMessageTopic(topic);
    loadMessages(topic);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("messages").insert({
      user_id: student.id,
      sender_id: user?.id,
      topic: messageTopic,
      content: newMessage.trim(),
      read_by_coach: true,
      read_by_alumno: false,
    });
    setSendingMessage(false);
    if (error) return alert("No se pudo enviar el mensaje: " + error.message);
    setNewMessage("");
    loadMessages(messageTopic);
  };

  return (
    <PanelLayout title="Mensajes" subtitle={student.name} onClose={onClose}>
      <div className="flex gap-2 mb-4">
        {topics.map((t) => (
          <button
            key={t.key}
            onClick={() => switchMessageTopic(t.key)}
            className={`text-xs rounded-full px-3 py-1.5 ${messageTopic === t.key ? "bg-accent text-app" : "bg-field text-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl p-4 mb-3 h-[55dvh] md:h-80 overflow-y-auto flex flex-col gap-2">
        {loadingMessages ? (
          <Skeleton />
        ) : messages.length === 0 ? (
          <p className="text-muted text-sm">Todavía no hay mensajes en este tema.</p>
        ) : (
          messages.map((m) => {
            const fromStudent = m.sender_id === student.id;
            return (
              <div key={m.id} className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${fromStudent ? "self-start bg-field text-ink" : "self-end bg-accent text-app"}`}>
                {m.content}
                <p className={`text-[10px] mt-1 ${fromStudent ? "text-muted" : "text-app/60"}`}>
                  {new Date(m.created_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
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
          placeholder="Escribí un mensaje..."
          className="flex-1 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={sendingMessage || !newMessage.trim()}
          className="bg-accent text-app font-medium text-sm rounded-lg px-4 disabled:opacity-60"
        >
          Enviar
        </button>
      </div>
    </PanelLayout>
  );
}
