# CONTEXTO DEL PROYECTO: KINEACO

> Prompt de contexto. Pégalo al inicio de cualquier sesión de IA o agente que vaya a
> trabajar sobre este repositorio. Última actualización: 2026-11-24.

Vas a trabajar sobre Kineaco. Lee todo este contexto antes de proponer nada.

## 1. QUÉ ES

Kineaco (nombre del paquete npm: `mi-app-training`) es una **PWA de entrenamiento
personal con dos caras: COACH y ALUMNO**. No es una app de rutinas genéricas ni un
producto de gimnasio: es la herramienta de trabajo de UN entrenador personal que
programa, controla y acompaña a distancia a sus alumnos, uno por uno.

- Responsable del tratamiento de datos: Jorge Grajales, persona natural, Medellín
  (Antioquia, Colombia). Marca: Kineaco.
- Lema del manifest: "Movimiento con conciencia, con su coach".
- Público objetivo: alumnos de entrenamiento personalizado que pagan un acceso con
  fecha de vencimiento (`profiles.access_until`), entrenan desde el celular y son
  seguidos a distancia por su coach. Hoy la base tiene UN SOLO COACH.
- Contexto cultural: Colombia. El alumno ve la app en español o inglés (detecta el
  idioma del dispositivo). El panel del coach está solo en español. Todo el texto
  en español trata de "usted", con vocabulario sencillo y sin tecnicismos.

## 2. POR QUÉ ESTÁ CONSTRUIDO ASÍ

El producto nace de la práctica real de un entrenador: reemplazar el Excel/WhatsApp
por una sola herramienta donde él planifica (periodización ATR con cargas
calculadas) y el alumno ejecuta, registra y recibe seguimiento. De ahí tres
consecuencias que explican casi todo el diseño:

1. **La planificación es el corazón**, no el catálogo de ejercicios. La app calcula
   cargas por semana a partir del RM y del % de la fase.
2. **El alumno entrena con el celular en la mano**, a veces sin mirar la pantalla:
   por eso hay un reloj que sobrevive en segundo plano, suena en iPhone y empuja
   notificaciones push.
3. **Maneja datos de salud de personas reales en Colombia**: por eso hay
   cumplimiento explícito de la Ley 1581 de 2012, consentimiento versionado y una
   auditoría de seguridad con pentest.

## 3. STACK TÉCNICO

- **Next.js 16** (App Router) — JavaScript puro, SIN TypeScript.
- **React 19**, **Tailwind CSS 4** (vía `@tailwindcss/postcss`).
- **Supabase**: Auth, Postgres con RLS, Storage, Realtime, triggers SQL, pg_cron.
- **Vercel**: hosting + Vercel Cron.
- **Vitest 5** para tests, **ESLint 9** (`eslint-config-next`).
- **lucide-react** (iconos), **pdfjs-dist** (previsualizar PDF).
- SIN librería de estado, SIN librería de data-fetching, SIN librería de gráficos,
  SIN librería de PDF (hay un generador propio en `lib/pdf.js`), SIN librería de
  web-push (implementación VAPID propia con `crypto` de Node en `lib/webpush.js`).
- Scripts: `npm run dev | build | start | lint | test | test:watch | pentest:rls`.
- Alias de importación: `@/` → raíz del repo (`jsconfig.json`).

## 4. ARQUITECTURA

Solo existen DOS pantallas reales, cada una una SPA que gestiona su propio estado
interno:

- `/` → app del ALUMNO (`app/page.js`, ~750 líneas, es el orquestador: carga perfil,
  rutina, insignias, avisos, consentimiento, check-ins, camaleón).
- `/admin` → panel del COACH/ADMIN (`app/admin/page.jsx`).
- Además: `/login`, `/restablecer`, `/privacidad`, `/terminos`.

Tres rutas de servidor (`runtime = "nodejs"`, `dynamic = "force-dynamic"`):

