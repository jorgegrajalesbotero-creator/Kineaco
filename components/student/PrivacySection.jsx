"use client";

import { useState } from "react";
import { ChevronRight, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { tr } from "@/lib/i18n";

// Perfil → Privacidad: documentos, autorización de datos de salud y eliminar la cuenta
export function PrivacySection({ userId, healthConsent, onHealthChange }) {
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const word = tr("ELIMINAR");

  // Cada cambio queda como un registro nuevo (así se conserva la prueba de cada autorización)
  const toggleHealth = async () => {
    const next = !healthConsent;
    if (!next && !confirm(tr("Si retira la autorización, ya no podrá registrar medidas, fotos de progreso, dolor ni datos de salud en su ficha. Lo que ya registró se conserva hasta que pida borrarlo o elimine su cuenta. ¿Continuar?"))) return;
    setBusy(true);
    const { data: last } = await supabase
      .from("legal_consents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) {
      setBusy(false);
      return alert(tr("No se encontró su autorización inicial."));
    }
    const { id, created_at, user_email, ...rest } = last;
    const { error: e } = await supabase.from("legal_consents").insert({ ...rest, health_data_consent: next, user_agent: navigator.userAgent.slice(0, 300) });
    setBusy(false);
    if (e) return alert(tr("No se pudo guardar: "));
    onHealthChange(next);
  };

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== word) return setError(tr("Escriba {p0} para confirmar.", { p0: word }));
    setBusy(true);
    setError("");
    // 1) Archivos: fotos de progreso y foto de perfil
    const { data: photos } = await supabase.from("progress_photos").select("storage_path").eq("user_id", userId);
    const paths = (photos || []).map((p) => p.storage_path).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) await supabase.storage.from("progress-photos").remove(paths.slice(i, i + 100));
    await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
    // 2) Datos y cuenta
    const { error: e } = await supabase.rpc("delete_my_account");
    if (e) {
      setBusy(false);
      return setError(tr("No se pudo eliminar la cuenta: "));
    }
    await supabase.auth.signOut();
    window.location.href = "/login?eliminada=1";
  };

  const row = "w-full flex items-center justify-between bg-card rounded-2xl px-4 py-3";

  return (
    <div className="mb-4">
      <p className="text-muted text-xs uppercase tracking-wider mb-2 px-1">{tr("Privacidad")}</p>
      <div className="space-y-2">
        <a href="/terminos" target="_blank" rel="noopener noreferrer" className={row}>
          <span className="text-ink text-sm">{tr("Términos y Condiciones")}</span>
          <ChevronRight size={16} className="text-muted" />
        </a>
        <a href="/privacidad" target="_blank" rel="noopener noreferrer" className={row}>
          <span className="text-ink text-sm">{tr("Política de datos")}</span>
          <ChevronRight size={16} className="text-muted" />
        </a>
        <div className="bg-card rounded-2xl px-4 py-3">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className={`shrink-0 mt-0.5 ${healthConsent ? "text-accent" : "text-muted"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-ink text-sm">{tr("Datos de salud")}</p>
              <p className="text-muted text-xs mt-0.5">
                {healthConsent
                  ? tr("Autorizado: su coach puede ver su ficha de salud, medidas, fotos y dolor reportado.")
                  : tr("No autorizado: la ficha de salud, las medidas, las fotos y el reporte de dolor están desactivados.")}
              </p>
            </div>
          </div>
          <button onClick={toggleHealth} disabled={busy} className={`mt-3 w-full text-xs font-semibold rounded-xl py-2.5 disabled:opacity-50 ${healthConsent ? "bg-white/[0.04] border border-white/[0.06] text-soft" : "bg-accent text-app"}`}>
            {healthConsent ? tr("Retirar autorización") : tr("Autorizar datos de salud")}
          </button>
        </div>
        {!deleting ? (
          <button onClick={() => setDeleting(true)} className={row}>
            <span className="text-danger text-sm flex items-center gap-2"><Trash2 size={15} /> {tr("Eliminar mi cuenta")}</span>
            <ChevronRight size={16} className="text-muted" />
          </button>
        ) : (
          <div className="bg-card rounded-2xl p-4 border border-danger/30">
            <p className="text-ink text-sm font-medium mb-1">{tr("Eliminar mi cuenta")}</p>
            <p className="text-soft text-xs leading-relaxed mb-3">
              {tr("Se borrarán para siempre su perfil, entrenamientos, mensajes, medidas, fotos y demás datos. No se puede deshacer. Escriba {p0} para confirmar.", { p0: word })}
            </p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={word} className="w-full bg-app/60 border border-white/[0.07] text-ink text-sm rounded-xl px-3 py-2.5 outline-none mb-3" />
            {error && <p className="text-danger text-xs mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setDeleting(false); setConfirmText(""); setError(""); }} className="flex-1 bg-white/[0.04] border border-white/[0.06] text-soft text-sm rounded-xl py-2.5">{tr("Cancelar")}</button>
              <button onClick={deleteAccount} disabled={busy} className="flex-1 bg-danger text-app text-sm font-semibold rounded-xl py-2.5 disabled:opacity-50">
                {busy ? tr("Eliminando...") : tr("Eliminar")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
