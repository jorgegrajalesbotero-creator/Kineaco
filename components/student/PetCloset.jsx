"use client";

import { useState } from "react";
import { Check, Lock, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";
import { useBackClose } from "@/lib/backStack";
import { Chameleon } from "@/components/ui/Chameleon";
import { PET_LEVELS, saveOutfit } from "@/lib/community";
import { PET_ITEMS, PET_SLOTS, cleanOutfit, needText, progressText } from "@/lib/petItems";

// Vestidor de la mascota: fondo, cabeza, gafas, ropa, medalla, cinturón, espalda, tenis y aura.
// Lo bloqueado muestra cuánto falta. Al guardar, la base revisa que todo esté desbloqueado.
export function PetCloset({ pet, petName, mood = 4, level = 0, onClose, onSaved }) {
  useBackClose(true, onClose);
  const unlocked = new Set(pet?.unlocked || []);
  const [outfit, setOutfit] = useState(() => cleanOutfit(pet?.outfit, pet?.unlocked));
  const [slot, setSlot] = useState("bg");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(0); // al ponerse algo, el camaleón celebra

  const slots = PET_SLOTS.filter((s) => PET_ITEMS.some((i) => i.slot === s.key));
  const items = PET_ITEMS.filter((i) => i.slot === slot);
  const specials = PET_ITEMS.filter((i) => i.special);
  const total = PET_ITEMS.filter((i) => i.metric).length;
  const have = PET_ITEMS.filter((i) => i.metric && unlocked.has(i.key)).length;

  const wear = (item) => {
    if (!unlocked.has(item.key)) return;
    setOutfit((o) => {
      const next = { ...o };
      if (next[item.slot] === item.key && item.slot !== "bg") delete next[item.slot];
      else next[item.slot] = item.key;
      return next;
    });
    setPreview((n) => n + 1);
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await saveOutfit(supabase, outfit);
    setSaving(false);
    if (error) return alert(tr("No se pudo guardar. Intente de nuevo."));
    onSaved?.(data || outfit);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]" onClick={onClose}>
      <div role="dialog" aria-label={tr("Vestir a su mascota")} onClick={(e) => e.stopPropagation()}
        className="bg-deep border border-white/[0.06] w-full max-w-lg rounded-t-3xl md:rounded-3xl max-h-[92dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="relative">
          <Chameleon key={preview} mood={mood} level={level} outfit={outfit} scene party={preview > 0} size={640} className="w-full" />
          <button onClick={onClose} aria-label={tr("Cerrar")} className="absolute right-3 top-3 w-9 h-9 rounded-full bg-app/70 backdrop-blur text-ink flex items-center justify-center"><X size={18} /></button>
          <span className="absolute left-3 top-3 bg-app/70 backdrop-blur text-ink text-xs font-semibold rounded-full px-3 py-1">{petName || tr("Su camaleón")}</span>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-ink text-base font-semibold">{tr("Vestir a {p0}", { p0: petName || tr("su camaleón") })}</p>
            <span className="text-muted text-xs">{tr("{p0} de {p1} desbloqueados", { p0: have, p1: total })}</span>
          </div>
          <p className="text-muted text-[11px] mb-3">
            {tr("Racha: {p0} semanas seguidas cumpliendo (mejor: {p1}) · {p2} entrenamientos", { p0: pet?.streak_now || 0, p1: pet?.streak_best || 0, p2: pet?.trainings || 0 })}
          </p>

          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 min-w-0 max-w-full">
            {slots.map((s) => (
              <button key={s.key} type="button" onClick={() => setSlot(s.key)}
                className={`shrink-0 text-xs rounded-full px-3 py-1.5 ${slot === s.key ? "bg-accent text-app font-semibold" : "bg-card text-soft"}`}>{tr(s.label)}</button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {items.map((it) => {
              const ok = unlocked.has(it.key);
              const on = outfit[it.slot] === it.key || (it.slot === "bg" && !outfit.bg && it.key === "selva");
              const show = { ...outfit, [it.slot]: it.key };
              return (
                <button key={it.key} type="button" onClick={() => wear(it)} disabled={!ok}
                  className={`relative rounded-2xl overflow-hidden text-left ${on ? "ring-2 ring-accent" : "ring-1 ring-white/[0.06]"} ${ok ? "active:scale-95" : ""}`}>
                  <div className={ok ? "" : "opacity-40 grayscale"}>
                    <Chameleon mood={4} outfit={show} scene={it.slot === "bg"} size={200} animate={false} className="w-full" />
                  </div>
                  <div className="px-2 py-1.5 bg-card">
                    <p className="text-ink text-[11px] font-medium leading-tight flex items-center gap-1">
                      {on && <Check size={11} className="text-accent shrink-0" />}{tr(it.name)}{it.special && <Sparkles size={11} className="text-warning shrink-0" />}
                    </p>
                    <p className="text-muted text-[10px] leading-tight mt-0.5">{ok ? (on ? tr("Puesto") : tr("Tocar para ponérselo")) : progressText(it, pet)}</p>
                  </div>
                  {!ok && <Lock size={13} className="absolute right-2 top-2 text-soft" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <p className="text-ink text-sm font-medium flex items-center gap-1.5"><Sparkles size={14} className="text-warning" /> {tr("Los 5 especiales")}</p>
            <p className="text-muted text-[11px] mb-2">{tr("Son los más difíciles: toman meses de constancia.")}</p>
            <div className="space-y-1.5">
              {specials.map((it) => {
                const ok = unlocked.has(it.key);
                const pct = Math.min(1, (Number(pet?.[it.metric]) || 0) / it.need);
                return (
                  <div key={it.key} className="bg-card rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={ok ? "text-accent font-semibold" : "text-ink"}>{tr(it.name)}</span>
                      <span className="text-muted text-[11px]">{ok ? tr("¡Desbloqueado!") : needText(it)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-field mt-1.5 overflow-hidden"><div className={`h-full rounded-full ${ok ? "bg-accent" : "bg-warning"}`} style={{ width: `${Math.round(pct * 100)}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-ink text-sm font-medium mb-2">{tr("Su rama")}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PET_LEVELS.map((l) => (
                <div key={l.level} className={`rounded-xl p-1.5 text-center ${level >= l.level ? "bg-accent/10 border border-accent/30" : "bg-field opacity-70"}`}>
                  <Chameleon mood={4} level={l.level} size={60} animate={false} className="mx-auto" />
                  <p className="text-[10px] text-ink leading-tight">{tr(l.name)}</p>
                  <p className="text-[9px] text-muted leading-tight mt-0.5">{level >= l.level ? tr("Logrado") : tr(l.need)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={save} disabled={saving} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-3 disabled:opacity-60">{saving ? tr("Guardando...") : tr("Guardar")}</button>
            <button onClick={onClose} className="bg-field text-soft text-sm rounded-xl px-4 py-3">{tr("Cancelar")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
