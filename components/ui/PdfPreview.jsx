"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, X } from "lucide-react";
import { downloadBlob } from "@/lib/pdf";

const plain = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? "").toString()) : text);
const MAX_PIXEL_RATIO = 2; // nitidez suficiente sin gastar memoria de más en celulares

// pdf.js (el lector de PDF) solo se descarga la primera vez que alguien abre una vista previa.
// Se usa la versión "legacy" para que también funcione en celulares con navegadores viejos.
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs")
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
        return pdfjs;
      })
      .catch((error) => {
        pdfjsPromise = null; // permite volver a intentar
        throw error;
      });
  }
  return pdfjsPromise;
}

// Vista previa de un PDF generado en la app, antes de descargarlo.
// file: { blob, filename } · t: traductor (pantallas del alumno).
export function PdfPreview({ file, onClose, t = plain }) {
  const pagesRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | rendering | ready | error
  const [progress, setProgress] = useState({ page: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    let task = null;
    const box = pagesRef.current;

    async function render() {
      try {
        const pdfjs = await loadPdfjs();
        const data = new Uint8Array(await file.blob.arrayBuffer());
        task = pdfjs.getDocument({ data });
        const doc = await task.promise;
        if (cancelled) return;
        setStatus("rendering");
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        // Las páginas se dibujan una por una y van apareciendo a medida que están listas
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (box.clientWidth / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block w-full h-auto rounded-lg bg-white shadow-lg animate-fade-in";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${n} / ${doc.numPages}`);
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
          box.appendChild(canvas);
          setProgress({ page: n, total: doc.numPages });
        }
        setStatus("ready");
      } catch {
        // Si este dispositivo no puede dibujar el PDF, igual se puede descargar
        if (!cancelled) setStatus("error");
      }
    }
    render();

    return () => {
      cancelled = true;
      task?.destroy();
      box?.replaceChildren();
    };
  }, [file]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-label={t("Vista previa del PDF")}
        className="relative flex flex-col w-full md:max-w-3xl h-[94dvh] md:h-[90dvh] bg-deep border border-field rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden animate-panel-in"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-field">
          <FileText size={18} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-ink text-sm font-semibold truncate">{file.filename}</p>
            <p className="text-muted text-[11px]">
              {status === "loading" && t("Preparando la vista previa...")}
              {status === "rendering" && t("Página {p0} de {p1}", { p0: progress.page, p1: progress.total })}
              {status === "ready" && (progress.total === 1 ? t("1 página") : t("{p0} páginas", { p0: progress.total }))}
              {status === "error" && t("Vista previa no disponible")}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("Cerrar")} className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-field active:scale-90 transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-night px-3 py-3 md:px-6 md:py-5">
          {status === "loading" && (
            <div className="w-full aspect-[210/297] rounded-lg bg-gradient-to-r from-card via-field/70 to-card bg-[length:200%_100%] animate-shimmer" />
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center animate-fade-up">
              <span className="w-12 h-12 rounded-full bg-field flex items-center justify-center text-soft"><FileText size={20} /></span>
              <p className="text-soft text-sm">{t("No se pudo mostrar la vista previa en este dispositivo. El PDF está listo: puede descargarlo.")}</p>
            </div>
          )}
          <div ref={pagesRef} className={`mx-auto w-full max-w-2xl space-y-3 ${status === "error" ? "hidden" : ""}`} />
        </div>

        <div className="flex gap-2 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 border-t border-field">
          <button type="button" onClick={onClose} className="flex-1 bg-field text-soft hover:text-ink text-sm font-medium rounded-xl py-3 active:scale-[0.98] transition">
            {t("Cerrar")}
          </button>
          <button
            type="button"
            onClick={() => downloadBlob(file.blob, file.filename)}
            className="flex-1 flex items-center justify-center gap-2 bg-accent text-app text-sm font-semibold rounded-xl py-3 active:scale-[0.98] transition-transform"
          >
            <Download size={16} /> {t("Descargar")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// const [showPdf, pdfPreview] = usePdfPreview(tr);
// showPdf(await buildRoutinePdf(...)) abre la vista previa; {pdfPreview} va en el JSX.
export function usePdfPreview(t) {
  const [file, setFile] = useState(null);
  const preview = file ? <PdfPreview file={file} onClose={() => setFile(null)} t={t} /> : null;
  return [setFile, preview];
}
