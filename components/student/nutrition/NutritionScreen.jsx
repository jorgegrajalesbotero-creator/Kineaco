"use client";

import { useEffect, useState } from "react";
import { Hand, Info } from "lucide-react";
import { tr } from "@/lib/i18n";
import { supabase } from "@/lib/supabaseClient";
import { MealLogSection } from "@/components/student/nutrition/MealLogSection";
import { cleanDecimal, toNumber } from "@/lib/numbers";

export const ACTIVITY_LEVELS = [
  { key: "sedentario", get label() { return tr("Sedentario"); }, get desc() { return tr("Poco o nada de ejercicio"); }, factor: 1.2 },
  { key: "moderado", get label() { return tr("Moderado"); }, get desc() { return tr("Entrena 3–4 días/semana"); }, factor: 1.375 },
  { key: "activo", get label() { return tr("Activo"); }, get desc() { return tr("Entrena 5–6 días/semana"); }, factor: 1.55 },
];

export const GOALS = [
  { key: "deficit", get label() { return tr("Bajar grasa"); }, pct: -0.2, get tag() { return tr("Déficit"); } },
  { key: "mantener", get label() { return tr("Mantener"); }, pct: 0, get tag() { return tr("Mantenimiento"); } },
  { key: "superavit", get label() { return tr("Ganar músculo"); }, pct: 0.12, get tag() { return tr("Superávit"); } },
];

