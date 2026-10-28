"use client";

import { useEffect, useState } from "react";
import { Copy, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { matchesSearch } from "@/lib/search";
import { supabase } from "@/lib/supabaseClient";
import { SearchInput } from "@/components/ui/Search";
import { Skeleton } from "@/components/ui/Skeleton";

export function ExercisesView() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", group: "", videoUrl: "" });
  const [editingId, setEditingId] = useState(null);
  const [exerciseSearch, setExerciseSearch] = useState("");

  async function loadExercises() {
    setLoading(true);
    const { data } = await supabase.from("exercises").select("*").order("created_at", { ascending: false });
    setExercises(data || []);
    setLoading(false);
  }

  useEffect(() => { loadExercises(); }, []);

  const saveExercise = async () => {
    if (!form.name.trim()) return alert("Escribí el nombre del ejercicio.");
    if (form.videoUrl && !/^https:\/\//i.test(form.videoUrl.trim())) return alert("El link del video debe empezar con https://");
    let error = null;
    if (editingId) {
      ({ error } = await supabase.from("exercises").update({
        name: form.name,
        muscle_group: form.group,
        video_url: form.videoUrl,
      }).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("exercises").insert({
        name: form.name,
        muscle_group: form.group,
        video_url: form.videoUrl,
      }));
    }
    if (error) return alert("No se pudo guardar el ejercicio: ");
    setEditingId(null);
    setForm({ name: "", group: "", videoUrl: "" });
    loadExercises();
  };

  const startEdit = (ex) => {
    setEditingId(ex.id);
    setForm({ name: ex.name, group: ex.muscle_group || "", videoUrl: ex.video_url || "" });
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { }
  };

  const duplicateExercise = async (ex) => {
    const { error } = await supabase.from("exercises").insert({ name: `${ex.name} (copia)`, muscle_group: ex.muscle_group, video_url: ex.video_url });
    if (error) return alert("No se pudo duplicar el ejercicio: ");
    loadExercises();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", group: "", videoUrl: "" });
  };

  const deleteExercise = async (ex) => {
    const { count } = await supabase
      .from("routine_exercises")
      .select("id", { count: "exact", head: true })
      .eq("exercise_id", ex.id);
    const usedMsg = count ? `\n\nEstá en ${count} ${count === 1 ? "lugar" : "lugares"} de tus rutinas y se va a quitar de ahí también.` : "";
    if (!confirm(`¿Eliminar el ejercicio "${ex.name}"?${usedMsg}\n\nEl historial de los alumnos se conserva.`)) return;
    const { error } = await supabase.from("exercises").delete().eq("id", ex.id);
    if (error) {
      alert(
        error.code === "23503"
          ? "No se pudo eliminar: el ejercicio todavía está conectado al historial de entrenamientos. Falta correr el SQL de arreglo en Supabase."
          : "No se pudo eliminar el ejercicio: "
      );
      return;
    }
    if (editingId === ex.id) cancelEdit();
    loadExercises();
  };

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-ink text-xl font-semibold mb-1">Catálogo de ejercicios</h2>
      <p className="text-muted text-sm mb-6">Estos ejercicios se reutilizan al armar cualquier rutina.</p>

      <div className="bg-card rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-2">
        <input placeholder="Nombre del ejercicio" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="flex-1 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
        <input placeholder="Grupo muscular" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className="md:w-40 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
        <input placeholder="Link del video" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} className="flex-1 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
        <button onClick={saveExercise} className="bg-accent text-app px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 shrink-0">
          <Plus size={15} /> {editingId ? "Guardar cambios" : "Agregar"}
        </button>
        {editingId && (
          <button onClick={cancelEdit} className="text-soft px-3 rounded-lg text-sm shrink-0">Cancelar</button>
        )}
      </div>

      <SearchInput value={exerciseSearch} onChange={setExerciseSearch} placeholder="Buscar ejercicio por nombre o grupo muscular..." className="mb-3 max-w-md" />

      <div className="bg-card rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_140px_1fr_104px] gap-2 px-4 py-2.5 text-muted text-xs border-b border-field">
          <span>Nombre</span><span>Grupo</span><span>Video</span><span></span>
        </div>
        {loading ? (
          <Skeleton />
        ) : exercises.filter((ex) => matchesSearch(exerciseSearch, ex.name, ex.muscle_group)).length === 0 ? (
          <p className="text-muted text-sm px-4 py-4">{exerciseSearch ? `No hay ejercicios que coincidan con "${exerciseSearch}".` : "Todavía no hay ejercicios."}</p>
        ) : exercises.filter((ex) => matchesSearch(exerciseSearch, ex.name, ex.muscle_group)).map((ex) => (
          <div key={ex.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_140px_1fr_104px] gap-2 px-4 py-3 items-center border-b border-field last:border-0">
            <span className="text-ink text-sm min-w-0">
              {ex.name}
              <span className="md:hidden block text-muted text-xs">{ex.muscle_group || "Sin grupo"} · {ex.video_url ? "Con video" : "Sin video"}</span>
            </span>
            <span className="hidden md:block text-soft text-xs">{ex.muscle_group}</span>
            {ex.video_url ? <span className="hidden md:flex text-accent text-xs items-center gap-1 truncate min-w-0"><Play size={11} /> <span className="truncate">{ex.video_url}</span></span> : <span className="hidden md:block text-muted text-xs italic">Sin video</span>}
            <div className="flex gap-1 md:gap-2 justify-end">
              <button onClick={() => startEdit(ex)} aria-label="Editar" className="text-muted hover:text-accent p-2 md:p-1"><Pencil size={14} /></button>
              <button onClick={() => duplicateExercise(ex)} aria-label="Duplicar" className="text-muted hover:text-ink p-2 md:p-1"><Copy size={14} /></button>
              <button onClick={() => deleteExercise(ex)} aria-label="Eliminar" className="text-muted hover:text-danger p-2 md:p-1"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
