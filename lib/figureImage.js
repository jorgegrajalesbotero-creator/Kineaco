// Convierte la figura del cuerpo (SVG) en una imagen JPEG para ponerla en el PDF
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { BodyFigure } from "@/components/ui/BodyFigure";

const BG = "#0f1512"; // fondo oscuro de la app, para que la figura se vea igual que en pantalla

export async function bodyFigureJpeg(props, { width = 720, height = 940 } = {}) {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement(BodyFigure, props)));
  const svg = host.querySelector("svg");
  if (!svg) {
    root.unmount();
    return null;
  }
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("font-family", "Helvetica, Arial, sans-serif");
  const markup = new XMLSerializer().serializeToString(svg);
  root.unmount();

  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const data = atob(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]);
    return { data, width, height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
