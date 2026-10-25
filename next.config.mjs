/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// Dirección del proyecto de Supabase (la única "otra página" con la que habla la app)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

// Política de contenido: el navegador solo carga scripts, imágenes y conexiones
// desde la propia app y desde Supabase. Bloquea código inyectado desde otros sitios.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}${isDev ? " ws: wss:" : ""}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Nadie puede meter la app dentro de otra página (evita trampas de "clickjacking")
  { key: "X-Frame-Options", value: "DENY" },
  // El navegador no adivina tipos de archivo
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No se le cuenta a otros sitios desde qué página de la app se llegó
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La app solo puede usar la cámara/galería para fotos; nada de micrófono ni ubicación
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Obliga a usar siempre https una vez publicada
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig = {
  // Permite abrir la app en modo desarrollo desde otros dispositivos de la misma red Wi-Fi
  // (por ejemplo, el celular entrando a http://192.168.x.x:3000). No afecta la app publicada.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Oculta el botón "N" de Next.js que aparece abajo a la izquierda mientras se programa.
  devIndicators: false,
  // No anunciar qué tecnología usa el servidor
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
