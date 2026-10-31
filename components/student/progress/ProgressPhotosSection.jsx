"use client";

import { useEffect, useState } from "react";
import { Camera, Check, X } from "lucide-react";
import { daysSince, localDateString } from "@/lib/dates";
import { appLocale, tr } from "@/lib/i18n";
import { shrinkImage } from "@/lib/images";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/Skeleton";
import { cleanDecimal } from "@/lib/numbers";

export const PHOTO_ANGLES = [
  { key: "frente", get label() { return tr("Frente"); } },
  { key: "perfil", get label() { return tr("Perfil"); } },
  { key: "espalda", get label() { return tr("Espalda"); } },
];

export const PHOTO_REMINDER_DAYS = 45;

export function formatPhotoDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(appLocale(), { day: "2-digit", month: "short", year: "numeric" });
}

export function ProgressPhotosSection({ userId, latestWeight }) {
  const [sets, setSets] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [weightDraft, setWeightDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadPhotos = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("progress_photo_sets")
      .select("id, taken_on, weight_kg, note, created_at, progress_photos(id, angle, storage_path)")
      .eq("user_id", userId)
      .order("taken_on", { ascending: false })
      .order("created_at", { ascending: false });
    const list = data || [];
    const paths = list.flatMap((s) => (s.progress_photos || []).map((p) => p.storage_path));
    const urlMap = {};
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrls(paths, 3600);
      (signed || []).forEach((u) => { if (u.signedUrl) urlMap[u.path] = u.signedUrl; });
    }
    setUrls(urlMap);
    setSets(list);
    setLoading(false);
  };

  useEffect(() => {
    loadPhotos();
  }, [userId]);

  const today = localDateString();
  const todaySet = sets.find((s) => s.taken_on === today) || null;
  const takenToday = new Set((todaySet?.progress_photos || []).map((p) => p.angle));
  const lastSet = sets[0];
  const daysFromLast = lastSet ? daysSince(lastSet.taken_on) : null;

  const openForm = () => {
    setFiles({});
    setPreviews({});
    setWeightDraft(todaySet?.weight_kg != null ? String(todaySet.weight_kg) : latestWeight != null ? String(latestWeight) : "");
    setNoteDraft(todaySet?.note || "");
    setShowForm(true);
  };

  const pickFile = (angle, file) => {
    if (!file) return;
    setFiles((f) => ({ ...f, [angle]: file }));
    setPreviews((p) => ({ ...p, [angle]: URL.createObjectURL(file) }));
  };

  const removeFile = (angle) => {
    setFiles((f) => { const n = { ...f }; delete n[angle]; return n; });
    setPreviews((p) => { const n = { ...p }; delete n[angle]; return n; });
  };

  const saveRecord = async () => {
    const angles = Object.keys(files);
    if (angles.length === 0) {
      alert(tr("Elija al menos una foto."));
      return;
    }
    setSaving(true);
    const weightValue = weightDraft === "" ? null : Number(weightDraft);
    const noteValue = noteDraft.trim() || null;

    let setId = todaySet?.id;
    let createdNow = false;
    if (setId) {
      await supabase.from("progress_photo_sets").update({ weight_kg: weightValue, note: noteValue }).eq("id", setId);
    } else {
      const { data: created, error } = await supabase
        .from("progress_photo_sets")
        .insert({ user_id: userId, taken_on: today, weight_kg: weightValue, note: noteValue })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        alert(tr("No se pudo crear el registro: "));
        return;
      }
      setId = created.id;
      createdNow = true;
    }

    let uploaded = 0;
    for (const angle of angles) {
      let blob;
      try {
        blob = await shrinkImage(files[angle]);
      } catch {
        alert(tr("No se pudo leer la foto de {p0}. Pruebe con una foto en formato JPG o PNG.", { p0: angle }));
        continue;
      }
      const path = `${userId}/${setId}/${angle}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("progress-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) {
        alert(tr("No se pudo subir la foto de {p0}: ", { p0: angle }));
        continue;
      }
      const { error: rowErr } = await supabase
        .from("progress_photos")
        .insert({ set_id: setId, user_id: userId, angle, storage_path: path });
      if (rowErr) {
        await supabase.storage.from("progress-photos").remove([path]);
        alert(tr("No se pudo guardar la foto de {p0}: ", { p0: angle }));
        continue;
      }
      uploaded++;
    }

    if (uploaded === 0 && createdNow) {
      await supabase.from("progress_photo_sets").delete().eq("id", setId);
    }

    setSaving(false);
    if (uploaded > 0) setShowForm(false);
    loadPhotos();
  };

  const deleteRecord = async (set) => {
    if (!window.confirm(tr("¿Borrar el registro del {p0} con todas sus fotos?", { p0: formatPhotoDate(set.taken_on) }))) return;
    setDeletingId(set.id);
    const paths = (set.progress_photos || []).map((p) => p.storage_path);
    if (paths.length > 0) {
      const { error: rmErr } = await supabase.storage.from("progress-photos").remove(paths);
      if (rmErr) {
        setDeletingId(null);
        alert(tr("No se pudieron borrar las fotos: "));
        return;
      }
    }
    const { error } = await supabase.from("progress_photo_sets").delete().eq("id", set.id);
    setDeletingId(null);
    if (error) {
      alert(tr("No se pudo borrar el registro: "));
      return;
    }
    loadPhotos();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-muted text-xs uppercase tracking-wider">{tr("Fotos de progreso")}</p>
        {!showForm && (
          <button onClick={openForm} className="text-accent text-xs font-medium">
            {todaySet ? tr("+ Completar registro de hoy") : tr("+ Nuevo registro")}
          </button>
        )}
      </div>

      {!loading && !showForm && (sets.length === 0 || daysFromLast >= PHOTO_REMINDER_DAYS) && (
        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-3 mb-3 flex items-center gap-3">
          <Camera size={18} className="text-accent shrink-0" />
          <p className="text-ink text-xs">
            {sets.length === 0
              ? tr("Suba sus primeras fotos de progreso para que su coach pueda ver su evolución.")
              : tr("Hace {p0} días que no sube fotos. ¡Es buen momento para un nuevo registro!", { p0: daysFromLast })}
          </p>
        </div>
      )}

      {showForm && (
        <div className="bg-card rounded-2xl p-4 mb-3">
          <p className="text-ink text-sm font-medium mb-1">{todaySet ? tr("Completar registro de hoy") : tr("Nuevo registro")}</p>
          <p className="text-muted text-xs mb-3">{tr("Suba al menos una foto. Las 3 son opcionales.")}</p>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {PHOTO_ANGLES.map((a) => (
              <div key={a.key}>
                {takenToday.has(a.key) ? (
                  <div className="w-full aspect-[3/4] rounded-xl bg-field flex flex-col items-center justify-center gap-1">
                    <Check size={18} className="text-accent" />
                    <span className="text-muted text-[10px]">{tr("Ya subida")}</span>
                  </div>
                ) : previews[a.key] ? (
                  <div className="relative">
                    <img src={previews[a.key]} alt={a.label} className="w-full aspect-[3/4] object-cover rounded-xl" />
                    <button
                      onClick={() => removeFile(a.key)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-app/80 flex items-center justify-center"
                    >
                      <X size={12} className="text-ink" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full aspect-[3/4] rounded-xl bg-field border border-dashed border-muted flex flex-col items-center justify-center gap-1 cursor-pointer">
                    <Camera size={18} className="text-soft" />
                    <span className="text-soft text-[10px]">{tr("Agregar")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { pickFile(a.key, e.target.files[0]); e.target.value = ""; }}
                    />
                  </label>
                )}
                <p className="text-muted text-[11px] mt-1 text-center">{a.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder={tr("Peso en kg (opcional)")}
              value={weightDraft}
              onChange={(e) => setWeightDraft(cleanDecimal(e.target.value))}
              className="block w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none"
            />
            <input
              placeholder={tr("Nota (opcional)")}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="block w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              disabled={saving}
              className="flex-1 bg-field text-soft text-sm rounded-lg py-2.5 disabled:opacity-60"
            >
              {tr("Cancelar")}
            </button>
            <button
              onClick={saveRecord}
              disabled={saving || Object.keys(files).length === 0}
              className="flex-1 bg-accent text-app font-semibold text-sm rounded-lg py-2.5 disabled:opacity-60"
            >
              {saving ? tr("Subiendo...") : tr("Guardar")}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        {loading ? (
          <div className="bg-card rounded-2xl p-4">
            <Skeleton />
          </div>
        ) : sets.length === 0 ? (
          !showForm && (
            <div className="bg-card rounded-2xl p-4">
              <p className="text-muted text-sm text-center py-2">{tr("Todavía no ha subido fotos de progreso.")}</p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {sets.map((s) => (
              <div key={s.id} className="bg-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-ink text-sm font-medium">{formatPhotoDate(s.taken_on)}</p>
                    {s.weight_kg != null && <p className="text-muted text-xs">{s.weight_kg} {tr("kg")}</p>}
                  </div>
                  <button
                    onClick={() => deleteRecord(s)}
                    disabled={deletingId === s.id}
                    className="text-muted text-xs disabled:opacity-60"
                  >
                    {deletingId === s.id ? tr("Borrando...") : tr("Borrar")}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PHOTO_ANGLES.map((a) => {
                    const photo = (s.progress_photos || []).find((p) => p.angle === a.key);
                    const url = photo ? urls[photo.storage_path] : null;
                    return (
                      <div key={a.key}>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={a.label} className="w-full aspect-[3/4] object-cover rounded-xl" />
                          </a>
                        ) : (
                          <div className="w-full aspect-[3/4] rounded-xl bg-field flex items-center justify-center text-muted text-[10px]">{tr("Sin foto")}</div>
                        )}
                        <p className="text-muted text-[11px] mt-1 text-center">{a.label}</p>
                      </div>
                    );
                  })}
                </div>
                {s.note && <p className="text-soft text-xs mt-3">{s.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
