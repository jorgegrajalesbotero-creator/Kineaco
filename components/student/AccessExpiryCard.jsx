"use client";

import { CalendarClock } from "lucide-react";
import { appLocale, tr } from "@/lib/i18n";
import { accessDaysLeft, accessStage, colombiaDateISO } from "@/lib/accessNotice";

// Tarjeta de Inicio cuando el acceso a la app está por vencer (desde 7 días antes).
// Amarilla los últimos días y roja el día que vence. El botón abre los mensajes con el coach
// con un texto listo para pedir la renovación.
export function AccessExpiryCard({ accessUntil, onRenew }) {
  const days = accessDaysLeft(accessUntil);
  const stage = accessStage(days);
  if (!stage) return null;
  const iso = colombiaDateISO(accessUntil);
  const date = new Date(`${iso}T12:00:00Z`).toLocaleDateString(appLocale(), { day: "numeric", month: "short", timeZone: "UTC" });
  const tone = stage === "today"
    ? "bg-danger/10 border-danger/40"
    : stage === "urgent" ? "bg-warning/10 border-warning/40" : "bg-card border-white/[0.06]";
  const iconTone = stage === "today" ? "text-danger" : stage === "urgent" ? "text-warning" : "text-accent";
  const title = stage === "today"
    ? tr("Su acceso a la app vence hoy")
    : days === 1 ? tr("Su acceso a la app vence mañana") : tr("Su acceso a la app vence en {p0} días", { p0: days });
  return (
    <div className={`w-full flex items-start gap-3 border rounded-3xl px-4 py-3 mb-5 animate-fade-up ${tone}`}>
      <CalendarClock size={20} className={`shrink-0 mt-0.5 ${iconTone}`} />
      <div className="flex-1 min-w-0">
        <p className="text-ink text-sm font-medium">{title}</p>
        <p className="text-soft text-xs leading-snug">
          {stage === "today" ? tr("Hoy es su último día. Renueve para no perder el acceso a sus rutinas.") : tr("Vence el {p0}. Renueve con su coach para seguir entrenando sin pausas.", { p0: date })}
        </p>
        {onRenew && (
          <button onClick={onRenew} className="mt-2 bg-accent text-app text-xs font-semibold rounded-full px-3 py-1.5 active:scale-95 transition-transform">
            {tr("Escribirle a mi coach para renovar")}
          </button>
        )}
      </div>
    </div>
  );
}
