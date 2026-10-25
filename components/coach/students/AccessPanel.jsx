"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { INTAKE_EXPERIENCE, INTAKE_GOALS, intakeHasAlert, intakeLabel } from "@/lib/intake";
import { GUARDIAN_RELATIONSHIPS, LEGAL_VERSION, ageFrom } from "@/lib/legal";
import { PanelLayout } from "./PanelLayout";
import { Skeleton } from "@/components/ui/Skeleton";

// Habilitar o quitar el acceso del alumno, y ver su ficha de ingreso
export function AccessPanel({ student, onClose, onChanged }) {
  const [customAccessDate, setCustomAccessDate] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessIntake, setAccessIntake] = useState(null);
  const [loadingIntake, setLoadingIntake] = useState(true);
  const [consent, setConsent] = useState(undefined);

  useEffect(() => {
    async function load() {
      setLoadingIntake(true);
      const { data } = await supabase.from("intake_forms").select("*").eq("user_id", student.id).maybeSingle();
      setAccessIntake(data || null);
      setLoadingIntake(false);
      const { data: c, error } = await supabase
        .from("legal_consents")
        .select("*")
        .eq("user_id", student.id)
        .order("created_at", { ascending: false })
        .limit(1);
      setConsent(error ? null : c?.[0] || null);
    }
    load();
  }, [student.id]);

  const saveAccessUntil = async (until) => {
    setSavingAccess(true);
    const { error } = await supabase
      .from("profiles")
      .update({ access_until: until ? until.toISOString() : null })
      .eq("id", student.id);
    setSavingAccess(false);
    if (error) return alert("No se pudo guardar el acceso: " + error.message);
    onChanged?.();
    onClose();
  };

  const setAccessDuration = (months) => {
    const until = new Date();
    until.setMonth(until.getMonth() + months);
    saveAccessUntil(until);
  };

  const setAccessCustomDate = () => {
    if (customAccessDate) saveAccessUntil(new Date(customAccessDate + "T23:59:59"));
  };

  const revokeAccess = () => {
    if (confirm("¿Seguro que querés quitarle el acceso a este alumno?")) saveAccessUntil(null);
  };

  const until = student?.accessUntil ? new Date(student.accessUntil) : null;
  const isActive = !!(until && until > new Date());
  const statusLabel = !until ? "Sin acceso" : isActive ? `Activo hasta ${until.toLocaleDateString()}` : `Vencido el ${until.toLocaleDateString()}`;
  const fi = accessIntake;
  const infoRow = (labelText, value, highlight) => (
    <div>
      <p className="text-muted text-xs mb-0.5">{labelText}</p>
      <p className={`text-sm whitespace-pre-wrap ${highlight ? "text-danger" : "text-ink"}`}>{value || "—"}</p>
    </div>
  );

  return (
    <PanelLayout title="Acceso" subtitle={student.name} onClose={onClose}>
      <div className="bg-card rounded-xl p-4 mb-6">
        <p className="text-muted text-xs mb-1">Estado actual</p>
        <p className={`text-sm font-medium ${isActive ? "text-accent" : "text-danger"}`}>{statusLabel}</p>
      </div>

      <p className="text-muted text-xs uppercase tracking-wider mb-2">Habilitar por</p>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setAccessDuration(1)} disabled={savingAccess} className="flex-1 bg-field text-accent text-sm rounded-lg py-2.5 disabled:opacity-60">1 mes</button>
        <button onClick={() => setAccessDuration(3)} disabled={savingAccess} className="flex-1 bg-field text-accent text-sm rounded-lg py-2.5 disabled:opacity-60">3 meses</button>
        <button onClick={() => setAccessDuration(12)} disabled={savingAccess} className="flex-1 bg-field text-accent text-sm rounded-lg py-2.5 disabled:opacity-60">1 año</button>
      </div>

      <p className="text-muted text-xs uppercase tracking-wider mb-2">O elegir una fecha exacta</p>
      <div className="flex gap-2 mb-6">
        <input
          type="date"
          value={customAccessDate}
          onChange={(e) => setCustomAccessDate(e.target.value)}
          className="flex-1 bg-field text-ink text-sm rounded-lg px-3 py-2.5 outline-none"
        />
        <button onClick={setAccessCustomDate} disabled={savingAccess || !customAccessDate} className="bg-accent text-app font-medium text-sm rounded-lg px-4 disabled:opacity-60">
          Guardar
        </button>
      </div>

      <button onClick={revokeAccess} disabled={savingAccess} className="text-danger text-sm flex items-center gap-1.5 disabled:opacity-60">
        <X size={14} /> Quitar acceso ahora
      </button>

      {consent !== undefined && (
        <div className="mt-8 bg-card rounded-xl p-4">
          <p className="text-ink text-sm font-medium mb-2">Autorizaciones</p>
          {!consent ? (
            <p className="text-warning text-xs">Todavía no aceptó los Términos y la Política de datos (se le pide al entrar).</p>
          ) : (
            <div className="space-y-1.5 text-xs">
              <p className="text-soft">
                Términos y política: <span className="text-ink">aceptados el {new Date(consent.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</span>
                {consent.doc_version !== LEGAL_VERSION && <span className="text-warning"> · versión anterior</span>}
              </p>
              <p className="text-soft">
                Datos de salud: {consent.health_data_consent ? <span className="text-accent">autorizados</span> : <span className="text-warning">no autorizados (no ve ficha de salud, medidas, fotos ni dolor)</span>}
              </p>
              {consent.birth_date && <p className="text-soft">Edad: <span className="text-ink">{ageFrom(consent.birth_date)} años</span></p>}
              {consent.is_minor && (
                <p className="text-soft">
                  Menor de edad · autorizó {GUARDIAN_RELATIONSHIPS.find((r) => r.key === consent.guardian_relationship)?.label.toLowerCase() || "acudiente"}:{" "}
                  <span className="text-ink">{consent.guardian_name} ({consent.guardian_doc_type} {consent.guardian_doc_number}) · {consent.guardian_email}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-ink text-sm font-medium">Ficha de ingreso</p>
          {fi && (
            <span className="text-muted text-[11px]">
              Actualizada el {new Date(fi.updated_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        {loadingIntake ? (
          <Skeleton />
        ) : !fi ? (
          <div className="bg-card rounded-xl p-4">
            <p className="text-muted text-sm">Este alumno todavía no completó su ficha.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {intakeHasAlert(fi) && (
              <div className="bg-danger/10 border border-danger/40 rounded-xl px-4 py-3">
                <p className="text-danger text-sm font-medium">
                  ⚠ {[fi.current_injury && "Lesión actual", fi.medical_restriction && "Restricción médica"].filter(Boolean).join(" y ")}
                </p>
                <p className="text-danger/80 text-xs">Revisá el detalle antes de armar su rutina.</p>
              </div>
            )}
            <div className="bg-card rounded-xl p-4 grid grid-cols-2 gap-3">
              {infoRow("Objetivo", intakeLabel(INTAKE_GOALS, fi.main_goal))}
              {infoRow("Experiencia", intakeLabel(INTAKE_EXPERIENCE, fi.experience))}
              {infoRow("Días por semana", fi.days_per_week ? `${fi.days_per_week} días` : null)}
              <div className="col-span-2">{infoRow("En sus palabras", fi.goal_detail)}</div>
            </div>
            <div className="bg-card rounded-xl p-4 space-y-3">
              {infoRow("Lesiones anteriores", fi.past_injuries ? fi.past_injuries_detail || "Sí" : "No")}
              {infoRow("Lesión o dolor actual", fi.current_injury ? fi.current_injury_detail || "Sí" : "No", fi.current_injury)}
            </div>
            <div className="bg-card rounded-xl p-4 space-y-3">
              {infoRow("Condiciones médicas", fi.medical_conditions)}
              {infoRow("Medicamentos", fi.medications)}
              {infoRow("Restricción médica", fi.medical_restriction ? fi.medical_restriction_detail || "Sí" : "No", fi.medical_restriction)}
            </div>
            <div className="bg-card rounded-xl p-4 grid grid-cols-2 gap-3">
              {infoRow("Contacto de emergencia", fi.emergency_name)}
              {infoRow("Teléfono", fi.emergency_phone)}
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