- `POST /api/push` — recibe el webhook de Supabase (`send_push`) con el id del aviso
  y la cabecera `x-push-secret`, lee el aviso con la clave secreta, lo cifra
  (aes128gcm) y lo manda a cada celular de `push_subscriptions`. Borra solo las
  suscripciones muertas.
- `GET /api/cron/daily` — Vercel Cron (`vercel.json`: `0 11 * * *` = 6:00 a.m.
  Colombia). Crea "Hoy le toca entrenar" / "Hoy es su día de descanso", el check-in
  del domingo y el aviso de acceso por vencer, con las MISMAS `dedupe_key` que crea
  la app al abrirse para que no se dupliquen.
- `/api/account` — ver/cambiar nombre y correo. El correo vive en Supabase Auth y se
  cambia con la clave secreta en el servidor, pero los permisos se validan llamando
  a la base **con la sesión de quien llama** (`is_coach()` + `is_staff_for()`), para
  usar exactamente las mismas reglas que RLS.

**REGLA DE ORO DE LA ARQUITECTURA: toda la seguridad real vive en Supabase** (RLS,
políticas de Storage, triggers y funciones SQL). El código del cliente solo mejora
la experiencia (gating de UI); el servidor manda. El esquema SQL NO está versionado
en el repo salvo la carpeta `supabase/security/`.

## 5. ESTRUCTURA DE CARPETAS

```
app/
  page.js              App del alumno (/)
  admin/page.jsx       Panel del coach (/admin)
  login/page.jsx       Ingreso y registro
  restablecer/page.jsx Restablecer contraseña
  privacidad, terminos Páginas legales
  api/push, api/cron/daily, api/account
  layout.js, globals.css, manifest.js, icon.png, apple-icon.png

components/
  student/     HomeScreen, RoutineScreen, SetLogger, MessagesScreen, ProfileScreen,
               IntakeScreen, CheckinScreen, CalendarScreen, Announcements,
               ConsentScreen, PetCheckin, HomeExtras, Navigation (SideNav + BottomNav),
               ClockIsland, WorkoutClock, PrivacySection
    progress/  ProgressScreen, ExerciseProgressSection, BadgesSection,
               ProgressPhotosSection, MeasurementsSection, BodyWeightSection,
               CheckinHistory
    nutrition/ NutritionScreen, MealLogSection
  coach/       Sidebar, MessagesInbox, ExercisesView, ReportView, AnnouncementsView,
               ProfileView, TimerSettings
    routines/  RoutinesView, BlockEditor, ExerciseItemEditor, AssignRoutineModal,
               RoutineModeToggle, RoutineTimerField, routineHelpers.js
    programs/  ProgramsView, DayRoutinesEditor
    students/  StudentsView, StudentDetail + un panel por sección: Messages, Checkin,
               Measurements, Days, Plan (+ PlanPhasesEditor, PlanLoadsEditor),
               Nutrition, Photos, Access, Account, Compare, Extras,
               ExerciseHistoryPanel, ExerciseNoteEditor, RoutineNoteEditor,
               RoutinePreviewPanel, TimerOverrideEditor, PanelLayout
  admin/       UsersView (solo rol admin)
  progress/    ExerciseProgressView (compartido alumno/coach)
  measurements/ MeasurementWizard, MeasurementResults, MeasurementsOverview
  legal/       ConsentFields, LegalDocument
  ui/          BodyFigure, BrandMark, Chameleon, ChangePassword, ClockField, Confetti,
               CountUp, DateSelect, FilterBar, PasswordInput, PdfPreview,
               PushNotifications, Search, Select, Skeleton, WeightInput

lib/           (lógica pura, sin pantallas)
supabase/security/  Scripts SQL de seguridad + auditorías (00 a 13)
scripts/pentest-rls.mjs
tests/         24 archivos de test (Vitest), 81+ tests sobre lógica pura
.github/workflows/ci.yml
```

## 6. DECISIONES TÉCNICAS DELIBERADAS (están en DECISIONS.md — NO las "arregles")

