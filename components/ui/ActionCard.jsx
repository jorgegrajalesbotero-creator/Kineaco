"use client";

// Tarjeta "viva": se abre tocando cualquier parte, tiene menú de acciones (clic derecho en el computador o
// mantener presionado en el celular) y, en el celular, se desliza a la izquierda para ver acciones rápidas.
// Los botones, enlaces y campos de adentro siguen funcionando normal (no abren la tarjeta).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const INTERACTIVE = "button, a, input, select, textarea, label, [role='button'], [data-no-open]";

// actions: [{ label, icon: Icon, onClick, danger }]  · swipe: las que salen al deslizar (por defecto, las últimas 2)
export function ActionCard({ onOpen, actions = [], swipe, className = "", outerClassName = "rounded-xl", children, disabled = false, ariaLabel }) {
  const [menu, setMenu] = useState(null); // { x, y }
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touch = useRef(null);
  const suppressClick = useRef(false);
  const openTimer = useRef(null);
  useEffect(() => () => clearTimeout(openTimer.current), []);
  const swipeActions = (swipe || actions.slice(-2)).filter(Boolean);
  const reveal = swipeActions.length * 76;

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const openMenuAt = (x, y) => {
    if (!actions.length) return;
    const w = 220;
    const h = actions.length * 42 + 12;
    setMenu({ x: Math.max(8, Math.min(x, window.innerWidth - w - 8)), y: Math.max(8, Math.min(y, window.innerHeight - h - 8)) });
  };

  const onClick = (e) => {
    if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); return; }
    if (dx !== 0) { setDx(0); return; }
    const hit = e.target.closest(INTERACTIVE);
    if (disabled || !onOpen || (hit && hit !== e.currentTarget)) return;
    if (window.getSelection?.()?.toString()) return; // estaba seleccionando texto
    // Sobre un nombre que se cambia con doble clic: se espera un momento por si es doble clic
    if (e.target.closest("[data-dblclick]")) {
      clearTimeout(openTimer.current);
      if (e.detail >= 2) return;
      openTimer.current = setTimeout(onOpen, 240);
      return;
    }
    onOpen();
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, startDx: dx, mode: null, timer: null };
    if (actions.length && !e.target.closest("input, textarea, select")) {
      touch.current.timer = setTimeout(() => {
        if (!touch.current || touch.current.mode) return;
        touch.current.mode = "menu";
        suppressClick.current = true;
        navigator.vibrate?.(15);
        openMenuAt(t.clientX, t.clientY);
      }, 480);
    }
  };
  const onTouchMove = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const mx = t.clientX - s.x;
    const my = t.clientY - s.y;
    if (!s.mode && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      clearTimeout(s.timer);
      s.mode = swipeActions.length && Math.abs(mx) > Math.abs(my) * 1.3 ? "swipe" : "scroll";
    }
    if (s.mode === "swipe") {
      if (!dragging) setDragging(true);
      setDx(Math.max(-reveal - 20, Math.min(0, s.startDx + mx)));
    }
  };
  const onTouchEnd = () => {
    const s = touch.current;
    if (!s) return;
    clearTimeout(s.timer);
    setDragging(false);
    if (s.mode === "swipe") {
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 350);
      setDx((d) => (d < -reveal / 2 ? -reveal : 0));
    }
    touch.current = null;
  };

  const run = (a) => { setMenu(null); setDx(0); a.onClick?.(); };

  return (
    <div className={`relative overflow-hidden ${outerClassName}`}>
      {dx !== 0 && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: reveal }}>
          {swipeActions.map((a) => (
            <button key={a.label} type="button" onClick={() => run(a)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${a.danger ? "bg-danger text-app" : "bg-field text-ink"}`}>
              {a.icon && <a.icon size={16} />}{a.label}
            </button>
          ))}
        </div>
      )}
      <div
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        aria-label={ariaLabel}
        onClick={onClick}
        onKeyDown={(e) => { if (onOpen && e.key === "Enter" && e.target === e.currentTarget) { e.preventDefault(); onOpen(); } }}
        onContextMenu={(e) => { if (!actions.length || e.target.closest("input, textarea")) return; e.preventDefault(); openMenuAt(e.clientX, e.clientY); }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? "none" : "transform 180ms ease" }}
        className={`relative ${onOpen && !disabled ? "cursor-pointer hover:ring-1 hover:ring-accent/40 focus-visible:ring-1 focus-visible:ring-accent outline-none" : ""} transition-shadow ${className}`}
      >
        {children}
      </div>
      {menu && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[450]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div role="menu" style={{ left: menu.x, top: menu.y }} className="fixed z-[460] w-[220px] p-1.5 bg-panel border border-white/[0.08] rounded-xl shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] animate-fade-in">
            {actions.map((a) => (
              <button key={a.label} type="button" role="menuitem" onClick={() => run(a)}
                className={`w-full flex items-center gap-2.5 text-left text-sm rounded-lg px-3 py-2.5 hover:bg-field ${a.danger ? "text-danger" : "text-ink"}`}>
                {a.icon && <a.icon size={15} className={a.danger ? "" : "text-soft"} />}{a.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// Nombre que se cambia con doble clic (Enter guarda, Esc cancela)
// startKey: al cambiar (por ejemplo desde el menú «Cambiar nombre») se abre para escribir
export function InlineRename({ value, onSave, className = "", inputClassName = "", title = "Doble clic para cambiar el nombre", startKey = 0 }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || "");
  useEffect(() => { if (startKey) { setText(value || ""); setEditing(true); } }, [startKey]);
  const commit = async () => {
    setEditing(false);
    const v = text.trim();
    if (v && v !== value) {
      const ok = await onSave(v);
      if (ok === false) setText(value || "");
    } else setText(value || "");
  };
  if (editing) {
    return (
      <input
        autoFocus
        data-enter="own"
        value={text}
        maxLength={120}
        onChange={(e) => setText(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") { e.preventDefault(); setText(value || ""); setEditing(false); }
        }}
        className={`w-full bg-field text-ink rounded-lg px-2 py-1 outline-none ring-1 ring-accent ${inputClassName}`}
      />
    );
  }
  return (
    <span data-dblclick title={title} onDoubleClick={(e) => { e.stopPropagation(); setText(value || ""); setEditing(true); }} className={className}>
      {value}
    </span>
  );
}
