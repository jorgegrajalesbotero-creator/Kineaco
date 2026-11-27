"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

// Explicación que no ocupa pantalla: un ⓘ pequeño que, al tocarlo, muestra el texto en una burbuja.
// Se cierra al tocar fuera, con Esc o al hacer scroll. Va en el portal para que nunca quede recortada.
//   <InfoTip text="Lo que antes era un párrafo de ayuda" />
export function InfoTip({ text, label = "Más información", className = "", size = 14 }) {
  const btn = useRef(null);
  const [pos, setPos] = useState(null); // { top, left, up }

  const toggle = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (pos) return setPos(null);
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
    const up = r.bottom + 140 > window.innerHeight; // sin espacio abajo: sale hacia arriba
    setPos({ left, width, top: up ? r.top - 8 : r.bottom + 8, up });
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

  if (!text) return null;
  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-label={label} aria-expanded={!!pos} title={label}
        className={`inline-flex items-center justify-center align-middle shrink-0 w-6 h-6 -m-1 rounded-full ${pos ? "text-accent" : "text-muted hover:text-ink"} ${className}`}>
        <Info size={size} />
      </button>
      {pos && typeof document !== "undefined" && createPortal(
        <div role="tooltip" onPointerDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, transform: pos.up ? "translateY(-100%)" : undefined }}
          className="z-[500] bg-panel border border-white/[0.1] text-ink text-xs leading-relaxed rounded-xl px-3 py-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9)] animate-fade-in whitespace-pre-line">
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}

// Para reemplazar un párrafo de ayuda: deja solo el ⓘ en ese lugar (className conserva los márgenes)
export function InfoNote({ text, className = "" }) {
  return <div className={`flex ${className}`}><InfoTip text={text} /></div>;
}
