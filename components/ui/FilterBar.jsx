"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, Check, SlidersHorizontal, X } from "lucide-react";
import { SearchInput } from "@/components/ui/Search";
import { Select } from "@/components/ui/Select";

const MAX_VISIBLE = 8; // opciones visibles por categoría antes de "Ver todas"
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

// Barra compacta (buscador + orden + botón Filtros) y una ficha con los filtros
// ordenados por categoría: panel flotante en escritorio, hoja inferior en celular.
// Debajo de la barra solo se muestran los filtros activos, cada uno removible.
//  - state: lo que devuelve useFilterState
//  - facets: [{ id, label, options: [{ value, label, count }] }] (de filterItems)
//  - sorts: [{ id, label }]
//  - shown / total: cantidad visible y total
export function FilterBar({ state, placeholder = "Buscar...", facets = [], sorts = [], shown, total, className = "", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState({}); // categorías con "Ver todas"
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const { query, setQuery, selected, toggle, sort, setSort, clear, clearFacet, chipCount } = state;

  const visibleFacets = facets.filter((f) => f.options.length > 0);
  const hasFilters = visibleFacets.length > 0;
  const hasActive = chipCount > 0 || !!query.trim();
  const canSort = sorts.length > 1;

  const activePills = visibleFacets.flatMap((f) =>
    (selected[f.id] || [])
      .map((v) => {
        const opt = f.options.find((o) => o.value === v);
        return opt ? { facetId: f.id, facetLabel: f.label, value: v, label: opt.label } : null;
      })
      .filter(Boolean)
  );

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const clearChips = () => visibleFacets.forEach((f) => clearFacet(f.id));

  // Cerrar con Escape o al hacer clic fuera del panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative mb-4 max-w-3xl ${className}`}>
      {/* Barra compacta */}
      <div className="flex items-stretch gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder={placeholder} className="flex-1 min-w-0" />

        {canSort && (
          <Select
            tone="card"
            icon={ArrowUpDown}
            aria-label="Ordenar por"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className={`${hasFilters ? "hidden md:block" : ""} shrink-0`}
          >
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        )}

        {hasFilters && (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-haspopup="dialog"
            className={`shrink-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors ${FOCUS} ${
              open || chipCount ? "bg-field border-field-strong text-ink" : "bg-card border-field text-soft hover:text-ink"
            }`}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            Filtros
            {chipCount > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-app text-[11px] font-semibold tabular-nums flex items-center justify-center">
                {chipCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Filtros activos: removibles uno a uno */}
      {hasActive && (
        <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
          <span className="flex items-center text-xs mr-1.5">
            <span className="text-soft tabular-nums">{shown} de {total}</span>
            <span className="text-muted mx-1.5" aria-hidden="true">·</span>
            <button type="button" onClick={clear} className={`text-soft hover:text-ink rounded ${FOCUS}`}>
              Limpiar todo
            </button>
          </span>
          {activePills.map((p) => (
            <button
              key={`${p.facetId}:${p.value}`}
              type="button"
              onClick={() => toggle(p.facetId, p.value)}
              title={`${p.facetLabel}: ${p.label}`}
              aria-label={`Quitar filtro ${p.facetLabel}: ${p.label}`}
              className={`group flex items-center gap-1 rounded-full pl-2.5 pr-1.5 py-1 text-xs bg-accent/[0.08] text-accent border border-accent/20 hover:bg-accent/[0.14] transition-colors ${FOCUS}`}
            >
              {p.label}
              <X size={12} className="opacity-70 group-hover:opacity-100" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* Ficha de filtros */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 z-[70] bg-night/70 touch-none animate-fade-in" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id={panelId}
            role="dialog"
            aria-label="Filtros"
            className="fixed inset-x-0 bottom-0 z-[71] max-h-[85dvh] rounded-t-3xl animate-sheet-in md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-[26rem] md:max-h-[min(70vh,36rem)] md:rounded-2xl md:animate-panel-in md:origin-top-right flex flex-col bg-gradient-to-b from-card to-deep border border-white/[0.06] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.8)]"
          >
            <div className="md:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />

            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/[0.05]">
              <div>
                <p className="text-ink text-base font-semibold tracking-tight">Filtros</p>
                <p className="text-soft text-xs mt-0.5 tabular-nums">
                  {shown} de {total} {total === 1 ? "resultado" : "resultados"}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar filtros"
                className={`w-8 h-8 shrink-0 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-soft hover:text-ink ${FOCUS}`}
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 [scrollbar-width:thin] [scrollbar-color:var(--color-field)_transparent]">
              {canSort && (
                <Section title="Ordenar por" className="md:hidden">
                  {sorts.map((s) => (
                    <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>
                      {s.label}
                    </Chip>
                  ))}
                </Section>
              )}

              {visibleFacets.map((f) => {
                const selectedHere = selected[f.id] || [];
                const isExpanded = expanded[f.id];
                // Las marcadas siempre se ven, aunque estén más allá del límite
                const shownOptions = isExpanded
                  ? f.options
                  : f.options.filter((o, i) => i < MAX_VISIBLE || selectedHere.includes(o.value));
                const hidden = f.options.length - shownOptions.length;
                return (
                  <Section key={f.id} title={f.label} count={selectedHere.length} onClear={() => clearFacet(f.id)}>
                    {shownOptions.map((o) => {
                      const active = selectedHere.includes(o.value);
                      return (
                        <Chip
                          key={o.value}
                          active={active}
                          disabled={!active && o.count === 0}
                          count={o.count}
                          onClick={() => toggle(f.id, o.value)}
                        >
                          {o.label}
                        </Chip>
                      );
                    })}
                    {f.options.length > MAX_VISIBLE && (hidden > 0 || isExpanded) && (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [f.id]: !isExpanded }))}
                        className={`text-xs text-accent px-2 py-1.5 rounded ${FOCUS}`}
                      >
                        {isExpanded ? "Ver menos" : `Ver todas (+${hidden})`}
                      </button>
                    )}
                  </Section>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/[0.05]">
              <button
                type="button"
                onClick={clearChips}
                disabled={chipCount === 0}
                className={`text-sm text-soft hover:text-ink disabled:opacity-40 disabled:hover:text-soft rounded px-1 ${FOCUS}`}
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={close}
                className={`bg-accent text-app text-sm font-semibold rounded-xl px-4 py-2.5 tabular-nums active:scale-[0.98] transition-transform ${FOCUS}`}
              >
                Ver {shown} {shown === 1 ? "resultado" : "resultados"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, count = 0, onClear, children, className = "" }) {
  return (
    <section className={`py-4 border-b border-white/[0.05] last:border-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h3 className="text-ink text-[13px] font-medium">
          {title}
          {count > 0 && <span className="text-accent tabular-nums"> · {count}</span>}
        </h3>
        {onClear && count > 0 && (
          <button type="button" onClick={onClear} className={`text-xs text-soft hover:text-ink rounded px-1 ${FOCUS}`}>
            Quitar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Chip({ active, disabled = false, count, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] border transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${FOCUS} ${
        active
          ? "bg-accent text-app border-accent font-medium"
          : "bg-white/[0.03] text-ink/85 border-white/[0.07] hover:text-ink hover:border-white/15"
      }`}
    >
      {active && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}
      {children}
      {count !== undefined && <span className={`tabular-nums text-[11px] ${active ? "text-app/70" : "text-soft"}`}>{count}</span>}
    </button>
  );
}
