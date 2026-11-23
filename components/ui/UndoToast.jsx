"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Undo2 } from "lucide-react";

// "Se quitó · Deshacer" durante unos segundos, en vez de preguntar "¿Está seguro?".
// const { offer, toast } = useUndo();  offer("Se quitó el bloque", () => volverAtras());  y dibujar {toast}
export function useUndo(ms = 6000) {
  const [item, setItem] = useState(null); // { label, undo, id }
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const offer = (label, undo) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setItem({ label, undo, id });
    timer.current = setTimeout(() => setItem((x) => (x?.id === id ? null : x)), ms);
  };
  const run = () => {
    clearTimeout(timer.current);
    const it = item;
    setItem(null);
    it?.undo();
  };
  const toast = item && typeof document !== "undefined"
    ? createPortal(
      <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-[400]">
        <div className="animate-fade-up flex items-center gap-3 bg-panel border border-white/[0.08] rounded-xl pl-4 pr-2 py-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)]">
          <span className="text-ink text-sm">{item.label}</span>
          <button type="button" onClick={run} className="flex items-center gap-1.5 text-accent text-sm font-semibold rounded-lg px-3 py-1.5 hover:bg-field">
            <Undo2 size={14} /> Deshacer
          </button>
        </div>
      </div>,
      document.body
    )
    : null;
  return { offer, toast };
}
