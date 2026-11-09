import { describe, it, expect } from "vitest";
import {
  EMPTY,
  facetKey,
  splitList,
  prettyLabel,
  itemKeys,
  buildFacetOptions,
  filterItems,
  sortItems,
  activeFilterCount,
  accessBucket,
  seniorityBucket,
  durationSince,
} from "@/lib/filters";
import { matchesSearch } from "@/lib/search";

// Datos parecidos a los reales: grupos con espacios sobrantes y listas con comas.
const EXERCISES = [
  { id: 1, name: "Sentadilla", muscle_group: "Cuadriceps, gluteo", video_url: "https://x" },
  { id: 2, name: "Hip thrust", muscle_group: "Gluteo", video_url: "" },
  { id: 3, name: "Remo", muscle_group: "Dorsal ancho ", video_url: null },
  { id: 4, name: "Jalón", muscle_group: "Dorsal ancho", video_url: "https://y" },
  { id: 5, name: "Plancha", muscle_group: null, video_url: null },
  { id: 6, name: "Burpee", muscle_group: "", video_url: null },
];

const GROUP = { id: "grupo", label: "Grupo", getValues: (e) => e.muscle_group, split: true, emptyLabel: "Sin grupo" };
const VIDEO = {
  id: "video",
  label: "Video",
  getValues: (e) => (e.video_url ? "con" : "sin"),
  options: [{ value: "con", label: "Con video" }, { value: "sin", label: "Sin video" }],
};

describe("normalización de valores", () => {
  it("une variantes con tilde, mayúsculas y espacios", () => {
    expect(facetKey("Musculación ")).toBe(facetKey("musculacion"));
    expect(facetKey("  Dorsal   ancho ")).toBe("dorsal ancho");
  });

  it("separa listas por comas", () => {
    expect(splitList("Gluteo, abdomen, paravertebrales")).toEqual(["Gluteo", "abdomen", "paravertebrales"]);
    expect(splitList(null)).toEqual([]);
  });

  it("arma etiquetas legibles", () => {
    expect(prettyLabel("avanzado")).toBe("Avanzado");
    expect(prettyLabel("  isquiosurales  ")).toBe("Isquiosurales");
  });

  it("los ítems sin valor caen en 'vacío' solo si la categoría lo pide", () => {
    expect(itemKeys(GROUP, EXERCISES[4])).toEqual([EMPTY]);
    expect(itemKeys(GROUP, EXERCISES[5])).toEqual([EMPTY]);
    expect(itemKeys({ ...GROUP, emptyLabel: undefined }, EXERCISES[4])).toEqual([]);
  });

  it("un ejercicio con varios grupos aparece en cada uno", () => {
    expect(itemKeys(GROUP, EXERCISES[0])).toEqual(["cuadriceps", "gluteo"]);
  });
});

describe("opciones de cada categoría", () => {
  it("cuenta, une variantes y deja 'Sin grupo' al final", () => {
    const opts = buildFacetOptions(EXERCISES, EXERCISES, GROUP);
    const byValue = Object.fromEntries(opts.map((o) => [o.value, o]));
    expect(byValue["dorsal ancho"].count).toBe(2); // "Dorsal ancho " + "Dorsal ancho"
    expect(byValue["gluteo"].count).toBe(2);
    expect(byValue[EMPTY]).toMatchObject({ label: "Sin grupo", count: 2 });
    expect(opts[opts.length - 1].value).toBe(EMPTY);
  });

  it("respeta el orden de las categorías fijas", () => {
    const opts = buildFacetOptions(EXERCISES, EXERCISES, VIDEO);
    expect(opts.map((o) => o.label)).toEqual(["Con video", "Sin video"]);
    expect(opts.map((o) => o.count)).toEqual([2, 4]);
  });

  it("conserva una opción marcada aunque ya no tenga resultados", () => {
    const opts = buildFacetOptions(EXERCISES, [], GROUP, ["gluteo"]);
    const glute = opts.find((o) => o.value === "gluteo");
    expect(glute).toMatchObject({ label: "Gluteo", count: 0 });
  });
});

