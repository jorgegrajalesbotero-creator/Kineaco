"use client";

import { useEffect, useState } from "react";

// Número que "sube" desde 0 hasta su valor al aparecer en pantalla
export function CountUp({ value, duration = 900 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return <span className="tabular-nums">{shown.toLocaleString()}</span>;
}
