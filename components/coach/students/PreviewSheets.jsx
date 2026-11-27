"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Layers, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { BLOCK_TYPES, blockTypeLabel } from "@/lib/blocks";
import { cleanInt } from "@/lib/numbers";
import { SearchSelect } from "@/components/ui/Search";
import { useBackClose } from "@/lib/backStack";

const field = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";
const sheet = "bg-deep border border-white/[0.06] w-full max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5 max-h-[90dvh] overflow-y-auto";

// "+ Agregar bloque" desde la vista del alumno: tipo, nombre, series y sus ejercicios.
// onSave({ block_type, title, sets, exercises }) devuelve true si salió bien.
export function AddBlockSheet({ routineTitle, scoped, onSave, onClose }) {
  useBackClose(true, onClose);
  const [type, setType] = useState("remate");
  const [title, setTitle] = useState("");
  const [sets, setSets] = useState("3");
  const [list, setList] = useState([]); // [{ exerciseId, name, reps }]
  const [catalog, setCatalog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState("week");
  useEffect(() => {
    supabase.from("exercises").select("id, name, muscle_group").order("name").then(({ data }) => setCatalog(data || []));
  }, []);
  const options = useMemo(() => catalog.map((e) => ({ value: e.id, label: e.name, sub: e.muscle_group || "" })), [catalog]);
  const add = (id) => {
    const ex = catalog.find((e) => String(e.id) === String(id));
    if (ex) setList((l) => [...l, { exerciseId: ex.id, name: ex.name, reps: "" }]);
  };
  const save = async () => {
    if (!list.length) return alert("Agregue al menos un ejercicio al bloque.");
    setBusy(true);
    const ok = await onSave({ block_type: type, title: title.trim() || blockTypeLabel(type), sets, exercises: list }, scope);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]" onClick={onClose}>
      <div className={sheet} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><Layers size={14} /> Agregar bloque</p>
            <p className="text-muted text-xs truncate mt-1">{routineTitle} · solo para este alumno</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>
        {scoped && (
          <div className="flex gap-1.5 mb-3">
            {[["week", "Solo esta semana"], ["from", "Desde esta semana"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setScope(k)} className={`flex-1 text-xs rounded-lg px-3 py-2 ${scope === k ? "bg-accent text-app font-semibold" : "bg-field text-soft hover:text-ink"}`}>{l}</button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {BLOCK_TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setType(t.key)} className={`text-xs rounded-full px-3 py-1.5 ${type === t.key ? "bg-accent text-app font-semibold" : "bg-field text-soft hover:text-ink"}`}>{t.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={`Nombre (${blockTypeLabel(type)})`} className={`${field} col-span-2`} />
          <input inputMode="numeric" value={sets} onChange={(e) => setSets(cleanInt(e.target.value).slice(0, 2))} placeholder="Series" aria-label="Series" className={field} />
        </div>
        <div className="space-y-1.5 mb-2">
          {list.map((e, i) => (
            <div key={i} className="flex items-center gap-2 bg-field rounded-lg pl-3 pr-1 py-1">
              <span className="flex-1 min-w-0 text-ink text-sm truncate">{e.name}</span>
              <input value={e.reps} maxLength={20} onChange={(ev) => setList((l) => l.map((x, j) => (j === i ? { ...x, reps: ev.target.value } : x)))} placeholder="Reps" aria-label="Reps" className="w-20 bg-app text-ink text-xs rounded-md px-2 py-1.5 outline-none" />
              <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label="Quitar" className="w-8 h-8 rounded-md text-soft flex items-center justify-center hover:text-danger"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <SearchSelect options={options} value="" keepEmpty onChange={(id) => id && add(id)} placeholder="+ Agregar ejercicio al bloque (buscar)..." />
        <div className="flex gap-2 mt-5">
          <button onClick={save} disabled={busy} className="flex-1 bg-accent text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50">{busy ? "Guardando..." : "Agregar bloque"}</button>
          <button onClick={onClose} className="bg-field text-soft text-sm rounded-xl px-4 py-2.5">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// "Copiar este día a…": otro día de la semana o el mismo día de la semana siguiente.
// targets = [{ key, label, hasRoutines }] · onCopy(target, mode "replace" | "add") devuelve true si salió bien.
export function CopyDaySheet({ dayLabel, targets, onCopy, onClose }) {
  useBackClose(true, onClose);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = async (target, mode) => {
    setBusy(true);
    const ok = await onCopy(target, mode);
    setBusy(false);
    if (ok) onClose();
  };
  const choose = (t) => (t.hasRoutines ? setPicked(t) : go(t, "add"));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]" onClick={onClose}>
      <div className={sheet} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-accent text-xs font-semibold flex items-center gap-1.5"><Copy size={14} /> Copiar el {dayLabel.toLowerCase()}</p>
            <p className="text-muted text-xs mt-1">Se copian sus rutinas (no los extras), solo para este alumno.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted shrink-0"><X size={20} /></button>
        </div>
        {!picked ? (
          <div className="grid grid-cols-2 gap-2">
            {targets.map((t) => (
              <button key={t.key} type="button" disabled={busy} onClick={() => choose(t)}
                className={`text-left rounded-xl px-3 py-2.5 bg-field hover:bg-field-hover disabled:opacity-50 ${t.wide ? "col-span-2" : ""}`}>
                <span className="block text-ink text-sm">{t.label}</span>
                <span className="block text-muted text-[11px]">{t.hasRoutines ? "Ya tiene rutina" : "Libre"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-ink text-sm mb-3">El {picked.label.toLowerCase()} ya tiene rutina. ¿Qué hago?</p>
            <div className="flex flex-col gap-2">
              <button disabled={busy} onClick={() => go(picked, "replace")} className="bg-accent text-app text-sm font-semibold rounded-xl py-3 disabled:opacity-50">Reemplazar lo que tiene</button>
              <button disabled={busy} onClick={() => go(picked, "add")} className="bg-field text-ink text-sm font-semibold rounded-xl py-3 disabled:opacity-50"><Plus size={14} className="inline -mt-0.5" /> Sumarlo a lo que tiene</button>
              <button onClick={() => setPicked(null)} className="text-soft text-sm py-2">Elegir otro día</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
