// Supabase devuelve como máximo 1000 filas por consulta. Esta función pide
// de a 1000 hasta traer todas. Uso: fetchAllRows(() => supabase.from("tabla").select(...).eq(...).order(...))
export async function fetchAllRows(buildQuery) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error || !data) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
