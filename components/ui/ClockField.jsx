"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampField, formatClock, parseClockInput, stepFor } from "@/lib/clock";

const SIZES = {
  lg: { box: "bg-card rounded-xl px-3 py-2 gap-3", label: "text-soft text-sm", btn: "w-10 h-10 rounded-lg", icon: 16, value: "text-ink text-base font-semibold w-20 h-10 rounded-lg" },
  sm: { box: "bg-card rounded-lg px-2 py-1.5 gap-1.5", label: "text-soft text-xs", btn: "w-8 h-8 rounded-md", icon: 13, value: "text-ink text-sm font-semibold w-16 h-8 rounded-md" },
};

const shown = (field, v) => (field.unit === "time" ? formatClock(v) : field.unit === "minutes" ? `${v} min` : String(v));

// Botón − / + que se puede mantener presionado: llama a onStep una vez y, si se sostiene, cada 90 ms.
function HoldButton({ onStep, disabled, label, className, children }) {
  const timer = useRef(null);
  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current.timeout);
    clearInterval(timer.current.interval);
    timer.current = null;
  };
  // Si llega al límite y el botón se desactiva, deja de repetir (un botón desactivado no avisa al soltar)
  useEffect(() => {
    if (disabled && timer.current) {
      clearTimeout(timer.current.timeout);
      clearInterval(timer.current.interval);
      timer.current = null;
    }
  }, [disabled]);
  useEffect(() => () => {
    if (!timer.current) return;
    clearTimeout(timer.current.timeout);
    clearInterval(timer.current.interval);
  }, []);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={className}
      onPointerDown={(e) => {
        if (e.button !== undefined && e.button !== 0) return;
        stop();
        onStep();
        const t = { timeout: null, interval: null };
        t.timeout = setTimeout(() => { t.interval = setInterval(() => onStep(), 90); }, 420);
        timer.current = t;
      }}
      onPointerUp={() => stop()}
      onPointerLeave={() => stop()}
      onPointerCancel={() => stop()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStep(); } }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

// Un campo del reloj (trabajo, descanso, rondas, minutos):
// − / + (se pueden mantener presionados) y tocar el número para escribir el valor exacto (7, 0:08, 1:30...).
export function ClockField({ field, value, onChange, t = (x) => x, size = "lg" }) {
  const sz = SIZES[size] || SIZES.lg;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  // Último valor (para que al mantener presionado siga sumando desde donde va)
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  const onStepDown = () => {
    const next = stepFor(field, latest.current, -1);
    latest.current = next;
    onChange(next);
  };
  const onStepUp = () => {
    const next = stepFor(field, latest.current, 1);
    latest.current = next;
    onChange(next);
  };

  const openEdit = () => {
    setText(field.unit === "time" ? formatClock(value) : String(value));
    setBad(false);
    setEditing(true);
  };
  const commit = () => {
    const n = field.unit === "time" ? parseClockInput(text) : (/^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null);
    if (n === null) {
      setBad(true);
      return false;
    }
    onChange(clampField(field, n));
    setEditing(false);
    return true;
  };

  const btnCls = `${sz.btn} bg-field text-ink flex items-center justify-center disabled:opacity-40 select-none touch-none`;
  return (
    <div className={`${sz.box} flex items-center`}>
      <span className={`${sz.label} flex-1 min-w-0`}>{t(field.label)}</span>
      <HoldButton onStep={onStepDown} disabled={value <= field.min} label={`${t("Menos")} ${t(field.label)}`} className={btnCls}>
        <Minus size={sz.icon} />
      </HoldButton>
      {editing ? (
        <input
          autoFocus
          value={text}
          inputMode={field.unit === "time" ? "text" : "numeric"}
          onChange={(e) => { setText(e.target.value); setBad(false); }}
          onBlur={() => { if (!commit()) setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
          }}
          aria-label={t(field.label)}
          placeholder={field.unit === "time" ? "0:08" : ""}
          className={`${sz.value} bg-app/70 border ${bad ? "border-danger" : "border-accent/50"} text-center tabular-nums outline-none px-1`}
        />
      ) : (
        <button
          type="button"
          onClick={openEdit}
          title={t("Toque para escribir el tiempo exacto")}
          aria-label={`${t(field.label)}: ${shown(field, value)}. ${t("Toque para escribir el tiempo exacto")}`}
          className={`${sz.value} tabular-nums text-center border border-dashed border-field-strong hover:border-accent/50 transition-colors`}
        >
          {shown(field, value)}
        </button>
      )}
      <HoldButton onStep={onStepUp} disabled={value >= field.max} label={`${t("Más")} ${t(field.label)}`} className={btnCls}>
        <Plus size={sz.icon} />
      </HoldButton>
    </div>
  );
}