- **No se usa `next/link` ni `useRouter`.** El cambio entre secciones grandes o roles
  se hace con **recarga completa de página** (`<a href>`, `window.location.href`).
  Motivo: reinicia la sesión de Supabase y limpia el estado en memoria; un
  `router.push` dejaría estado de auth viejo. Los destinos son literales fijos
  (`"/"`, `"/login"`), nunca entrada de usuario → el aviso de open-redirect no
  aplica. Warnings aceptados: `@next/next/no-html-link-for-pages`,
  `no-location-assign-relative-destination`.
- **No se usa `next/image`; se usa `<img>`.** Las imágenes son URLs firmadas de
  Supabase (cambian y expiran) y previews `blob:`. Se optimiza con `loading="lazy"`
  + `decoding="async"`. Warning aceptado: `@next/next/no-img-element`.
- **Warnings de `react-hooks` aceptados** (`set-state-in-effect`, `exhaustive-deps`):
  se analizaron uno a uno, ninguno es bug. Son cargas únicas al montar y detección
  de idioma que necesita `window`/`localStorage` (no se puede derivar en render sin
  romper SSR). Las impurezas de render REALES sí se corrigieron.
- **CSP con `'unsafe-inline'` en `script-src`** — riesgo aceptado y documentado como
  SEG-M6 en `next.config.mjs`. Quitarlo exigiría nonces por petición (middleware) y
  se perdería el prerender estático. No hay vector XSS (sin
  `dangerouslySetInnerHTML`, `innerHTML`, `eval`).

## 7. MODELO DE DATOS (Postgres / Supabase, ~45 tablas)

**Identidad y acceso**
- `profiles` — id (= auth.users.id), full_name, role (`alumno` | `coach` | `admin`),
  access_until, avatar_url (ruta, se firma al mostrar), pet_name, fecha de nacimiento.
- `legal_consents` — consentimientos versionados (`LEGAL_VERSION`), incluye
  `health_data_consent` y datos del acudiente si es menor.

**Rutinas y ejercicios**
- `exercises` — catálogo, con `video_url` de YouTube.
- `routines` → `routine_blocks` → `routine_exercises` (rutina por bloques).
- `routine_assignments` — días fijos de la semana (fuera de plan).
- `routine_timers` — reloj programado por bloque; `user_id` nulo = de la rutina,
  `user_id` = override para ese alumno. El bloque se identifica por `order_index`.
- `student_routine_notes`, `student_exercise_notes` — notas del coach para UN alumno.
- `programs`, `program_days` — programas automáticos.
- `plan_templates`, `plan_template_phases`, `plan_template_days` — plantillas de plan.

**Planificación (ATR)**
- `training_plans` (start_date, weeks, máx. 8) → `training_plan_phases`,
  `training_plan_weeks`, `training_plan_days`, `training_plan_loads`,
  `training_plan_load_cells`, `training_plan_exercise_changes`.
- `student_exercise_weights` — pesos personalizados por alumno.
- `student_extras` — remates / intermitentes / entrenos extra por rango de fechas.

**Registro y progreso**
- `progress` (ejercicio completado) y `progress_sets` (serie a serie).
- `workout_sessions` — día finalizado: una fila por alumno, semana (lunes) y día;
  al finalizar, el día queda BLOQUEADO (no se puede marcar/desmarcar ni cambiar pesos).
- `exercise_history` — historial cargado a mano por el coach, de antes de la app.
  Solo cuenta para los gráficos, NO para las insignias.
- `body_weight_logs`, `body_measurements`, `progress_photo_sets`, `progress_photos`.

**Seguimiento y hábitos**
- `intake_forms` — ficha de ingreso (objetivo, experiencia, lesiones).
- `weekly_checkins` (domingo) y `daily_checkins` (opcional, antes de entrenar).
- `nutrition_profiles`, `meal_logs`.

**Comunicación**
- `messages` (con `read_by_coach`), `announcements`, `announcement_recipients`,
  `notifications` (campanita, con `dedupe_key`, `type`, `link`, `student_id`),
  `push_subscriptions`, `clock_alarms`.

