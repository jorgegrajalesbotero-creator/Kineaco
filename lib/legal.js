// Términos, política de datos y autorizaciones (Ley 1581 de 2012 y Decreto 1377 de 2013).
// Si se cambian los documentos de forma importante, subir LEGAL_VERSION: a todos se les pedirá aceptar de nuevo.

export const LEGAL_VERSION = "2026-10-24";

export const CONTROLLER = {
  brand: "Kineaco",
  name: "Jorge Grajales",
  type: "persona natural",
  city: "Medellín, Antioquia, Colombia",
  email: "jorgegrajalesbotero@gmail.com",
  phone: "322 543 3379",
};

export const GUARDIAN_DOC_TYPES = [
  { key: "CC", label: "Cédula de ciudadanía" },
  { key: "CE", label: "Cédula de extranjería" },
  { key: "PA", label: "Pasaporte" },
  { key: "PPT", label: "Permiso por Protección Temporal" },
];

export const GUARDIAN_RELATIONSHIPS = [
  { key: "madre", label: "Madre" },
  { key: "padre", label: "Padre" },
  { key: "acudiente", label: "Acudiente o representante legal" },
];

// Edad cumplida a hoy a partir de "AAAA-MM-DD"
export function ageFrom(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T12:00:00");
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export const MIN_AGE = 12;

export const EMPTY_CONSENT = {
  birthDate: "",
  terms: false,
  health: false,
  guardianName: "",
  guardianDocType: "CC",
  guardianDocNumber: "",
  guardianRelationship: "madre",
  guardianEmail: "",
  guardianAccept: false,
};

// Devuelve el texto del primer error (en español; la pantalla lo traduce) o "" si todo está bien
export function validateConsent(c) {
  const age = ageFrom(c.birthDate);
  if (age === null) return "Escriba su fecha de nacimiento.";
  if (age < MIN_AGE || age > 110) return "Revise su fecha de nacimiento.";
  if (age < 18) {
    if (c.guardianName.trim().length < 5) return "Escriba el nombre completo de su padre, madre o acudiente.";
    if (!/^[A-Za-z0-9]{4,15}$/.test(c.guardianDocNumber.trim())) return "Revise el número de documento del acudiente.";
    if (!/^\S+@\S+\.\S+$/.test(c.guardianEmail.trim())) return "Revise el correo del acudiente.";
    if (!c.guardianAccept) return "Su padre, madre o acudiente debe marcar la autorización.";
  }
  if (!c.terms) return "Debe aceptar los Términos y la Política de datos para continuar.";
  return "";
}

// Fila para guardar en legal_consents
export function consentRecord(c, lang) {
  const minor = ageFrom(c.birthDate) < 18;
  return {
    doc_version: LEGAL_VERSION,
    birth_date: c.birthDate,
    accepted_terms: true,
    accepted_privacy: true,
    health_data_consent: !!c.health,
    is_minor: minor,
    guardian_name: minor ? c.guardianName.trim().slice(0, 120) : null,
    guardian_doc_type: minor ? c.guardianDocType : null,
    guardian_doc_number: minor ? c.guardianDocNumber.trim().slice(0, 15) : null,
    guardian_relationship: minor ? c.guardianRelationship : null,
    guardian_email: minor ? c.guardianEmail.trim().slice(0, 120) : null,
    language: lang === "en" ? "en" : "es",
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
  };
}
