import { describe, it, expect } from "vitest";
import { createPdf } from "@/lib/pdf";

// La vista previa dibuja los PDF con pdf.js: aquí se comprueba que pdf.js entiende
// los PDF que arma la app (se escriben a mano en lib/pdf.js, sin librería).
describe("vista previa de PDF", () => {
  it("pdf.js lee un PDF generado por la app, con todas sus páginas y su texto", async () => {
    const doc = createPdf();
    doc.text("Rutina de prueba: sentadilla, peso muerto y dominadas", doc.margin, doc.y, { size: 14, bold: true });
    doc.newPage();
    doc.text("Segunda página — acentos: áéíóú ñ", doc.margin, doc.y, { size: 11 });
    const blob = doc.toBlob();
    expect(blob.type).toBe("application/pdf");

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    const pdf = await task.promise;
    expect(pdf.numPages).toBe(2);

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    expect(Math.round(viewport.width)).toBe(595);
    expect(Math.round(viewport.height)).toBe(842);

    const first = (await page.getTextContent()).items.map((i) => i.str).join(" ");
    expect(first).toContain("sentadilla");
    const second = (await (await pdf.getPage(2)).getTextContent()).items.map((i) => i.str).join(" ");
    expect(second).toContain("áéíóú ñ");
    // Dibujar la página pasa por interpretar todas sus instrucciones
    const ops = await page.getOperatorList();
    expect(ops.fnArray.length).toBeGreaterThan(0);
    await task.destroy();
  });
});
