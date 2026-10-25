"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { localDateString } from "@/lib/dates";
import { PanelLayout } from "./PanelLayout";
import { Skeleton } from "@/components/ui/Skeleton";

// Datos de nutrición del alumno y sus comidas de los últimos 14 días
export function NutritionPanel({ student, onClose }) {
  const [nutritionData, setNutritionData] = useState(null);
  const [mealLogs, setMealLogs] = useState([]);
  const [loadingNutrition, setLoadingNutrition] = useState(true);

  useEffect(() => {
    async function load() {
      setLoadingNutrition(true);
      const since = new Date();
      since.setDate(since.getDate() - 13);
      const [{ data }, { data: meals }] = await Promise.all([
        supabase
          .from("nutrition_profiles")
          .select("weight_kg, height_cm, age, gender, activity_level, goal, target_calories, protein_g, updated_at")
          .eq("user_id", student.id)
          .maybeSingle(),
        supabase
          .from("meal_logs")
          .select("id, log_date, meal_type, description, calories, protein_g, created_at")
          .eq("user_id", student.id)
          .gte("log_date", localDateString(since))
          .order("log_date", { ascending: false })
          .order("created_at", { ascending: true }),
      ]);
      setNutritionData(data || null);
      setMealLogs(meals || []);
      setLoadingNutrition(false);
    }
    load();
  }, [student.id]);

  return (
    <PanelLayout title="Nutrición" subtitle={student.name} onClose={onClose}>
      {loadingNutrition ? (
        <Skeleton />
      ) : !nutritionData ? (
        <p className="text-muted text-sm">Este alumno todavía no completó su información de nutrición.</p>
      ) : (
        <div className="bg-card rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-muted text-xs mb-0.5">Peso</p><p className="text-ink text-sm">{nutritionData.weight_kg} kg</p></div>
            <div><p className="text-muted text-xs mb-0.5">Altura</p><p className="text-ink text-sm">{nutritionData.height_cm} cm</p></div>
            <div><p className="text-muted text-xs mb-0.5">Edad</p><p className="text-ink text-sm">{nutritionData.age} años</p></div>
            <div><p className="text-muted text-xs mb-0.5">Sexo</p><p className="text-ink text-sm capitalize">{nutritionData.gender}</p></div>
            <div><p className="text-muted text-xs mb-0.5">Actividad</p><p className="text-ink text-sm capitalize">{nutritionData.activity_level}</p></div>
            <div><p className="text-muted text-xs mb-0.5">Objetivo</p><p className="text-ink text-sm capitalize">{nutritionData.goal}</p></div>
          </div>
          <div className="border-t border-field pt-3 flex items-center justify-between">
            <div>
              <p className="text-muted text-xs mb-0.5">Calorías objetivo</p>
              <p className="text-accent text-2xl font-semibold">{nutritionData.target_calories} <span className="text-sm text-soft font-normal">kcal/día</span></p>
            </div>
            <div className="text-right">
              <p className="text-muted text-xs mb-0.5">Proteína sugerida</p>
              <p className="text-ink text-sm">{nutritionData.protein_g} g/día</p>
            </div>
          </div>
          <p className="text-muted text-[10px] pt-2">
            Última actualización: {new Date(nutritionData.updated_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
      )}
      {!loadingNutrition && (() => {
        const mealOrder = ["desayuno", "almuerzo", "cena", "snack"];
        const mealLabels = { desayuno: "Desayuno", almuerzo: "Almuerzo", cena: "Cena", snack: "Snack" };
        const days = [];
        mealLogs.forEach((m) => {
          let day = days.find((d) => d.date === m.log_date);
          if (!day) { day = { date: m.log_date, items: [] }; days.push(day); }
          day.items.push(m);
        });
        const fmt = (n) => Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });
        return (
          <div className="mt-6">
            <p className="text-ink text-sm font-medium">Comidas registradas</p>
            <p className="text-muted text-xs mb-3">Últimos 14 días</p>
            {days.length === 0 ? (
              <div className="bg-card rounded-xl p-5">
                <p className="text-muted text-sm">El alumno no registró comidas en los últimos 14 días.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {days.map((d) => {
                  const withKcal = d.items.filter((m) => m.calories != null);
                  const withProt = d.items.filter((m) => m.protein_g != null);
                  const kcal = withKcal.reduce((sum, m) => sum + Number(m.calories), 0);
                  const prot = withProt.reduce((sum, m) => sum + Number(m.protein_g), 0);
                  return (
                    <div key={d.date} className="bg-card rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <p className="text-ink text-sm font-medium capitalize">
                          {new Date(d.date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "short" })}
                        </p>
                        <div className="text-right text-xs">
                          {withKcal.length > 0 && (
                            <p className="text-accent">
                              {fmt(kcal)}{nutritionData?.target_calories ? ` / ${fmt(nutritionData.target_calories)}` : ""} kcal
                            </p>
                          )}
                          {withProt.length > 0 && (
                            <p className="text-soft">
                              {fmt(prot)}{nutritionData?.protein_g ? ` / ${fmt(nutritionData.protein_g)}` : ""} g proteína
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {mealOrder.map((type) => {
                          const items = d.items.filter((m) => m.meal_type === type);
                          if (items.length === 0) return null;
                          return (
                            <div key={type}>
                              <p className="text-muted text-[11px] uppercase tracking-wider mb-1">{mealLabels[type]}</p>
                              {items.map((m) => (
                                <div key={m.id} className="flex items-start justify-between gap-3 text-sm">
                                  <p className="text-ink">{m.description}</p>
                                  {(m.calories != null || m.protein_g != null) && (
                                    <p className="text-soft text-xs whitespace-nowrap">
                                      {m.calories != null ? `${fmt(m.calories)} kcal` : ""}
                                      {m.calories != null && m.protein_g != null ? " · " : ""}
                                      {m.protein_g != null ? `${fmt(m.protein_g)} g` : ""}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </PanelLayout>
  );
}
