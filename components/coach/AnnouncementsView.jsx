"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Megaphone, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { matchesSearch } from "@/lib/search";
import { SearchInput } from "@/components/ui/Search";
import { Skeleton } from "@/components/ui/Skeleton";

const GOALS = [["deficit", "Déficit"], ["mantener", "Mantener"], ["superavit", "Superávit"]];
const PLACES = [["casa", "Casa"], ["gym", "Gym"]];

const field = "w-full bg-field text-ink text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-accent/40";
const chip = (on) => `px-3 py-1.5 rounded-lg text-xs font-medium ${on ? "bg-accent text-app" : "bg-field text-soft"}`;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

// Anuncios del coach: escribir uno para todos o para un grupo, y ver quién lo leyó
export function AnnouncementsView() {
  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState("all"); // all | group | pick
  const [goal, setGoal] = useState("");
  const [place, setPlace] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState("");
  const [openId, setOpenId] = useState(null);

  async function load() {
    const now = new Date().toISOString();
    const [{ data: profiles }, { data: nutrition }, { data: anns }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role, access_until").neq("role", "coach"),
      supabase.from("nutrition_profiles").select("user_id, goal, location"),
      supabase.from("announcements").select("*, announcement_recipients(user_id, read_at)").order("created_at", { ascending: false }).limit(50),
    ]);
    const byUser = Object.fromEntries((nutrition || []).map((n) => [n.user_id, n]));
    setStudents(
      (profiles || [])
        .filter((p) => p.access_until && p.access_until > now)
        .map((p) => ({ id: p.id, name: p.full_name || "Alumno", goal: byUser[p.id]?.goal || null, location: byUser[p.id]?.location || null }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setNames(Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name || "Alumno"])));
    setHistory(anns || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const recipients = useMemo(() => {
    if (mode === "all") return students;
    if (mode === "group") return students.filter((s) => (!goal || s.goal === goal) && (!place || s.location === place));
    return students.filter((s) => picked.has(s.id));
  }, [mode, students, goal, place, picked]);

  const audienceLabel = () => {
    if (mode === "all") return "Todos los alumnos";
    if (mode === "group") {
      const g = GOALS.find(([v]) => v === goal)?.[1];
      const p = PLACES.find(([v]) => v === place)?.[1];
      return [g ? `Objetivo: ${g}` : null, p ? `Lugar: ${p}` : null].filter(Boolean).join(" · ") || "Todos los alumnos";
    }
    return `${picked.size} alumno${picked.size === 1 ? "" : "s"} elegido${picked.size === 1 ? "" : "s"}`;
  };

  const togglePick = (id) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const send = async () => {
    if (!title.trim() || !body.trim()) return alert("Escribí el título y el mensaje.");
    if (recipients.length === 0) return alert("No hay alumnos que cumplan ese filtro.");
    if (!confirm(`¿Enviar este anuncio a ${recipients.length} alumno${recipients.length === 1 ? "" : "s"}?`)) return;
    setSending(true);
    const { data: ann, error } = await supabase
      .from("announcements")
      .insert({ title: title.trim().slice(0, 120), body: body.trim().slice(0, 2000), audience: audienceLabel() })
      .select("id")
      .single();
    if (error) {
      setSending(false);
      return alert("No se pudo enviar: ");
    }
    const rows = recipients.map((s) => ({ announcement_id: ann.id, user_id: s.id }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e2 } = await supabase.from("announcement_recipients").insert(rows.slice(i, i + 500));
      if (e2) {
        setSending(false);
        return alert("El anuncio se creó pero no se pudo enviar a todos: ");
      }
    }
    setSending(false);
    setTitle("");
    setBody("");
    setPicked(new Set());
    setSentOk(`Enviado a ${rows.length} alumno${rows.length === 1 ? "" : "s"}.`);
    setTimeout(() => setSentOk(""), 4000);
    load();
  };

  const remove = async (a) => {
    if (!confirm(`¿Borrar el anuncio "${a.title}"? Los alumnos dejan de verlo.`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) return alert("No se pudo borrar: ");
    load();
  };

  const pickList = students.filter((s) => matchesSearch(s.name, query));

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h2 className="text-ink text-xl font-semibold mb-1">Anuncios</h2>
      <p className="text-muted text-sm mb-6">Un mensaje para todos tus alumnos o para un grupo. Les aparece en Inicio y en la campanita.</p>

      {loading ? (
        <Skeleton rows={3} height="h-28" />
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
          {/* Escribir */}
          <div className="bg-card rounded-2xl p-4 space-y-4">
            <div>
              <label className="text-muted text-xs">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ej: Reto de noviembre" className={`${field} mt-1`} />
            </div>
            <div>
              <label className="text-muted text-xs">Mensaje</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={6} placeholder="Escribí el anuncio..." className={`${field} mt-1 resize-none`} />
              <p className="text-muted text-[10px] text-right">{body.length}/2000</p>
            </div>

            <div>
              <p className="text-muted text-xs mb-2">¿A quiénes?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {[["all", "Todos"], ["group", "Por grupo"], ["pick", "Elegir alumnos"]].map(([v, l]) => (
                  <button key={v} onClick={() => setMode(v)} className={chip(mode === v)}>{l}</button>
                ))}
              </div>

              {mode === "group" && (
                <div className="space-y-3 bg-field/40 rounded-xl p-3">
                  <div>
                    <p className="text-muted text-[11px] mb-1.5">Objetivo</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setGoal("")} className={chip(!goal)}>Cualquiera</button>
                      {GOALS.map(([v, l]) => <button key={v} onClick={() => setGoal(v)} className={chip(goal === v)}>{l}</button>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted text-[11px] mb-1.5">Lugar de entrenamiento</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setPlace("")} className={chip(!place)}>Cualquiera</button>
                      {PLACES.map(([v, l]) => <button key={v} onClick={() => setPlace(v)} className={chip(place === v)}>{l}</button>)}
                    </div>
                  </div>
                  <p className="text-muted text-[11px]">Los alumnos sin datos de nutrición no entran en los filtros.</p>
                </div>
              )}

              {mode === "pick" && (
                <div className="bg-field/40 rounded-xl p-3">
                  <SearchInput value={query} onChange={setQuery} placeholder="Buscar alumno..." className="mb-2" />
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {pickList.map((s) => (
                      <button key={s.id} onClick={() => togglePick(s.id)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-field text-left">
                        <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${picked.has(s.id) ? "bg-accent" : "border border-field-strong"}`}>
                          {picked.has(s.id) && <Check size={11} strokeWidth={3} className="text-app" />}
                        </span>
                        <span className="text-ink text-sm truncate">{s.name}</span>
                      </button>
                    ))}
                    {pickList.length === 0 && <p className="text-muted text-xs px-2 py-1">Sin resultados.</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-soft text-xs">
                Le llegará a <span className="text-accent font-semibold">{recipients.length}</span> alumno{recipients.length === 1 ? "" : "s"} con acceso vigente
              </p>
              <button onClick={send} disabled={sending} className="bg-accent text-app text-sm font-semibold rounded-xl px-5 py-2.5 disabled:opacity-50 shrink-0">
                {sending ? "Enviando..." : "Enviar anuncio"}
              </button>
            </div>
            {sentOk && <p className="text-accent text-xs">{sentOk}</p>}
          </div>

          {/* Enviados */}
          <div>
            <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3">Enviados</p>
            {history.length === 0 ? (
              <div className="bg-card rounded-2xl p-5 flex items-center gap-3">
                <Megaphone size={18} className="text-muted" />
                <p className="text-muted text-sm">Todavía no enviaste ningún anuncio.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((a) => {
                  const rec = a.announcement_recipients || [];
                  const read = rec.filter((r) => r.read_at);
                  const pending = rec.filter((r) => !r.read_at);
                  const pct = rec.length ? Math.round((read.length / rec.length) * 100) : 0;
                  const open = openId === a.id;
                  return (
                    <div key={a.id} className="bg-card rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-medium">{a.title}</p>
                          <p className="text-muted text-[11px]">{formatDate(a.created_at)} · {a.audience || "Todos los alumnos"}</p>
                        </div>
                        <button onClick={() => remove(a)} aria-label="Borrar anuncio" className="text-muted hover:text-danger shrink-0"><Trash2 size={15} /></button>
                      </div>
                      <p className="text-soft text-xs mt-2 whitespace-pre-wrap line-clamp-3">{a.body}</p>
                      <button onClick={() => setOpenId(open ? null : a.id)} className="w-full mt-3 text-left">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-soft">Leído por <span className="text-ink font-semibold">{read.length}</span> de {rec.length}</span>
                          <span className="text-accent">{open ? "Ocultar" : "Ver quiénes"}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-field overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                      {open && (
                        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                          <div>
                            <p className="text-muted mb-1">Lo leyeron ({read.length})</p>
                            {read.map((r) => <p key={r.user_id} className="text-ink truncate">{names[r.user_id] || "Alumno"}</p>)}
                          </div>
                          <div>
                            <p className="text-muted mb-1">Falta leer ({pending.length})</p>
                            {pending.map((r) => <p key={r.user_id} className="text-warning truncate">{names[r.user_id] || "Alumno"}</p>)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
