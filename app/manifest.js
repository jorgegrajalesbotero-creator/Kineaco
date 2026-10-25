// Datos para que la app se pueda instalar en el celular ("Agregar a pantalla de inicio").
// Next.js lo publica solo en /manifest.webmanifest.
export default function manifest() {
  return {
    name: "Kineaco",
    short_name: "Kineaco",
    description: "Movimiento con conciencia, con su coach",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0F1512",
    theme_color: "#0F1512",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
