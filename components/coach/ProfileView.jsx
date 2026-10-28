"use client";

import { useEffect, useState } from "react";
import { Camera, Check, User } from "lucide-react";
import { shrinkAvatar } from "@/lib/images";
import { supabase } from "@/lib/supabaseClient";
import { signedAvatarUrl } from "@/lib/avatars";
import { Skeleton } from "@/components/ui/Skeleton";

export function ProfileView({ onProfileUpdate }) {
  const [form, setForm] = useState({ fullName: "", email: "", specialty: "", bio: "", avatarUrl: "" });
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, specialty, bio, avatar_url")
      .eq("id", user.id)
      .single();

    setForm({
      fullName: profile?.full_name || "",
      email: user?.email || "",
      specialty: profile?.specialty || "",
      bio: profile?.bio || "",
      avatarUrl: await signedAvatarUrl(profile?.avatar_url),
    });
    setLoading(false);
  }

  useEffect(() => { loadProfile(); }, []);

  const update = (field) => (e) => { setForm({ ...form, [field]: e.target.value }); setSaved(false); };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !userId) return;
    setUploading(true);

    let blob;
    try {
      blob = await shrinkAvatar(file);
    } catch (err) {
      alert("No se pudo subir la foto: " + "formato");
      setUploading(false);
      return;
    }
    const path = `${userId}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      alert("No se pudo subir la foto: " + uploadError.message);
      setUploading(false);
      return;
    }

    // Guardamos la RUTA (no una URL pública) porque el bucket es privado.
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);

    // Para mostrarla de inmediato, firmamos la URL y rompemos la caché del navegador.
    const signed = await signedAvatarUrl(path);
    const display = signed ? `${signed}&t=${Date.now()}` : signed;

    setForm((f) => ({ ...f, avatarUrl: display }));
    setUploading(false);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("profiles")
      .update({
        full_name: form.fullName,
        specialty: form.specialty,
        bio: form.bio,
      })
      .eq("id", user.id);

    setSaved(true);
    if (onProfileUpdate) onProfileUpdate(form.fullName);
  };

  if (loading) {
    return <div className="p-4 md:p-8"><Skeleton /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <h2 className="text-ink text-xl font-semibold mb-1">Mi perfil</h2>
      <p className="text-muted text-sm mb-6">Así te van a ver tus alumnos dentro de la app.</p>
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-field flex items-center justify-center overflow-hidden">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
            ) : (
              <User size={30} className="text-muted" />
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent flex items-center justify-center cursor-pointer">
            <Camera size={13} className="text-app" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
          </label>
        </div>
        <div>
          <p className="text-ink text-sm font-medium">Foto de perfil</p>
          <p className="text-muted text-xs">{uploading ? "Subiendo..." : "Tocá el ícono de la cámara para cambiarla"}</p>
        </div>
      </div>
      <div className="bg-card rounded-xl p-5 space-y-4 mb-6">
        <div><p className="text-muted text-xs mb-1">Nombre completo</p><input value={form.fullName} onChange={update("fullName")} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" /></div>
        <div><p className="text-muted text-xs mb-1">Email</p><input type="email" value={form.email} disabled className="w-full bg-field text-muted text-sm rounded-lg px-3 py-2 outline-none cursor-not-allowed" /></div>
        <div><p className="text-muted text-xs mb-1">Especialidad</p><input value={form.specialty} onChange={update("specialty")} placeholder="Ej: Fuerza, cardio..." className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent" /></div>
        <div><p className="text-muted text-xs mb-1">Bio</p><textarea value={form.bio} onChange={update("bio")} rows={3} className="w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-accent resize-none" /></div>
      </div>
      <button onClick={handleSave} className="bg-accent text-app font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2">
        {saved ? <><Check size={15} /> Guardado</> : "Guardar cambios"}
      </button>
    </div>
  );
}
