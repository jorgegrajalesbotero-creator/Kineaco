"use client";

import { useBackClose } from "@/lib/backStack";

// Pregunta antes de quitar o mover algo desde "Rutina como la ve el alumno".
// scoped = con planeación o en un extra: se elige "solo esta semana" o "desde esta semana".
// onAnswer(scope) con "week" | "from" (o "all" si no hay semanas que elegir) · onCancel()
export function ScopeAskSheet({ title, message, scoped, confirmLabel = "Sí, quitar", danger = true, onAnswer, onCancel }) {
  useBackClose(true, onCancel);
  const main = danger ? "bg-danger text-app" : "bg-accent text-app";
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[80]" onClick={onCancel}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="bg-panel border border-white/[0.06] w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <p className="text-ink text-base font-semibold mb-1">{title}</p>
        {message && <p className="text-soft text-sm mb-4 whitespace-pre-line">{message}</p>}
        <div className="flex flex-col gap-2">
          {scoped ? (
            <>
              <button onClick={() => onAnswer("week")} className={`${main} text-sm font-semibold rounded-xl py-3`}>Solo esta semana</button>
              <button onClick={() => onAnswer("from")} className="bg-field text-ink text-sm font-semibold rounded-xl py-3">Desde esta semana en adelante</button>
            </>
          ) : (
            <button onClick={() => onAnswer("all")} className={`${main} text-sm font-semibold rounded-xl py-3`}>{confirmLabel}</button>
          )}
          <button onClick={onCancel} className="text-soft text-sm rounded-xl py-2.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
