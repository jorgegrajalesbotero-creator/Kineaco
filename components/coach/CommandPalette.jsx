"use client";

// Buscador general del panel (Ctrl + K): escribe el nombre de un alumno, una rutina, un ejercicio o una sección
// y salta directo. ↑ ↓ para moverse, Enter para abrir, Esc para cerrar.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dumbbell, LayoutDashboard, Search, Users, CornerDownLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { libraryRoutines } from "@/lib/libraryRoutines";
import { matchesSearch } from "@/lib/search";

export function CommandPalette({ open, onClose, sections, onGo }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState(null); // { students, routines, exercises }
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    (async () => {
      const [p, r, e] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").order("full_name"),
        libraryRoutines(supabase, "id, title, level, goal", (x) => x.order("title")),
        supabase.from("exercises").select("id, name, muscle_group").order("name"),
      ]);
      setData({
        students: p.data || [],
        routines: r.data || [],
        exercises: e.data || [],
      });
    })();
  }, [open]);

  const results = useMemo(() => {
    const out = [];
    const take = (list, n) => (q.trim() ? list.slice(0, n) : list.slice(0, Math.min(n, 3)));
    take(sections.filter((s) => matchesSearch(q, s.label)), 4).forEach((s) => out.push({ kind: "tab", id: s.key, label: s.label, sub: "Sección", icon: s.icon }));
    if (data) {
      take(data.students.filter((s) => matchesSearch(q, s.full_name)), 6).forEach((s) => out.push({ kind: "student", id: s.id, label: s.full_name || "Sin nombre", sub: s.role === "alumno" ? "Alumno" : "Coach", icon: Users }));
      take(data.routines.filter((r) => matchesSearch(q, r.title, r.goal, r.level)), 6).forEach((r) => out.push({ kind: "routine", id: r.id, label: r.title || "Rutina", sub: ["Rutina", r.level, r.goal].filter(Boolean).join(" · "), icon: LayoutDashboard }));
      take(data.exercises.filter((x) => matchesSearch(q, x.name, x.muscle_group)), 6).forEach((x) => out.push({ kind: "exercise", id: x.id, label: x.name, sub: ["Ejercicio", x.muscle_group].filter(Boolean).join(" · "), icon: Dumbbell }));
    }
    return out;
  }, [q, data, sections]);

  if (!open || typeof document === "undefined") return null;

  const go = (r) => { if (!r) return; onClose(); onGo(r.kind, r.id); };
  const mark = (i) => {
    setActive(i);
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-label="Buscar en el panel">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-panel border border-white/[0.08] rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] overflow-hidden animate-fade-in">
        <div className="flex items-center gap-2 px-4 border-b border-field">
          <Search size={16} className="text-muted shrink-0" />
          <input
            autoFocus
            data-enter="own"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(results.length - 1, active + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(0, active - 1)); }
              if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
            placeholder="Buscar alumno, rutina, ejercicio o sección..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-ink text-base py-4 outline-none placeholder:text-muted"
          />
          <kbd className="text-[10px] text-muted border border-field rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {!data && <p className="text-muted text-sm px-3 py-3">Cargando...</p>}
          {data && results.length === 0 && <p className="text-muted text-sm px-3 py-3">Sin resultados para «{q}».</p>}
          {results.map((r, i) => (
            <button key={`${r.kind}:${r.id}`} type="button" data-i={i} onMouseMove={() => active !== i && setActive(i)} onClick={() => go(r)}
              className={`w-full flex items-center gap-3 text-left rounded-lg px-3 py-2.5 ${i === active ? "bg-field" : ""}`}>
              {r.icon && <r.icon size={16} className="text-soft shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className="block text-ink text-sm truncate">{r.label}</span>
                <span className="block text-muted text-[11px] truncate">{r.sub}</span>
              </span>
              {i === active && <CornerDownLeft size={14} className="text-muted shrink-0" />}
            </button>
          ))}
        </div>
        <p className="text-muted text-[11px] px-4 py-2 border-t border-field">↑ ↓ para moverse · Enter para abrir · Ctrl + K para abrir este buscador · / busca en la pantalla · N crea uno nuevo</p>
      </div>
    </div>,
    document.body
  );
}
