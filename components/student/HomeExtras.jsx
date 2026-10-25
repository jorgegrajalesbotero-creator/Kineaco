"use client";

import { useEffect, useState } from "react";
import { Camera, ChevronRight, ClipboardCheck, Clock, MessageCircle, Moon, Plus, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { computeBadges, loadBadgeData } from "@/lib/badges";
import { WEEK_DAYS, currentWeekStartISO, daysSince, localDateString } from "@/lib/dates";
import { appLocale, tr } from "@/lib/i18n";
import { PHOTO_REMINDER_DAYS } from "@/components/student/progress/ProgressPhotosSection";
import { checkinWeekStart, isCheckinDay } from "@/lib/checkin";
import { addDays, currentOrNextPlan, loadSchedule, mondayOf, planWeekOf, routinesForDate } from "@/lib/trainingPlan";

const cardCls = "rounded-2xl bg-gradient-to-b from-card to-deep border border-white/[0.06]";
const sectionLabel = "text-muted text-[11px] font-medium uppercase tracking-[0.14em] mb-3";

// Carga todo lo que muestra el Inicio debajo de la rutina de hoy
export function useHomeExtras(userId) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const today = localDateString();
      const [progressRes, assignRes, nutritionRes, mealsRes, messageRes, weightRes, photoRes, badgeStats, checkinRes] = await Promise.all([
        supabase.from("progress").select("completed_at").eq("user_id", userId).gte("completed_at", currentWeekStartISO()),
        loadSchedule(supabase, userId, "id, title, duration_minutes"),
        supabase.from("nutrition_profiles").select("target_calories, protein_g").eq("user_id", userId).maybeSingle(),
        supabase.from("meal_logs").select("calories, protein_g").eq("user_id", userId).eq("log_date", today),
        supabase.from("messages").select("content, created_at, sender_id").eq("user_id", userId).neq("sender_id", userId).order("created_at", { ascending: false }).limit(1),
        supabase.from("body_weight_logs").select("weight_kg, logged_at").eq("user_id", userId).order("logged_at", { ascending: false }).limit(2),
        supabase.from("progress_photo_sets").select("taken_on").eq("user_id", userId).order("taken_on", { ascending: false }).limit(1),
        loadBadgeData(supabase, userId),
        supabase.from("weekly_checkins").select("id").eq("user_id", userId).eq("week_start", checkinWeekStart()).maybeSingle(),
      ]);

      // Días de esta semana con algún ejercicio hecho (0 = lunes)
      const trainedDays = new Set((progressRes.data || []).map((p) => (new Date(p.completed_at).getDay() + 6) % 7));
      // Días con rutina esta semana (del plan si hay plan activo, si no de sus días fijos) y lo de mañana
      const { plans, fixed } = assignRes;
      const monday = mondayOf(new Date());
      const assignedCount = WEEK_DAYS.filter((_, i) => routinesForDate(plans, fixed, addDays(monday, i)).items.length > 0).length;
      const todayIndex = (new Date().getDay() + 6) % 7;
      const tomorrowLabel = WEEK_DAYS[(todayIndex + 1) % 7];
      const tomorrow = routinesForDate(plans, fixed, addDays(new Date(), 1)).items.map((a) => a.routines);
      const plan = currentOrNextPlan(plans);

      const meals = mealsRes.data || [];
      const sum = (key) => meals.reduce((s, m) => s + (Number(m[key]) || 0), 0);

      const badges = computeBadges(badgeStats).filter((b) => !b.unlocked);
      const nextBadge = badges.sort((a, b) => b.current / b.target - a.current / a.target)[0] || null;

      const lastPhoto = photoRes.data?.[0]?.taken_on || null;

      setData({
        trainedDays,
        assignedCount,
        plan,
        planWeek: plan ? planWeekOf(plan, new Date()) : null,
        hasSchedule: plans.length > 0 || fixed.length > 0,
        trainedCount: [...trainedDays].length,
        tomorrowLabel,
        tomorrow,
        nutrition: nutritionRes.data,
        kcal: sum("calories"),
        protein: sum("protein_g"),
        mealsCount: meals.length,
        lastMessage: messageRes.data?.[0] || null,
        weights: weightRes.data || [],
        nextBadge,
        photoDue: !lastPhoto || daysSince(lastPhoto) >= PHOTO_REMINDER_DAYS,
        lastPhoto,
        checkinDue: isCheckinDay() && !checkinRes.data,
      });
    }
    load();
  }, [userId]);

  return data;
}

