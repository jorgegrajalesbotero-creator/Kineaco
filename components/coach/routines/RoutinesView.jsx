"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollMemory } from "@/lib/useScrollMemory";
import { Check, ChevronDown, ChevronRight, Clock, Copy, Download, GitMerge, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { matchesSearch } from "@/lib/search";
import { filterItems, sortItems } from "@/lib/filters";
import { useFilterState } from "@/lib/useFilterState";
import { fetchAllRows } from "@/lib/fetchAll";
import { supabase } from "@/lib/supabaseClient";
import { libraryRoutines } from "@/lib/libraryRoutines";
import { buildRoutinePdf } from "@/lib/planPdf";
import { usePdfPreview } from "@/components/ui/PdfPreview";
import { BlockEditor } from "@/components/coach/routines/BlockEditor";
import { autoRoutineTitle, catalogOptions, loadRoutineContent, mergeRoutineContent, switchRoutineMode, writeRoutineContent } from "@/components/coach/routines/routineHelpers";
import { ExerciseItemEditor } from "@/components/coach/routines/ExerciseItemEditor";
import { AssignRoutineModal } from "@/components/coach/routines/AssignRoutineModal";
import { RoutineModeToggle } from "@/components/coach/routines/RoutineModeToggle";
import { RoutineTimerField } from "@/components/coach/routines/RoutineTimerField";
import { SearchSelect } from "@/components/ui/Search";
import { DragHandle, SortableList, SortableRow, arrayMove, keyOf } from "@/components/ui/Sortable";
import { useUndo } from "@/components/ui/UndoToast";
import { ActionCard, InlineRename } from "@/components/ui/ActionCard";
import { useBackClose } from "@/lib/backStack";
import { FilterBar } from "@/components/ui/FilterBar";
import { Select } from "@/components/ui/Select";
import { WeightInput } from "@/components/ui/WeightInput";
import { formatWeight, useWeightUnit } from "@/lib/weightUnits";

const ROUTINE_SORTS = [
  { id: "recientes", label: "Más recientes", compare: (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) },
  { id: "az", label: "Nombre (A-Z)", compare: (a, b) => (a.title || "").localeCompare(b.title || "") },
  { id: "ejercicios", label: "Más ejercicios", compare: (a, b) => (b.routine_exercises?.length || 0) - (a.routine_exercises?.length || 0) },
];

// Categorías de filtro de rutinas. assignedIds: rutinas usadas por algún alumno
// (asignación fija o día de un plan).
function routineFacets(assignedIds) {
  return [
    { id: "nivel", label: "Nivel", getValues: (r) => r.level },
    { id: "objetivo", label: "Objetivo", getValues: (r) => r.goal, emptyLabel: "Sin objetivo" },
    {
      id: "asignacion",
      label: "Asignación",
      getValues: (r) => (assignedIds.has(r.id) ? "asignada" : "libre"),
      options: [{ value: "asignada", label: "Asignada a alumnos" }, { value: "libre", label: "Sin asignar" }],
    },
    {
      id: "formato",
      label: "Formato",
      getValues: (r) => (r.routine_blocks?.length ? "bloques" : "lista"),
      options: [{ value: "bloques", label: "Por bloques" }, { value: "lista", label: "Lista simple" }],
    },
  ];
}

// Lista simple de ejercicios: cada uno se puede editar (tocando el nombre), mover arrastrando desde ⋮⋮
// (o con las flechas ↑ ↓ en la agarradera) o quitar. "Elegir varios" permite duplicar o quitar varios juntos.
function ListItems({ items, setItems, catalog }) {
  const [editing, setEditing] = useState(null);
  const [picked, setPicked] = useState(null); // null = modo normal; Set de índices = eligiendo varios
  const [unit] = useWeightUnit();
  const { offer, toast } = useUndo();
  const ids = items.map(keyOf);
  const moveTo = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems(arrayMove(items, from, to));
    setEditing(null);
  };
  const removeAt = (set, label) => {
    const prev = items;
    setItems(items.filter((_, j) => !set.has(j)));
    setEditing(null);
    setPicked(null);
    offer(label, () => setItems(prev));
  };
  const duplicateSet = (set) => {
    const out = [];
    items.forEach((x, j) => { out.push(x); if (set.has(j)) out.push({ ...x, itemKey: null }); });
    setItems(out);
    setPicked(null);
  };
  const toggle = (i) => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <div className="mb-3">
      {items.length > 1 && (
        <div className="flex items-center justify-end gap-2 mb-1.5 text-xs">
          {picked ? (
            <>
              <span className="text-muted mr-auto">{picked.size} elegidos</span>
              <button type="button" disabled={!picked.size} onClick={() => duplicateSet(picked)} className="flex items-center gap-1 text-soft hover:text-accent disabled:opacity-40"><Copy size={12} /> Duplicar</button>
              <button type="button" disabled={!picked.size} onClick={() => removeAt(picked, picked.size === 1 ? "Se quitó 1 ejercicio" : `Se quitaron ${picked.size} ejercicios`)} className="flex items-center gap-1 text-soft hover:text-danger disabled:opacity-40"><Trash2 size={12} /> Quitar</button>
              <button type="button" onClick={() => setPicked(null)} className="text-muted hover:text-ink">Listo</button>
            </>
          ) : (
            <button type="button" onClick={() => { setPicked(new Set()); setEditing(null); }} className="text-muted hover:text-accent">Elegir varios</button>
          )}
        </div>
      )}
      <SortableList ids={ids} onMove={moveTo} className="space-y-2">
        {items.map((ex, i) => (
          <SortableRow key={ids[i]} id={ids[i]} disabled={editing === i || !!picked}>{(handle) =>
            editing === i ? (
              <ExerciseItemEditor
                item={ex}
                catalog={catalog}
                showSets
                onSave={(patch) => { setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x))); setEditing(null); }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className={`flex items-center gap-2 bg-card rounded-lg px-3 py-2.5 ${picked?.has(i) ? "ring-1 ring-accent/60" : ""}`}>
                {picked ? (
                  <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} aria-label={`Elegir ${ex.name}`} className="w-4 h-4 accent-[var(--color-accent)] shrink-0" />
                ) : (
                  <DragHandle {...handle} onKeyMove={(dir) => moveTo(i, i + dir)} />
                )}
                <button type="button" onClick={() => (picked ? toggle(i) : setEditing(i))} className="text-ink text-sm flex-1 min-w-0 truncate text-left hover:text-accent">{ex.name}</button>
                <span className="text-muted text-xs shrink-0">
                  {[ex.sets && ex.sets !== "0" ? `${ex.sets}×${ex.reps || "—"}` : ex.reps, formatWeight(ex.targetWeight, unit)].filter(Boolean).join(" · ")}
                </span>
                {!picked && <button type="button" onClick={() => removeAt(new Set([i]), `Se quitó ${ex.name}`)} className="text-muted hover:text-danger px-1" aria-label="Quitar ejercicio"><X size={14} /></button>}
              </div>
            )
          }</SortableRow>
        ))}
      </SortableList>
      {toast}
    </div>
  );
}

