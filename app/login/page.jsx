"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { tr, setLang, detectLang, rememberLang } from "@/lib/i18n";
import { BrandMark } from "@/components/ui/BrandMark";
import { friendlyAuthError } from "@/lib/authErrors";
import { EMPTY_CONSENT, consentRecord, validateConsent } from "@/lib/legal";
import { ConsentFields } from "@/components/legal/ConsentFields";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState(EMPTY_CONSENT);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLangState] = useState("es");
  setLang(lang);
  useEffect(() => {
    setLangState(detectLang());
    if (new URLSearchParams(window.location.search).get("eliminada")) setNotice(tr("Su cuenta y sus datos fueron eliminados."));
  }, []);
  const changeLang = (l) => {
    setLangState(l);
    rememberLang(l);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    if (mode === "reset") {
      // Siempre se muestra el mismo mensaje, exista o no la cuenta (así nadie puede averiguar qué correos están registrados)
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/restablecer`,
      });
      if (error && /rate|seconds|limit/i.test(error.message)) setError(friendlyAuthError(error));
      else setNotice(tr("Si el correo está registrado, le llegará un enlace para crear una contraseña nueva. Revise también la carpeta de spam."));
    } else if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(friendlyAuthError(error));
      else window.location.href = "/"; // redirige a la home al loguearse
    } else {
      const consentError = validateConsent(consent);
      if (consentError) {
        setError(tr(consentError));
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // La autorización viaja con la cuenta y la base de datos la guarda como prueba
        options: { data: { full_name: fullName.trim().slice(0, 80), language: lang, consent: consentRecord(consent, lang) } },
      });
      if (error) {
        setError(friendlyAuthError(error));
      } else if (data.user && !data.session) {
        // Confirmación de correo activada: todavía no puede entrar
        setError(tr("Le enviamos un correo para confirmar su cuenta. Ábralo y luego inicie sesión."));
      } else if (data.user) {
        // La base de datos crea el perfil sola al registrarse; esto es solo un respaldo
        const { data: existing } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
        if (!existing) {
          await supabase.from("profiles").insert({ id: data.user.id, full_name: fullName.trim().slice(0, 80), role: "alumno", language: lang });
        }
        window.location.href = "/";
      }
    }
    setLoading(false);
  };

  const inputCls =
    "w-full bg-app/60 border border-white/[0.07] text-ink text-[15px] rounded-xl px-4 py-3 outline-none placeholder:text-muted focus:border-accent/50 focus:ring-4 focus:ring-accent/10 transition";

  return (
    <div className="relative min-h-screen bg-night flex items-center justify-center p-6 overflow-hidden">

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <p className="text-ink text-lg font-semibold tracking-tight leading-none">kineaco</p>
              <p className="text-muted text-xs mt-1">{tr("Su entrenamiento con su coach")}</p>
            </div>
          </div>
          <div className="flex gap-1 bg-card border border-white/[0.06] rounded-full p-1">
            {["es", "en"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => changeLang(code)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${lang === code ? "bg-accent text-app" : "text-soft"}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gradient-to-b from-card to-deep border border-white/[0.07] rounded-3xl p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        >
          <h1 className="text-ink text-2xl font-semibold tracking-tight mb-1">
            {mode === "login" ? tr("Iniciar sesión") : mode === "signup" ? tr("Crear cuenta") : tr("Recuperar contraseña")}
          </h1>
          <p className="text-soft text-sm mb-6">
            {mode === "login"
              ? tr("Entre a su entrenamiento")
              : mode === "signup"
                ? tr("Empiece su rutina hoy")
                : tr("Escriba su correo y le enviaremos un enlace para crear una contraseña nueva.")}
          </p>

          <div className="space-y-3 mb-5">
            {mode === "signup" && (
              <input
                placeholder={tr("Nombre completo")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={80}
                autoComplete="name"
                className={inputCls}
              />
            )}
            <input
              type="email"
              placeholder={tr("Email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputCls}
            />
            {mode !== "reset" && (
              <input
                type="password"
                placeholder={tr("Contraseña")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className={inputCls}
              />
            )}
            {mode === "login" && (
              <div className="flex justify-end">
                <button type="button" onClick={() => { setMode("reset"); setError(""); setNotice(""); }} className="text-soft text-xs hover:text-ink transition-colors">
                  {tr("¿Olvidó su contraseña?")}
                </button>
              </div>
            )}
            {mode === "signup" && <p className="text-muted text-[11px] px-1">{tr("Mínimo 8 caracteres.")}</p>}
            {mode === "signup" && <ConsentFields value={consent} onChange={setConsent} />}
          </div>

          {error && <p className="text-danger text-xs mb-4 bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{error}</p>}
          {notice && <p className="text-accent text-xs mb-4 bg-accent/10 border border-accent/20 rounded-xl px-3 py-2">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-app font-semibold py-3 rounded-xl text-[15px] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? tr("Cargando...") : mode === "login" ? tr("Entrar") : mode === "signup" ? tr("Crear cuenta") : tr("Enviar enlace")}
          </button>

          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setNotice(""); }}
            className="w-full text-soft text-sm mt-5 hover:text-ink transition-colors"
          >
            {mode === "login" ? tr("¿No tiene cuenta? Regístrese") : mode === "signup" ? tr("¿Ya tiene cuenta? Inicie sesión") : tr("Volver a iniciar sesión")}
          </button>
        </form>
        <p className="text-center text-muted text-[11px] mt-5 space-x-3">
          <a href="/terminos" className="hover:text-soft">{tr("Términos y Condiciones")}</a>
          <span>·</span>
          <a href="/privacidad" className="hover:text-soft">{tr("Política de datos")}</a>
        </p>
      </div>
    </div>
  );
}