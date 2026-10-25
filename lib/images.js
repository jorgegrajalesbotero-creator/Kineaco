// Herramientas para fotos: se achican en el navegador antes de subirlas
// (ahorra espacio en Supabase y hace la subida más rápida).

// Devuelve un JPEG con el lado más largo de máximo `maxSide` píxeles
export async function shrinkImage(file, maxSide = 1200, quality = 0.82) {
  let img = null;
  try {
    img = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("formato"));
      i.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Foto de perfil: más chica
export function shrinkAvatar(file) {
  return shrinkImage(file, 512, 0.85);
}