describe("aplicar filtros", () => {
  it("dentro de una categoría suma (O)", () => {
    const { result } = filterItems({ items: EXERCISES, facets: [GROUP], selected: { grupo: ["gluteo", "dorsal ancho"] } });
    expect(result.map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });

  it("entre categorías combina (Y)", () => {
    const { result } = filterItems({
      items: EXERCISES,
      facets: [GROUP, VIDEO],
      selected: { grupo: ["gluteo", "dorsal ancho"], video: ["con"] },
    });
    expect(result.map((e) => e.id)).toEqual([1, 4]);
  });

  it("se combina con la búsqueda de texto", () => {
    const { result } = filterItems({
      items: EXERCISES,
      facets: [GROUP],
      selected: { grupo: ["dorsal ancho"] },
      matches: (e) => matchesSearch("jalon", e.name),
    });
    expect(result.map((e) => e.id)).toEqual([4]);
  });

  it("los conteos de una categoría consideran las demás, no la propia", () => {
    const { facetOptions } = filterItems({ items: EXERCISES, facets: [GROUP, VIDEO], selected: { video: ["con"] } });
    const group = facetOptions.find((f) => f.id === "grupo").options;
    const video = facetOptions.find((f) => f.id === "video").options;
    expect(group.find((o) => o.value === "dorsal ancho").count).toBe(1); // solo "Jalón" tiene video
    expect(video.find((o) => o.value === "sin").count).toBe(4); // la propia categoría no se filtra a sí misma
  });

  it("sin filtros devuelve todo", () => {
    expect(filterItems({ items: EXERCISES, facets: [GROUP, VIDEO] }).result).toHaveLength(6);
    expect(activeFilterCount({ grupo: ["a", "b"], video: [] })).toBe(2);
  });
});

describe("orden", () => {
  const SORTS = [
    { id: "az", label: "A-Z", compare: (a, b) => a.name.localeCompare(b.name) },
    { id: "id", label: "Id", compare: (a, b) => b.id - a.id },
  ];
  it("ordena por el criterio elegido sin modificar el original", () => {
    const sorted = sortItems(EXERCISES, SORTS, "az");
    expect(sorted[0].name).toBe("Burpee");
    expect(EXERCISES[0].name).toBe("Sentadilla");
  });
  it("si el criterio no existe usa el primero", () => {
    expect(sortItems(EXERCISES, SORTS, "nada")[0].name).toBe("Burpee");
  });
});

describe("clasificadores de tiempo", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const daysFromNow = (d) => new Date(now.getTime() + d * 86400000).toISOString();

  it("tiempo de acceso restante", () => {
    expect(accessBucket(null, now)).toBe("sin");
    expect(accessBucket(daysFromNow(-1), now)).toBe("vencido");
    expect(accessBucket(daysFromNow(3), now)).toBe("vence7");
    expect(accessBucket(daysFromNow(7), now)).toBe("vence7");
    expect(accessBucket(daysFromNow(20), now)).toBe("vence30");
    expect(accessBucket(daysFromNow(400), now)).toBe("mas30");
  });

  it("antigüedad", () => {
    expect(seniorityBucket(null, now)).toBe(null);
    expect(seniorityBucket(daysFromNow(-10), now)).toBe("m1");
    expect(seniorityBucket(daysFromNow(-45), now)).toBe("m3");
    expect(seniorityBucket(daysFromNow(-120), now)).toBe("m6");
    expect(seniorityBucket(daysFromNow(-400), now)).toBe("mas6");
  });

  it("texto corto de antigüedad", () => {
    expect(durationSince(daysFromNow(-1), now)).toBe("1 día");
    expect(durationSince(daysFromNow(-21), now)).toBe("3 semanas");
    expect(durationSince(daysFromNow(-100), now)).toBe("3 meses");
    expect(durationSince(daysFromNow(-400), now)).toBe("1 año");
  });
});