**RPC usadas desde el cliente:** `save_routine_content` (guardado transaccional de
rutinas), `is_coach`, `is_staff_for`, `assign_program_for_user`, `delete_my_account`,
`delete_student_account`, `save_push_subscription`, `set_clock_alarm`,
`clear_clock_alarm`.

**Storage:** bucket `avatars` (PRIVADO, se sirve con URLs firmadas) y
`progress-photos`.

**Triggers de Supabase (no versionados en el repo):** `notify_access_granted`,
`notify_workout_start`, `notify_workout_done`, `send_push`, `kin_staff_for_student()`.
Un job de pg_cron (`kineaco-reloj`, cada 10 s) pasa las alarmas de `clock_alarms` a
`notifications`.

## 8. FUNCIONALIDAD — ALUMNO (`/`)

Navegación: Inicio · Mensajes · Nutrición · Progreso · Perfil (menú lateral en
computador, barra inferior en celular).

- **Rutina del día.** La arma `lib/studentRoutine.js`: manda el plan por semanas; si
  la fecha está fuera del plan, los días fijos (`routine_assignments`); encima se
  suman los extras, las cargas calculadas de esa semana, los cambios de ejercicio
  del plan, los pesos personalizados, lo ya marcado esa semana y las observaciones
  del coach. Video del ejercicio incrustado desde youtube-nocookie.
- **SetLogger**: marcar series con peso y reps. Al finalizar el día se bloquea.
- **Reloj** (ver sección 10): Descanso, Tabata/intermitentes, AMRAP, Cronómetro.
- **Check-in diario** (opcional, antes de entrenar: sueño, energía, dolor muscular,
  estrés…) y **check-in semanal** (domingo, o lunes si se le pasó; cuenta para la
  semana lunes–domingo).
- **Camaleón compañero**: su color, estado y frase salen SOLO del check-in diario.
  Reglas, en orden: estrés 4-5 → Estresado (rojo); sueño/energía/ánimo en 1-2 →
  Cansado (morado); si no, promedio de sueño, energía, (6−dolor), (6−estrés) y ánimo:
  ≥4,5 Con toda (lima) · ≥3,5 Bien (verde) · resto Normal (azul).
- **Medidas corporales** con asistente paso a paso y figura del cuerpo. Fórmulas:
  % de grasa de la Marina de EE. UU. (Hodgdon y Beckett, 1984, versión cm),
  percentiles del Cooper Institute (ACSM), rango saludable de Gallagher et al. 2000,
  IMC y cintura (OMS), cintura/cadera (OMS 2008), cintura/estatura (Ashwell, corte
  0,5), FFMI normalizado a 1,80 m (Kouri 1995). Recordatorio cada 28 días.
- **Progreso por ejercicio**: escalera de récords y "antes vs. ahora", uniendo
  `exercise_history` (previo a la app) con `progress`/`progress_sets`.
- **Fotos de progreso** (se achican en el navegador antes de subir) y peso corporal.
- **Insignias**: 13 insignias en 4 grupos (Constancia, Volumen, Fuerza, Hábitos),
  calculadas al vuelo desde los datos existentes — NO hay tabla de insignias.
- **Nutrición**: perfil (sexo, peso, estatura, edad, actividad ×1.2/1.375/1.55,
  objetivo −20% / 0 / +12%) y registro de comidas por porciones con la mano.
- **Mensajes** con el coach, **anuncios**, **campanita de avisos**, **push**.
- **Ficha de ingreso** (objetivo, experiencia, lesiones — alerta al coach si hay
  lesión actual o restricción médica) y **pantalla de consentimiento**.
- PWA instalable; idioma es/en; unidad kg o lb (la BD SIEMPRE guarda kg).

## 9. FUNCIONALIDAD — COACH (`/admin`)

Menú: Alumnos · Mensajes · Reporte semanal | Rutinas · Ejercicios · Programas |
Anuncios | Usuarios (solo admin) · Mi perfil.

