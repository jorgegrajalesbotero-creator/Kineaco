"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { localDateString } from "@/lib/dates";
import { cleanInt } from "@/lib/numbers";
import { Select } from "@/components/ui/Select";

const endOfMonth = () => { const d = new Date(); return localDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

// Coach: crear y borrar los retos grupales de su comunidad (se usa en el panel y en su vista de alumno)
export function ChallengeManager({ onChange }) {
  const [list, setList] = useState(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("community_challenges").select("*").order("end_date", { ascending: false });
    setMissing(!!error);
    setList(data || []);
  }
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim()) return alert("Escriba el nombre del reto.");
    if (!(Number(form.target) > 0)) return alert("Escriba la meta (un número mayor que 0).");
    if (!form.start || !form.end || form.end < form.start) return alert("Revise las fechas.");
    setSaving(true);
    const { error } = await supabase.from("community_challenges").insert({ title: form.title.trim(), kind: form.kind, target: Number(form.target), start_date: form.start, end_date: form.end });
    setSaving(false);
    if (error) return alert("No se pudo crear el reto.");
    setForm(null);
    await load();
    onChange?.();
  };

  const remove = async (c) => {
    if (!confirm(`¿Eliminar el reto «${c.title}»?`)) return;
    const { error } = await supabase.from("community_challenges").delete().eq("id", c.id);
    if (error) return alert("No se pudo eliminar.");
    await load();
    onChange?.();
  };

  const field = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent";

  if (missing) return <p className="text-warning text-sm bg-card rounded-xl p-4">Falta correr el SQL de la comunidad en Supabase.</p>;

  return (
    <div className="bg-card rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-ink text-sm font-medium flex items-center gap-1.5"><Trophy size={15} className="text-accent" /> Mis retos grupales</p>
        {!form && (
          <button onClick={() => setForm({ title: "", kind: "entrenos", target: "", start: localDateString(), end: endOfMonth() })} className="bg-accent text-app text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5">
            <Plus size={13} /> Nuevo reto
          </button>
        )}
      </div>
      {form && (
        <div className="bg-deep border border-field rounded-xl p-3 mb-3 grid grid-cols-2 gap-2">
          <input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: 300 entrenamientos en diciembre" className={`${field} col-span-2`} />
          <label className="block"><span className="text-muted text-[11px]">Qué se cuenta</span>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full">
              <option value="entrenos">Entrenamientos (días entrenados)</option>
              <option value="series">Series registradas</option>
            </Select>
          </label>
          <label className="block"><span className="text-muted text-[11px]">Meta entre todos</span>
            <input inputMode="numeric" value={form.target} onChange={(e) => setForm({ ...form, target: cleanInt(e.target.value).slice(0, 6) })} placeholder="300" className={field} />
          </label>
          <label className="block"><span className="text-muted text-[11px]">Desde</span><input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={field} /></label>
          <label className="block"><span className="text-muted text-[11px]">Hasta</span><input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={field} /></label>
          <div className="col-span-2 flex gap-2">
            <button onClick={save} disabled={saving} className="bg-accent text-app text-xs font-semibold rounded-lg px-4 py-2 disabled:opacity-60">{saving ? "Guardando..." : "Crear reto"}</button>
            <button onClick={() => setForm(null)} className="text-soft text-xs px-3">Cancelar</button>
          </div>
        </div>
      )}
      {list === null ? null : list.length === 0 ? (
        <p className="text-muted text-xs">Todavía no hay retos. Un reto es una meta común: todos suman, usted también.</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink truncate">{c.title} <span className="text-muted">· meta {c.target} {c.kind === "series" ? "series" : "entrenamientos"} · {c.start_date} → {c.end_date}</span></span>
              <button onClick={() => remove(c)} aria-label="Eliminar reto" className="text-soft hover:text-danger shrink-0"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
