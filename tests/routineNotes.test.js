import { describe, it, expect } from "vitest";
import { ROUTINE_NOTE_INDEX, notesFor } from "@/lib/routineNotes";

// Comentarios que el coach deja a UN alumno y que pisan los de la rutina.
const filas = [
  { routine_id: "rut-1", block_index: 0, note: "Baje el ritmo en este bloque" },
  { routine_id: "rut-1", block_index: 2, note: "   " },
  { routine_id: "rut-1", block_index: ROUTINE_NOTE_INDEX, note: "Hoy enfóquese en la técnica" },
  { routine_id: "rut-2", block_index: 0, note: "De otra rutina" },
];

describe("notesFor", () => {
  it("devuelve las notas de esa rutina, por posición del bloque", () => {
    const n = notesFor(filas, "rut-1");
    expect(n[0]).toBe("Baje el ritmo en este bloque");
    expect(n[ROUTINE_NOTE_INDEX]).toBe("Hoy enfóquese en la técnica");
  });

  it("no mezcla las notas de otra rutina", () => {
    expect(notesFor(filas, "rut-1")[0]).not.toBe("De otra rutina");
    expect(notesFor(filas, "rut-2")[0]).toBe("De otra rutina");
  });

  it("una nota en blanco es como no tener nota, así vuelve la de la rutina", () => {
    expect(notesFor(filas, "rut-1")[2]).toBeUndefined();
  });

  it("el bloque sin nota del alumno no aparece: se queda con la de la rutina", () => {
    expect(notesFor(filas, "rut-1")[1]).toBeUndefined();
  });

  it("recorta los espacios de alrededor", () => {
    expect(notesFor([{ routine_id: "r", block_index: 0, note: "  hola  " }], "r")[0]).toBe("hola");
  });

  it("sin filas no se cae", () => {
    expect(notesFor(null, "r")).toEqual({});
    expect(notesFor([], "r")).toEqual({});
  });

  it("el comentario del día usa la posición -1, la misma convención que el reloj de la rutina", () => {
    expect(ROUTINE_NOTE_INDEX).toBe(-1);
  });
});
