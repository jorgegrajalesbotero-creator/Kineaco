"use client";

import { ChevronDown } from "lucide-react";

// Selector con el estilo de la plataforma. Por dentro sigue siendo un <select>
// nativo: en el celular abre el selector del teléfono y funciona con teclado y
// lectores de pantalla. Por fuera tiene la flecha de la app, tamaños y foco
// consistentes, y la lista desplegada en tema oscuro.
//
//  - tone:  "field" (dentro de tarjetas, como los demás campos del panel)
//           "card"  (sobre el fondo de la página, como el buscador)
//           "soft"  (formularios del alumno y del registro)
//  - size:  "sm" (filas compactas) · "md" (normal) · "lg" (junto a botones grandes)
//           · "xl" (formularios del registro)
//  - icon:  ícono opcional a la izquierda (componente de lucide-react)
//  - rounded: "lg" | "xl" para forzar el radio
//  - className: va en el contenedor (ancho, márgenes, flex). El resto de props
//    (value, onChange, disabled, aria-label...) van al <select>.

const TONES = {
  field: "bg-field hover:bg-field-hover",
  card: "bg-card border border-field hover:border-field-strong focus:border-accent/40",
  soft: "bg-app/60 border border-white/[0.07] hover:border-white/15 focus:border-accent/40",
};

const SIZES = {
  sm: { text: "text-xs", py: "py-1.5", pl: "pl-2.5", plIcon: "pl-7", pr: "pr-8", chevron: 14, right: "right-2.5", left: "left-2.5" },
  md: { text: "text-sm", py: "py-2", pl: "pl-3", plIcon: "pl-9", pr: "pr-9", chevron: 15, right: "right-3", left: "left-3" },
  lg: { text: "text-sm", py: "py-2.5", pl: "pl-3", plIcon: "pl-9", pr: "pr-9", chevron: 15, right: "right-3", left: "left-3" },
  xl: { text: "text-[15px]", py: "py-3", pl: "pl-4", plIcon: "pl-10", pr: "pr-10", chevron: 16, right: "right-3.5", left: "left-3.5" },
};

export function Select({ tone = "field", size = "md", icon: Icon, rounded, className = "", children, ...props }) {
  const s = SIZES[size] || SIZES.md;
  const radius = rounded === "xl" || (!rounded && (tone === "soft" || size === "xl")) ? "rounded-xl" : "rounded-lg";
  return (
    <div className={`relative ${className}`}>
      {Icon && (
        <Icon
          size={s.chevron - 1}
          aria-hidden="true"
          className={`pointer-events-none absolute ${s.left} top-1/2 -translate-y-1/2 text-muted`}
        />
      )}
      <select
        {...props}
        className={`peer block w-full h-full appearance-none cursor-pointer text-ink outline-none transition-colors [color-scheme:dark] focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone] || TONES.field} ${radius} ${s.text} ${s.py} ${Icon ? s.plIcon : s.pl} ${s.pr}`}
      >
        {children}
      </select>
      <ChevronDown
        size={s.chevron}
        aria-hidden="true"
        className={`pointer-events-none absolute ${s.right} top-1/2 -translate-y-1/2 text-soft transition-colors peer-hover:text-ink peer-focus:text-accent peer-disabled:opacity-40`}
      />
    </div>
  );
}
