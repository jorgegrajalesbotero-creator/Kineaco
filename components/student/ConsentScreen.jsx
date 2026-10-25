"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { EMPTY_CONSENT, consentRecord, validateConsent } from "@/lib/legal";
import { getLang, tr } from "@/lib/i18n";
import { ConsentFields } from "@/components/legal/ConsentFields";

// Pantalla para aceptar los Términos y la Política (alumnos que ya tenían cuenta, o cuando cambian los documentos)
export function ConsentScreen({ userId, onAccepted, onSignOut }) {
  const [consent, setConsent] = useState(EMPTY_CONSENT);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    const err = validateConsent(consent);
    if (err) return setError(tr(err));
    setSaving(true);
    setError("");
    const record = { ...consentRecord(consent, getLang()), user_id: userId };
    const { error: dbError } = await supabase.from("legal_consents").insert(record);
    setSaving(false);
    if (dbError) return setError(tr("No se pudo guardar: ") + dbError.message);
    onAccepted(record.health_data_consent);
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8">
      <div>
        <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
          <ShieldCheck size={20} className="text-accent" />
        </div>
      </div>
      <h1 className="text-ink text-2xl font-semibold tracking-tight mb-1">{tr("Sus datos, con su permiso")}</h1>
      <p className="text-soft text-sm mb-6">
        {tr("Publicamos los Términos y la Política de tratamiento de datos de Kineaco. Para seguir usando la app, revíselos y acéptelos.")}
      </p>
      <div className="rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06] p-4 mb-4">
        <ConsentFields value={consent} onChange={setConsent} />
      </div>
      {error && <p className="text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mb-3">{error}</p>}
      <button onClick={accept} disabled={saving} className="block w-full bg-accent text-app font-semibold py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-60">
        {saving ? tr("Guardando...") : tr("Aceptar y continuar")}
      </button>
      <button onClick={onSignOut} className="block w-full text-muted text-xs underline mt-4">{tr("Cerrar sesión")}</button>
    </div>
  );
}
