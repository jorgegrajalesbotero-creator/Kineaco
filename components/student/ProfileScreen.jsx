"use client";

import { useState } from "react";
import { Camera, ChevronRight, User } from "lucide-react";
import { tr } from "@/lib/i18n";
import { shrinkAvatar } from "@/lib/images";
import { supabase } from "@/lib/supabaseClient";
import { signedAvatarUrl } from "@/lib/avatars";
import { updateAccount } from "@/lib/account";
import { Chameleon } from "@/components/ui/Chameleon";
import { PET_NAME_MAX } from "@/lib/chameleon";
import { PrivacySection } from "@/components/student/PrivacySection";
import { ChangePassword } from "@/components/ui/ChangePassword";
import { PushToggle } from "@/components/ui/PushNotifications";

export function ProfileScreen({ fullName, email, avatarUrl, userId, onProfileUpdate, onEmailUpdate, pet, onPetRenamed, onOpenIntake, onOpenAnnouncements, isCoach, onLogout, lang, onChangeLang, healthConsent, onHealthChange }) {
  const [nameDraft, setNameDraft] = useState(fullName);
  const [emailDraft, setEmailDraft] = useState(email || "");
  const [renaming, setRenaming] = useState(false);
  const [petDraft, setPetDraft] = useState("");
  const [petError, setPetError] = useState("");
  const [petSaving, setPetSaving] = useState(false);

  // Nombre del camaleón: se puede cambiar UNA sola vez (lo controla también la base)
  const renamePet = async () => {
    const v = petDraft.trim().slice(0, PET_NAME_MAX);
    if (!v) return setPetError(tr("Escriba un nombre para continuar."));
    if (v === pet?.name) return setRenaming(false);
    if (!confirm(tr("Solo puede cambiar el nombre una vez. ¿Llamarlo {p0}?", { p0: v }))) return;
    setPetSaving(true);
    const { error } = await supabase.from("profiles").update({ pet_name: v }).eq("id", userId);
    setPetSaving(false);
    if (error) return setPetError(tr("No se pudo cambiar el nombre: ya usó su cambio."));
    onPetRenamed?.(v);
    setRenaming(false);
  };
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
    if (error) {
      setSaving(false);
      alert(tr("No se pudo guardar: "));
      return;
    }
    // Correo: se cambia en la cuenta (de una vez, sin correo de confirmación)
    const newEmail = emailDraft.trim().toLowerCase();
    if (newEmail && newEmail !== (email || "").toLowerCase()) {
      if (!confirm(tr("Desde ahora va a iniciar sesión con {p0}. ¿Está bien escrito?", { p0: newEmail }))) {
        setSaving(false);
        return;
      }
      const { error: emailError } = await updateAccount(null, { email: newEmail });
      if (emailError) {
        setSaving(false);
        alert(tr(emailError));
        return;
      }
      if (onEmailUpdate) onEmailUpdate(newEmail);
    }
    setSaving(false);
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
              <img src={localAvatarUrl} alt={tr("Foto de perfil")} decoding="async" className="w-full h-full object-cover" />
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
            type="email"
            autoComplete="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            className="block w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="text-muted text-[11px] mt-1">{tr("Es el correo con el que inicia sesión.")}</p>
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

      <PushToggle userId={userId} t={tr} />
      <ChangePassword t={tr} />

      {pet && pet.name && (
        <div className="bg-card rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <Chameleon mood={pet.mood || 3} size={96} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-muted text-xs">{tr("Su camaleón")}</p>
              <p className="text-ink text-base font-semibold truncate">{pet.name}</p>
              {!renaming && (pet.changes || 0) < 1 && (
                <button onClick={() => { setPetDraft(pet.name); setPetError(""); setRenaming(true); }} className="text-accent text-xs mt-1">
                  {tr("Cambiar nombre (solo una vez)")}
                </button>
              )}
              {(pet.changes || 0) >= 1 && <p className="text-muted text-[11px] mt-1">{tr("Ya usó su cambio de nombre.")}</p>}
            </div>
          </div>
          {renaming && (
            <div className="mt-3">
              <input value={petDraft} maxLength={PET_NAME_MAX} onChange={(e) => { setPetDraft(e.target.value); setPetError(""); }}
                className="block w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" />
              {petError && <p className="text-danger text-xs mt-1">{petError}</p>}
              <div className="flex gap-2 mt-2">
                <button onClick={renamePet} disabled={petSaving} className="flex-1 bg-accent text-app text-sm font-medium rounded-lg py-2 disabled:opacity-60">{petSaving ? tr("Guardando...") : tr("Guardar")}</button>
                <button onClick={() => setRenaming(false)} className="bg-field text-soft text-sm rounded-lg px-4 py-2">{tr("Cancelar")}</button>
              </div>
            </div>
          )}
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
