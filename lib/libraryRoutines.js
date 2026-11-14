// Rutinas de la biblioteca: deja afuera las rutinas privadas de un alumno (bloques rápidos de "Extras").
// Si la columna student_id todavía no existe en la base, trae todas como antes.
export async function libraryRoutines(supabase, fields, build = (q) => q) {
  const res = await build(supabase.from("routines").select(fields).is("student_id", null));
  if (res.error && /student_id/.test(res.error.message || "")) return build(supabase.from("routines").select(fields));
  return res;
}
