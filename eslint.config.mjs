import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Reglas de React 19 / Next 16 desactivadas de forma consciente porque marcan
    // patrones que en esta app son intencionales (no son bugs). Decisión documentada
    // en la auditoría; revisar si cambia la arquitectura.
    rules: {
      // Patrón "cargar datos al montar": useEffect(() => { cargar(); }, []).
      // Es un uso legítimo de data-fetching; reescribirlo no aporta valor y añade riesgo.
      "react-hooks/set-state-in-effect": "off",

      // `window.location.href = "/login"` en guards de acceso y logout: la recarga
      // completa es DELIBERADA para limpiar el estado de React y el cliente de Supabase
      // en memoria (privacidad/seguridad). router.push dejaría datos del usuario anterior.
      "@next/next/no-location-assign-relative-destination": "off",
      // Esta regla se dispara sobre la misma asignación a window.location de arriba.
      "react-hooks/immutability": "off",

      // `<img>` para imágenes dinámicas de usuario (avatares y fotos de progreso con
      // URLs firmadas de Supabase y blobs locales). next/image exigiría remotePatterns
      // y dimensiones fijas, y no encaja con blobs; aquí <img> es lo correcto.
      "@next/next/no-img-element": "off",

      // Dependencias de hooks: se mantiene como aviso (no bloquea), varias omisiones
      // son intencionales y están comentadas en el propio código.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);

export default eslintConfig;
