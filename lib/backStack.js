"use client";

// Botón "atrás" del celular y del navegador dentro de la app: en vez de salir, cierra el panel o la
// ventana que está abierta, o vuelve a la pestaña anterior.
// Cada panel que se abre agrega una entrada al historial del navegador. Al tocar atrás se cierra el de arriba.
// Si un panel se cierra con su propio botón, su entrada queda "muerta" y el próximo atrás la salta sola.
import { useEffect, useRef } from "react";

const stack = [];
let installed = false;

function onPop() {
  const top = stack.pop();
  if (!top) return;
  if (top.dead) {
    if (stack.length) history.back(); // entrada de un panel ya cerrado: seguir hacia atrás
    return;
  }
  // Si el panel no se dejó cerrar (por ejemplo, tenía cambios sin guardar y se canceló), vuelve a quedar arriba
  if (top.close() === false) push(top);
}

function push(entry) {
  stack.push(entry);
  // Se conserva el estado interno de Next.js para que el router no recargue la página al volver
  history.pushState({ ...(history.state || {}), kinBack: stack.length }, "");
}

export function pushBack(close) {
  if (typeof window === "undefined") return () => {};
  if (!installed) {
    installed = true;
    window.addEventListener("popstate", onPop);
  }
  const entry = { close, dead: false };
  push(entry);
  return () => { entry.dead = true; };
}

// Mientras open sea verdadero, "atrás" llama a onClose. onClose puede devolver false para no cerrarse.
export function useBackClose(open, onClose) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });
  useEffect(() => {
    if (!open) return undefined;
    let byBack = false;
    const release = pushBack(() => {
      const r = ref.current?.();
      if (r !== false) byBack = true;
      return r;
    });
    return () => { if (!byBack) release(); };
  }, [open]);
}

// Pestañas: "atrás" vuelve a la pestaña anterior. select(tab) es la función que cambia de pestaña.
export function useBackTabs(tab, select) {
  const prev = useRef(tab);
  const restoring = useRef(false);
  const selectRef = useRef(select);
  useEffect(() => { selectRef.current = select; });
  useEffect(() => {
    const from = prev.current;
    prev.current = tab;
    if (from === tab) return;
    if (restoring.current) { restoring.current = false; return; }
    pushBack(() => { restoring.current = true; selectRef.current(from); });
  }, [tab]);
}