- **Alumnos** → ficha con paneles: Mensajes, Check-in, Medidas, Semana base (días
  fijos), Progreso, Nutrición, Fotos, Acceso, Cuenta, Comparar, Extras, Progreso por
  ejercicio con historial previo a la app, y **Planeación**.
- **Planeación (lo más importante del producto)**: fases ATR, rutinas por semana,
  cargas calculadas y plantillas. Ver sección 10.
- **Rutinas**: biblioteca con editor por bloques, versiones (al cambiar una rutina
  que ya tienen alumnos se archiva la anterior), rutinas privadas de un alumno.
- **Vista en vivo del entreno**: `RoutinePreviewPanel` escucha `progress_sets`,
  `progress` y `workout_sessions` por Supabase Realtime, con repaso cada 20 s como
  respaldo. El coach NO marca series: en `coachMode` solo corrige peso y reps de
  series ya hechas.
- **Reporte semanal** con filtros y órdenes; **informes en PDF** (progreso, medidas
  con la figura, nutrición, calendario del plan y rutinas) con un generador propio.
- **Ejercicios** con enlace de YouTube; **Anuncios** con destinatarios; **Acceso**
  (prórroga de la mensualidad); **Usuarios** (crear/borrar cuentas, solo admin).

## 10. DOMINIO: PERIODIZACIÓN ATR Y CÁLCULO DE CARGAS

Tipos de bloque de rutina: aproximación, calentamiento, **trabajo principal**,
intermitentes, remate, estiramiento. Los pesos de la progresión ATR y los pesos
personalizados SOLO se aplican en rutinas sin bloques y en bloques "principal".

Fases (mesociclos) y sus valores por defecto (`PHASE_DEFAULTS` en `lib/loadCalc.js`):

| Fase | % inicio–fin | Reps inicio–fin | Series inicio–fin |
|---|---|---|---|
| Acumulación | 65 → 75 | 10-12 → 8 | 3 → 4 |
| Transformación | 77,5 → 85 | 6-8 → 4-6 | 4 → 3 |
| Realización | 87,5 → 92,5 | 3-4 → 1-3 | 3 → 2 |
| Descarga | 55 → 60 | 10 → 10 | 2 → 2 |
| Otro | sin valores (usa los de la rutina) | | |

Cálculo: cada ejercicio tiene una base (RM medido, o peso × reps → RM estimado con
**Epley**, máx. 12 reps). El peso de cada semana = RM × % de esa semana, redondeado
según la unidad. El % y las reps se reparten linealmente entre las semanas de la
fase. **Las casillas editadas a mano mandan sobre el cálculo.** Plan de máx. 8
semanas (opciones 4-8), empezando en lunes (si `start_date` no cae en lunes se
normaliza para que el plan igual se active).

Coach y alumno usan EXACTAMENTE el mismo código de cálculo (`lib/loadCalc.js`).

## 11. EL RELOJ (la parte más trabajada y más frágil)

Modos: **Descanso**, **Tabata** (también usado para intermitentes), **AMRAP**,
**Cronómetro**. El tiempo se calcula SIEMPRE desde `Date.now()` real, nunca
acumulando ticks, para que no se atrase si el celular duerme.

- `lib/clockStore.js` — un solo reloj global, guardado en el dispositivo.
- `components/student/ClockIsland.jsx` (`ClockHost`) — motor de pitidos/alarma,
  píldora tipo "isla dinámica" arriba y el reloj grande.
- `lib/alarm.js` — pitidos y alarma que repite hasta que la apaguen. **No usa Web
  Audio** (el iPhone lo duerme en segundo plano); la alarma se apaga sola a los 10 s.
- `lib/clockMedia.js` + `lib/clockArtwork.js` — tarjeta en la pantalla de bloqueo y
  centro de control, con carátula dibujada al vuelo (fase, ciclo, serie).
- `lib/clockNotification.js` — ficha con forma de cronómetro en el panel de avisos.
- `lib/clockProgress.js` — al terminar, da el bloque por hecho.
- Si el reloj termina con la app cerrada: `set_clock_alarm` deja el aviso en
  `clock_alarms` y el job de pg_cron lo pasa a `notifications` con tipo `clock`
  (ese tipo NO se muestra en la campanita).
