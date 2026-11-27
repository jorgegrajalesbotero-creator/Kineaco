"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

// Enlace que cambia de sección grande (panel del coach ↔ vista de alumno) con recarga completa de la
// página, como pide DECISIONS.md. Al tocarlo muestra de una vez que está abriendo, y un segundo toque no
// hace nada (antes había que esperar y tocar dos veces).
export function ReloadLink({ href, className = "", children, pendingLabel = "Abriendo…" }) {
  const [busy, setBusy] = useState(false);
  return (
    <a
      href={href}
      aria-busy={busy}
      onClick={(e) => {
        if (busy) { e.preventDefault(); return; }
        setBusy(true);
      }}
      className={`${className} ${busy ? "opacity-80 pointer-events-none" : ""}`}
    >
      {busy ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> {pendingLabel}</span> : children}
    </a>
  );
}
