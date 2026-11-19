"use client";

import { useState } from "react";
import { ChevronDown, Timer } from "lucide-react";
import { timerLabel } from "@/lib/clock";
import { TimerSettings } from "@/components/coach/TimerSettings";

// Reloj programado para una rutina en "lista simple" (vale para toda la rutina)
export function RoutineTimerField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={`w-full flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-left ${value ? "bg-accent/15 text-accent" : "bg-card text-soft hover:text-ink"}`}>
        <Timer size={16} />
        <span className="flex-1">{value ? `Reloj de la rutina: ${timerLabel(value)}` : "Programar reloj (opcional): Tabata / intermitentes, AMRAP..."}</span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2">
          <TimerSettings value={value || null} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
