"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { detectLang, setLang, tr } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/authErrors";
import { BrandMark } from "@/components/ui/BrandMark";

// Página a la que llega el alumno desde el correo de "Recuperar contraseña"
export default function ResetPasswordPage() {
  const [lang, setLangState] = useState("es");
  setLang(lang);
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | done
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLangState(detectLang());
    // Supabase lee el enlace del correo y abre una sesión temporal de recuperación
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) setStatus("ready");
    });
    const hashError = /error_code|error=/.test(window.location.hash + window.location.search);
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setStatus((s) => (s === "checking" ? (data.session && !hashError ? "ready" : "invalid") : s));
    }, 1200);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(tr("La contraseña debe tener mínimo 8 caracteres."));
    if (password !== confirm) return setError(tr("Las contraseñas no coinciden."));
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(friendlyAuthError(error));
    setStatus("done");
    setTimeout(() => (window.location.href = "/"), 1800);
  };

  const inputCls =
    "w-full bg-app/60 border border-white/[0.07] text-ink text-[15px] rounded-xl px-4 py-3 outline-none placeholder:text-muted focus:border-accent/50 focus:ring-4 focus:ring-accent/10 transition";

  return (
    <div className="min-h-screen bg-night flex items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex items-center gap-3 mb-8">
          <BrandMark size={44} />
          <p className="text-ink text-lg font-semibold tracking-tight">kineaco</p>
        </div>

        <div className="bg-gradient-to-b from-card to-deep border border-white/[0.07] rounded-3xl p-6">
          {status === "checking" && <p className="text-soft text-sm">{tr("Verificando el enlace...")}</p>}

          {status === "invalid" && (
            <>
              <h1 className="text-ink text-xl font-semibold mb-2">{tr("Enlace no válido")}</h1>
              <p className="text-soft text-sm mb-5">{tr("El enlace venció o ya fue usado. Pida uno nuevo.")}</p>
              <a href="/login" className="block w-full text-center bg-accent text-app font-semibold py-3 rounded-xl text-[15px]">
                {tr("Volver a iniciar sesión")}
              </a>
            </>
          )}

          {status === "ready" && (
            <form onSubmit={submit}>
              <h1 className="text-ink text-2xl font-semibold tracking-tight mb-1">{tr("Nueva contraseña")}</h1>
              <p className="text-soft text-sm mb-6">{tr("Escriba su contraseña nueva dos veces.")}</p>
              <div className="space-y-3 mb-5">
                <input type="password" placeholder={tr("Contraseña nueva")} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={inputCls} />
                <input type="password" placeholder={tr("Repita la contraseña")} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" className={inputCls} />
                <p className="text-muted text-[11px] px-1">{tr("Mínimo 8 caracteres.")}</p>
              </div>
              {error && <p className="text-danger text-xs mb-4 bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{error}</p>}
              <button type="submit" disabled={saving} className="w-full bg-accent text-app font-semibold py-3 rounded-xl text-[15px] active:scale-[0.98] transition-transform disabled:opacity-60">
                {saving ? tr("Guardando...") : tr("Guardar contraseña")}
              </button>
            </form>
          )}

          {status === "done" && (
            <>
              <h1 className="text-ink text-xl font-semibold mb-2">{tr("¡Listo!")}</h1>
              <p className="text-soft text-sm">{tr("Su contraseña quedó cambiada. Entrando a la app...")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
