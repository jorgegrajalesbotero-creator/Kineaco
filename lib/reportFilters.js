// Filtros y órdenes del Reporte semanal (components/coach/ReportView.jsx).
// Trabajan sobre las filas que arma el reporte: { name, status, expected,
// trainedDays, daysSinceLast, mealDays, photosDue, unreadCount, intakeAlert,
// checkin, accessUntil, accessBucket, seniority }.

import { ACCESS_OPTIONS, SENIORITY_OPTIONS } from "@/lib/filters";

export const STATUS_ORDER = { inactive: 0, attention: 1, ok: 2 };

// Entrenos de la semana frente a los días que tenía rutina
export function trainingBucket(r) {
  if (r.expected === 0) return "sinrutina";
  if (r.trainedDays >= r.expected) return "completo";
  return r.trainedDays > 0 ? "parcial" : "ninguno";
}

// Días desde el último entreno (null = más de 60 días o nunca)
export function lastTrainingBucket(r) {
  if (r.daysSinceLast === null || r.daysSinceLast === undefined) return "nunca";
  if (r.daysSinceLast <= 1) return "reciente";
  if (r.daysSinceLast <= 4) return "medio";
  return "lejos";
}

// Un check-in puede estar a la vez enviado, sin responder y con dolor
export function checkinTags(r) {
  if (!r.checkin) return ["sin"];
  return [
    "enviado",
    !r.checkin.coach_reply && "sinresponder",
    r.checkin.pain && r.checkin.pain_level >= 7 && "dolor",
  ].filter(Boolean);
}

export function pendingTags(r) {
  const p = [
    r.photosDue && "fotos",
    r.unreadCount > 0 && "mensajes",
    r.intakeAlert && "ficha",
    r.mealDays === 0 && "comidas",
  ].filter(Boolean);
  return p.length ? p : ["ninguno"];
}

export const REPORT_FACETS = [
  {
    id: "estado",
    label: "Estado",
    getValues: (r) => r.status,
    options: [
      { value: "ok", label: "Al día" },
      { value: "attention", label: "Atención" },
      { value: "inactive", label: "Sin actividad" },
    ],
  },
  {
    id: "entrenos",
    label: "Entrenos de la semana",
    getValues: trainingBucket,
    options: [
      { value: "completo", label: "Completos" },
      { value: "parcial", label: "Parciales" },
      { value: "ninguno", label: "Ninguno" },
      { value: "sinrutina", label: "Sin rutina asignada" },
    ],
  },
  {
    id: "ultimo",
    label: "Último entreno",
    getValues: lastTrainingBucket,
    options: [
      { value: "reciente", label: "Hoy o ayer" },
      { value: "medio", label: "Hace 2 a 4 días" },
      { value: "lejos", label: "Hace 5 días o más" },
      { value: "nunca", label: "+60 días o nunca" },
    ],
  },
  {
    id: "checkin",
    label: "Check-in",
    getValues: checkinTags,
    options: [
      { value: "enviado", label: "Enviado" },
      { value: "sinresponder", label: "Sin responder" },
      { value: "dolor", label: "Con dolor (7+)" },
      { value: "sin", label: "Sin check-in" },
    ],
  },
  {
    id: "pendientes",
    label: "Pendientes",
    getValues: pendingTags,
    options: [
      { value: "fotos", label: "Fotos pendientes" },
      { value: "mensajes", label: "Mensajes sin leer" },
      { value: "ficha", label: "Ficha con alerta" },
      { value: "comidas", label: "Sin comidas registradas" },
      { value: "ninguno", label: "Sin pendientes" },
    ],
  },
  { id: "acceso", label: "Tiempo de acceso", getValues: (r) => r.accessBucket, options: ACCESS_OPTIONS },
  { id: "antiguedad", label: "Antigüedad", getValues: (r) => r.seniority, options: SENIORITY_OPTIONS },
];

const byName = (a, b) => a.name.localeCompare(b.name);
// Cumplimiento: los que no tienen rutina van al final
const ratio = (r) => (r.expected > 0 ? r.trainedDays / r.expected : Infinity);
const daysSince = (r) => (r.daysSinceLast === null || r.daysSinceLast === undefined ? Infinity : r.daysSinceLast);

export const REPORT_SORTS = [
  { id: "prioridad", label: "Prioridad", compare: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byName(a, b) },
  { id: "nombre", label: "Nombre (A-Z)", compare: byName },
  { id: "cumplimiento", label: "Menos entrenos", compare: (a, b) => ratio(a) - ratio(b) || byName(a, b) },
  // Sin entrenos registrados = el caso más lejano, va primero
  { id: "inactividad", label: "Más días sin entrenar", compare: (a, b) => daysSince(b) - daysSince(a) || byName(a, b) },
  { id: "vence", label: "Vence primero", compare: (a, b) => String(a.accessUntil || "9999").localeCompare(String(b.accessUntil || "9999")) || byName(a, b) },
  { id: "mensajes", label: "Mensajes sin leer", compare: (a, b) => b.unreadCount - a.unreadCount || byName(a, b) },
];
