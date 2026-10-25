import { tr } from "@/lib/i18n";

// Traduce los mensajes de error de Supabase (vienen en inglés) a mensajes claros para el alumno
export function friendlyAuthError(error) {
  const msg = String(error?.message || "");
  if (/invalid login credentials/i.test(msg)) return tr("Correo o contraseña incorrectos.");
  if (/email not confirmed/i.test(msg)) return tr("Todavía no confirmó su correo. Revise su bandeja de entrada.");
  if (/already registered|already been registered|user already exists/i.test(msg)) return tr("Ya existe una cuenta con ese correo. Inicie sesión o recupere su contraseña.");
  if (/password should be at least|weak password|password is too short/i.test(msg)) return tr("La contraseña debe tener mínimo 8 caracteres.");
  if (/same.*password|different from the old/i.test(msg)) return tr("La contraseña nueva debe ser distinta de la anterior.");
  if (/rate limit|too many|for security purposes|seconds/i.test(msg)) return tr("Demasiados intentos. Espere un momento y vuelva a intentar.");
  if (/invalid email|unable to validate email/i.test(msg)) return tr("Revise que el correo esté bien escrito.");
  if (/expired|invalid.*token|otp/i.test(msg)) return tr("El enlace venció o ya fue usado. Pida uno nuevo.");
  return tr("Ocurrió un error. Intente de nuevo.") + (msg ? ` (${msg})` : "");
}