- El descanso entre series usa el mismo reloj.
- `components/ui/ClockField.jsx` — escribir el tiempo exacto, mantener − / +.
  Pasos en `stepFor`, lectura en `parseClockInput` (`lib/clock.js`).

## 12. NOTIFICACIONES

Cada fila nueva en `notifications` dispara en Supabase `send_push` → `POST /api/push`
con el id y la cabecera `x-push-secret`. La ruta lee el aviso con la clave secreta,
lo cifra y lo manda a cada celular de `push_subscriptions` (`lib/webpush.js`, VAPID
RFC 8292 + aes128gcm, sin librerías). Las suscripciones muertas se borran solas.

`public/sw.js` muestra el aviso y al tocarlo abre `/?aviso=<id>` o `/admin?aviso=<id>`;
`useOpenNotification` (`lib/push.js`) abre la sección correcta. En iPhone solo
funciona con la app instalada en la pantalla de inicio (iOS 16.4+). Los avisos tipo
`rest` se quedan solo en la campanita.

Variables en Vercel (Production): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`, `CRON_SECRET`, `SUPABASE_SECRET_KEY`, más
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 13. SEGURIDAD

Estado (auditoría del 2026-10-31, `supabase/security/05_auditoria_codigo.md`):
**no hay brechas críticas ni altas abiertas en el código del cliente.** Sin XSS,
sin secretos en el repo ni en el historial de git, sin open redirect, sin CSRF
(tokens Bearer, no cookies propias), sin fugas en mensajes de error.

- `scripts/pentest-rls.mjs` (`npm run pentest:rls`) simula a un alumno malicioso e
  intenta 6 ataques (escalar rol, extender acceso, leer perfiles ajenos, usar la RPC
  de coach, escribir a nombre de otro, suplantar remitente). **Resultado: 6/6
  bloqueados.**
- Aplicado en Supabase: `01` (trigger que impide que un alumno se cambie el `role` o
  el `access_until`) y `02` (bucket `avatars` privado + URLs firmadas).
- `lib/supabaseAdmin.js` usa la clave SECRETA y salta RLS: **solo en `app/api/`,
  nunca importar desde un componente.**
- `lib/url.js` (`safeHttpUrl`) rechaza `javascript:`, `data:` y similares.
- `lib/youtube.js` nunca incrusta el enlace tal cual: extrae el id del video.
- Cabeceras en `next.config.mjs`: CSP completa (`frame-src` solo
  youtube-nocookie, `frame-ancestors 'none'`), X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy (solo cámara), COOP, HSTS en producción.

**PENDIENTES (scripts escritos, NO aplicados en la base):**
- `03` — IDOR entre coaches: `save_routine_content` solo valida `is_coach()`, no que
  la rutina sea del coach que llama. Riesgo bajo hoy (un solo coach).
- `06` — cualquier usuario autenticado puede leer el avatar de otro (política ancha
  sin carpeta). Falta restringir a carpeta propia + coach.
- `07` — **el más importante por implicación legal**: retirar el consentimiento de
  datos de salud hoy solo se aplica en la interfaz. Falta `has_health_consent(uid)`
  y usarla en las ~26 políticas de las tablas de salud.
- `09_aplicar_todo.sql` unifica 03 + 06 + 07 + borrado de Storage en
  `delete_my_account`, en un script idempotente con verificación.

Hallazgos bajos abiertos: borrado de cuenta no atómico (posibles fotos huérfanas),
`video_url` validado solo en cliente, sin validar tipo/tamaño de archivo en subidas.

## 14. LEGAL (Colombia)

Ley 1581 de 2012 y Decreto 1377 de 2013. `lib/legal.js` + `lib/legalText.js`:
- `LEGAL_VERSION = "2026-10-24"`. Si se cambian los documentos de forma importante se
  sube la versión y **a todos se les vuelve a pedir aceptar**.
- Consentimiento separado para **datos sensibles de salud** (`health_data_consent`),
  que se puede retirar.
- **Edad mínima 12 años** (`MIN_AGE`); los menores requieren datos del acudiente
  (tipo de documento CC/CE/PA/PPT y parentesco madre/padre/acudiente).
- La versión en español es la que rige; la inglesa es traducción de cortesía.
- Derecho de supresión vía `delete_my_account`.

## 15. CONVENCIONES DE CÓDIGO

- **Todos los comentarios, nombres de rama y mensajes de commit van en español**, y
  están escritos para que los entienda alguien no técnico. Ejemplos reales de commit:
  "Reloj: deja de usar Web Audio, que el iPhone duerme en segundo plano",
  "Buscador pegado al campo en el celular y crear ejercicio nuevo desde el ATR".
  Mantén ese registro.
- **Colores**: definidos UNA sola vez en `app/globals.css` y usados como clases:
  `bg-app`, `bg-card`, `bg-field`, `text-ink`, `text-soft`, `text-muted`,
  `text-accent` (verde lima), `text-danger`, `text-warning`. Para cambiar un color en
  toda la app basta con cambiarlo ahí. Tema oscuro (`#0F1512`).
