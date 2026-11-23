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
// En el celular la lista sale pegada justo debajo del campo (dentro de la página) y el campo
// sube hasta arriba de la pantalla, así el teclado no la tapa. En el computador se dibuja
// encima de todo (portal), para que no quede cortada dentro de una tarjeta o ventana.
const isTouch = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

export function SearchSelect({ options, value, onChange, placeholder = "Buscar...", topOption, className = "", inputClassName = "", disabled = false, keepEmpty = false }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState(null);
  const [touch, setTouch] = useState(false);
  const inputRef = useRef(null);
  const selected = options.find((o) => o.value === value) || (topOption && topOption.value === value ? topOption : null);
  const filtered = options.filter((o) => matchesSearch(text, o.label, o.sub));
  // Flechas ↑ ↓ recorren la lista (incluida la opción de arriba) y Enter elige la marcada
  const [active, setActive] = useState(-1);
  const choices = [...(topOption ? [topOption] : []), ...filtered];
  const pick = (v) => {
    onChange(v, text);
    setText("");
    setOpen(false);
    setActive(-1);
  };
  const markAt = (i) => {
    setActive(i);
    requestAnimationFrame(() => document.querySelector(`[data-search-opt="${i}"]`)?.scrollIntoView({ block: "nearest" }));
  };

  // Computador: debajo del campo, o arriba si abajo no entra
  const place = () => {
    const el = inputRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const vH = window.innerHeight;
    const vW = window.innerWidth;
    const below = vH - r.bottom - 10;
    const above = r.top - 10;
    const up = below < 200 && above > below;
    const maxH = Math.max(140, Math.min(288, up ? above : below));
    const width = Math.min(Math.max(r.width, 240), vW - 16);
    const left = Math.max(8, Math.min(r.left, vW - width - 8));
    setPos({ left, width, top: up ? null : r.bottom + 6, bottom: up ? vH - r.top + 6 : null, up, maxH });
  };

  useEffect(() => {
    if (!open || touch) return;
    place();
    let raf = 0;
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, touch]);

  // Celular: el campo sube a la parte de arriba de la pantalla (cuando ya abrió el teclado)
  const bringToTop = () => {
    const el = inputRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  useEffect(() => {
    if (!open || !touch) return;
    const t1 = setTimeout(bringToTop, 120);
    const t2 = setTimeout(bringToTop, 450); // el teclado del iPhone tarda en abrir
    const vv = window.visualViewport;
    const onResize = () => bringToTop();
    vv?.addEventListener("resize", onResize);
    return () => { clearTimeout(t1); clearTimeout(t2); vv?.removeEventListener("resize", onResize); };
  }, [open, touch]);

  const items = (
    <>
      {topOption && (
        <button type="button" data-search-opt={0} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(topOption.value)} className={`w-full text-left px-2.5 py-2.5 mb-1 text-sm text-accent rounded-lg hover:bg-card border-b border-white/[0.05] break-words ${active === 0 ? "bg-card" : ""}`}>
          {topOption.label}{text ? `: "${text}"` : ""}
        </button>
      )}
      {filtered.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-soft break-words">Sin resultados para &quot;{text}&quot;</p>
      ) : (
        filtered.map((o, idx) => {
          const isSelected = o.value === value;
          const n = idx + (topOption ? 1 : 0);
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              data-search-opt={n}
              aria-selected={isSelected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
              className={`w-full text-left px-2.5 py-2.5 text-sm rounded-lg flex items-center gap-2 hover:bg-card ${active === n ? "bg-card ring-1 ring-accent/40" : ""} ${isSelected ? "text-accent" : "text-ink"}`}
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
    </>
  );
  const listCls = "overflow-y-auto overscroll-contain p-1 bg-panel border border-white/[0.07] rounded-xl [scrollbar-width:thin] [scrollbar-color:var(--color-field)_transparent]";

  const floating = open && !touch && pos && typeof document !== "undefined" ? createPortal(
    <div
      role="listbox"
      style={{ position: "fixed", left: pos.left, width: pos.width, maxHeight: pos.maxH, ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }) }}
      className={`z-[300] ${listCls} shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] ${pos.up ? "animate-fade-in" : "animate-panel-in origin-top"}`}
    >
      {items}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          ref={inputRef}
          value={open ? text : keepEmpty ? "" : selected?.label || ""}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => { setTouch(isTouch()); setText(""); setOpen(true); setActive(-1); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) { setOpen(true); return; }
              if (!choices.length) return;
              const next = e.key === "ArrowDown" ? (active + 1) % choices.length : active <= 0 ? choices.length - 1 : active - 1;
              markAt(next);
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (active >= 0 && choices[active]) pick(choices[active].value);
              else if (filtered[0]) pick(filtered[0].value);
              else if (topOption) pick(topOption.value);
            }
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); e.currentTarget.blur(); }
          }}
          placeholder={placeholder}
          disabled={disabled}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{ scrollMarginTop: 16 }}
          className={`w-full min-w-0 bg-field hover:bg-field-hover text-ink text-sm rounded-lg pl-8 pr-8 py-2 outline-none transition-colors text-ellipsis focus:ring-2 focus:ring-accent/30 disabled:opacity-60 ${inputClassName}`}
        />
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 ${open ? "rotate-180 text-accent" : "text-soft"}`}
        />
      </div>
      {open && touch && (
        <div role="listbox" className={`mt-1.5 max-h-60 ${listCls} animate-panel-in origin-top`}>
          {items}
        </div>
      )}
      {floating}
    </div>
  );
}
