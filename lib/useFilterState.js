"use client";

import { useEffect, useState } from "react";
import { activeFilterCount } from "@/lib/filters";

// Estado de búsqueda + filtros + orden de una vista.
// Los chips marcados y el orden se recuerdan en ESTE navegador (localStorage)
// para no perderlos al cambiar de pestaña. El texto de búsqueda no se guarda,
// así al volver la lista no aparece "vacía" por una búsqueda olvidada.
export function useFilterState(storageKey, defaultSort = "") {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [sort, setSort] = useState(defaultSort);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved === "object") {
        if (saved.sel && typeof saved.sel === "object") setSelected(saved.sel);
        if (typeof saved.sort === "string" && saved.sort) setSort(saved.sort);
      }
    } catch { }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sel: selected, sort }));
    } catch { }
  }, [ready, storageKey, selected, sort]);

  const toggle = (facetId, value) =>
    setSelected((s) => {
      const cur = s[facetId] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...s, [facetId]: next };
    });

  const clear = () => {
    setQuery("");
    setSelected({});
  };

  return {
    query,
    setQuery,
    selected,
    toggle,
    sort,
    setSort,
    clear,
    chipCount: activeFilterCount(selected),
  };
}
