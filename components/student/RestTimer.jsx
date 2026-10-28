"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, X } from "lucide-react";
import { tr } from "@/lib/i18n";

// Pitido corto al terminar el descanso (sin archivos de audio)
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    // algunos navegadores no permiten sonido; no pasa nada
  }
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

// Temporizador de descanso flotante. `endsAt` = momento en que termina (ms)
export function RestTimer({ endsAt, total, onChange, onClose }) {
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);
  const left = Math.ceil((endsAt - now) / 1000);
  const done = left <= 0;

  useEffect(() => {
    finished.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // Dependemos de `done` (booleano estable) y no de `left`: así el setTimeout no se
  // cancela en cada tick y el temporizador se cierra solo a los 2,5 s.
  useEffect(() => {
    if (done && !finished.current) {
      finished.current = true;
      navigator.vibrate?.([200, 100, 200]);
      beep();
      const t = setTimeout(onClose, 2500);
      return () => clearTimeout(t);
    }
  }, [done]);

  const pct = total ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;

  return (
    <div className="fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[55] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-panel border border-white/[0.08] rounded-2xl p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <Timer size={18} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted text-[11px]">{done ? tr("¡A la siguiente serie!") : tr("Descanso")}</p>
            <p className="text-ink text-2xl font-semibold tabular-nums leading-none">{done ? "0:00" : fmt(left)}</p>
          </div>
          {!done && (
            <>
              <button onClick={() => onChange(-15)} className="w-10 h-10 rounded-xl bg-white/[0.05] text-soft text-xs font-semibold">-15</button>
              <button onClick={() => onChange(15)} className="w-10 h-10 rounded-xl bg-white/[0.05] text-soft text-xs font-semibold">+15</button>
            </>
          )}
          <button onClick={onClose} aria-label={tr("Saltar descanso")} className="w-10 h-10 rounded-xl bg-white/[0.05] text-soft flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden mt-3">
          <div className="h-full bg-accent rounded-full transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
