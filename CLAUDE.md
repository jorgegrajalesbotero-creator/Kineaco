@AGENTS.md

# Kineaco — instrucciones para agentes

PWA de entrenamiento personal, dos caras (coach y alumno). Maneja **datos de salud
de personas reales en Colombia** (Ley 1581 de 2012). Lo que se rompa aquí afecta a
alumnos reales y a un entrenador que trabaja con esto todos los días.

## Documentos del proyecto (referencia; no se duplica su contenido aquí)

| Archivo | Qué contiene | Cuándo es obligatorio |
|---|---|---|
| `AGENTS.md` | Reglas de Next.js. **Lo genera y actualiza `next dev`** | Se importa arriba con `@AGENTS.md`. No editar a mano |
| `DECISIONS.md` | Decisiones deliberadas y warnings aceptados a propósito | **Antes de modificar cualquier código** |
| `CONTEXTO.md` | Contexto completo: dominio, arquitectura, modelo de datos (~45 tablas), periodización ATR, reloj, notificaciones, seguridad, legal | **Antes de cualquier cambio no trivial**, y siempre antes de tocar planificación ATR, reloj, push, consentimiento o el modelo de datos |
| `README.md` | Puesta en marcha del entorno | Al configurar el entorno |
| `supabase/security/` | Scripts SQL de seguridad y auditorías (00–13) | Al tocar RLS, Storage o consentimiento de salud |

`AGENTS.md` contiene únicamente el bloque que genera Next.js. **No añadas reglas de
Kineaco dentro de ese bloque**: `next dev` lo reescribe y se perderían. Las reglas
del proyecto van en este archivo.

## Regla cero

**Las decisiones de `DECISIONS.md` prevalecen sobre cualquier recomendación
genérica**: mía, de un agente o Skill de ECC, de un linter o de una guía de buenas
prácticas. Varios "errores" evidentes de este repo son decisiones tomadas con
motivo escrito. Si una herramienta propone revertir una de ellas, el hallazgo es
ruido conocido: se descarta citando `DECISIONS.md`, no se "arregla".

Si crees que una decisión debería cambiar: dilo y espera respuesta. No la cambies.

Resumen de las cuatro decisiones vigentes (el porqué está en `DECISIONS.md`):

1. **No se usa `next/link` ni `useRouter`.** La navegación entre secciones grandes
   o roles es con **recarga completa** (`<a href>`, `window.location.href`).
2. **Se usa `<img>`, no `next/image`** (URLs firmadas de Supabase y previews `blob:`).
3. **Warnings de `react-hooks`** (`set-state-in-effect`, `exhaustive-deps`)
   analizados uno a uno y aceptados.
4. **CSP con `'unsafe-inline'` en `script-src`** — SEG-M6, riesgo aceptado y
   documentado en `next.config.mjs`.

## Next.js — lectura obligatoria antes de escribir código

Este repo usa **Next.js 16.4.6**, con cambios que rompen compatibilidad respecto a
lo que cualquier modelo tiene memorizado. Antes de escribir código relacionado con
Next.js (rutas, `app/`, API routes, `next.config.mjs`, caché, middleware/proxy,
renderizado) **lee la guía correspondiente en `node_modules/next/dist/docs/`**
(`01-app`, `02-pages`, `03-architecture`, `index.md`) y atiende los avisos de
obsolescencia. No escribas de memoria.

`next dev` reescribe `AGENTS.md`. Si aparece modificado en el árbol de trabajo,
**revisa el diff y decide si corresponde incluirlo en el commit**. No lo descartes
por costumbre ni lo añadas automáticamente: mira qué cambió y, si no tiene relación
con el trabajo en curso o no lo entiendes, pregunta antes de incluirlo.

## Restricciones no negociables

1. **JavaScript puro. SIN TypeScript.** No introducir TS ni archivos `.ts`/`.tsx`.
2. **Sin librerías nuevas** (dependencias o devDependencies) salvo petición expresa.
   No hay librería de estado, data-fetching, gráficos, PDF ni web-push: es
   deliberado. `lib/pdf.js` y `lib/webpush.js` son propios.