function Bar({ value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString(appLocale());

// Resumen de la semana + rutina de mañana
export function WeekSummary({ extras }) {
  if (!extras) return null;
  const { trainedCount, assignedCount, tomorrow, tomorrowLabel } = extras;
  return (
    <div className="space-y-2.5 mb-7">
      {assignedCount > 0 && (
        <div className={`${cardCls} p-4`}>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-ink text-sm font-medium">
              {tr("{p0} de {p1} entrenos esta semana", { p0: trainedCount, p1: assignedCount })}
            </p>
            <p className="text-accent text-sm font-semibold tabular-nums">{Math.min(100, Math.round((trainedCount / assignedCount) * 100))}%</p>
          </div>
          <Bar value={trainedCount} max={assignedCount} />
        </div>
      )}
      <div className={`${cardCls} p-4 flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0">
          {tomorrow.length ? <Clock size={17} className="text-soft" /> : <Moon size={17} className="text-soft" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted text-[11px]">{tr("Mañana")} · {tr(tomorrowLabel)}</p>
          <p className="text-ink text-sm font-medium truncate">
            {tomorrow.length ? tomorrow.map((r) => r.title).join(" + ") : tr("Día de descanso")}
          </p>
        </div>
        {tomorrow.length > 0 && (
          <span className="text-soft text-xs shrink-0 tabular-nums">
            {tomorrow.reduce((s, r) => s + (Number(r.duration_minutes) || 0), 0)} {tr("min")}
          </span>
        )}
      </div>
    </div>
  );
}

// Calorías y proteína de hoy frente a la meta
export function TodayNutrition({ extras, onOpen }) {
  if (!extras?.nutrition) return null;
  const { nutrition, kcal, protein, mealsCount } = extras;
  return (
    <>
      <p className={sectionLabel}>{tr("Nutrición de hoy")}</p>
      <div className={`${cardCls} p-4 mb-7`}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-ink text-xl font-semibold tabular-nums leading-none">
              {fmt(kcal)} <span className="text-muted text-xs font-normal">/ {fmt(nutrition.target_calories)} kcal</span>
            </p>
            <p className="text-muted text-[11px] mt-1.5 mb-2">{tr("Calorías")}</p>
            <Bar value={kcal} max={nutrition.target_calories} />
          </div>
          <div>
            <p className="text-ink text-xl font-semibold tabular-nums leading-none">
              {fmt(protein)} <span className="text-muted text-xs font-normal">/ {fmt(nutrition.protein_g)} g</span>
            </p>
            <p className="text-muted text-[11px] mt-1.5 mb-2">{tr("Proteína")}</p>
            <Bar value={protein} max={nutrition.protein_g} />
          </div>
        </div>
        <button onClick={onOpen} className="w-full flex items-center justify-center gap-1.5 bg-white/[0.05] border border-white/[0.06] text-ink text-sm font-medium rounded-xl py-2.5 active:scale-[0.98] transition-transform">
          {mealsCount ? <Utensils size={14} /> : <Plus size={15} />}
          {mealsCount ? tr("Ver comidas de hoy ({p0})", { p0: mealsCount }) : tr("Registrar comida")}
        </button>
      </div>
    </>
  );
}

// Último mensaje del coach
export function CoachMessage({ extras, onOpen }) {
  const msg = extras?.lastMessage;
  if (!msg) return null;
  const when = new Date(msg.created_at).toLocaleDateString(appLocale(), { day: "numeric", month: "short" });
  return (
    <>
      <p className={sectionLabel}>{tr("Mensaje de su coach")}</p>
      <button onClick={onOpen} className={`${cardCls} w-full text-left p-4 mb-7 active:scale-[0.99] transition-transform`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <MessageCircle size={16} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink text-sm leading-snug line-clamp-2">{msg.content}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-muted text-[11px]">{when}</span>
              <span className="text-accent text-xs font-medium flex items-center gap-0.5">
                {tr("Responder")} <ChevronRight size={13} />
              </span>
            </div>
          </div>
        </div>
      </button>
    </>
  );
}

// Próxima insignia, peso y aviso de fotos
export function GoalsAndReminders({ extras, onOpenProgress }) {
  if (!extras) return null;
  const { nextBadge, weights, photoDue, lastPhoto } = extras;
  const latest = weights[0];
  const diff = weights.length >= 2 ? Math.round((weights[0].weight_kg - weights[1].weight_kg) * 10) / 10 : null;
  const Icon = nextBadge?.icon;

  return (
    <>
      <p className={sectionLabel}>{tr("Metas")}</p>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <button onClick={onOpenProgress} className={`${cardCls} p-4 text-left active:scale-[0.98] transition-transform`}>
          {nextBadge ? (
            <>
              <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center mb-3">
                <Icon size={15} className="text-soft" />
              </div>
              <p className="text-muted text-[11px]">{tr("Próxima insignia")}</p>
              <p className="text-ink text-sm font-medium leading-snug mb-2 line-clamp-2">{tr(nextBadge.title)}</p>
              <Bar value={nextBadge.current} max={nextBadge.target} />
              <p className="text-muted text-[11px] mt-1.5 tabular-nums">{nextBadge.current} / {nextBadge.target}</p>
            </>
          ) : (
            <>
              <p className="text-muted text-[11px]">{tr("Insignias")}</p>
              <p className="text-ink text-sm font-medium">{tr("¡Las tiene todas!")}</p>
            </>
          )}
        </button>
        <button onClick={onOpenProgress} className={`${cardCls} p-4 text-left active:scale-[0.98] transition-transform`}>
          <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center mb-3">
            {diff != null && diff > 0 ? <TrendingUp size={15} className="text-soft" /> : <TrendingDown size={15} className="text-soft" />}
          </div>
          <p className="text-muted text-[11px]">{tr("Peso corporal")}</p>
          {latest ? (
            <>
              <p className="text-ink text-2xl font-semibold tabular-nums leading-tight">
                {latest.weight_kg} <span className="text-muted text-xs font-normal">kg</span>
              </p>
              {diff != null && (
                <p className="text-soft text-[11px] mt-1 tabular-nums">
                  {diff > 0 ? "+" : ""}{diff} kg {tr("desde el registro anterior")}
                </p>
              )}
            </>
          ) : (
            <p className="text-ink text-sm font-medium mt-1">{tr("Registre su peso")}</p>
          )}
        </button>
      </div>
      {photoDue && (
        <button onClick={onOpenProgress} className={`${cardCls} w-full p-4 mb-7 flex items-center gap-3 text-left active:scale-[0.99] transition-transform`}>
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <Camera size={17} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink text-sm font-medium">{tr("Es momento de sus fotos de progreso")}</p>
            <p className="text-muted text-xs">
              {lastPhoto ? tr("Pasaron {p0} días desde las últimas.", { p0: daysSince(lastPhoto) }) : tr("Todavía no ha subido ninguna.")}
            </p>
          </div>
          <ChevronRight size={16} className="text-muted shrink-0" />
        </button>
      )}
      {!photoDue && <div className="mb-4" />}
    </>
  );
}

// Domingo/lunes: invitación a hacer el check-in semanal
export function CheckinCard({ extras, onOpen }) {
  if (!extras?.checkinDue) return null;
  return (
    <button onClick={onOpen} className="w-full mb-7 rounded-2xl bg-accent/[0.08] border border-accent/25 p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
        <ClipboardCheck size={18} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-medium">{tr("Hoy toca su check-in semanal")}</p>
        <p className="text-soft text-xs">{tr("Cuéntele a su coach cómo le fue esta semana (2 minutos).")}</p>
      </div>
      <ChevronRight size={16} className="text-accent shrink-0" />
    </button>
  );
}
