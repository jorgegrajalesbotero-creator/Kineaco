// La carátula del reloj en la pantalla de bloqueo: en vez de la foto de un disco, una tarjeta
// con la fase, el ciclo y la serie, dibujada al vuelo.
//
// Se redibuja SOLO cuando cambia la fase o el ciclo, nunca por el paso del tiempo: cada vez que
// se cambia la carátula, el celular borra la que estaba y la vuelve a cargar, así que hacerlo
// cada segundo dejaría la pantalla de bloqueo parpadeando. El tiempo lo anima el celular con
// la barra de progreso (lib/clockMedia.js).

const LADO = 512;

// Los mismos colores de la app (app/globals.css)
const FONDO = "#0f1512";
const BLANCO = "#f2f5f0";
const GRIS = "#8a9690";
const COLORES = { work: "#d6ff5c", prep: "#ffb547", rest: "#5b9bff", setrest: "#5b9bff", cooldown: "#5b9bff", done: "#8a9690" };

let urlActual = null;

// Suelta la carátula anterior. Sin esto se van acumulando imágenes en memoria.
function soltar() {
  if (!urlActual) return;
  try { URL.revokeObjectURL(urlActual); } catch { }
  urlActual = null;
}

// Dibuja la tarjeta y devuelve su dirección, o null si el navegador no puede (en el servidor,
// o si algo falla): en ese caso la tarjeta sale con el icono de la app, como antes.
export function drawCard({ phase = "work", label = "", cycle = 0, cycles = 0, set = 1, sets = 1, onReady } = {}) {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = LADO;
    canvas.height = LADO;
    const c = canvas.getContext("2d");
    if (!c) return null;
    const color = COLORES[phase] || COLORES.work;

    c.fillStyle = FONDO;
    c.fillRect(0, 0, LADO, LADO);

    // Marco con el color de la fase: se reconoce de lejos sin leer nada
    c.strokeStyle = color;
    c.lineWidth = 10;
    c.strokeRect(5, 5, LADO - 10, LADO - 10);

    c.textAlign = "center";

    // La fase, arriba
    c.fillStyle = color;
    c.font = "600 46px system-ui, -apple-system, sans-serif";
    c.fillText(String(label).toUpperCase().slice(0, 22), LADO / 2, 130);

    // El ciclo, en grande
    if (cycles > 0 && cycle > 0) {
      c.fillStyle = BLANCO;
      c.font = "700 190px system-ui, -apple-system, sans-serif";
      c.fillText(`${cycle}/${cycles}`, LADO / 2, 300);
    }

    // La serie, debajo
    if (sets > 1) {
      c.fillStyle = GRIS;
      c.font = "500 40px system-ui, -apple-system, sans-serif";
      c.fillText(`Serie ${set} de ${sets}`, LADO / 2, 372);
    }

    // Puntos: los ciclos ya hechos de esta serie
    if (cycles > 0 && cycles <= 20) {
      const r = 11;
      const paso = r * 3;
      const ancho = (cycles - 1) * paso;
      const y = 440;
      for (let i = 1; i <= cycles; i++) {
        const x = LADO / 2 - ancho / 2 + (i - 1) * paso;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        if (i <= cycle) {
          c.fillStyle = color;
          c.fill();
        } else {
          c.strokeStyle = GRIS;
          c.lineWidth = 3;
          c.stroke();
        }
      }
    }

    // toBlob es asíncrono: se avisa por onReady cuando la imagen está lista
    canvas.toBlob((blob) => {
      if (!blob) return;
      soltar();
      urlActual = URL.createObjectURL(blob);
      onReady?.(urlActual);
    }, "image/png");
    return urlActual;
  } catch {
    return null;
  }
}

export function clearCard() {
  soltar();
}
