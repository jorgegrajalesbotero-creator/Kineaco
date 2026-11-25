"use client";

import { Sparkles } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useBackClose } from "@/lib/backStack";
import { Chameleon } from "@/components/ui/Chameleon";
import { itemByKey } from "@/lib/petItems";

// Se desbloqueó algo para el camaleón: lo muestra puesto, celebrando, y lleva a vestirlo
export function PetUnlockCelebration({ news, petName, onClose, onDress }) {
  useBackClose(true, onClose);
  const items = news.keys.map(itemByKey).filter(Boolean);
  if (!items.length) return null;
  const first = items[0];
  const outfit = { ...(news.outfit || {}), [first.slot]: first.key };
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div role="dialog" aria-label={tr("Desbloqueo nuevo")} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-panel border border-accent/30 rounded-3xl overflow-hidden text-center animate-celebrate">
        <Chameleon mood={5} outfit={outfit} scene party size={640} className="w-full" />
        <div className="p-5">
          <p className="text-accent text-xs font-semibold flex items-center justify-center gap-1.5"><Sparkles size={14} /> {tr("¡Desbloqueo nuevo!")}</p>
          <p className="text-ink text-lg font-semibold mt-1">
            {items.length === 1 ? tr(first.name) : tr("{p0} cosas nuevas", { p0: items.length })}
          </p>
          <p className="text-soft text-sm mt-1">
            {items.length === 1
              ? tr("{p0} ya se lo puede poner.", { p0: petName || tr("Su camaleón") })
              : items.map((i) => tr(i.name)).join(" · ")}
          </p>
          <div className="flex gap-2 mt-5">
            <button onClick={onDress} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-3">{tr("Vestirlo")}</button>
            <button onClick={onClose} className="bg-field text-soft text-sm rounded-xl px-4 py-3">{tr("Después")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
