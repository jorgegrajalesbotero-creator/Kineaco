# Kineaco — app de entrenamiento coach / alumno

Hecha con **Next.js** (App Router), **Tailwind CSS** y **Supabase**.

## Cómo correrla en el computador

```bash
npm install      # solo la primera vez o después de actualizar paquetes
npm run dev      # abre http://localhost:3000
```

Las claves de Supabase van en `.env.local` (nunca se suben a internet).

## Cómo está organizado el código

```
app/                      Páginas (cada carpeta es una dirección de la app)
  page.js                 App del alumno (/)
  admin/page.jsx          Panel del coach (/admin)
  login/page.jsx          Ingreso y registro (/login)
  layout.js               Marco común: título, ícono, tipografía
  globals.css             Paleta de colores y estilos generales
  manifest.js             Datos para instalar la app en el celular

components/
  student/                Pantallas del alumno
    HomeScreen, RoutineScreen, MessagesScreen, ProfileScreen, IntakeScreen,
    CheckinScreen, SetLogger, RestTimer, Announcements
    Navigation            Menú lateral (computador) y barra inferior (celular)
    progress/             Progreso: por ejercicio (por mes), fotos, insignias
    nutrition/            Nutrición y registro de comidas
  coach/                  Panel del coach
    Sidebar               Menú lateral
    routines/             Rutinas (lista, editor por bloques, ayudas)
    programs/             Programas automáticos y editor de días
    students/             Alumnos: lista + una pantalla por sección
                          (Mensajes, Check-in, Medidas, Semana base, Progreso,
                          Nutrición, Fotos, Acceso, Progreso por ejercicio con
                          historial de antes de la app, y Planeación: fases ATR,
                          rutinas por semana, cargas calculadas y plantillas)
    ExercisesView, ReportView, AnnouncementsView, ProfileView
  progress/               Gráfico de progreso por ejercicio (escalera de récords
                          + antes vs. ahora), compartido por alumno y coach
  measurements/           Medidas corporales (registro paso a paso, resultados)
  ui/                     Piezas reutilizables (buscadores, figura del cuerpo, etc.)

lib/                      Lógica sin pantallas
  supabaseClient          Conexión a la base de datos
  dates, images, search   Fechas, achicar fotos, buscar sin tildes
  badges, blocks, intake, planning, notifications, i18n (traducción del alumno)
  checkin, measurements   Check-in semanal y fórmulas de las medidas
  exerciseHistory         Progreso por ejercicio: une historial + registros de la app
  trainingPlan, loadCalc  Plan por semanas y cálculo de cargas (RM × % de cada fase)

```

## Notificaciones push (barra del celular)

- Cada fila nueva en `notifications` (la campanita) dispara en Supabase `send_push` → `POST /api/push` con el id y el encabezado `x-push-secret`. La ruta lee el aviso con la clave secreta, lo cifra y lo envía a cada celular guardado en `push_subscriptions` (`lib/webpush.js`, VAPID + aes128gcm sin librerías). Los celulares que ya no existen se borran solos.
- `public/sw.js` muestra la notificación y, al tocarla, abre `/?aviso=<id>` o `/admin?aviso=<id>`; `useOpenNotification` (`lib/push.js`) abre la sección.
- `/api/cron/daily` (Vercel Cron, `vercel.json`, 11:00 UTC = 6:00 a. m. Colombia) crea "Hoy le toca entrenar", el check-in del domingo y el aviso de acceso por vencer, con las mismas `dedupe_key` que la app.
- Los avisos tipo `rest` (día de descanso) se quedan solo en la campanita.
- En iPhone solo funciona con la app instalada en la pantalla de inicio (iOS 16.4+).
- Variables (Vercel, Production): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`, `CRON_SECRET`, `SUPABASE_SECRET_KEY`.

## Colores

Definidos una sola vez en `app/globals.css` y usados como clases:
`bg-app`, `bg-card`, `bg-field`, `text-ink`, `text-soft`, `text-muted`,
`text-accent` (verde lima), `text-danger`, `text-warning`.
Para cambiar un color en toda la app basta con cambiarlo ahí.
