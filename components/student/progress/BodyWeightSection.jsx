"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { appLocale, tr } from "@/lib/i18n";
import { cleanDecimal, toNumber } from "@/lib/numbers";

const fmtKg = (v) => Number(v).toFixed(1).replace(/\.0$/, "");
const fmtDate = (iso) => new Date(iso).toLocaleDateString(appLocale(), { day: "2-digit", month: "short", year: "numeric" });

// Línea del peso en el tiempo (sin librerías)
function Sparkline({ points }) {
  if (points.length < 2) return null;
  const W = 300, H = 70, pad = 6;
  const vals = points.map((p) => Number(p.weight_kg));
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const xy = vals.map((v, i) => [pad + (i * (W - pad * 2)) / (vals.length - 1), pad + (H - pad * 2) * (1 - (v - min) / span)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${lx},${H} L${pad},${H} Z`} fill="var(--color-accent, #d6ff5c)" opacity="0.08" />
      <path d={d} fill="none" stroke="var(--color-accent, #d6ff5c)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3.5" fill="var(--color-accent, #d6ff5c)" />
    </svg>
  );
}

// Progreso → Peso corporal: un solo historial que también se llena desde Nutrición, Medidas, Check-in y Fotos
export function BodyWeightSection({ logs, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const latest = logs[0];
  const previous = logs[1];
  const diff = latest && previous ? Number(latest.weight_kg) - Number(previous.weight_kg) : null;
  const chrono = logs.slice(0, 30).reverse();
  const first = chrono[0];
  const total = latest && first && first !== latest ? Number(latest.weight_kg) - Number(first.weight_kg) : null;

  const valid = (v) => {
    const n = toNumber(v);
    return n !== null && n >= 25 && n <= 400 ? n : null;
  };

  const add = async () => {
    const n = valid(draft);
    if (n === null) return alert(tr("Escriba un peso válido en kg."));
    setBusy(true);
    await onAdd(n);
    setBusy(false);
    setDraft("");
    setAdding(false);
  };

  const saveEdit = async (w) => {
    const n = valid(editDraft);
    if (n === null) return alert(tr("Escriba un peso válido en kg."));
    setBusy(true);
    await onUpdate(w.id, n);
    setBusy(false);
    setEditId(null);
  };

  const remove = async (w) => {
    if (!confirm(tr("¿Borrar el registro de {p0} kg del {p1}?", { p0: fmtKg(w.weight_kg), p1: fmtDate(w.logged_at) }))) return;
    setBusy(true);
    await onDelete(w.id);
    setBusy(false);
  };

  const list = showAll ? logs : logs.slice(0, 6);

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-3">
        <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em]">{tr("Peso corporal")}</p>
        <button onClick={() => setAdding((s) => !s)} className="text-accent text-xs font-medium">
          {adding ? tr("Cancelar") : tr("+ Agregar peso")}
        </button>
      </div>

      {adding && (
        <div className="bg-card rounded-2xl p-3 mb-3 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder={tr("Peso en kg, ej. 64,5")}
            value={draft}
            onChange={(e) => setDraft(cleanDecimal(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1 min-w-0 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none"
            autoFocus
          />
          <button onClick={add} disabled={busy} className="bg-accent text-app font-semibold px-4 rounded-lg text-sm disabled:opacity-50">
            {tr("Guardar")}
          </button>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-4">
        {!latest ? (
          <p className="text-muted text-sm text-center py-2">{tr("Todavía no ha registrado su peso.")}</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-ink text-3xl font-semibold tracking-tight tabular-nums">
                  {fmtKg(latest.weight_kg)} <span className="text-soft text-base font-medium">kg</span>
                </p>
                <p className="text-muted text-xs mt-0.5">{tr("Último registro:")} {fmtDate(latest.logged_at)}</p>
              </div>
              <div className="text-right">
                {diff !== null && diff !== 0 && (
                  <p className="text-soft text-xs tabular-nums">{diff > 0 ? "+" : ""}{fmtKg(diff)} kg {tr("vs. anterior")}</p>
                )}
                {total !== null && total !== 0 && (
                  <p className="text-muted text-[11px] tabular-nums">{total > 0 ? "+" : ""}{fmtKg(total)} kg {tr("desde el {p0}", { p0: fmtDate(first.logged_at) })}</p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <Sparkline points={chrono} />
            </div>

            <div className="mt-3 divide-y divide-white/[0.05]">
              {list.map((w) => (
                <div key={w.id || w.logged_at} className="flex items-center gap-2 py-2">
                  <span className="text-muted text-xs flex-1">{fmtDate(w.logged_at)}</span>
                  {editId === w.id ? (
                    <>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editDraft}
                        onChange={(e) => setEditDraft(cleanDecimal(e.target.value))}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(w)}
                        className="w-20 bg-field text-ink text-sm text-right rounded-lg px-2 py-1 outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveEdit(w)} disabled={busy} aria-label={tr("Guardar")} className="text-accent p-1"><Check size={16} /></button>
                      <button onClick={() => setEditId(null)} aria-label={tr("Cancelar")} className="text-muted p-1"><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-ink text-sm tabular-nums">{fmtKg(w.weight_kg)} kg</span>
                      {w.id && (
                        <>
                          <button onClick={() => { setEditId(w.id); setEditDraft(String(w.weight_kg)); }} aria-label={tr("Corregir")} className="text-muted hover:text-ink p-1"><Pencil size={14} /></button>
                          <button onClick={() => remove(w)} disabled={busy} aria-label={tr("Borrar")} className="text-muted hover:text-danger p-1"><Trash2 size={14} /></button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            {logs.length > 6 && (
              <button onClick={() => setShowAll((s) => !s)} className="text-accent text-xs mt-2">
                {showAll ? tr("Ver menos") : tr("Ver todo ({p0})", { p0: logs.length })}
              </button>
            )}
          </>
        )}
        <p className="text-muted text-[11px] mt-3">{tr("También se actualiza cuando registra su peso en Nutrición, Medidas, Check-in o Fotos.")}</p>
      </div>
    </div>
  );
}
