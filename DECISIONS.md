# Decisiones técnicas (riesgos/warnings aceptados)

Registro de decisiones de arquitectura y de warnings de lint que se aceptan
a propósito. Antes de "arreglar" uno de estos avisos, lee por qué está así:
cambiarlo rompe comportamiento intencional.

## Navegación con recarga completa (no se usa `next/link` ni `useRouter`)

**Warnings relacionados:** `@next/next/no-html-link-for-pages`,
`@next/next/no-location-assign-relative-destination`.

La app es una SPA montada sobre `app/page.js` que gestiona su propio estado
interno. El cambio entre **secciones grandes o roles** se hace con **recarga
completa de página** (`<a href>` y `window.location.href`), no con navegación
cliente. Es deliberado:

- **Redirecciones de autenticación** (`location.href = "/login"` o `"/"`) tras
  login/logout: la recarga reinicia la sesión de Supabase y limpia todo el
  estado en memoria. Un `router.push` cliente dejaría estado de auth viejo.
- **Cambio de rol** coach → "Mi entrenamiento (vista de alumno)" y **volver a
  la app** desde las páginas legales (`/privacidad`, `/terminos`): la recarga
  reinicia el contexto correcto.
- Los destinos son **literales fijos** (`"/"`, `"/login"`), nunca entrada del
  usuario, así que el aviso de seguridad `no-location-assign-relative-destination`
  (pensado para open-redirects) **no aplica**.

**Decisión:** mantener la navegación con recarga completa. No migrar a
`next/link` / `useRouter`.

## Imágenes con `<img>` en vez de `next/image`

**Warning relacionado:** `@next/next/no-img-element`.

Las imágenes son avatares y fotos de progreso servidos con **URLs firmadas de
Supabase** (cambian y expiran en cada carga) y **previews locales** (`blob:`).
`next/image` encaja mal con ambos casos: reoptimizaría URLs que cambian siempre
(rompe su caché), exige configurar dominios remotos y no puede optimizar blobs.

**Decisión:** mantener `<img>`. Para optimizar la carga sin `next/image` se usa
`loading="lazy"` + `decoding="async"` en las fotos grandes (galerías de
progreso) y `decoding="async"` en los avatares.

## Warnings de `react-hooks` aceptados (carga de datos y hydration)

**Warnings relacionados:** `react-hooks/set-state-in-effect`,
`react-hooks/exhaustive-deps`.

Se analizaron uno a uno. **Ninguno es un bug real de dependencias.** Se dejan
como están porque "arreglarlos" en masa no mejora el rendimiento (son cargas
únicas al montar) e introduce riesgo de bucles de recarga. Dos patrones:

- **Carga de datos** (`useEffect(() => { loadX(); }, [])` o `[student.id]` /
  `[userId]`): el `setState` ocurre DESPUÉS del `await`, no es síncrono; no hay
  render en cascada evitable. Las dependencias están completas (o `[]` es
  intencional para cargar solo al montar). Es el patrón idiomático de fetch con
  Supabase sin librería de data-fetching.
- **Idioma / hydration** (`setLang(detectLang())` en login, `page.js`,
  `restablecer`, `LegalDocument`): necesita `window`/`localStorage`, que no
  existen en el servidor. NO se puede derivar en el render sin romper SSR
  (provocaría hydration mismatch). Debe quedarse en un effect de montaje.

Sí se corrigieron las impurezas de render reales (no son cargas):
`react-hooks/globals` (formateador con estado de módulo mutado en render →
fábrica local), `react-hooks/static-components` (componente definido en el
render → elemento JSX) y un `react-hooks/immutability` (acumulador mutable →
`reduce`).

## CSP

Ver `SEG-M6` (documentado en `next.config.mjs`): decisión de CSP con riesgo
aceptado.
