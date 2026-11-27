"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

// Botón ⋯ que abre un menú con acciones (para no llenar una tarjeta de botones).
// actions: [{ label, icon: Icon, onClick, danger }] · las que vienen en null se omiten.
export function MenuButton({ actions, label = "Más opciones", className = "" }) {
  const list = (actions || []).filter(Boolean);
  const btn = useRef(null);
  const [pos, setPos] = useState(null);
  const open = (e) => {
    e.stopPropagation();
    if (pos) return setPos(null);
    const r = btn.current.getBoundingClientRect();
    const width = 230;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const height = list.length * 42 + 12;
    const top = r.bottom + height + 8 > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4;
    setPos({ left, top, width });
  };
  useEffect(() => {
    if (!pos) return undefined;
    const close = (e) => { if (!btn.current?.contains(e.target)) setPos(null); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); setPos(null); } };
    const onScroll = () => setPos(null);
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [pos]);
  if (!list.length) return null;
  const run = (a) => { setPos(null); a.onClick(); };
  return (
    <>
      <button ref={btn} type="button" onClick={open} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={!!pos}
        className={`shrink-0 w-9 h-9 rounded-lg bg-field text-soft flex items-center justify-center hover:text-ink ${pos ? "text-accent" : ""} ${className}`}>
        <MoreHorizontal size={16} />
      </button>
      {pos && typeof document !== "undefined" && createPortal(
        <div role="menu" onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width }}
          className="z-[460] p-1.5 bg-panel border border-white/[0.08] rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] animate-fade-in">
          {list.map((a) => (
            <button key={a.label} type="button" role="menuitem" onClick={() => run(a)}
              className={`w-full flex items-center gap-2.5 text-left text-sm rounded-lg px-3 py-2 hover:bg-field ${a.danger ? "text-danger" : "text-ink"}`}>
              {a.icon && <a.icon size={15} className="shrink-0" />} {a.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
