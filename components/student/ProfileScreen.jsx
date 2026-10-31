"use client";

import { useState } from "react";
import { Camera, ChevronRight, User } from "lucide-react";
import { tr } from "@/lib/i18n";
import { shrinkAvatar } from "@/lib/images";
import { supabase } from "@/lib/supabaseClient";
import { signedAvatarUrl } from "@/lib/avatars";
import { PrivacySection } from "@/components/student/PrivacySection";

export function ProfileScreen({ fullName, email, avatarUrl, userId, onProfileUpdate, onOpenIntake, onOpenAnnouncements, isCoach, onLogout, lang, onChangeLang, healthConsent, onHealthChange }) {
  const [nameDraft, setNameDraft] = useState(fullName);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !userId) return;
    setUploading(true);

    let blob;
    try {
      blob = await shrinkAvatar(file);
    } catch {
      alert(tr("No se pudo subir la foto: ") + "formato");
      setUploading(false);
      return;
    }
    const path = `${userId}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      alert(tr("No se pudo subir la foto: "));
      setUploading(false);
      return;
    }

    // Guardamos la RUTA (no una URL pública) porque el bucket es privado.
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);

    // Para mostrarla de inmediato, firmamos la URL y rompemos la caché del navegador.
    const signed = await signedAvatarUrl(path);
    const display = signed ? `${signed}&t=${Date.now()}` : signed;

    setLocalAvatarUrl(display);
    setUploading(false);
    if (onProfileUpdate) onProfileUpdate(nameDraft, display);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: nameDraft }).eq("id", userId);
    setSaving(false);
    if (error) {
      alert(tr("No se pudo guardar: "));
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (onProfileUpdate) onProfileUpdate(nameDraft, localAvatarUrl);
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
      <h1 className="text-ink text-xl font-semibold mb-6">{tr("Mi perfil")}</h1>

      <div className="flex flex-col items-center mb-6">
        <div className="relative mb-3">
          <div className="w-24 h-24 rounded-full bg-field flex items-center justify-center overflow-hidden">
            {localAvatarUrl ? (
              <img src={localAvatarUrl} alt={tr("Foto de perfil")} className="w-full h-full object-cover" />
            ) : (
              <User size={36} className="text-muted" />
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center cursor-pointer">
            <Camera size={14} className="text-app" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
          </label>
        </div>
        {uploading && <p className="text-muted text-xs">{tr("Subiendo foto...")}</p>}
      </div>

      <div className="bg-card rounded-2xl p-4 space-y-4 mb-6">
        <div>
          <p className="text-muted text-xs mb-1">{tr("Nombre completo")}</p>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="block w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <p className="text-muted text-xs mb-1">{tr("Email")}</p>
          <input
            value={email}
            disabled
            className="block w-full bg-field text-muted text-sm rounded-lg px-3 py-2 outline-none cursor-not-allowed"
          />
        </div>
      </div>

      {onChangeLang && (
        <div className="bg-card rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <span className="text-ink text-sm">{tr("Idioma")}</span>
          <div className="flex gap-1 bg-app rounded-full p-1">
            {[["es", "Español"], ["en", "English"]].map(([code, name]) => (
              <button
                key={code}
                type="button"
                onClick={() => onChangeLang(code)}
                className={`px-3 py-1.5 rounded-full text-xs ${lang === code ? "bg-accent text-app font-medium" : "text-soft"}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isCoach && (
        <a href="/admin" className="w-full flex items-center justify-between bg-accent/10 border border-accent/30 rounded-2xl px-4 py-3 mb-4">
          <span className="text-accent text-sm font-medium">{tr("Ir al panel de coach")}</span>
          <ChevronRight size={16} className="text-accent" />
        </a>
      )}

      {onOpenIntake && (
        <button onClick={onOpenIntake} className="w-full flex items-center justify-between bg-card rounded-2xl px-4 py-3 mb-4">
          <span className="text-ink text-sm">{tr("Mi ficha de salud")}</span>
          <ChevronRight size={16} className="text-muted" />
        </button>
      )}

      {onOpenAnnouncements && (
        <button onClick={onOpenAnnouncements} className="w-full flex items-center justify-between bg-card rounded-2xl px-4 py-3 mb-4">
          <span className="text-ink text-sm">{tr("Anuncios de su coach")}</span>
          <ChevronRight size={16} className="text-muted" />
        </button>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="block w-full bg-accent text-app font-medium text-sm rounded-xl py-3 disabled:opacity-60"
      >
        {saving ? tr("Guardando...") : saved ? tr("¡Guardado! ✓") : tr("Guardar cambios")}
      </button>

      {!isCoach && onHealthChange && (
        <div className="mt-7">
          <PrivacySection userId={userId} healthConsent={healthConsent} onHealthChange={onHealthChange} />
        </div>
      )}

      {onLogout && (
        <button onClick={onLogout} className="block w-full text-danger text-sm font-medium bg-card rounded-xl py-3 mt-3">
          {tr("Cerrar sesión")}
        </button>
      )}
    </div>
  );
}
