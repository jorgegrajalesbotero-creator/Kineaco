import { supabase } from "@/lib/supabaseClient";

// Manejo de avatares con el bucket privado (SEG-A2).
// Guardamos la RUTA del archivo en profiles.avatar_url y firmamos la URL
// al mostrarla. Es compatible con las URLs públicas antiguas ya guardadas.

export const AVATAR_BUCKET = "avatars";

// La ruta del avatar de un usuario (una sola foto por usuario).
export function avatarPath(userId) {
  return `${userId}/avatar.jpg`;
}

// Saca la ruta dentro del bucket a partir del valor guardado, que puede ser:
//   · una ruta ya ("<uid>/avatar.jpg"), o
//   · una URL pública antigua (".../object/public/avatars/<uid>/avatar.jpg?t=...").
function pathFromValue(value) {
  if (!value) return "";
  if (!/^https?:/i.test(value)) return value.split("?")[0];
  const m = value.match(/\/avatars\/([^?]+)/);
  return m ? m[1] : "";
}

// Devuelve una URL firmada mostrable (o "" si no hay avatar).
// Caducidad larga (8 h) para cubrir una sesión sin que desaparezca la foto.
export async function signedAvatarUrl(value) {
  const path = pathFromValue(value);
  if (!path) return "";
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60 * 8);
  if (error || !data?.signedUrl) return "";
  return data.signedUrl;
}
