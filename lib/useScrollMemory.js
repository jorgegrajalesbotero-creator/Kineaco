"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// Recuerda dónde iba el scroll de una lista mientras se abre un detalle (ficha de
// un alumno, una rutina, un panel...) y lo devuelve al mismo lugar al volver.
//  - hidden: true mientras la lista NO se ve (está abierto el detalle)
//  - id: el contenedor que hace scroll (en el panel del coach es "coach-scroll";
//        si no existe, se usa la ventana)
export function useScrollMemory(hidden, id = "coach-scroll") {
  const pos = useRef(0);

  const getEl = () => (typeof document === "undefined" ? null : document.getElementById(id) || document.scrollingElement);

  // Mientras la lista se ve, se guarda la posición. Es un layout effect para dejar de
  // escuchar ANTES de que el navegador recorte el scroll al mostrar el detalle.
  useLayoutEffect(() => {
    if (hidden) return;
    const el = getEl();
    if (!el) return;
    const target = id === "coach-scroll" && !document.getElementById(id) ? window : el;
    const onScroll = () => { pos.current = el.scrollTop; };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [hidden, id]);

  // Al abrir el detalle: arriba de todo. Al volver: donde estaba (reintenta unos
  // instantes por si la lista todavía está cargando y aún no tiene su alto final).
  useEffect(() => {
    const el = getEl();
    if (!el) return;
    if (hidden) { el.scrollTop = 0; return; }
    const goal = pos.current;
    if (!goal) return;
    let raf = 0;
    let tries = 0;
    let stop = false;
    const cancel = () => { stop = true; };
    el.addEventListener("wheel", cancel, { passive: true });
    el.addEventListener("touchstart", cancel, { passive: true });
    const tick = () => {
      if (stop) return;
      el.scrollTop = goal;
      if (Math.abs(el.scrollTop - goal) < 2 || tries++ > 90) return;
      raf = requestAnimationFrame(tick);
    };
    tick();
    pos.current = goal;
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("wheel", cancel);
      el.removeEventListener("touchstart", cancel);
    };
  }, [hidden, id]);
}