- **Textos del alumno** siempre vía `tr("...")` de `lib/i18n.js` (la clave es el texto
  en español). El panel del coach usa `plain(...)` o texto directo.
- **No usar `<input type="date">` en formularios del alumno**: usar
  `components/ui/DateSelect.jsx` (día · mes · año).
- **Números con coma o punto**: usar `lib/numbers.js`; la BD guarda siempre con punto.
- **Pesos**: la BD guarda SIEMPRE kilogramos; `lib/weightUnits.js` convierte a libras
  solo para mostrar.
- **Consultas de más de 1000 filas**: usar `fetchAllRows` de `lib/fetchAll.js`
  (Supabase corta en 1000).
- La lógica pura va en `lib/` (sin React) para poder testearla.

## 16. CALIDAD Y CI

- **81+ tests** en Vitest (`tests/`), solo sobre lógica pura: reloj, cargas, plan,
  medidas, fechas, filtros, webpush, legal (`validateConsent`, `ageFrom`), `url`
  (rechaza `javascript:`/`data:`), youtube, blocks, numbers, pdfPreview…
- **CI en GitHub Actions** (`.github/workflows/ci.yml`) en cada push y PR a `main`:
  Node 20 → `npm ci` → lint (0 errores; los warnings no bloquean) → tests → build
  (con variables `NEXT_PUBLIC_*` de marcador).
- `npm audit`: 2 críticos solo en devDependencies (tinypool vía vitest);
  `--omit=dev` → 0.

## 17. ESTADO Y TAMAÑO

~26.000 líneas, 130 commits desde el **25 de octubre de 2026** (desarrollo muy
intenso en un mes). Flujo de trabajo: ramas `feat/...` y `fix/...` con pull request
a `main`. Archivos más grandes: `lib/i18n.js` (1.008), `RoutinesView.jsx` (827),
`app/page.js` (748), `PlanPanel.jsx` (648), `RoutineScreen.jsx` (615),
`lib/planPdf.js` (610), `ClockIsland.jsx` (556), `PlanLoadsEditor.jsx` (541) —
candidatos a dividirse si siguen creciendo.

## 18. CÓMO QUIERO QUE TRABAJES

- Antes de cambiar algo, **lee `DECISIONS.md`**: varios "errores" aparentes son
  decisiones a propósito y cambiarlos rompe comportamiento intencional.
- No introduzcas TypeScript, ni librerías nuevas, sin que lo pida expresamente.
- No muevas lógica de seguridad al cliente: **si es una regla de acceso, va en RLS**.
- Respeta el idioma y el tono: comentarios y commits en español sencillo.
- Si tocas lógica pura, añade o actualiza su test en `tests/`.
- Ten presente iOS: todo lo del reloj, el sonido y las notificaciones es frágil ahí.
