// Generador de PDF muy simple (sin librerías): páginas A4, texto Helvetica / Helvetica-Bold,
// rectángulos y líneas. Suficiente para exportar planes y rutinas como documento.

const W = 595.28;
const H = 841.89;

// Anchos de Helvetica y Helvetica-Bold (métricas estándar AFM, en milésimas del tamaño), caracteres 32 a 126
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

// Caracteres especiales de WinAnsiEncoding
const WIN = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99 };

function charCode(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return c;
  if (c >= 160 && c <= 255) return c;
  if (WIN[ch] != null) return WIN[ch];
  if (c === 9) return 32;
  return 63; // "?"
}

function charWidth(ch, bold) {
  const c = ch.charCodeAt(0);
  const table = bold ? HELVB : HELV;
  if (c >= 32 && c <= 126) return table[c - 32];
  const base = ch.normalize("NFD")[0];
  const b = base.charCodeAt(0);
  if (b >= 32 && b <= 126) return table[b - 32];
  if (ch === "•") return 350;
  if (ch === "—") return 1000;
  if (ch === "–" || ch === "…") return bold ? 556 : 556;
  return 556;
}

export function textWidth(str, size, bold = false) {
  let w = 0;
  for (const ch of String(str)) w += charWidth(ch, bold);
  return (w * size) / 1000;
}

function pdfString(str) {
  let out = "(";
  for (const ch of String(str)) {
    const code = charCode(ch);
    if (code === 40 || code === 41 || code === 92) out += "\\" + String.fromCharCode(code);
    else if (code > 126) out += "\\" + code.toString(8).padStart(3, "0");
    else out += String.fromCharCode(code);
  }
  return out + ")";
}

const rgb = (c) => c.map((v) => (Math.round(v * 1000) / 1000).toString()).join(" ");

export function createPdf({ margin = 42 } = {}) {
  const pages = [];
  const images = []; // { name, data (texto binario JPEG), w, h }
  let ops = null;

  const doc = {
    width: W,
    height: H,
    margin,
    contentWidth: W - margin * 2,
    y: margin,
    pageCount: () => pages.length,
    newPage() {
      ops = [];
      pages.push(ops);
      doc.y = margin;
    },
    // ¿Cabe un alto h en lo que queda de página? Si no, pasa a una nueva
    ensure(h) {
      if (!ops || doc.y + h > H - margin) doc.newPage();
    },
    text(str, x, y, { size = 10, bold = false, color = [0.1, 0.1, 0.1] } = {}) {
      ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${(H - y - size * 0.8).toFixed(2)} Td ${pdfString(str)} Tj ET`);
    },
    rect(x, y, w, h, color) {
      ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    },
    line(x1, y1, x2, y2, color = [0.85, 0.85, 0.85], width = 0.6) {
      ops.push(`${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`);
    },
    roundRect(x, y, w, h, r, color) {
      const k = 0.5523 * r, top = H - y, bot = H - y - h;
      ops.push(`${rgb(color)} rg ${x + r} ${top} m ${x + w - r} ${top} l ${x + w - r + k} ${top} ${x + w} ${top - r + k} ${x + w} ${top - r} c ${x + w} ${bot + r} l ${x + w} ${bot + r - k} ${x + w - r + k} ${bot} ${x + w - r} ${bot} c ${x + r} ${bot} l ${x + r - k} ${bot} ${x} ${bot + r - k} ${x} ${bot + r} c ${x} ${top - r} l ${x} ${top - r + k} ${x + r - k} ${top} ${x + r} ${top} c f`);
    },
    // Línea quebrada (para gráficas): puntos [[x, y], ...] en coordenadas de la página (y hacia abajo)
    polyline(points, color, width = 1.4) {
      if (points.length < 2) return;
      const path = points.map(([x, y], i) => `${x.toFixed(2)} ${(H - y).toFixed(2)} ${i ? "l" : "m"}`).join(" ");
      ops.push(`${rgb(color)} RG ${width} w 1 J 1 j ${path} S`);
    },
    circle(x, y, r, color) {
      const k = 0.5523 * r, cy = H - y;
      ops.push(`${rgb(color)} rg ${x + r} ${cy} m ${x + r} ${cy + k} ${x + k} ${cy + r} ${x} ${cy + r} c ${x - k} ${cy + r} ${x - r} ${cy + k} ${x - r} ${cy} c ${x - r} ${cy - k} ${x - k} ${cy - r} ${x} ${cy - r} c ${x + k} ${cy - r} ${x + r} ${cy - k} ${x + r} ${cy} c f`);
    },
    // Imagen JPEG (texto binario, por ejemplo de atob) dibujada en x, y con ancho w y alto h
    image(data, pxW, pxH, x, y, w, h) {
      const name = `Im${images.length + 1}`;
      images.push({ name, data, w: pxW, h: pxH });
      ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(H - y - h).toFixed(2)} cm /${name} Do Q`);
    },
    // Parte un texto en líneas que caben en maxW
    wrap(str, maxW, size, bold = false) {
      const words = String(str).split(/\s+/).filter(Boolean);
      const lines = [];
      let cur = "";
      for (const word of words) {
        const next = cur ? `${cur} ${word}` : word;
        if (textWidth(next, size, bold) <= maxW || !cur) cur = next;
        else {
          lines.push(cur);
          cur = word;
        }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    },
    // Párrafo que fluye hacia abajo (y salta de página si hace falta)
    paragraph(str, { x = margin, maxW = W - margin * 2 - (x - margin), size = 10, bold = false, color, lineGap = 1.35, after = 0 } = {}) {
      const lines = doc.wrap(str, maxW, size, bold);
      for (const l of lines) {
        doc.ensure(size * lineGap);
        doc.text(l, x, doc.y, { size, bold, color });
        doc.y += size * lineGap;
      }
      doc.y += after;
    },
    // Arma el archivo PDF
    toBlob() {
      const objs = [];
      const add = (s) => {
        objs.push(s);
        return objs.length;
      };
      const catalogId = add(null);
      const pagesId = add(null);
      const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
      const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
      const imgRefs = images.map((im) => `/${im.name} ${add(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n${im.data}\nendstream`)} 0 R`).join(" ");
      const pageIds = [];
      const total = pages.length;
      pages.forEach((p, i) => {
        // Número de página al pie
        const footer = `BT /F1 8 Tf 0.55 0.55 0.55 rg ${(W - margin - 40).toFixed(2)} ${(margin / 2).toFixed(2)} Td ${pdfString(`${i + 1} / ${total}`)} Tj ET`;
        const stream = [...p, footer].join("\n");
        const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
        pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${imgRefs ? ` /XObject << ${imgRefs} >>` : ""} >> /Contents ${contentId} 0 R >>`));
      });
      objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
      objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

      let out = "%PDF-1.4\n";
      const offsets = [];
      objs.forEach((o, i) => {
        offsets.push(out.length);
        out += `${i + 1} 0 obj\n${o}\nendobj\n`;
      });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
      offsets.forEach((off) => { out += `${String(off).padStart(10, "0")} 00000 n \n`; });
      out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
      // Cada carácter es un byte: el texto va en ASCII (acentos como \ooo) y las imágenes como texto binario
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
      return new Blob([bytes], { type: "application/pdf" });
    },
  };
  doc.newPage();
  return doc;
}

// Descarga el PDF con un nombre de archivo
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const safeFileName = (s) =>
  String(s || "documento")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "documento";
