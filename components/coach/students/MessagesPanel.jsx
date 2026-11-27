"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fetchAllRows } from "@/lib/fetchAll";
import { PanelLayout } from "./PanelLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { Check, CheckCheck } from "lucide-react";
import { chatWhen, firstName } from "@/lib/chatMeta";

// Chat con el alumno, separado por temas
// initialTopic: tema con el que abre (la bandeja abre en el tema del último mensaje sin leer).
// padding / width: los usa la bandeja de Mensajes para mostrar el chat al lado de la lista.
export function MessagesPanel({ student, onClose, onChanged, initialTopic = "general", padding, width = "max-w-lg" }) {
  const [messageTopic, setMessageTopic] = useState(initialTopic);
  const listRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [names, setNames] = useState({}); // quién del equipo escribió cada mensaje
  const [myId, setMyId] = useState(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMyId(data?.user?.id || null)); }, []);

  const topics = [
    { key: "general", label: "General" },
    { key: "rutina", label: "Rutina" },
    { key: "nutricion", label: "Nutrición" },
    { key: "progreso", label: "Progreso" },
  ];

  const loadMessages = async (topic, silent = false) => {
    if (!silent) setLoadingMessages(true);
    const data = await fetchAllRows(() =>
      supabase
        .from("messages")
        .select("id, sender_id, topic, content, created_at, read_by_alumno")
        .eq("user_id", student.id)
        .eq("topic", topic)
        .order("created_at", { ascending: true })
    );
    setMessages(data);
    setLoadingMessages(false);
    const ids = [...new Set(data.map((m) => m.sender_id).filter((id) => id && id !== student.id))].filter((id) => !(id in names));
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setNames((n) => ({ ...n, ...Object.fromEntries((ps || []).map((p) => [p.id, firstName(p.full_name)])) }));
    }
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
    loadMessages(initialTopic);
  }, [student.id]);

  // Mientras el chat está abierto, revisa cada 15 s si el alumno escribió algo nuevo
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      await loadMessages(messageTopic, true);
      const { data: marked } = await supabase
        .from("messages").update({ read_by_coach: true })
        .eq("user_id", student.id).eq("read_by_coach", false).select("id");
      if (marked?.length) {
        await supabase.from("notifications").update({ read_at: new Date().toISOString() })
          .eq("type", "message").eq("student_id", student.id).is("read_at", null);
        onChanged?.();
      }
    };
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [student.id, messageTopic]);

  // Baja al último mensaje cuando llegan mensajes nuevos
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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
    if (error) return alert("No se pudo enviar el mensaje: ");
    setNewMessage("");
    loadMessages(messageTopic, true);
    onChanged?.();
  };

  return (
    <PanelLayout title={padding === "" ? student.name : "Mensajes"} subtitle={padding === "" ? "Mensajes" : student.name} onClose={onClose} width={width} {...(padding !== undefined ? { padding } : {})}>
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

      <div ref={listRef} className={`bg-card rounded-xl p-4 mb-3 overflow-y-auto flex flex-col gap-2 ${padding === "" ? "h-[60dvh] md:h-[28rem]" : "h-[55dvh] md:h-80"}`}>
        {loadingMessages ? (
          <Skeleton />
        ) : messages.length === 0 ? (
          <p className="text-muted text-sm">Todavía no hay mensajes en este tema.</p>
        ) : (
          messages.map((m) => {
            const fromStudent = m.sender_id === student.id;
            return (
              <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${fromStudent ? "self-start bg-field text-ink" : "self-end bg-accent text-app"}`}>
                {/* Quién lo escribió: el alumno, o quién del equipo (si no fue usted) */}
                {fromStudent
                  ? <p className="text-accent text-[11px] font-semibold mb-0.5">{firstName(student.name) || "Alumno"}</p>
                  : m.sender_id !== myId && names[m.sender_id] && <p className="text-app/70 text-[11px] font-semibold mb-0.5">{names[m.sender_id]}</p>}
                <span className="whitespace-pre-wrap break-words">{m.content}</span>
                <p className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${fromStudent ? "text-muted" : "text-app/70"}`}>
                  {chatWhen(m.created_at)}
                  {!fromStudent && (m.read_by_alumno
                    ? <span className="inline-flex items-center gap-0.5 font-semibold"><CheckCheck size={12} /> Visto</span>
                    : <span className="inline-flex items-center gap-0.5"><Check size={12} /> Enviado</span>)}
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
          placeholder="Escriba un mensaje..."
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
