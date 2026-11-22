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
const PISTA = "#25332c"; // el anillo de atrás (bg-field)
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
export function drawCard({ phase = "work", label = "", time = "", cycle = 0, cycles = 0, set = 1, sets = 1, rounds = null, onReady } = {}) {
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
    c.textAlign = "center";

    // La esfera del reloj. El anillo marca por dónde va la serie (los ciclos hechos), que es
    // lo que de verdad cambia cada vez que se vuelve a dibujar esta tarjeta.
    const cx = LADO / 2;
    const cy = 232;
    const r = 152;
    const avance = cycles > 0 && cycle > 0 ? Math.min(1, cycle / cycles) : 1;

    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.strokeStyle = PISTA;
    c.lineWidth = 28;
    c.stroke();

    c.beginPath();
    c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * avance);
    c.strokeStyle = color;
    c.lineWidth = 28;
    c.lineCap = "round";
    c.stroke();

    // El tiempo, en el centro. Es lo que DURA esta fase: no baja solo, porque repintar la
    // carátula cada segundo hace parpadear la pantalla de bloqueo. El tiempo que corre es
    // el de la barra de abajo, que el celular anima por su cuenta.
    c.textBaseline = "middle";
    c.fillStyle = BLANCO;
    c.font = "700 116px ui-rounded, \"SF Pro Rounded\", -apple-system, system-ui, sans-serif";
    c.fillText(time || "", cx, cy - 16);

    c.fillStyle = color;
    c.font = "600 36px ui-rounded, \"SF Pro Rounded\", -apple-system, system-ui, sans-serif";
    c.fillText(String(label).toUpperCase().slice(0, 20), cx, cy + 62);
    c.textBaseline = "alphabetic";

    // Debajo de la esfera: en AMRAP las rondas que lleva contadas; si no, la serie y el ciclo
    const abajo = [];
    if (rounds !== null) {
      abajo.push(`Rondas: ${rounds}`);
    } else {
      if (sets > 1) abajo.push(`Serie ${set} de ${sets}`);
      if (cycles > 0 && cycle > 0) abajo.push(`${cycle}/${cycles}`);
    }
    if (abajo.length) {
      c.fillStyle = GRIS;
      c.font = "500 38px ui-rounded, \"SF Pro Rounded\", -apple-system, system-ui, sans-serif";
      c.fillText(abajo.join(" · "), cx, 452);
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
