// Rutinas de la biblioteca: deja afuera las rutinas privadas de un alumno (bloques rápidos de "Extras")
// y las versiones anteriores ("archivadas"): cuando el coach cambia una rutina que ya tienen alumnos,
// ellos siguen con la versión que tenían y la biblioteca muestra la nueva.
// withArchived = true trae también las versiones anteriores (con archived_at), para mostrar el nombre
// de las que ya están asignadas; los selectores igual deben ocultarlas.
// Si las columnas todavía no existen en la base, trae todas como antes.
export async function libraryRoutines(supabase, fields, build = (q) => q, { withArchived = false } = {}) {
  const sel = withArchived ? `${fields}, archived_at` : fields;
  let q = supabase.from("routines").select(sel).is("student_id", null);
  if (!withArchived) q = q.is("archived_at", null);
  const res = await build(q);
  if (res.error && /archived_at/.test(res.error.message || "")) {
    const r2 = await build(supabase.from("routines").select(fields).is("student_id", null));
    if (!(r2.error && /student_id/.test(r2.error.message || ""))) return r2;
  }
  if (res.error && /student_id/.test(res.error.message || "")) return build(supabase.from("routines").select(fields));
  return res;
}

// Para los selectores: solo las rutinas vigentes de la biblioteca
export const activeRoutines = (list) => (list || []).filter((r) => !r.archived_at);
