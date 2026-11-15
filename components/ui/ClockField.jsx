"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampField, formatClock, parseClockInput, stepFor } from "@/lib/clock";

const SIZES = {
  lg: { box: "bg-card rounded-xl px-3 py-2 gap-3", label: "text-soft text-sm", btn: "w-10 h-10 rounded-lg", icon: 16, value: "text-ink text-base font-semibold w-20 h-10 rounded-lg" },
  sm: { box: "bg-card rounded-lg px-2 py-1.5 gap-1.5", label: "text-soft text-xs", btn: "w-8 h-8 rounded-md", icon: 13, value: "text-ink text-sm font-semibold w-16 h-8 rounded-md" },
};

const shown = (field, v) => (field.unit === "time" ? formatClock(v) : field.unit === "minutes" ? `${v} min` : String(v));

// Un campo del reloj (trabajo, descanso, rondas, minutos):
// − / + (se pueden mantener presionados) y tocar el número para escribir el valor exacto (7, 0:08, 1:30...).
export function ClockField({ field, value, onChange, t = (x) => x, size = "lg" }) {
  const sz = SIZES[size] || SIZES.lg;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  const hold = useRef(null);

  const bump = (dir) => {
    const next = stepFor(field, latest.current, dir);
    latest.current = next;
    onChange(next);
  };
  const stopHold = () => {
    if (hold.current) {
      clearTimeout(hold.current.timeout);
      clearInterval(hold.current.interval);
      hold.current = null;
    }
  };
  useEffect(() => stopHold, []);
  const startHold = (dir) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    stopHold();
    bump(dir);
    hold.current = { timeout: setTimeout(() => { hold.current.interval = setInterval(() => bump(dir), 90); }, 420) };
  };
  const holdProps = (dir) => ({
    onPointerDown: startHold(dir),
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bump(dir); } },
    onContextMenu: (e) => e.preventDefault(),
  });

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
      <button type="button" {...holdProps(-1)} disabled={value <= field.min} aria-label={`${t("Menos")} ${t(field.label)}`} className={btnCls}>
        <Minus size={sz.icon} />
      </button>
      {editing ? (
        <input
          autoFocus
          value={text}
          inputMode={field.unit === "time" ? "text" : "numeric"}
          onChange={(e) => { setText(e.target.value); setBad(false); }}
          onBlur={() => { if (!commit()) setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") setEditing(false);
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
      <button type="button" {...holdProps(1)} disabled={value >= field.max} aria-label={`${t("Más")} ${t(field.label)}`} className={btnCls}>
        <Plus size={sz.icon} />
      </button>
    </div>
  );
}
