"use client";

import { Check } from "lucide-react";
import { GUARDIAN_DOC_TYPES, GUARDIAN_RELATIONSHIPS, ageFrom } from "@/lib/legal";
import { tr } from "@/lib/i18n";

const inputCls =
  "w-full bg-app/60 border border-white/[0.07] text-ink text-[15px] rounded-xl px-4 py-3 outline-none placeholder:text-muted focus:border-accent/50 transition";

function CheckRow({ checked, onToggle, children }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(); } }}
      className="w-full flex items-start gap-3 text-left cursor-pointer outline-none"
    >
      <span className={`w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center ${checked ? "bg-accent" : "border border-field-strong"}`}>
        {checked && <Check size={14} strokeWidth={3} className="text-app" />}
      </span>
      <span className="text-soft text-xs leading-relaxed">{children}</span>
    </div>
  );
}

const link = (href, text) => (
  <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent underline underline-offset-2">
    {text}
  </a>
);

// Fecha de nacimiento, datos del acudiente (si es menor) y las dos autorizaciones
export function ConsentFields({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const age = ageFrom(value.birthDate);
  const minor = age !== null && age < 18;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-muted text-xs px-1">{tr("Fecha de nacimiento")}</span>
        <input type="date" value={value.birthDate} max={today} onChange={(e) => set("birthDate", e.target.value)} required className={`${inputCls} mt-1`} />
      </label>

      {minor && (
        <div className="rounded-2xl border border-warning/30 bg-warning/[0.06] p-4 space-y-3">
          <p className="text-ink text-sm font-medium">{tr("Usted es menor de edad")}</p>
          <p className="text-soft text-xs leading-relaxed">
            {tr("Para usar la app necesita la autorización de su padre, madre o acudiente. Pídale que llene estos datos y marque la autorización.")}
          </p>
          <input value={value.guardianName} onChange={(e) => set("guardianName", e.target.value)} maxLength={120} placeholder={tr("Nombre y apellidos del acudiente")} className={inputCls} />
          <select value={value.guardianDocType} onChange={(e) => set("guardianDocType", e.target.value)} className={inputCls}>
            {GUARDIAN_DOC_TYPES.map((d) => <option key={d.key} value={d.key}>{tr(d.label)}</option>)}
          </select>
          <div>
            <input value={value.guardianDocNumber} onChange={(e) => set("guardianDocNumber", e.target.value.replace(/[^A-Za-z0-9]/g, ""))} maxLength={15} inputMode="numeric" placeholder={tr("Número de documento")} className={inputCls} />
          </div>
          <select value={value.guardianRelationship} onChange={(e) => set("guardianRelationship", e.target.value)} className={inputCls}>
            {GUARDIAN_RELATIONSHIPS.map((r) => <option key={r.key} value={r.key}>{tr(r.label)}</option>)}
          </select>
          <input type="email" value={value.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} maxLength={120} placeholder={tr("Correo del acudiente")} className={inputCls} />
          <CheckRow checked={value.guardianAccept} onToggle={() => set("guardianAccept", !value.guardianAccept)}>
            {tr("Como padre, madre o acudiente, autorizo que este menor use Kineaco y acepto en su nombre los Términos y la Política de datos.")}
          </CheckRow>
        </div>
      )}

      <div className="space-y-3 pt-1">
        <CheckRow checked={value.terms} onToggle={() => set("terms", !value.terms)}>
          {tr("Acepto los")} {link("/terminos", tr("Términos y Condiciones"))} {tr("y autorizo el tratamiento de mis datos según la")} {link("/privacidad", tr("Política de datos"))}. <span className="text-danger">*</span>
        </CheckRow>
        <CheckRow checked={value.health} onToggle={() => set("health", !value.health)}>
          {tr("(Opcional) Autorizo de forma expresa el tratamiento de mis datos de salud — ficha de lesiones y condiciones, medidas, fotos de progreso y dolor reportado — para que mi coach adapte mi entrenamiento de forma segura.")}{" "}
          <span className="text-muted">
            {tr("Son datos sensibles: no está obligado a autorizarlo. Sin esta autorización puede usar la app, pero esas funciones no estarán disponibles. Puede cambiarlo cuando quiera en Perfil.")}
          </span>
        </CheckRow>
      </div>
    </div>
  );
}
