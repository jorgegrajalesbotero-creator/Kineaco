"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Campo de contraseña con un botón (ojo) para mostrarla u ocultarla.
// Recibe las mismas props que un <input>; showLabel/hideLabel son los textos para lectores de pantalla.
export function PasswordInput({ className = "", showLabel = "Mostrar contraseña", hideLabel = "Ocultar contraseña", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-12!`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted hover:text-ink transition-colors"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
