"use client";

import { useEffect, useState } from "react";
import { localDateString } from "@/lib/dates";
import { appLocale, tr } from "@/lib/i18n";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/Skeleton";
import { cleanDecimal } from "@/lib/numbers";

export const MEAL_TYPES = [
  { key: "desayuno", get label() { return tr("Desayuno"); } },
  { key: "almuerzo", get label() { return tr("Almuerzo"); } },
  { key: "cena", get label() { return tr("Cena"); } },
  { key: "snack", get label() { return tr("Snacks"); } },
];

export const MEAL_DAYS_BACK = 7;

export function MealLogSection({ userId }) {
  const today = localDateString();
  const dayOptions = Array.from({ length: MEAL_DAYS_BACK + 1 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const value = localDateString(d);
    const label =
      i === 0 ? tr("Hoy") : i === 1 ? tr("Ayer") : d.toLocaleDateString(appLocale(), { weekday: "short", day: "numeric" });
    return { value, label };
  });

  const [selectedDate, setSelectedDate] = useState(today);
  const [meals, setMeals] = useState([]);
  const [targets, setTargets] = useState({ calories: null, protein: null });
  const [loading, setLoading] = useState(true);
  const [formType, setFormType] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [descDraft, setDescDraft] = useState("");
  const [kcalDraft, setKcalDraft] = useState("");
  const [protDraft, setProtDraft] = useState("");
  const [savingMeal, setSavingMeal] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("nutrition_profiles")
      .select("target_calories, protein_g")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setTargets({ calories: data?.target_calories ?? null, protein: data?.protein_g ?? null }));
  }, [userId]);

  const loadMeals = async (date) => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("meal_logs")
      .select("id, meal_type, description, calories, protein_g, created_at")
      .eq("user_id", userId)
      .eq("log_date", date)
      .order("created_at", { ascending: true });
    setMeals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMeals(selectedDate);
  }, [userId, selectedDate]);

  const closeForm = () => {
    setFormType(null);
    setEditingId(null);
    setDescDraft("");
    setKcalDraft("");
    setProtDraft("");
  };

  const openNew = (type) => {
    closeForm();
    setFormType(type);
  };

  const openEdit = (meal) => {
    setFormType(meal.meal_type);
    setEditingId(meal.id);
    setDescDraft(meal.description);
    setKcalDraft(meal.calories != null ? String(meal.calories) : "");
    setProtDraft(meal.protein_g != null ? String(meal.protein_g) : "");
  };

  const changeDay = (value) => {
    closeForm();
    setSelectedDate(value);
  };

  const saveMeal = async () => {
    if (!descDraft.trim()) return;
    setSavingMeal(true);
    const values = {
      description: descDraft.trim(),
      calories: kcalDraft === "" ? null : Number(kcalDraft),
      protein_g: protDraft === "" ? null : Number(protDraft),
    };
    const { error } = editingId
      ? await supabase.from("meal_logs").update({ ...values, updated_at: new Date().toISOString() }).eq("id", editingId)
      : await supabase.from("meal_logs").insert({ ...values, user_id: userId, log_date: selectedDate, meal_type: formType });
    setSavingMeal(false);
    if (error) {
      alert(tr("No se pudo guardar la comida: ") + error.message);
      return;
    }
    closeForm();
    loadMeals(selectedDate);
  };

  const deleteMeal = async (meal) => {
    if (!window.confirm(tr("¿Borrar \"{p0}\"?", { p0: meal.description }))) return;
    const { error } = await supabase.from("meal_logs").delete().eq("id", meal.id);
    if (error) {
      alert(tr("No se pudo borrar: ") + error.message);
      return;
    }
    if (editingId === meal.id) closeForm();
    loadMeals(selectedDate);
  };

  const withKcal = meals.filter((m) => m.calories != null);
  const withProt = meals.filter((m) => m.protein_g != null);
  const totalKcal = withKcal.reduce((sum, m) => sum + Number(m.calories), 0);
  const totalProt = withProt.reduce((sum, m) => sum + Number(m.protein_g), 0);
  const fmt = (n) => Number(n).toLocaleString(appLocale(), { maximumFractionDigits: 0 });

  const renderForm = () => (
    <div className="bg-field rounded-xl p-3 mt-2 space-y-2">
      <input
        value={descDraft}
        onChange={(e) => setDescDraft(e.target.value)}
        placeholder={tr("¿Qué comió? Ej: 2 huevos, arepa y café")}
        className="block w-full bg-card text-ink text-sm rounded-lg px-3 py-2 outline-none"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={kcalDraft}
          onChange={(e) => setKcalDraft(cleanDecimal(e.target.value))}
          placeholder={tr("kcal (opcional)")}
          className="block w-full bg-card text-ink text-sm rounded-lg px-3 py-2 outline-none"
        />
        <input
          type="text"
          inputMode="decimal"
          value={protDraft}
          onChange={(e) => setProtDraft(cleanDecimal(e.target.value))}
          placeholder={tr("Proteína g (opcional)")}
          className="block w-full bg-card text-ink text-sm rounded-lg px-3 py-2 outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={closeForm} disabled={savingMeal} className="flex-1 bg-card text-soft text-sm rounded-lg py-2 disabled:opacity-60">
          {tr("Cancelar")}
        </button>
        <button
          onClick={saveMeal}
          disabled={savingMeal || !descDraft.trim()}
          className="flex-1 bg-accent text-app font-semibold text-sm rounded-lg py-2 disabled:opacity-60"
        >
          {savingMeal ? tr("Guardando...") : tr("Guardar")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="mb-6">
      <p className="text-muted text-xs uppercase tracking-wider mb-3">{tr("Mis comidas")}</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {dayOptions.map((d) => (
          <button
            key={d.value}
            onClick={() => changeDay(d.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs capitalize ${selectedDate === d.value ? "bg-accent text-app font-medium" : "bg-field text-soft"}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {(withKcal.length > 0 || withProt.length > 0) && (
        <div className="bg-card rounded-2xl px-4 py-3 mb-3 flex items-center justify-between">
          <div>
            <p className="text-muted text-[10px] uppercase tracking-wider">{tr("Calorías")}</p>
            <p className="text-accent text-lg font-semibold">
              {fmt(totalKcal)}
              {targets.calories ? <span className="text-soft text-xs font-normal"> / {fmt(targets.calories)} {tr("kcal")}</span> : <span className="text-soft text-xs font-normal"> {tr("kcal")}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted text-[10px] uppercase tracking-wider">{tr("Proteína")}</p>
            <p className="text-ink text-lg font-semibold">
              {fmt(totalProt)}
              <span className="text-soft text-xs font-normal">{targets.protein ? tr(" / {p0} g", { p0: fmt(targets.protein) }) : tr(" g")}</span>
            </p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 space-y-4">
        {loading ? (
          <Skeleton />
        ) : (
          MEAL_TYPES.map((t) => {
            const items = meals.filter((m) => m.meal_type === t.key);
            return (
              <div key={t.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-ink text-sm font-medium">{t.label}</p>
                  {formType !== t.key && (
                    <button onClick={() => openNew(t.key)} className="text-accent text-xs font-medium">{tr("+ Agregar")}</button>
                  )}
                </div>
                {items.length === 0 && formType !== t.key && (
                  <p className="text-muted text-xs">{tr("Sin registrar")}</p>
                )}
                {items.map((m) =>
                  editingId === m.id ? (
                    <div key={m.id}>{renderForm()}</div>
                  ) : (
                    <div key={m.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-field last:border-0">
                      <div>
                        <p className="text-ink text-sm">{m.description}</p>
                        {(m.calories != null || m.protein_g != null) && (
                          <p className="text-muted text-xs">
                            {m.calories != null ? tr("{p0} kcal", { p0: fmt(m.calories) }) : ""}
                            {m.calories != null && m.protein_g != null ? " · " : ""}
                            {m.protein_g != null ? tr("{p0} g proteína", { p0: fmt(m.protein_g) }) : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-3 shrink-0">
                        <button onClick={() => openEdit(m)} className="text-soft text-xs">{tr("Editar")}</button>
                        <button onClick={() => deleteMeal(m)} className="text-danger text-xs">{tr("Borrar")}</button>
                      </div>
                    </div>
                  )
                )}
                {formType === t.key && !editingId && renderForm()}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
