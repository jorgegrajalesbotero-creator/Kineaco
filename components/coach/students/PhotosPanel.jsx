"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PanelLayout } from "./PanelLayout";
import { Skeleton } from "@/components/ui/Skeleton";

// Fotos de progreso del alumno: comparador "antes vs. ahora" y línea de tiempo
export function PhotosPanel({ student, onClose }) {
  const [photoSets, setPhotoSets] = useState([]);
  const [photoUrls, setPhotoUrls] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [compareBeforeId, setCompareBeforeId] = useState("");
  const [compareAfterId, setCompareAfterId] = useState("");

  useEffect(() => {
    async function load() {
      setLoadingPhotos(true);
      const { data: sets, error } = await supabase
        .from("progress_photo_sets")
        .select("id, taken_on, weight_kg, note, created_at, progress_photos(id, angle, storage_path)")
        .eq("user_id", student.id)
        .order("taken_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) {
        alert("No se pudieron cargar las fotos: ");
        setLoadingPhotos(false);
        return;
      }
      const list = sets || [];
      const paths = list.flatMap((s) => (s.progress_photos || []).map((p) => p.storage_path));
      const urlMap = {};
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from("progress-photos").createSignedUrls(paths, 3600);
        (signed || []).forEach((u) => { if (u.signedUrl) urlMap[u.path] = u.signedUrl; });
      }
      setPhotoUrls(urlMap);
      setPhotoSets(list);
      setCompareBeforeId(list.length >= 2 ? list[list.length - 1].id : "");
      setCompareAfterId(list.length >= 2 ? list[0].id : "");
      setLoadingPhotos(false);
    }
    load();
  }, [student.id]);

  const angles = [
    { key: "frente", label: "Frente" },
    { key: "perfil", label: "Perfil" },
    { key: "espalda", label: "Espalda" },
  ];
  const fmtPhotoDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  const photoOf = (set, angle) => {
    const p = (set?.progress_photos || []).find((x) => x.angle === angle);
    return p ? photoUrls[p.storage_path] : null;
  };
  const beforeSet = photoSets.find((s) => s.id === compareBeforeId);
  const afterSet = photoSets.find((s) => s.id === compareAfterId);
  const photoBox = (url, label) =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={label} className="w-full aspect-[3/4] object-cover rounded-lg" />
      </a>
    ) : (
      <div className="w-full aspect-[3/4] rounded-lg bg-field flex items-center justify-center text-muted text-xs">Sin foto</div>
    );

  return (
    <PanelLayout title="Fotos de progreso" subtitle={student.name} onClose={onClose} width="max-w-3xl">
      {loadingPhotos ? (
        <Skeleton />
      ) : photoSets.length === 0 ? (
        <div className="bg-card rounded-xl p-5">
          <p className="text-ink text-sm mb-1">Todavía no hay fotos</p>
          <p className="text-muted text-xs">Cuando el alumno suba su primer registro desde la pestaña Progreso, lo vas a ver acá.</p>
        </div>
      ) : (
        <>
          {photoSets.length >= 2 && (
            <div className="bg-card rounded-xl p-5 mb-6">
              <p className="text-ink text-sm font-medium mb-3">Antes vs. ahora</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label: "Antes", value: compareBeforeId, setter: setCompareBeforeId },
                  { label: "Ahora", value: compareAfterId, setter: setCompareAfterId },
                ].map((c) => (
                  <label key={c.label} className="text-muted text-xs">
                    {c.label}
                    <select
                      value={c.value}
                      onChange={(e) => c.setter(e.target.value)}
                      className="mt-1 w-full bg-field text-ink text-sm rounded-lg px-3 py-2 outline-none"
                    >
                      {photoSets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {fmtPhotoDate(s.taken_on)}{s.weight_kg != null ? ` · ${s.weight_kg} kg` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {angles.map((a) => {
                const before = photoOf(beforeSet, a.key);
                const after = photoOf(afterSet, a.key);
                if (!before && !after) return null;
                return (
                  <div key={a.key} className="mb-4 last:mb-0">
                    <p className="text-soft text-xs mb-2">{a.label}</p>
                    <div className="grid grid-cols-2 gap-4">
                      {photoBox(before, a.label)}
                      {photoBox(after, a.label)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-ink text-sm font-medium mb-3">Línea de tiempo</p>
          <div className="flex flex-col gap-4">
            {photoSets.map((s) => (
              <div key={s.id} className="bg-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-ink text-sm font-medium">{fmtPhotoDate(s.taken_on)}</p>
                  {s.weight_kg != null && <span className="text-accent text-xs">{s.weight_kg} kg</span>}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {angles.map((a) => (
                    <div key={a.key}>
                      {photoBox(photoOf(s, a.key), a.label)}
                      <p className="text-muted text-[11px] mt-1 text-center">{a.label}</p>
                    </div>
                  ))}
                </div>
                {s.note && <p className="text-soft text-xs mt-3">{s.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </PanelLayout>
  );
}
