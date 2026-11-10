// Reconoce un enlace de YouTube y arma la dirección del reproductor incrustado.
// Nunca se incrusta el enlace tal cual (lo escribe el coach): solo se toma el
// identificador del video (11 caracteres, validado) y se construye la dirección
// del reproductor en el dominio "sin cookies" de YouTube.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PATH_KINDS = ["shorts", "embed", "live", "v"];

// Devuelve { id, vertical, embedUrl } o null si el enlace no es un video de YouTube.
// vertical: true para Shorts (se muestran en formato 9:16).
export function youtubeVideo(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id = null;
  let vertical = false;

  if (host === "youtu.be") {
    id = parts[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") {
      id = url.searchParams.get("v");
    } else if (PATH_KINDS.includes(parts[0])) {
      id = parts[1];
      vertical = parts[0] === "shorts";
    }
  }

  if (!id || !VIDEO_ID.test(id)) return null;
  return {
    id,
    vertical,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
  };
}