3. **Seguridad en dos capas; ninguna sustituye a la otra.**
   - **Base de datos — RLS es el suelo.** Políticas RLS, políticas de Storage,
     triggers y funciones SQL. Si es una regla de acceso a datos, su lugar es RLS.
     El cliente solo hace *gating* de interfaz y **nunca** cuenta como control de
     seguridad: todo lo que haga el navegador es manipulable.
   - **Rutas de `app/api/` — validan por su cuenta, en cada petición.** Sesión,
     permisos y **alcance** de la operación (que el recurso pedido sea realmente
     suyo), antes de tocar ningún dato. RLS no exime a una ruta de comprobar la
     autorización.
   - **Obligatorio cuando se usa `lib/supabaseAdmin.js`**, que emplea la clave
     secreta y **omite RLS**: ahí no hay red debajo, la validación del backend es
     la única defensa. El patrón de referencia es `/api/account`: aunque escribe
     con la clave secreta, valida los permisos llamando a la base **con la sesión
     de quien llama** (`is_coach()` + `is_staff_for()`), para aplicar exactamente
     las mismas reglas que RLS.
4. **`lib/supabaseAdmin.js` usa la clave secreta y salta RLS: solo en `app/api/`.**
   Jamás importarlo desde un componente.
5. **La BD guarda siempre kilogramos.** Las libras solo se muestran
   (`lib/weightUnits.js`). Los números se parsean con `lib/numbers.js` (la BD
   guarda con punto).
6. **Textos del alumno siempre con `tr("...")`** de `lib/i18n.js` (la clave es el
   texto en español). El panel del coach usa `plain(...)` o texto directo y está
   solo en español. Todo el español trata de **"usted"**, sin tecnicismos.
7. **Colores solo desde `app/globals.css`** como clases (`bg-app`, `bg-card`,
   `bg-field`, `text-ink`, `text-soft`, `text-muted`, `text-accent`, `text-danger`,
   `text-warning`). Nunca colores a mano.
8. **Nunca `<input type="date">`** en formularios del alumno: usar
   `components/ui/DateSelect.jsx`.
9. **Consultas de más de 1000 filas**: `fetchAllRows` de `lib/fetchAll.js`
   (Supabase corta en 1000).
10. **La lógica pura va en `lib/`**, sin React, para poder testearla.

## Pruebas (Vitest) y CI

- **Si tocas lógica pura, añade o actualiza su test en `tests/`.** No es opcional.
- Los tests cubren **solo lógica pura** (reloj, cargas, plan, medidas, fechas,
  webpush, legal, url, youtube, numbers…). Es deliberado: **no** añadas tests de
  componentes ni persigas un porcentaje global de cobertura.
- Scripts reales: `npm run dev | build | start | lint | test | test:watch | pentest:rls`.
- CI (`.github/workflows/ci.yml`) en cada push y PR a `main`, Node 20:
  `npm ci` → `npm run lint` (**0 errores**; los warnings no bloquean) →
  `npm test` → `npm run build`. Verifica en local antes de abrir PR.
- `npm run pentest:rls` simula a un alumno malicioso: **hoy 6/6 ataques
  bloqueados**. No se abre un PR que empeore ese resultado.

## Idioma y commits

Comentarios, nombres de rama y mensajes de commit **en español**, escritos para que
los entienda alguien no técnico. Ejemplo real: «Reloj: deja de usar Web Audio, que
el iPhone duerme en segundo plano». **No uses Conventional Commits** (`feat:`,
`fix:`). Ramas `feat/...` y `fix/...` con pull request a `main`. Los nombres de
variables, funciones y clases quedan en inglés.

## Zonas frágiles — tocar con cuidado

- **El reloj** (`lib/clockStore.js`, `components/student/ClockIsland.jsx`,
  `lib/alarm.js`): el tiempo se calcula siempre desde `Date.now()` real, nunca
  acumulando ticks. `lib/alarm.js` **no usa Web Audio a propósito** (iPhone lo
  duerme en segundo plano).
- **Notificaciones push e iOS**: frágil. En iPhone solo funciona con la app
  instalada en la pantalla de inicio (iOS 16.4+).
