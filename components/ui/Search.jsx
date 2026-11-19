"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { matchesSearch } from "@/lib/search";

export function SearchInput({ value, onChange, placeholder = "Buscar...", className = "" }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full min-w-0 appearance-none [&::-webkit-search-cancel-button]:hidden bg-card text-ink text-sm rounded-lg pl-9 pr-8 py-2 outline-none border border-field focus:border-accent/40 text-ellipsis"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// Lista desplegable con buscador. options: [{ value, label, sub }]
// topOption (opcional): { value, label } que siempre aparece primero (ej. "+ Crear ejercicio nuevo").
// La lista se dibuja encima de todo (portal) y se acomoda a la pantalla: nunca queda cortada
// dentro de una tarjeta o ventana, se abre hacia arriba si abajo no hay lugar y, en el
// celular, no queda tapada por el teclado.
export function SearchSelect({ options, value, onChange, placeholder = "Buscar...", topOption, className = "", inputClassName = "", disabled = false, keepEmpty = false }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState(null);
  const inputRef = useRef(null);
  const selected = options.find((o) => o.value === value) || (topOption && topOption.value === value ? topOption : null);
  const filtered = options.filter((o) => matchesSearch(text, o.label, o.sub));
  const pick = (v) => {
    onChange(v, text);
    setText("");
    setOpen(false);
  };

  // Dónde va la lista: debajo del campo, o arriba si abajo no entra (teclado del celular)
  const place = () => {
    const el = inputRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const vTop = vv ? vv.offsetTop : 0;
    const vH = vv ? vv.height : window.innerHeight;
    const vW = vv ? vv.width : window.innerWidth;
    const below = vTop + vH - r.bottom - 10;
    const above = r.top - vTop - 10;
    const up = below < 200 && above > below;
    const maxH = Math.max(140, Math.min(288, up ? above : below));
    const width = Math.min(Math.max(r.width, 240), vW - 16);
    const left = Math.max(8, Math.min(r.left, vW - width - 8));
    const layoutH = document.documentElement.clientHeight || window.innerHeight;
    setPos({ left, width, top: up ? null : r.bottom + 6, bottom: up ? layoutH - r.top + 6 : null, up, maxH });
  };

  useEffect(() => {
    if (!open) return;
    place();
    let raf = 0;
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("scroll", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.visualViewport?.removeEventListener("resize", onMove);
      window.visualViewport?.removeEventListener("scroll", onMove);
    };
  }, [open]);

  // En el celular: al tocar el buscador, se centra en la pantalla para que el teclado no lo tape
  const bringIntoView = () => {
    if (typeof window === "undefined" || !window.matchMedia?.("(pointer: coarse)").matches) return;
    setTimeout(() => inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 280);
  };

  const list = open && pos && typeof document !== "undefined" ? createPortal(
    <div
      role="listbox"
      style={{ position: "fixed", left: pos.left, width: pos.width, maxHeight: pos.maxH, ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }) }}
      className={`z-[300] overflow-y-auto overscroll-contain p-1 bg-panel border border-white/[0.07] rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] ${pos.up ? "animate-fade-in" : "animate-panel-in origin-top"} [scrollbar-width:thin] [scrollbar-color:var(--color-field)_transparent]`}
    >
      {topOption && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(topOption.value)} className="w-full text-left px-2.5 py-2.5 mb-1 text-sm text-accent rounded-lg hover:bg-card border-b border-white/[0.05] break-words">
          {topOption.label}{text ? `: "${text}"` : ""}
        </button>
      )}
      {filtered.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-soft break-words">Sin resultados para &quot;{text}&quot;</p>
      ) : (
        filtered.map((o) => {
          const isSelected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
              className={`w-full text-left px-2.5 py-2.5 text-sm rounded-lg flex items-center gap-2 hover:bg-card ${isSelected ? "text-accent" : "text-ink"}`}
            >
              <span className="flex-1 min-w-0 break-words">
                {o.label}
                {o.sub && <span className="text-soft text-xs"> · {o.sub}</span>}
              </span>
              {isSelected && <Check size={14} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />}
            </button>
          );
        })
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative min-w-0 ${className}`}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        ref={inputRef}
        value={open ? text : keepEmpty ? "" : selected?.label || ""}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => { setText(""); setOpen(true); bringIntoView(); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) pick(filtered[0].value); else if (topOption) pick(topOption.value); }
          if (e.key === "Escape") { setOpen(false); e.currentTarget.blur(); }
        }}
        placeholder={placeholder}
        disabled={disabled}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={`w-full min-w-0 bg-field hover:bg-field-hover text-ink text-sm rounded-lg pl-8 pr-8 py-2 outline-none transition-colors text-ellipsis focus:ring-2 focus:ring-accent/30 disabled:opacity-60 ${inputClassName}`}
      />
      <ChevronDown
        size={15}
        aria-hidden="true"
        className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${open ? "rotate-180 text-accent" : "text-soft"}`}
      />
      {list}
    </div>
  );
}
