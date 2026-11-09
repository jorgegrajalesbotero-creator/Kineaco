"use client";

import { useState } from "react";
import { ArrowUpDown, SlidersHorizontal, X } from "lucide-react";
import { SearchInput } from "@/components/ui/Search";

const MAX_VISIBLE = 8; // opciones visibles por categoría antes de "Ver todas"

// Barra de búsqueda + filtros por categorías + orden.
//  - facets: [{ id, label, options: [{ value, label, count }] }] (de filterItems)
//  - state: lo que devuelve useFilterState
//  - sorts: [{ id, label }]
//  - shown / total: cantidad visible y total
export function FilterBar({ state, placeholder = "Buscar...", facets = [], sorts = [], shown, total, className = "" }) {
  const [open, setOpen] = useState(false); // panel de filtros en celular
  const [expanded, setExpanded] = useState({}); // categorías con "Ver todas"
  const { query, setQuery, selected, toggle, sort, setSort, clear, chipCount } = state;
  const visibleFacets = facets.filter((f) => f.options.length > 0);
  const hasActive = chipCount > 0 || !!query.trim();

  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <SearchInput value={query} onChange={setQuery} placeholder={placeholder} className="flex-1 min-w-[12rem] max-w-md" />
        {visibleFacets.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`md:hidden flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 border ${chipCount ? "border-accent/50 text-accent" : "border-field text-soft"} bg-card`}
          >
            <SlidersHorizontal size={15} /> Filtros{chipCount ? ` (${chipCount})` : ""}
          </button>
        )}
        {sorts.length > 1 && (
          <label className="flex items-center gap-1.5 shrink-0 bg-card border border-field rounded-lg pl-2.5">
            <ArrowUpDown size={14} className="text-muted" aria-hidden="true" />
            <span className="sr-only">Ordenar por</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-card text-ink text-sm rounded-lg pr-2 py-2 outline-none cursor-pointer"
            >
              {sorts.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {visibleFacets.length > 0 && (
        <div className={`${open ? "block" : "hidden"} md:block mt-3 space-y-2.5`}>
          {visibleFacets.map((f) => {
            const isExpanded = expanded[f.id];
            const selectedHere = selected[f.id] || [];
            // Siempre se muestran las marcadas, aunque estén más allá del límite.
            const shownOptions = isExpanded
              ? f.options
              : f.options.filter((o, i) => i < MAX_VISIBLE || selectedHere.includes(o.value));
            const hidden = f.options.length - shownOptions.length;
            return (
              <div key={f.id} className="flex flex-col md:flex-row md:items-start gap-1.5 md:gap-3">
                <span className="text-muted text-xs md:w-28 md:pt-1.5 shrink-0">{f.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {shownOptions.map((o) => {
                    const active = selectedHere.includes(o.value);
                    const disabled = !active && o.count === 0;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => toggle(f.id, o.value)}
                        className={`text-xs rounded-full px-3 py-1.5 border flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          active ? "bg-accent text-app border-accent font-medium" : "bg-card text-soft border-field hover:text-ink"
                        }`}
                      >
                        {o.label}
                        <span className={active ? "opacity-80" : "text-muted"}>{o.count}</span>
                      </button>
                    );
                  })}
                  {(hidden > 0 || isExpanded) && f.options.length > MAX_VISIBLE && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [f.id]: !isExpanded }))}
                      className="text-xs text-accent px-2 py-1.5"
                    >
                      {isExpanded ? "Ver menos" : `Ver todas (+${hidden})`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasActive && (
        <div className="flex items-center gap-3 mt-3 text-xs">
          <span className="text-muted">Mostrando {shown} de {total}</span>
          <button type="button" onClick={clear} className="text-accent flex items-center gap-1">
            <X size={12} /> Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