export function NutritionScreen({ userId, onFirstRoutineAssigned }) {
  const [gender, setGender] = useState("mujer");
  const [weight, setWeight] = useState(65);
  const [height, setHeight] = useState(165);
  const [age, setAge] = useState(28);
  const [activity, setActivity] = useState("moderado");
  const [goal, setGoal] = useState("deficit");
  const [location, setLocation] = useState("gym");
  const [hasProfile, setHasProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [routineUpdated, setRoutineUpdated] = useState(false);

  useEffect(() => {
    const loadNutritionProfile = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("nutrition_profiles")
        .select("weight_kg, height_cm, age, gender, activity_level, goal, location")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        if (data.weight_kg != null) setWeight(data.weight_kg);
        if (data.height_cm != null) setHeight(data.height_cm);
        if (data.age != null) setAge(data.age);
        if (data.gender) setGender(data.gender);
        if (data.activity_level) setActivity(data.activity_level);
        if (data.goal) setGoal(data.goal);
        if (data.location) setLocation(data.location);
      }
      setHasProfile(!!data);
    };
    loadNutritionProfile();
  }, [userId]);

  const bmr = gender === "hombre"
    ? 10 * (Number(weight) || 0) + 6.25 * (Number(height) || 0) - 5 * (Number(age) || 0) + 5
    : 10 * (Number(weight) || 0) + 6.25 * (Number(height) || 0) - 5 * (Number(age) || 0) - 161;
  const factor = ACTIVITY_LEVELS.find((a) => a.key === activity).factor;
  const tdee = bmr * factor;
  const goalObj = GOALS.find((g) => g.key === goal);
  const target = Math.round(tdee * (1 + goalObj.pct));
  const protein = Math.round((Number(weight) || 0) * 2);

  const saveNutritionProfile = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("nutrition_profiles").upsert(
      {
        user_id: userId,
        weight_kg: toNumber(weight),
        height_cm: toNumber(height),
        age: toNumber(age) != null ? Math.round(toNumber(age)) : null,
        gender: gender,
        activity_level: activity,
        goal: goal,
        location: location,
        target_calories: target,
        protein_g: protein,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) {
      alert(tr("No se pudo guardar: ") + error.message);
      return;
    }

    const isFirstSave = !hasProfile;
    // El programa automático solo se asigna la primera vez que el alumno guarda sus datos.
    // Después, cambiar el objetivo o el lugar NO toca las rutinas que armó el coach.
    if (isFirstSave) {
      await supabase.rpc("assign_program_for_user", { p_user_id: userId });
      setRoutineUpdated(true);
      setTimeout(() => setRoutineUpdated(false), 5000);
    }
    setHasProfile(true);

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    if (isFirstSave && onFirstRoutineAssigned) {
      onFirstRoutineAssigned();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-2 pb-4">
      <h1 className="text-ink text-2xl font-semibold mb-1">{tr("Nutrición")}</h1>
      <p className="text-soft text-sm mb-5">{tr("Calcule su punto de partida; después lo ajustamos con su coach.")}</p>

      {hasProfile && <MealLogSection userId={userId} />}

      <div className="bg-card rounded-2xl p-4 mb-4">
        <p className="text-muted text-xs uppercase tracking-wider mb-3">{tr("Sus datos")}</p>
        <div className="flex gap-2 mb-3">
          {["mujer", "hombre"].map((g) => (
            <button key={g} onClick={() => setGender(g)} className={`flex-1 py-2 rounded-lg text-sm capitalize ${gender === g ? "bg-accent text-app font-medium" : "bg-field text-soft"}`}>
              {g === "mujer" ? tr("Mujer") : tr("Hombre")}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { get label() { return tr("Peso (kg)"); }, value: weight, set: setWeight },
            { get label() { return tr("Altura (cm)"); }, value: height, set: setHeight },
            { get label() { return tr("Edad"); }, value: age, set: (v) => setAge(String(v).replace(/\D/g, "")) },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-muted text-[10px] mb-1">{f.label}</p>
              <input type="text" inputMode="decimal" value={f.value} onChange={(e) => f.set(cleanDecimal(e.target.value, 1))} className="block w-full bg-field text-ink text-sm rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-accent" />
            </div>
          ))}
        </div>
        <p className="text-muted text-[10px] mb-1.5">{tr("Nivel de actividad")}</p>
        <div className="space-y-1.5 mb-4">
          {ACTIVITY_LEVELS.map((a) => (
            <button key={a.key} onClick={() => setActivity(a.key)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg bg-field ${activity === a.key ? "ring-1 ring-accent" : ""}`}>
              <span className="text-ink text-xs">{a.label}</span>
              <span className="text-muted text-[10px]">{a.desc}</span>
            </button>
          ))}
        </div>
        <p className="text-muted text-[10px] mb-1.5">{tr("Objetivo")}</p>
        <div className="flex gap-2 mb-4">
          {GOALS.map((g) => (
            <button key={g.key} onClick={() => setGoal(g.key)} className={`flex-1 py-2 rounded-lg text-xs ${goal === g.key ? "bg-accent text-app font-medium" : "bg-field text-soft"}`}>
              {g.label}
            </button>
          ))}
        </div>
        <p className="text-muted text-[10px] mb-1.5">{tr("Dónde entrena")}</p>
        <div className="flex gap-2">
          {[{ key: "casa", get label() { return tr("Casa"); } }, { key: "gym", get label() { return tr("Gym"); } }].map((l) => (
            <button key={l.key} onClick={() => setLocation(l.key)} className={`flex-1 py-2 rounded-lg text-xs ${location === l.key ? "bg-accent text-app font-medium" : "bg-field text-soft"}`}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-field to-deep rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-soft text-xs">{goalObj.tag} {tr("estimado")}</span>
          <span className="text-muted text-[10px]">{tr("Mantenimiento:")} {Math.round(tdee)} {tr("kcal")}</span>
        </div>
        <p className="text-accent text-4xl font-semibold mb-1">
          {target}<span className="text-lg text-soft font-normal"> {tr("kcal/día")}</span>
        </p>
        <p className="text-soft text-xs">{tr("Proteína sugerida: ~")}{protein} {tr("g/día")}</p>
      </div>

      <button
        onClick={saveNutritionProfile}
        disabled={saving}
        className="block w-full bg-accent text-app font-medium text-sm rounded-xl py-3 mb-4 disabled:opacity-60"
      >
        {saving ? tr("Guardando...") : saved ? tr("¡Guardado! ✓") : tr("Guardar mis datos")}
      </button>

      {routineUpdated && (
        <div className="flex items-start gap-2 bg-card border border-accent/30 rounded-xl px-3 py-2.5 mb-4">
          <Info size={14} className="text-accent mt-0.5 shrink-0" />
          <p className="text-accent text-xs leading-relaxed">
            {tr("Le asignamos su rutina según su objetivo y lugar de entrenamiento.")}
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 bg-card rounded-xl px-3 py-2.5 mb-6">
        <Info size={14} className="text-muted mt-0.5 shrink-0" />
        <p className="text-muted text-[11px] leading-relaxed">
          {tr("Es una estimación general (fórmula Mifflin-St Jeor). Su coach puede ajustarla según su progreso real.")}
        </p>
      </div>

      {!hasProfile && <MealLogSection userId={userId} />}

      <p className="text-muted text-xs uppercase tracking-wider mb-2">{tr("Mida sus platos sin báscula")}</p>
      <div className="space-y-2">
        {[
          { get part() { return tr("Palma de su mano"); }, get food() { return tr("Proteína (pollo, carne, pescado)"); } },
          { get part() { return tr("Puño cerrado"); }, get food() { return tr("Verduras y vegetales"); } },
          { get part() { return tr("Mano ahuecada"); }, get food() { return tr("Carbohidratos (arroz, papa, avena)"); } },
          { get part() { return tr("Pulgar completo"); }, get food() { return tr("Grasas (aceite, aguacate, frutos secos)"); } },
        ].map((r) => (
          <div key={r.part} className="flex items-center gap-3 bg-card rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-field flex items-center justify-center shrink-0">
              <Hand size={15} className="text-soft" />
            </div>
            <div>
              <p className="text-ink text-sm">{r.part}</p>
              <p className="text-muted text-xs">{r.food}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
