"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { deleteAccount, getAccount, updateAccount } from "@/lib/account";
import { Skeleton } from "@/components/ui/Skeleton";
import { PanelLayout } from "./PanelLayout";

const field = "w-full bg-field text-ink text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-accent";

// Borra la cuenta de un alumno con TODO lo suyo (rutinas asignadas, progreso, fotos, mensajes...).
// La ruta /api/account borra sus fotos y avatar, y la función de la base revisa que quien borra sea su coach (o admin) y que sea un alumno.
export async function deleteStudent(student) {
  const word = prompt(`Se va a borrar la cuenta de ${student.name || "este alumno"} con TODO lo suyo: entrenamientos, progreso, fotos, medidas, mensajes y su planeación. No se puede deshacer.\n\nPara confirmar, escribí ELIMINAR:`);
  if (word == null) return false;
  if (word.trim().toUpperCase() !== "ELIMINAR") {
    alert("No se borró: había que escribir ELIMINAR.");
    return false;
  }
  const { error } = await deleteAccount(student.id);
  if (error) {
    alert(error);
    return false;
  }
  return true;
}

// Nombre y correo del alumno (los puede cambiar el coach) + eliminar la cuenta
export function AccountPanel({ student, onClose, onChanged, onDeleted }) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: "", email: "" });
  const [original, setOriginal] = useState({ full_name: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error: e } = await getAccount(student.id);
    if (e) setError(e);
    const v = { full_name: data?.full_name ?? student.name ?? "", email: data?.email ?? "" };
    setForm(v);
    setOriginal(v);
    setLoading(false);
  }
  useEffect(() => { load(); }, [student.id]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); setError(""); };

  const save = async () => {
    const changes = {};
    if (form.full_name.trim() !== original.full_name) changes.full_name = form.full_name.trim();
    if (form.email.trim().toLowerCase() !== original.email.toLowerCase()) {
      if (!confirm(`Desde ahora ${form.full_name || "el alumno"} va a iniciar sesión con ${form.email.trim().toLowerCase()}. Avisale el cambio. ¿Continuar?`)) return;
      changes.email = form.email.trim().toLowerCase();
    }
    if (!Object.keys(changes).length) return;
    setSaving(true);
    setError("");
    const { error: e } = await updateAccount(student.id, changes);
    setSaving(false);
    if (e) return setError(e);
    const v = { full_name: form.full_name.trim(), email: form.email.trim().toLowerCase() };
    setForm(v);
    setOriginal(v);
    setSaved(true);
    onChanged?.();
  };

  const remove = async () => {
    setDeleting(true);
    const ok = await deleteStudent({ ...student, name: original.full_name || student.name });
    setDeleting(false);
    if (ok) onDeleted?.();
  };

  const dirty = form.full_name.trim() !== original.full_name || form.email.trim().toLowerCase() !== original.email.toLowerCase();

  return (
    <PanelLayout title="Datos de la cuenta" subtitle={original.full_name || student.name} onClose={onClose}>
      {loading ? (
        <Skeleton rows={2} />
      ) : (
        <>
          <div className="bg-card rounded-xl p-4 space-y-4 mb-3">
            <div>
              <p className="text-muted text-xs mb-1">Nombre completo</p>
              <input value={form.full_name} maxLength={80} onChange={set("full_name")} className={field} />
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Correo (con el que inicia sesión)</p>
              <input type="email" value={form.email} onChange={set("email")} className={field} />
              <p className="text-muted text-[11px] mt-1">El cambio queda activo de una vez, sin correo de confirmación. Su contraseña no cambia.</p>
            </div>
          </div>
          {error && <p className="text-danger text-xs bg-danger/10 rounded-lg px-3 py-2 mb-3">{error}</p>}
          <button onClick={save} disabled={!dirty || saving} className="bg-accent text-app font-semibold text-sm rounded-lg px-5 py-2.5 flex items-center gap-2 disabled:opacity-50">
            {saving ? "Guardando..." : saved && !dirty ? <><Check size={15} /> Guardado</> : "Guardar cambios"}
          </button>

          {!student.isSelf && (
            <div className="mt-10 border border-danger/30 rounded-xl p-4">
              <p className="text-danger text-sm font-semibold flex items-center gap-2 mb-1"><AlertTriangle size={15} /> Eliminar alumno</p>
              <p className="text-muted text-xs mb-3">Borra la cuenta y todo lo suyo (entrenamientos, progreso, fotos, medidas, mensajes y planeación). Sirve para cuentas de prueba o alumnos que pidieron darse de baja. No se puede deshacer.</p>
              <button onClick={remove} disabled={deleting} className="bg-danger/15 text-danger text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-50">
                <Trash2 size={14} /> {deleting ? "Eliminando..." : "Eliminar cuenta"}
              </button>
            </div>
          )}
        </>
      )}
    </PanelLayout>
  );
}
