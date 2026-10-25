"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { matchesSearch } from "@/lib/search";

export function SearchInput({ value, onChange, placeholder = "Buscar...", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-card text-ink text-sm rounded-lg pl-9 pr-8 py-2 outline-none border border-field focus:border-accent/40"
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
export function SearchSelect({ options, value, onChange, placeholder = "Buscar...", topOption, className = "", inputClassName = "", disabled = false, keepEmpty = false }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const selected = options.find((o) => o.value === value) || (topOption && topOption.value === value ? topOption : null);
  const filtered = options.filter((o) => matchesSearch(text, o.label, o.sub));
  const pick = (v) => {
    onChange(v, text);
    setText("");
    setOpen(false);
  };
  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        value={open ? text : keepEmpty ? "" : selected?.label || ""}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => { setText(""); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) pick(filtered[0].value); else if (topOption) pick(topOption.value); }
          if (e.key === "Escape") { setOpen(false); e.currentTarget.blur(); }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full bg-field text-ink text-sm rounded-lg pl-8 pr-3 py-2 outline-none disabled:opacity-60 ${inputClassName}`}
      />
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-panel border border-field rounded-lg shadow-xl">
          {topOption && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(topOption.value)} className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-card border-b border-field">
              {topOption.label}{text ? `: "${text}"` : ""}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">Sin resultados para "{text}"</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-card ${o.value === value ? "text-accent" : "text-ink"}`}
              >
                {o.label}
                {o.sub && <span className="text-muted text-xs"> · {o.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
