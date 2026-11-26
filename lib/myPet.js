import { useSyncExternalStore } from "react";
import { PET_ITEMS } from "@/lib/petItems";

// Lo que tiene puesto la mascota del alumno que está usando la app. Un solo lugar para que el
// camaleón salga vestido en todas partes (inicio, check-in, check-out, al terminar, acompañando).
// Se guarda también en el teléfono para que salga vestido desde el primer momento, antes de
// que responda la base. Es solo para mostrar: la base valida lo que de verdad se puede poner.
let uid = null;
let current = null;
const subs = new Set();

const keyOf = (id) => `pet_outfit_${id}`;
// Solo prendas que existen y en su lugar (lo guardado en el teléfono no es de fiar)
const valid = (o) => {
  const out = {};
  Object.entries(o || {}).forEach(([slot, key]) => { if (PET_ITEMS.some((i) => i.key === key && i.slot === slot)) out[slot] = key; });
  return out;
};
const emit = () => subs.forEach((f) => f());

// Al saber quién entró: carga lo último que tenía puesto en este teléfono
export function startMyOutfit(userId) {
  if (uid === userId) return;
  uid = userId || null;
  let saved = null;
  if (uid) { try { saved = JSON.parse(localStorage.getItem(keyOf(uid)) || "null"); } catch { saved = null; } }
  current = saved && typeof saved === "object" ? valid(saved) : null;
  emit();
}

export function setMyOutfit(outfit) {
  current = outfit && typeof outfit === "object" ? valid(outfit) : null;
  if (uid) { try { localStorage.setItem(keyOf(uid), JSON.stringify(current || {})); } catch { } }
  emit();
}

export function stopMyOutfit() {
  uid = null;
  current = null;
  emit();
}

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export function useMyOutfit() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