export function RoutinesView({ initialOpenId = null, onInitialOpenDone } = {}) {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const filters = useFilterState("kineaco:filtros:rutinas", "recientes");
  const [assignedIds, setAssignedIds] = useState(() => new Set());
  const [usersByRoutine, setUsersByRoutine] = useState({});
  const [saveChoice, setSaveChoice] = useState(null); // { count } cuando la rutina editada ya la tienen alumnos
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", level: "Principiante", goal: "", duration: "" });
  const [draftExercises, setDraftExercises] = useState([]);
  const [exForm, setExForm] = useState({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  const [saving, setSaving] = useState(false);
  const [draftMode, setDraftMode] = useState("lista");
  const [draftBlocks, setDraftBlocks] = useState([]);
  const [editMode, setEditMode] = useState("lista");
  const [editBlocks, setEditBlocks] = useState([]);

  const [viewingId, setViewingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: "", level: "Principiante", goal: "", duration: "" });
  const [draftTimer, setDraftTimer] = useState(null); // reloj de la rutina en "lista simple"
  const [editTimer, setEditTimer] = useState(null);
  const [editExercises, setEditExercises] = useState([]);
  const [editExForm, setEditExForm] = useState({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeId, setMergeId] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergedFrom, setMergedFrom] = useState([]); // rutinas ya fusionadas en esta edición
  const [deleteMerged, setDeleteMerged] = useState(false);
  const [busyId, setBusyId] = useState(null); // rutina de la lista en la que se está trabajando (duplicar/PDF/eliminar)
  const [assignRoutine, setAssignRoutine] = useState(null); // rutina que se está asignando a un alumno
  const [selectMode, setSelectMode] = useState(false); // modo "marcar varias"
  const [selected, setSelected] = useState([]); // ids marcados
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [peek, setPeek] = useState(() => new Set()); // tarjetas con la vista rápida de ejercicios abierta
  const [renameKey, setRenameKey] = useState({}); // { rutina: n } para abrir el cambio de nombre desde el menú
  const togglePeek = (id) => setPeek((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const renameRoutine = async (r, title) => {
    const { error } = await supabase.from("routines").update({ title }).eq("id", r.id);
    if (error) { alert("No se pudo cambiar el nombre."); return false; }
    setRoutines((list) => list.map((x) => (x.id === r.id ? { ...x, title } : x)));
    return true;
  };

  async function loadRoutines() {
    setLoading(true);
    const { data: routinesData } = await libraryRoutines(supabase, "*, routine_exercises(id, order_index, exercises(name)), routine_blocks(id)", (q) =>
      q.order("created_at", { ascending: false }));
    setRoutines(routinesData || []);
    setLoading(false);
  }

  // Rutinas que usa algún alumno: asignación fija, día de un plan o extra. usersByRoutine = { rutina: Set(alumnos) }
  async function loadAssigned() {
    const [fixed, planDays, extras] = await Promise.all([
      fetchAllRows(() => supabase.from("routine_assignments").select("routine_id, user_id").order("id")),
      fetchAllRows(() => supabase.from("training_plan_days").select("routine_id, training_plans(user_id)").order("id")),
      fetchAllRows(() => supabase.from("student_extras").select("routine_id, user_id").order("id")).catch(() => []),
    ]);
    const map = {};
    const ids = new Set();
    const add = (rid, uid) => {
      if (!rid) return;
      ids.add(rid);
      (map[rid] = map[rid] || new Set()).add(uid || "?");
    };
    fixed.forEach((r) => add(r.routine_id, r.user_id));
    planDays.forEach((r) => add(r.routine_id, r.training_plans?.user_id));
    (extras || []).forEach((r) => add(r.routine_id, r.user_id));
    setUsersByRoutine(map);
    setAssignedIds(ids);
  }

  async function loadCatalog() {
    const { data } = await supabase.from("exercises").select("id, name, muscle_group").order("name");
    setCatalog(data || []);
  }

  useEffect(() => { loadRoutines(); loadCatalog(); loadAssigned(); }, []);

  // Llegó desde el buscador general: abre esa rutina apenas cargue la lista
  useEffect(() => {
    if (!initialOpenId || loading) return;
    const r = routines.find((x) => x.id === initialOpenId);
    if (r) openDetail(r);
    onInitialOpenDone?.();
  }, [initialOpenId, loading]);

  const createExercise = async (name, group) => {
    const { data, error } = await supabase
      .from("exercises")
      .insert({ name: name.trim(), muscle_group: group?.trim() || null, video_url: null })
      .select("id, name, muscle_group")
      .single();
    if (error || !data) {
      alert("No se pudo crear el ejercicio.");
      return null;
    }
    setCatalog((c) => [...c, data].sort((x, y) => x.name.localeCompare(y.name)));
    return data;
  };

  const addExerciseToDraft = async () => {
    let chosen = null;
    if (exForm.exerciseId === "__new__") {
      if (!exForm.newName?.trim()) {
        alert("Escriba el nombre del ejercicio nuevo.");
        return;
      }
      chosen = await createExercise(exForm.newName, exForm.newGroup);
      if (!chosen) return;
    } else {
      if (!exForm.exerciseId) {
        alert("Elija un ejercicio de la lista o la opción \"+ Crear ejercicio nuevo\".");
        return;
      }
      chosen = catalog.find((c) => c.id === exForm.exerciseId);
      if (!chosen) return;
    }
    setDraftExercises((d) => [...d, { exerciseId: chosen.id, name: chosen.name, sets: exForm.sets, reps: exForm.reps, targetWeight: exForm.targetWeight, restMinutes: exForm.restMinutes }]);
    setExForm({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  };

  const saveRoutine = async () => {
    setSaving(true);
    const routineTitle = draft.title.trim() || autoRoutineTitle();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: newRoutine, error: routineError } = await supabase
      .from("routines")
      .insert({
        title: routineTitle,
        level: draft.level.toLowerCase(),
        goal: draft.goal,
        duration_minutes: Number(draft.duration) || 0,
        created_by: user?.id,
      })
      .select()
      .single();

    if (routineError || !newRoutine) {
      alert("Error al guardar la rutina.");
      setSaving(false);
      return;
    }

    const contentError = await writeRoutineContent(newRoutine.id, draftMode, draftExercises, draftBlocks, { timer: draftTimer });
    if (contentError) {
      alert("La rutina se creó, pero hubo un error al guardar sus ejercicios: " + (contentError.message || ""));
    }

    setDraft({ title: "", level: "Principiante", goal: "", duration: "" });
    setDraftTimer(null);
    setDraftExercises([]);
    setDraftBlocks([]);
    setDraftMode("lista");
    setCreating(false);
    setSaving(false);
    loadRoutines();
  };

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Principiante");

  const openDetail = async (routine) => {
    setViewingId(routine.id);
    setEditDraft({
      title: routine.title || "",
      level: capitalize(routine.level),
      goal: routine.goal || "",
      duration: String(routine.duration_minutes ?? ""),
    });

    const content = await loadRoutineContent(routine.id);
    setEditMode(content.mode);
    setEditBlocks(content.blocks);
    setEditExercises(content.list);
    setEditTimer(content.timer || null);
    setAutoState("");
    setBaseline((n) => n + 1); // lo que se acaba de cargar es el punto de partida del guardado automático
  };

  const closeDetail = () => {
    setBase(null);
    setAutoState("");
    setViewingId(null);
    setEditExercises([]);
    setEditBlocks([]);
    setEditMode("lista");
    setEditTimer(null);
    setEditExForm({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
    setMergeOpen(false);
    setMergeId("");
    setMergedFrom([]);
    setDeleteMerged(false);
  };

  // ---- Guardado automático (rutinas que no tiene ningún alumno) ----
  // Si la rutina ya la tienen alumnos, se sigue guardando con el botón: hay que elegir si el cambio es para ellos.
  const [autoState, setAutoState] = useState(""); // "" | "pendiente" | "guardando" | "guardado" | "error" | "manual"
  const [baseline, setBaseline] = useState(0);
  const [recheck, setRecheck] = useState(0);
  const [base, setBase] = useState(null); // cómo estaba la rutina la última vez que se guardó
  const autoBusy = useRef(false);
  const editSnap = viewingId ? JSON.stringify({ d: editDraft, m: editMode, l: editExercises, b: editBlocks, t: editTimer }) : "";
  const editShared = !!viewingId && (usersByRoutine[viewingId]?.size || 0) > 0;
  const editDirty = !!viewingId && base != null && editSnap !== base;
  const autoOn = !editShared && mergedFrom.length === 0;
  useEffect(() => { if (viewingId) setBase(editSnap); }, [baseline]);
  useEffect(() => {
    if (!viewingId || base == null || editSnap === base) return undefined;
    if (editShared || mergedFrom.length > 0) { setAutoState("manual"); return undefined; }
    setAutoState("pendiente");
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [editSnap, recheck]);

  async function autoSave() {
    if (autoBusy.current || !viewingId) return;
    autoBusy.current = true;
    setAutoState("guardando");
    // Los ejercicios nuevos reciben su clave fija aquí, así no cambia en cada guardado
    const key = (arr) => (arr || []).map((e) => (e.itemKey ? e : { ...e, itemKey: crypto.randomUUID() }));
    const needs = editExercises.some((e) => !e.itemKey) || editBlocks.some((b) => (b.exercises || []).some((e) => !e.itemKey));
    const list = needs ? key(editExercises) : editExercises;
    const blocks = needs ? editBlocks.map((b) => ({ ...b, exercises: key(b.exercises) })) : editBlocks;
    const draft = editDraft;
    const snap = JSON.stringify({ d: draft, m: editMode, l: list, b: blocks, t: editTimer });
    const row = { title: draft.title.trim() || autoRoutineTitle(), level: draft.level.toLowerCase(), goal: draft.goal, duration_minutes: Number(draft.duration) || 0 };
    const { error } = await supabase.from("routines").update(row).eq("id", viewingId);
    const contentError = error ? null : await writeRoutineContent(viewingId, editMode, list, blocks, { timer: editTimer });
    autoBusy.current = false;
    if (error || contentError) { setAutoState("error"); return; }
    if (needs) { setEditExercises(list); setEditBlocks(blocks); }
    setBase(snap);
    setAutoState("guardado");
    setRoutines((rs) => rs.map((r) => (r.id === viewingId ? { ...r, ...row } : r)));
    setRecheck((n) => n + 1); // por si cambió algo mientras se guardaba
  }

  // Salir de la rutina: si hay algo pendiente se guarda antes; si se guarda con botón y hay cambios, avisa
  const finishDetail = () => {
    if (editDirty && !autoOn && !confirm("Tiene cambios sin guardar en esta rutina. ¿Salir sin guardar?")) return false;
    const pending = editDirty && autoOn;
    const go = () => { closeDetail(); loadRoutines(); };
    if (pending) autoSave().then(go);
    else go();
    return true;
  };
  useBackClose(!!viewingId, finishDetail); // "atrás" del celular
  useBackClose(creating, () => setCreating(false));

  // Trae los ejercicios de otra rutina al final de esta (queda en pantalla; se guarda con "Guardar cambios")
  const mergeRoutine = async () => {
    const other = routines.find((r) => r.id === mergeId);
    if (!other) return alert("Elegí la rutina que querés fusionar con esta.");
    setMergeBusy(true);
    const otherContent = await loadRoutineContent(other.id);
    setMergeBusy(false);
    if (otherContent.list.length === 0 && otherContent.blocks.every((b) => b.exercises.length === 0)) {
      return alert("Esa rutina no tiene ejercicios.");
    }
    const merged = mergeRoutineContent({ mode: editMode, list: editExercises, blocks: editBlocks }, otherContent);
    setEditMode(merged.mode);
    setEditExercises(merged.list);
    setEditBlocks(merged.blocks);
    setMergedFrom((m) => [...m, { id: other.id, title: other.title }]);
    setMergeId("");
    setMergeOpen(false);
  };

  const addExerciseToEdit = async () => {
    let chosen = null;
    if (editExForm.exerciseId === "__new__") {
      if (!editExForm.newName?.trim()) {
        alert("Escriba el nombre del ejercicio nuevo.");
        return;
      }
      chosen = await createExercise(editExForm.newName, editExForm.newGroup);
      if (!chosen) return;
    } else {
      if (!editExForm.exerciseId) {
        alert("Elija un ejercicio de la lista o la opción \"+ Crear ejercicio nuevo\".");
        return;
      }
      chosen = catalog.find((c) => c.id === editExForm.exerciseId);
      if (!chosen) return;
    }
    setEditExercises((d) => [...d, { exerciseId: chosen.id, name: chosen.name, sets: editExForm.sets, reps: editExForm.reps, targetWeight: editExForm.targetWeight, restMinutes: editExForm.restMinutes }]);
    setEditExForm({ exerciseId: "", sets: "", reps: "", targetWeight: "", restMinutes: "" });
  };

  // Guardar cambios: si la rutina ya la tienen alumnos, se pregunta si el cambio es para ellos o solo para la biblioteca
  const saveEdit = async () => {
    if (!viewingId) return;
    const count = usersByRoutine[viewingId]?.size || 0;
    if (count > 0) return setSaveChoice({ count });
    return saveEditForAll();
  };

  // Solo para la biblioteca: se crea una versión nueva con los cambios y la anterior queda archivada,
  // así los alumnos que ya la tenían siguen igual (con su planeación, cargas, observaciones e historial).
  // Los programas automáticos pasan a usar la versión nueva.
  const saveEditAsNewVersion = async () => {
    setSaveChoice(null);
    setSavingEdit(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: nr, error } = await supabase
      .from("routines")
      .insert({
        title: editDraft.title.trim() || autoRoutineTitle(),
        level: editDraft.level.toLowerCase(),
        goal: editDraft.goal,
        duration_minutes: Number(editDraft.duration) || 0,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error || !nr) {
      setSavingEdit(false);
      return alert("No se pudo guardar la nueva versión de la rutina.");
    }
    const strip = (arr) => arr.map((e) => ({ ...e, itemKey: null }));
    const contentError = await writeRoutineContent(nr.id, editMode, strip(editExercises), editBlocks.map((b) => ({ ...b, exercises: strip(b.exercises || []) })), { timer: editTimer });
    if (contentError) {
      await supabase.from("routines").delete().eq("id", nr.id);
      setSavingEdit(false);
      return alert("Error al guardar los ejercicios de la rutina: " + (contentError.message || ""));
    }
    const { error: archErr } = await supabase.from("routines").update({ archived_at: new Date().toISOString() }).eq("id", viewingId);
    if (archErr) {
      await supabase.from("routines").delete().eq("id", nr.id);
      setSavingEdit(false);
      return alert("No se pudo guardar como versión nueva. Revisá que el SQL «versiones de rutinas» esté aplicado en Supabase.");
    }
    await supabase.from("program_days").update({ routine_id: nr.id }).eq("routine_id", viewingId);
    if (deleteMerged && mergedFrom.length > 0) {
      const ids = mergedFrom.map((m) => m.id).filter((id) => id !== viewingId);
      const { error: delErr } = await supabase.from("routines").delete().in("id", ids);
      if (delErr) alert("La rutina se guardó, pero no se pudieron eliminar las rutinas fusionadas: ");
    }
    setSavingEdit(false);
    closeDetail();
    loadRoutines();
    loadAssigned();
  };

  // Para todos: cambia la rutina original (también para los alumnos que la tienen)
  const saveEditForAll = async () => {
    setSaveChoice(null);
    setSavingEdit(true);

    const { error: updateError } = await supabase
      .from("routines")
      .update({
        title: editDraft.title.trim() || autoRoutineTitle(),
        level: editDraft.level.toLowerCase(),
        goal: editDraft.goal,
        duration_minutes: Number(editDraft.duration) || 0,
      })
      .eq("id", viewingId);

    if (updateError) {
      alert("Error al actualizar la rutina: ");
      setSavingEdit(false);
      return;
    }

    const contentError = await writeRoutineContent(viewingId, editMode, editExercises, editBlocks, { timer: editTimer });
    if (contentError) {
      alert("Error al guardar los ejercicios de la rutina: " + (contentError.message || ""));
      setSavingEdit(false);
      return;
    }

    if (deleteMerged && mergedFrom.length > 0) {
      const ids = mergedFrom.map((m) => m.id).filter((id) => id !== viewingId);
      const { error: delErr } = await supabase.from("routines").delete().in("id", ids);
      if (delErr) alert("La rutina se guardó, pero no se pudieron eliminar las rutinas fusionadas: ");
    }

    setSavingEdit(false);
    closeDetail();
    loadRoutines();
  };

  const deleteRoutine = async () => {
    if (!viewingId) return;
    if (!confirm("¿Seguro que querés eliminar esta rutina? También se va a quitar de los alumnos y programas que la tengan. El historial de entrenamientos de los alumnos se conserva.")) return;
    setDeleting(true);

    // Los ejercicios, bloques, asignaciones y días de programa se borran solos (ON DELETE CASCADE).
    // El historial de los alumnos se conserva (progress.routine_id queda vacío).
    const { error } = await supabase.from("routines").delete().eq("id", viewingId);

    setDeleting(false);
    if (error) {
      alert(
        error.code === "23503"
          ? "No se pudo eliminar: la rutina todavía está conectada al historial de entrenamientos. Falta correr el SQL de arreglo en Supabase."
          : "No se pudo eliminar la rutina: "
      );
      return;
    }
    closeDetail();
    loadRoutines();
  };

  // Eliminar una rutina directo desde la lista (sin abrirla)
  const deleteFromList = async (r) => {
    if (!confirm(`¿Eliminar la rutina "${r.title}"? También se quita de los alumnos y programas que la tengan. El historial de entrenamientos se conserva.`)) return;
    setBusyId(r.id);
    const { error } = await supabase.from("routines").delete().eq("id", r.id);
    setBusyId(null);
    if (error) {
      alert(
        error.code === "23503"
          ? "No se pudo eliminar: la rutina todavía está conectada al historial de entrenamientos. Falta correr el SQL de arreglo en Supabase."
          : "No se pudo eliminar la rutina: "
      );
      return;
    }
    setSelected((s) => s.filter((id) => id !== r.id));
    loadRoutines();
  };

  // Duplicar una rutina (copia el título, los datos, los bloques y los ejercicios)
  const duplicateRoutine = async (r) => {
    setBusyId(r.id);
    const { data: { user } } = await supabase.auth.getUser();
    const content = await loadRoutineContent(r.id);
    const { data: nr, error } = await supabase
      .from("routines")
      .insert({ title: `${r.title} (copia)`, level: r.level, goal: r.goal, duration_minutes: r.duration_minutes || 0, created_by: user?.id })
      .select("id")
      .single();
    if (error || !nr) {
      setBusyId(null);
      return alert("No se pudo duplicar la rutina.");
    }
    const strip = (arr) => arr.map((e) => ({ ...e, itemKey: null }));
    const list = strip(content.list);
    const blocks = content.blocks.map((b) => ({ ...b, exercises: strip(b.exercises) }));
    const cErr = await writeRoutineContent(nr.id, content.mode, list, blocks, { timer: content.timer });
    setBusyId(null);
    if (cErr) alert("La copia se creó, pero hubo un error al copiar sus ejercicios: " + (cErr.message || ""));
    loadRoutines();
  };

  // PDF de una rutina desde la lista: primero la vista previa, y desde ahí se descarga
  const [showPdf, pdfPreview] = usePdfPreview();
  const pdfFromList = async (r) => {
    setBusyId(r.id);
    try {
      showPdf(await buildRoutinePdf({ supabase, routineIds: [r.id] }));
    } catch {
      alert("No se pudo generar el PDF: ");
    }
    setBusyId(null);
  };

  const toggleSelected = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const exitSelectMode = () => { setSelectMode(false); setSelected([]); };

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`¿Eliminar ${selected.length} ${selected.length === 1 ? "rutina" : "rutinas"}? También se quitan de los alumnos y programas que las tengan. El historial se conserva.`)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from("routines").delete().in("id", selected);
    setBulkDeleting(false);
    if (error) {
      alert(
        error.code === "23503"
          ? "No se pudieron eliminar: alguna todavía está conectada al historial. Falta correr el SQL de arreglo en Supabase."
          : "No se pudieron eliminar: "
      );
      return;
    }
    exitSelectMode();
    loadRoutines();
  };

  // Al volver de crear/editar una rutina, la lista queda donde estaba
  useScrollMemory(!!creating || !!viewingId);

  if (creating) {
    return (
      <div className="p-4 md:p-8 max-w-2xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-ink text-xl font-semibold">Nueva rutina</h2>
          <button onClick={() => setCreating(false)} className="text-muted"><X size={20} /></button>
        </div>

        <div className="bg-card rounded-xl p-5 mb-4 space-y-3">
          <div>
            <p className="text-muted text-xs mb-1">Título de la rutina (opcional)</p>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Si lo deja vacío, se nombra con la fecha" className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-muted text-xs mb-1">Nivel</p>
              <Select aria-label="Nivel" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} className="w-full">
                <option>Principiante</option>
                <option>Intermedio</option>
                <option>Avanzado</option>
              </Select>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Objetivo</p>
              <input value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} placeholder="Fuerza, cardio..." className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Duración (min)</p>
              <input type="number" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
          </div>
        </div>

        <p className="text-muted text-xs uppercase tracking-wider mb-2">Ejercicios de esta rutina</p>
        <RoutineModeToggle
          mode={draftMode}
          onChange={(m) => switchRoutineMode(m, draftMode, setDraftMode, draftExercises, setDraftExercises, draftBlocks, setDraftBlocks)}
        />
        {draftMode === "bloques" ? (
          <BlockEditor blocks={draftBlocks} setBlocks={setDraftBlocks} catalog={catalog} onCreateExercise={createExercise} />
        ) : (
          <>
            <ListItems items={draftExercises} setItems={setDraftExercises} catalog={catalog} />
            <RoutineTimerField value={draftTimer} onChange={setDraftTimer} />

            <div className="bg-card rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SearchSelect
                  className="col-span-2"
                  options={catalogOptions(catalog)}
                  value={exForm.exerciseId}
                  topOption={{ value: "__new__", label: "+ Crear ejercicio nuevo" }}
                  placeholder="Buscar ejercicio del catálogo..."
                  onChange={(id, typed) => setExForm((f) => (id === "__new__" ? { ...f, exerciseId: id, newName: f.newName || typed || "" } : { ...f, exerciseId: id }))}
                />
                {exForm.exerciseId === "__new__" && (
                  <>
                    <input autoFocus placeholder="Nombre del ejercicio nuevo" value={exForm.newName || ""} onChange={(e) => setExForm({ ...exForm, newName: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                    <input placeholder="Grupo muscular (opcional)" value={exForm.newGroup || ""} onChange={(e) => setExForm({ ...exForm, newGroup: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                  </>
                )}
                <input placeholder="Series" value={exForm.sets} onChange={(e) => setExForm({ ...exForm, sets: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <input placeholder="Reps" value={exForm.reps} onChange={(e) => setExForm({ ...exForm, reps: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <WeightInput placeholder="Peso sugerido - opcional" valueKg={exForm.targetWeight} onChangeKg={(kg) => setExForm({ ...exForm, targetWeight: kg })} wrapperClassName="col-span-2 mt-2" className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" /><input placeholder="Descanso (min) - opcional" value={exForm.restMinutes} onChange={(e) => setExForm({ ...exForm, restMinutes: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none mt-2" />
              </div>
              <button onClick={addExerciseToDraft} className="mt-2 bg-field text-accent px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Plus size={15} /> Agregar a la rutina</button>
              {catalog.length === 0 && <p className="text-muted text-xs italic mt-2">Todavía no hay ejercicios en tu catálogo — cargalos primero en la pestaña &quot;Ejercicios&quot;.</p>}
            </div>
          </>
        )}

        <button onClick={saveRoutine} disabled={saving} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-60">
          {saving ? "Guardando..." : "Guardar rutina"}
        </button>
      </div>
    );
  }

  if (viewingId) {
    return (
      <div className="p-4 md:p-8 max-w-2xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="min-w-0">
            <h2 className="text-ink text-xl font-semibold">Editar rutina</h2>
            <AutoSaveStatus state={editShared ? "manual" : mergedFrom.length > 0 ? "fusion" : autoState} />
          </div>
          <button onClick={finishDetail} aria-label="Cerrar" className="text-muted"><X size={20} /></button>
        </div>

        <div className="bg-card rounded-xl p-5 mb-4 space-y-3">
          <div>
            <p className="text-muted text-xs mb-1">Título de la rutina (opcional)</p>
            <input value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-muted text-xs mb-1">Nivel</p>
              <Select aria-label="Nivel" value={editDraft.level} onChange={(e) => setEditDraft({ ...editDraft, level: e.target.value })} className="w-full">
                <option>Principiante</option>
                <option>Intermedio</option>
                <option>Avanzado</option>
              </Select>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Objetivo</p>
              <input value={editDraft.goal} onChange={(e) => setEditDraft({ ...editDraft, goal: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Duración (min)</p>
              <input type="number" value={editDraft.duration} onChange={(e) => setEditDraft({ ...editDraft, duration: e.target.value })} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
            </div>
          </div>
        </div>

        <p className="text-muted text-xs uppercase tracking-wider mb-2">Ejercicios de esta rutina</p>
        <RoutineModeToggle
          mode={editMode}
          onChange={(m) => switchRoutineMode(m, editMode, setEditMode, editExercises, setEditExercises, editBlocks, setEditBlocks)}
        />
        {editMode === "bloques" ? (
          <BlockEditor blocks={editBlocks} setBlocks={setEditBlocks} catalog={catalog} onCreateExercise={createExercise} />
        ) : (
          <>
            <ListItems items={editExercises} setItems={setEditExercises} catalog={catalog} />
            <RoutineTimerField value={editTimer} onChange={setEditTimer} />
            {editExercises.length === 0 && <p className="text-muted text-xs italic mb-3">Todavía no hay ejercicios en esta rutina.</p>}

            <div className="bg-card rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SearchSelect
                  className="col-span-2"
                  options={catalogOptions(catalog)}
                  value={editExForm.exerciseId}
                  topOption={{ value: "__new__", label: "+ Crear ejercicio nuevo" }}
                  placeholder="Buscar ejercicio del catálogo..."
                  onChange={(id, typed) => setEditExForm((f) => (id === "__new__" ? { ...f, exerciseId: id, newName: f.newName || typed || "" } : { ...f, exerciseId: id }))}
                />
                {editExForm.exerciseId === "__new__" && (
                  <>
                    <input autoFocus placeholder="Nombre del ejercicio nuevo" value={editExForm.newName || ""} onChange={(e) => setEditExForm({ ...editExForm, newName: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                    <input placeholder="Grupo muscular (opcional)" value={editExForm.newGroup || ""} onChange={(e) => setEditExForm({ ...editExForm, newGroup: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                  </>
                )}
                <input placeholder="Series" value={editExForm.sets} onChange={(e) => setEditExForm({ ...editExForm, sets: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <input placeholder="Reps" value={editExForm.reps} onChange={(e) => setEditExForm({ ...editExForm, reps: e.target.value })} className="bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" />
                <WeightInput placeholder="Peso sugerido - opcional" valueKg={editExForm.targetWeight} onChangeKg={(kg) => setEditExForm({ ...editExForm, targetWeight: kg })} wrapperClassName="col-span-2 mt-2" className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none" /><input placeholder="Descanso (min) - opcional" value={editExForm.restMinutes} onChange={(e) => setEditExForm({ ...editExForm, restMinutes: e.target.value })} className="col-span-2 bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none mt-2" />
              </div>
              <button onClick={addExerciseToEdit} className="mt-2 bg-field text-accent px-4 py-2 rounded-lg text-sm flex items-center gap-1"><Plus size={15} /> Agregar a la rutina</button>
              {catalog.length === 0 && <p className="text-muted text-xs italic mt-2">Todavía no hay ejercicios en tu catálogo — cargalos primero en la pestaña &quot;Ejercicios&quot;.</p>}
            </div>
          </>
        )}

        <div className="bg-card rounded-xl p-4 mb-6">
          {!mergeOpen ? (
            <button type="button" onClick={() => setMergeOpen(true)} className="text-accent text-sm flex items-center gap-2">
              <GitMerge size={15} /> Fusionar con otra rutina
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-ink text-sm font-medium flex items-center gap-2"><GitMerge size={15} className="text-accent" /> Fusionar con otra rutina</p>
              <p className="text-muted text-xs">Los ejercicios de la rutina que elijas se agregan al final de esta. Revisá el resultado y tocá &quot;Guardar cambios&quot;.</p>
              <SearchSelect
                options={routines
                  .filter((r) => r.id !== viewingId && !mergedFrom.some((m) => m.id === r.id))
                  .map((r) => ({ value: r.id, label: r.title, sub: `${r.routine_exercises?.length || 0} ejercicios` }))}
                value={mergeId}
                onChange={(id) => setMergeId(id)}
                placeholder="Buscar rutina..."
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setMergeOpen(false); setMergeId(""); }} className="text-muted text-xs px-3 py-1.5">Cancelar</button>
                <button type="button" onClick={mergeRoutine} disabled={!mergeId || mergeBusy} className="bg-accent text-app text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {mergeBusy ? "Trayendo..." : "Fusionar"}
                </button>
              </div>
            </div>
          )}
          {mergedFrom.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <p className="text-soft text-xs mb-2">Fusionada con: {mergedFrom.map((m) => m.title).join(", ")} (todavía sin guardar)</p>
              <label className="flex items-start gap-2 text-xs text-soft cursor-pointer">
                <input type="checkbox" checked={deleteMerged} onChange={(e) => setDeleteMerged(e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
                <span>Al guardar, eliminar {mergedFrom.length === 1 ? "esa rutina" : "esas rutinas"} para que no queden repetidas. Si algún alumno o programa la tiene asignada, se le quita (el historial se conserva).</span>
              </label>
            </div>
          )}
        </div>

        {saveChoice && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setSaveChoice(null)}>
            <div className="bg-deep border border-white/[0.06] w-full max-w-md rounded-t-2xl md:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-ink text-lg font-semibold mb-1">¿Para quién es este cambio?</h3>
              <p className="text-soft text-sm mb-4">
                Esta rutina ya la {saveChoice.count === 1 ? "tiene 1 alumno" : `tienen ${saveChoice.count} alumnos`} (días, planeación o extras).
              </p>
              <button onClick={saveEditAsNewVersion} className="w-full text-left bg-accent text-app rounded-xl px-4 py-3 mb-2">
                <span className="block text-sm font-semibold">Solo para la biblioteca (recomendado)</span>
                <span className="block text-xs text-app/75">Los alumnos que ya la tienen siguen igual. Lo nuevo que asignes usa la versión cambiada.</span>
              </button>
              <button onClick={saveEditForAll} className="w-full text-left bg-card rounded-xl px-4 py-3 mb-3 border border-white/[0.06]">
                <span className="block text-ink text-sm font-semibold">También para los alumnos que la tienen</span>
                <span className="block text-xs text-soft">El cambio les llega a todos, incluida su planeación ATR.</span>
              </button>
              <button onClick={() => setSaveChoice(null)} className="w-full text-muted text-sm py-2">Cancelar</button>
              <p className="text-muted text-[11px] mt-2">Para cambiar algo a un solo alumno, usá su Planeación (quitar, sustituir o agregar ejercicios) o las observaciones de su rutina.</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          {editShared || mergedFrom.length > 0 || autoState === "error" ? (
            <button onClick={saveEdit} disabled={savingEdit} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm disabled:opacity-60">
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </button>
          ) : (
            <button onClick={finishDetail} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm">Listo</button>
          )}
          <button onClick={deleteRoutine} disabled={deleting} className="text-danger text-sm flex items-center gap-1.5 disabled:opacity-60">
            <Trash2 size={15} /> {deleting ? "Eliminando..." : "Eliminar rutina"}
          </button>
        </div>
      </div>
    );
  }

  const { result: filteredRoutines, facetOptions } = filterItems({
    items: routines,
    facets: routineFacets(assignedIds),
    selected: filters.selected,
    // También busca por los ejercicios que contiene (ej. "sentadilla")
    matches: (r) => matchesSearch(filters.query, r.title, r.level, r.goal, ...(r.routine_exercises || []).map((x) => x.exercises?.name)),
  });
  const visible = sortItems(filteredRoutines, ROUTINE_SORTS, filters.sort);
  const quickBtn = "flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 bg-field text-soft hover:text-ink disabled:opacity-40";

  return (
    <div className="p-4 md:p-8 w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h2 className="text-ink text-xl font-semibold">Rutinas</h2>
          <p className="text-muted text-sm">{loading ? "Cargando..." : `${routines.length} rutinas creadas`}</p>
        </div>
        <div className="flex items-center gap-2">
          {routines.length > 0 && (
            selectMode ? (
              <button onClick={exitSelectMode} className="text-soft text-sm px-3 py-2">Cancelar</button>
            ) : (
              <button onClick={() => setSelectMode(true)} className="bg-field text-soft text-sm font-medium px-3 py-2 rounded-lg">Seleccionar</button>
            )
          )}
          <button data-shortcut="new" title="Nueva rutina (N)" onClick={() => setCreating(true)} className="bg-accent text-app font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={16} /> Nueva rutina</button>
        </div>
      </div>

      {selectMode && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-card rounded-xl px-4 py-3 mb-4">
          <p className="text-soft text-sm">{selected.length === 0 ? "Marque las rutinas que quiere eliminar." : `${selected.length} ${selected.length === 1 ? "rutina marcada" : "rutinas marcadas"}.`}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(visible.map((r) => r.id))} className="text-accent text-xs">Marcar todas</button>
            <button onClick={bulkDelete} disabled={selected.length === 0 || bulkDeleting} className="bg-danger text-app text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5 disabled:opacity-40">
              <Trash2 size={14} /> {bulkDeleting ? "Eliminando..." : `Eliminar${selected.length ? ` (${selected.length})` : ""}`}
            </button>
          </div>
        </div>
      )}

      <FilterBar
        state={filters}
        placeholder="Buscar por nombre, nivel, objetivo o ejercicio..."
        facets={facetOptions}
        sorts={ROUTINE_SORTS}
        shown={visible.length}
        total={routines.length}
      />
      {!loading && routines.length > 0 && visible.length === 0 && (
        <p className="text-muted text-sm mb-4">No hay rutinas que coincidan con la búsqueda o los filtros.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
        {visible.map((r) => {
          const busy = busyId === r.id;
          const checked = selected.includes(r.id);
          return (
            <ActionCard
              key={r.id}
              onOpen={() => (selectMode ? toggleSelected(r.id) : openDetail(r))}
              ariaLabel={`Abrir ${r.title}`}
              actions={selectMode || busy ? [] : [
                { label: "Abrir", icon: ChevronRight, onClick: () => openDetail(r) },
                { label: "Asignar a un alumno", icon: UserPlus, onClick: () => setAssignRoutine(r) },
                { label: "Cambiar nombre", icon: Pencil, onClick: () => setRenameKey((k) => ({ ...k, [r.id]: (k[r.id] || 0) + 1 })) },
                { label: "Duplicar", icon: Copy, onClick: () => duplicateRoutine(r) },
                { label: "PDF", icon: Download, onClick: () => pdfFromList(r) },
                { label: "Eliminar", icon: Trash2, danger: true, onClick: () => deleteFromList(r) },
              ]}
              swipe={selectMode || busy ? [] : [{ label: "Duplicar", icon: Copy, onClick: () => duplicateRoutine(r) }, { label: "Eliminar", icon: Trash2, danger: true, onClick: () => deleteFromList(r) }]}
              className={`bg-card rounded-xl p-4 ${checked ? "ring-1 ring-accent" : ""}`}
            >
              <div className="flex items-start gap-3 mb-3">
                {selectMode && (
                  <span className={`w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center ${checked ? "bg-accent" : "border border-field-strong"}`}>
                    {checked && <Check size={13} strokeWidth={3} className="text-app" />}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-ink font-medium truncate">
                    {selectMode ? r.title : <InlineRename value={r.title} startKey={renameKey[r.id] || 0} onSave={(v) => renameRoutine(r, v)} />}
                  </h3>
                  <p className="text-muted text-xs mt-0.5">{r.level}{r.goal ? ` · ${r.goal}` : ""}</p>
                </div>
                <span className="flex items-center gap-1 text-muted text-xs shrink-0"><Clock size={12} /> {r.duration_minutes} min</span>
              </div>

              <div className="flex items-center justify-between gap-2 mb-3">
                {(r.routine_exercises?.length || 0) > 0 && !selectMode ? (
                  <button type="button" onClick={() => togglePeek(r.id)} aria-expanded={peek.has(r.id)} className="text-muted text-xs flex items-center gap-1 hover:text-ink">
                    {r.routine_blocks?.length ? `${r.routine_blocks.length} bloques · ` : ""}{r.routine_exercises.length} ejercicios
                    <ChevronDown size={13} className={`transition-transform ${peek.has(r.id) ? "rotate-180" : ""}`} />
                  </button>
                ) : (
                  <span className="text-muted text-xs">{r.routine_blocks?.length ? `${r.routine_blocks.length} bloques · ` : ""}{r.routine_exercises?.length || 0} ejercicios</span>
                )}
                {!selectMode && <span className="text-accent text-xs flex items-center gap-0.5 shrink-0">Abrir <ChevronRight size={13} /></span>}
              </div>

              {peek.has(r.id) && !selectMode && (
                <ol className="mb-3 bg-field/40 rounded-lg px-3 py-2 space-y-0.5 list-decimal list-inside" data-no-open>
                  {[...(r.routine_exercises || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).map((x) => (
                    <li key={x.id} className="text-soft text-xs truncate">{x.exercises?.name || "Ejercicio"}</li>
                  ))}
                </ol>
              )}

              {!selectMode && (
                <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-white/[0.05]">
                  <button onClick={() => setAssignRoutine(r)} disabled={busy} className={quickBtn}><UserPlus size={13} /> Asignar</button>
                  <button onClick={() => duplicateRoutine(r)} disabled={busy} className={quickBtn}><Copy size={13} /> Duplicar</button>
                  <button onClick={() => pdfFromList(r)} disabled={busy} className={quickBtn}><Download size={13} /> PDF</button>
                  <button onClick={() => deleteFromList(r)} disabled={busy} className={`${quickBtn} hover:text-danger ml-auto`}><Trash2 size={13} /> Eliminar</button>
                </div>
              )}
            </ActionCard>
          );
        })}
      </div>

      {assignRoutine && <AssignRoutineModal routine={assignRoutine} onClose={() => { setAssignRoutine(null); loadAssigned(); }} />}
      {pdfPreview}
    </div>
  );
}

// Estado del guardado automático de la rutina
function AutoSaveStatus({ state }) {
  if (state === "fusion") return <p className="text-warning text-xs mt-0.5">Fusionó otra rutina: revise y toque «Guardar cambios».</p>;
  if (state === "manual") return <p className="text-warning text-xs mt-0.5">Esta rutina la tienen alumnos: tus cambios se guardan con «Guardar cambios».</p>;
  if (state === "pendiente" || state === "guardando") return <p className="text-muted text-xs mt-0.5">Guardando…</p>;
  if (state === "guardado") return <p className="text-accent text-xs mt-0.5">Guardado ✓</p>;
  if (state === "error") return <p className="text-danger text-xs mt-0.5">No se pudo guardar solo. Use «Guardar cambios».</p>;
  return <p className="text-muted text-xs mt-0.5">Los cambios se guardan solos.</p>;
}