- **Cálculo de cargas ATR** (`lib/loadCalc.js`): coach y alumno usan exactamente el
  mismo código. No lo dupliques. Las casillas editadas a mano mandan sobre el
  cálculo.
- **Legal** (`lib/legal.js`, `lib/legalText.js`): cambiar los documentos de forma
  importante obliga a subir `LEGAL_VERSION` y **re-pedir aceptación a todos**. Edad
  mínima 12 años. Consentimiento de datos de salud separado y retirable.

## Requiere autorización explícita antes de ejecutar

Pregunta y espera respuesta. No lo hagas "porque es lo lógico":

- **Ejecutar cualquier SQL que modifique la base** (DDL, DML, políticas RLS,
  triggers, funciones), incluidos los scripts de `supabase/security/` y
  `09_aplicar_todo.sql`. Leer el esquema y **proponer** SQL está bien; aplicarlo no.
- Herramientas MCP de Supabase que escriban: `apply_migration`, `execute_sql` con
  escritura, `deploy_edge_function`, `create_branch` / `merge_branch` /
  `reset_branch`, secretos de Edge Functions.
- **Desplegar** (Vercel) o tocar variables de entorno de producción.
- `git push`, abrir o fusionar un PR, crear tags.
- Instalar, actualizar o eliminar dependencias.
- Borrar o sobrescribir archivos fuera del cambio pedido.

## Herramientas de agente (ECC, Skills de Supabase)

Las Skills y agentes de ECC o de Supabase son **apoyo opcional para el agente, no
herramientas del proyecto**. No sustituyen a `npm run lint`, `npm test`,
`npm run build` ni `npm run pentest:rls`, que son la única verificación válida. No
se exige usarlas, no se añaden al flujo de trabajo del repo y ningún resultado suyo
reemplaza al CI.

## Al invocar subagentes

Los agentes especializados **no conocen este archivo**. No dependas de una herencia
automática de instrucciones: al lanzar cualquiera, incluye en su prompt, literalmente,
este bloque:

> Proyecto Kineaco: Next.js 16 + React 19 en **JavaScript puro, sin TypeScript**.
> No propongas librerías nuevas. **Lee `DECISIONS.md` antes de proponer cambios.**
>
> Decisiones deliberadas, NO son errores y NO se corrigen:
> (1) no se usa `next/link` ni `useRouter`, la navegación es con recarga completa;
> (2) se usa `<img>`, no `next/image`;
> (3) los warnings de `react-hooks` (`set-state-in-effect`, `exhaustive-deps`)
>     están analizados y aceptados;
> (4) la CSP lleva `'unsafe-inline'` en `script-src` (SEG-M6, riesgo aceptado).
>
> Seguridad:
> - La seguridad de los datos se protege mediante Supabase RLS y las políticas
>   correspondientes. El cliente nunca es una frontera de seguridad; solo realiza
>   gating de interfaz.
> - Las rutas de `app/api/` deben validar sesión, permisos y alcance del recurso en
>   cada petición. RLS no las exime de comprobar la autorización.
> - Cuando se utiliza `lib/supabaseAdmin.js`, la validación del backend es
>   imprescindible porque esa conexión omite RLS. Sigue el patrón de autorización de
>   `/api/account`.
> - `lib/supabaseAdmin.js` solo puede importarse desde `app/api/`, nunca desde
>   componentes.
> - No ejecutes SQL, no despliegues, no instales dependencias y no hagas `git push`
>   sin autorización explícita del usuario.
>
> Los tests (Vitest) cubren solo lógica pura de `lib/`. Antes de escribir código de
> Next.js consulta `node_modules/next/dist/docs/`. Comentarios y commits en español
> sencillo, sin Conventional Commits.

Si un agente propone cambiar alguna de las cuatro decisiones deliberadas de
`DECISIONS.md`, no apliques el cambio automáticamente: explica el motivo y espera
autorización. Los hallazgos de seguridad, errores reales y posibles incumplimientos
de las reglas del proyecto deben investigarse, aunque contradigan el comportamiento
actual del código. Nunca descartes una vulnerabilidad por el simple hecho de que
contradiga una decisión documentada.
