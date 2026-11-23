"use client";

import { useEffect } from "react";

// Ayudas de teclado y mouse para toda la app (computador):
//  · Enter en un campo pasa al siguiente campo (si es el último, lo cierra y se guarda como al salir del campo).
//    No actúa dentro de <form> (ahí Enter envía) ni en campos con su propio Enter (data-enter="own" o que ya lo manejan).
//  · Flechas ↑ ↓ ← → dentro de una zona data-grid se mueven entre casillas como en Excel
//    (← → solo cuando el cursor está al inicio o al final del texto).
//  · Esc: primero sale del campo; si no hay campo activo, cierra el panel o ventana de arriba (su botón «Cerrar»).
//  · Arrastrar con el mouse (clic sostenido) mueve de lado las zonas que se desplazan a lo ancho.
//  · Celular: deslizar el dedo desde el borde izquierdo hacia la derecha es "atrás" (cierra el panel abierto).
const FIELD = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]):not([type="range"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])';
const TEXTLIKE = new Set(["", "text", "number", "email", "tel", "url", "decimal", "date", "time"]);
const visible = (el) => !!(el.offsetParent || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden";
const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

function focusField(el) {
  el.focus();
  if (el.tagName === "INPUT" && typeof el.select === "function") {
    try { el.select(); } catch { /* algunos tipos no se pueden seleccionar */ }
  }
  el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

function onEnter(e) {
  const t = e.target;
  if (t.tagName !== "INPUT" || !TEXTLIKE.has((t.getAttribute("type") || "").toLowerCase())) return;
  if (t.closest("form") || t.dataset.enter === "own" || t.closest('[data-enter="own"]')) return;
  const scope = t.closest('[data-enter-scope], [role="dialog"], [data-grid]') || t.closest("main, #coach-scroll") || document.body;
  const fields = [...scope.querySelectorAll(FIELD)].filter(visible);
  const i = fields.indexOf(t);
  e.preventDefault();
  const next = i >= 0 ? fields[i + 1] : null;
  if (next) focusField(next);
  else t.blur();
}

function onGridArrow(e) {
  const t = e.target;
  if (t.tagName !== "INPUT") return;
  const grid = t.closest("[data-grid]");
  if (!grid) return;
  const k = e.key;
  if (k === "ArrowLeft" || k === "ArrowRight") {
    const v = t.value || "";
    let atEdge = true;
    try {
      const s = t.selectionStart;
      const en = t.selectionEnd;
      if (s != null) atEdge = s !== en ? (s === 0 && en === v.length) : k === "ArrowLeft" ? s === 0 : en === v.length;
    } catch { atEdge = true; }
    if (!atEdge) return;
  }
  const r = t.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const cands = [...grid.querySelectorAll("input")].filter((x) => x !== t && !x.disabled && visible(x)).map((x) => {
    const b = x.getBoundingClientRect();
    return { el: x, x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  let best = null;
  if (k === "ArrowDown" || k === "ArrowUp") {
    const dirOk = cands.filter((c) => (k === "ArrowDown" ? c.y > cy + 4 : c.y < cy - 4));
    if (!dirOk.length) return;
    const minDy = Math.min(...dirOk.map((c) => Math.abs(c.y - cy)));
    const row = dirOk.filter((c) => Math.abs(c.y - cy) - minDy < 8);
    best = row.reduce((a, c) => (!a || Math.abs(c.x - cx) < Math.abs(a.x - cx) ? c : a), null);
  } else {
    const same = cands.filter((c) => Math.abs(c.y - cy) < r.height / 2 + 4 && (k === "ArrowRight" ? c.x > cx + 2 : c.x < cx - 2));
    best = same.reduce((a, c) => (!a || Math.abs(c.x - cx) < Math.abs(a.x - cx) ? c : a), null);
  }
  if (!best) return;
  e.preventDefault();
  focusField(best.el);
}

function onEscape(e) {
  const a = document.activeElement;
  if (isTyping(a)) { a.blur(); return; }
  const closers = [...document.querySelectorAll('[data-esc-close], button[aria-label="Cerrar"], button[aria-label="Close"]')].filter(visible);
  const last = closers[closers.length - 1];
  if (last) { e.preventDefault(); last.click(); }
}

function shortcut(e) {
  if (document.querySelector('[role="dialog"]')) return false;
  if (e.key === "/") {
    const box = document.querySelector("#coach-scroll, main") || document.body;
    const s = [...box.querySelectorAll('input[type="search"], input[placeholder^="Buscar"]')].find(visible);
    if (!s) return false;
    e.preventDefault();
    focusField(s);
    return true;
  }
  const btn = [...document.querySelectorAll('[data-shortcut="new"]')].find(visible);
  if (!btn) return false;
  e.preventDefault();
  if (btn.tagName === "INPUT") focusField(btn);
  else btn.click();
  return true;
}

function scrollerOf(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 2) return n;
  }
  return null;
}

export function InputHelpers() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      // Atajos (solo si no está escribiendo): "/" busca en la pantalla, "N" crea uno nuevo
      if (!isTyping(document.activeElement) && !e.shiftKey && (e.key === "/" || e.key === "n" || e.key === "N")) {
        if (shortcut(e)) return;
      }
      if (e.key === "Enter" && !e.shiftKey) onEnter(e);
      else if (e.key.startsWith("Arrow") && !e.shiftKey) onGridArrow(e);
      // Esc se resuelve al final: si otra parte ya lo usó (un menú, el visor de PDF...), no se cierra nada más
      else if (e.key === "Escape") setTimeout(() => { if (!e.defaultPrevented) onEscape(e); }, 0);
    };

    // Arrastrar para desplazar a lo ancho con el mouse
    let drag = null;
    const onDown = (e) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"], [data-drag-handle], [data-no-drag-scroll]')) return;
      const box = scrollerOf(e.target);
      if (!box) return;
      drag = { box, x: e.clientX, left: box.scrollLeft, moved: false };
    };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }
      e.preventDefault();
      drag.box.scrollLeft = drag.left - dx;
    };
    const onUp = () => {
      if (!drag) return;
      if (drag.moved) {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        // El clic que sigue al soltar no debe tocar el botón donde terminó el arrastre
        const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 50);
      }
      drag = null;
    };

    // Deslizar desde el borde izquierdo = atrás (solo si hay algo abierto dentro de la app)
    let edge = null;
    const onTouchStart = (e) => {
      const t = e.touches[0];
      edge = t && t.clientX < 24 && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, done: false } : null;
    };
    const onTouchMove = (e) => {
      if (!edge || edge.done) return;
      const t = e.touches[0];
      const dx = t.clientX - edge.x;
      const dy = Math.abs(t.clientY - edge.y);
      if (dy > 50) { edge = null; return; }
      if (dx > 80 && history.state?.kinBack) { edge.done = true; history.back(); }
    };
    const onTouchEnd = () => { edge = null; };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);
  return null;
}
