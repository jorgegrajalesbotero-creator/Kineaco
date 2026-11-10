"use client";

import { useState } from "react";
import { ChevronDown, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { friendlyAuthError } from "@/lib/authErrors";
import { PasswordInput } from "@/components/ui/PasswordInput";

// Sección "Cambiar contraseña" (la usan el alumno en Perfil y el coach en Mi perfil).
// Pide la contraseña actual y la verifica antes de guardar la nueva.
// t = función de traducción (el alumno pasa tr; el coach, en español, no pasa nada).
export function ChangePassword({ t = (s) => s, className = "" }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const fieldCls = "block w-full bg-field text-ink text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-accent placeholder:text-muted";
  const labels = { showLabel: t("Mostrar contraseña"), hideLabel: t("Ocultar contraseña") };

  function reset() {
    setCurrent(""); setNext(""); setConfirm(""); setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError(""); setDone(false);
    if (!current) return setError(t("Escriba su contraseña actual."));
    if (next.length < 8) return setError(t("La contraseña debe tener mínimo 8 caracteres."));
    if (next !== confirm) return setError(t("Las contraseñas no coinciden."));
    if (next === current) return setError(t("La contraseña nueva debe ser distinta de la anterior."));

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setSaving(false); return setError(t("Ocurrió un error. Intente de nuevo.")); }

    // Verificamos la contraseña actual antes de cambiarla
    const { error: checkError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (checkError) {
      setSaving(false);
      return setError(/invalid login credentials/i.test(checkError.message || "") ? t("La contraseña actual no es correcta.") : friendlyAuthError(checkError));
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updateError) return setError(friendlyAuthError(updateError));
    reset();
    setOpen(false);
    setDone(true);
  }

  return (
    <div className={`bg-card rounded-2xl mb-4 ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setDone(false); if (open) reset(); }}
        className="w-full flex items-center justify-between px-4 py-3"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-ink text-sm">
          <KeyRound size={16} className="text-muted" />
          {t("Cambiar contraseña")}
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {done && !open && (
        <p className="text-accent text-xs px-4 pb-3 -mt-1">{t("Contraseña cambiada correctamente. ✓")}</p>
      )}

      {open && (
        <form onSubmit={submit} className="px-4 pb-4 space-y-3">
          <div>
            <p className="text-muted text-xs mb-1">{t("Contraseña actual")}</p>
            <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={fieldCls} {...labels} />
          </div>
          <div>
            <p className="text-muted text-xs mb-1">{t("Contraseña nueva")}</p>
            <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} minLength={8} autoComplete="new-password" className={fieldCls} {...labels} />
          </div>
          <div>
            <p className="text-muted text-xs mb-1">{t("Repita la contraseña nueva")}</p>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} autoComplete="new-password" className={fieldCls} {...labels} />
            <p className="text-muted text-[11px] mt-1">{t("Mínimo 8 caracteres.")}</p>
          </div>
          {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-accent text-app font-medium text-sm rounded-xl py-2.5 disabled:opacity-60">
              {saving ? t("Guardando...") : t("Guardar contraseña")}
            </button>
            <button type="button" onClick={() => { reset(); setOpen(false); }} className="px-4 bg-field text-soft text-sm rounded-xl py-2.5">
              {t("Cancelar")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
