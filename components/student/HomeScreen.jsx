"use client";

import { CalendarDays, Check, ChevronRight, Clock, Dumbbell, Flame, Info, Play, User } from "lucide-react";
import { WEEK_DAYS } from "@/lib/dates";
import { appLocale, dayLetters, tr } from "@/lib/i18n";
import { AnnouncementCard } from "@/components/student/Announcements";
import { CheckinCard, CoachMessage, GoalsAndReminders, TodayNutrition, WeekSummary, useHomeExtras } from "@/components/student/HomeExtras";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return tr("Buenos días,");
  if (h < 19) return tr("Buenas tardes,");
  return tr("Buenas noches,");
}

// Anillo de progreso del entrenamiento de hoy
function ProgressRing({ done, total, size = 76 }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="text-accent transition-[stroke-dashoffset] duration-700 ease-out drop-"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-ink text-lg font-semibold tabular-nums leading-none">{Math.round(pct * 100)}%</span>
        <span className="text-soft text-[10px] mt-0.5 tabular-nums">{done}/{total}</span>
      </div>
    </div>
  );
}

export function HomeScreen({ userId, onNavigate, onOpenCheckin, onOpenAnnouncements, onAnnouncementRead, onOpenRoutine, onOpenCalendar, fullName, avatarUrl, routine, loading, selectedDay, onSelectDay, streak, onGoToNutrition, hasNutritionProfile, needsIntake, onOpenIntake, bell }) {
  const extras = useHomeExtras(userId);
  const doneCount = routine ? routine.exercises.filter((e) => e.completed).length : 0;
  const total = routine ? routine.exercises.length : 0;
  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayIndex);
  const rawDate = today.toLocaleDateString(appLocale(), { weekday: "long", day: "numeric", month: "long" });
  const dateLine = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <div className="relative flex-1 overflow-y-auto px-5 pt-2 pb-4">
      {/* En computador el Inicio usa dos columnas: hoy y la semana a la izquierda, el resto a la derecha */}
      <div className="lg:max-w-5xl!">
        <div className="relative flex justify-between items-center mb-7 animate-fade-up">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-[2px] rounded-full bg-gradient-to-br from-accent to-accent/20 shrink-0">
              <div className="w-11 h-11 rounded-full bg-field flex items-center justify-center overflow-hidden ring-2 ring-app">
                {avatarUrl ? <img src={avatarUrl} alt="" decoding="async" className="w-full h-full object-cover" /> : <User size={18} className="text-muted" />}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-soft text-[13px]">{greeting()}</p>
              <h1 className="text-ink text-[22px] font-semibold tracking-tight leading-tight truncate">{fullName || "..."}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-gradient-to-b from-danger/20 to-danger/5 border border-danger/25 px-3 h-10 rounded-full">
              <Flame size={15} className="text-danger drop-" fill="currentColor" />
              <span className="text-ink text-sm font-semibold tabular-nums">{streak}</span>
            </div>
            {bell}
          </div>
        </div>

        {needsIntake && (
          <button onClick={onOpenIntake} className="relative w-full flex items-center gap-3 bg-accent/[0.08] border border-accent/25 rounded-2xl p-3.5 mb-5 text-left active:scale-[0.99] transition-transform">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Info size={17} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-ink text-sm font-medium">{tr("Complete su ficha de ingreso")}</p>
              <p className="text-soft text-xs">{tr("Así su coach conoce sus lesiones y objetivos.")}</p>
            </div>
            <ChevronRight size={16} className="text-accent shrink-0" />
          </button>
        )}

        <AnnouncementCard userId={userId} onOpenAll={onOpenAnnouncements} onRead={onAnnouncementRead} />
        <CheckinCard extras={extras} onOpen={onOpenCheckin} />
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
          <div>
            <div className="relative flex items-baseline justify-between mb-3">
              <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em]">{routine?.parts?.length > 1 ? tr("Su entrenamiento de hoy") : tr("Su rutina de hoy")}</p>
              <p className="text-muted text-[11px]">{dateLine}</p>
            </div>

            {loading ? (
              <div className="rounded-3xl p-5 mb-7 bg-card border border-white/[0.05] space-y-3">
                <div className="h-3 w-24 rounded-full bg-field animate-pulse" />
                <div className="h-6 w-48 rounded-full bg-field animate-pulse" />
                <div className="h-16 rounded-2xl bg-field/70 animate-pulse" />
              </div>
            ) : !routine && !hasNutritionProfile ? (
              <div className="rounded-3xl p-6 mb-7 text-center bg-gradient-to-b from-card to-deep border border-white/[0.06]">
                <p className="text-ink text-sm mb-1">{tr("Todavía no tiene una rutina asignada")}</p>
                <p className="text-muted text-xs mb-4">{tr("Complete sus datos de nutrición y le asignamos automáticamente la rutina más adecuada para su objetivo.")}</p>
                <button onClick={onGoToNutrition} className="bg-accent text-app font-semibold text-sm rounded-full px-5 py-2.5 active:scale-95 transition-transform">
                  {tr("Completar mis datos")}
                </button>
              </div>
            ) : !routine ? (
              <div className="rounded-3xl p-6 mb-7 text-center bg-gradient-to-b from-card to-deep border border-white/[0.06]">
                <p className="text-ink text-sm mb-1">{tr("Hoy no tiene rutina asignada")}</p>
                <p className="text-muted text-xs">{tr("Aproveche para descansar, o avísele a su coach si cree que falta asignarle algo.")}</p>
              </div>
            ) : (
              <button
                onClick={onOpenRoutine}
                className="group relative block w-full text-left rounded-3xl overflow-hidden mb-7 border border-white/[0.07] bg-gradient-to-br from-card to-deep shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] active:scale-[0.985] transition-transform animate-fade-up"
              >
                <div className="relative p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent bg-accent/10 border border-accent/20 rounded-full px-2.5 py-1 mb-3">
                        {tr(routine.day_label)}
                      </span>
                      {routine.parts?.length > 1 ? (
                        <div className="space-y-1">
                          {routine.parts.map((p, i) => (
                            <p key={`${p.id}-${i}`} className="text-ink text-lg font-semibold tracking-tight truncate">
                              <span className="text-accent/80 mr-1.5 tabular-nums">{i + 1}.</span>{p.title}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <h2 className="text-ink text-xl font-semibold tracking-tight">{routine.title}</h2>
                      )}
                      {routine.goal && <p className="text-soft text-xs mt-1">{routine.goal}</p>}
                    </div>
                    <ProgressRing done={doneCount} total={total} />
                  </div>

                  <div className="flex items-center gap-2 mt-5">
                    <span className="flex items-center gap-1.5 text-soft text-xs bg-white/[0.04] border border-white/[0.06] rounded-full px-2.5 py-1.5 whitespace-nowrap">
                      <Clock size={12} /> {routine.duration_minutes} {tr("min")}
                    </span>
                    <span className="flex items-center gap-1.5 text-soft text-xs bg-white/[0.04] border border-white/[0.06] rounded-full px-2.5 py-1.5 whitespace-nowrap">
                      <Dumbbell size={12} /> {total}
                    </span>
                    <span className="ml-auto shrink-0 flex items-center gap-1.5 bg-accent text-app text-sm font-semibold rounded-full pl-3 pr-3.5 py-2 group-active:scale-95 transition-transform">
                      <Play size={14} fill="currentColor" /> {doneCount > 0 ? tr("Continuar") : tr("Empezar")}
                    </span>
                  </div>
                </div>
              </button>
            )}

            <div className="flex items-center justify-between mb-3">
              <p className="text-muted text-[11px] font-medium uppercase tracking-[0.14em]">
                {tr("Esta semana")}
                {extras?.planWeek && <span className="text-accent normal-case tracking-normal font-normal"> · {tr("Plan: semana {p0} de {p1}", { p0: extras.planWeek, p1: extras.plan.weeks })}</span>}
              </p>
              {extras?.hasSchedule && (
                <button onClick={onOpenCalendar} className="flex items-center gap-1 text-accent text-xs font-medium">
                  <CalendarDays size={13} /> {tr("Calendario")}
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {dayLetters().map((d, i) => {
                const dayName = WEEK_DAYS[i];
                const isActive = selectedDay === dayName;
                const isToday = i === todayIndex;
                const date = new Date(monday);
                date.setDate(monday.getDate() + i);
                return (
                  <button
                    key={i}
                    onClick={() => onSelectDay(dayName)}
                    className={`relative rounded-2xl py-2.5 flex flex-col items-center gap-0.5 transition-all duration-200 ${isActive
                      ? "bg-accent text-app scale-[1.04]"
                      : "bg-card border border-white/[0.04] text-soft"}`}
                  >
                    <span className={`text-[10px] font-medium ${isActive ? "text-app/70" : "text-muted"}`}>{d}</span>
                    <span className="text-[15px] font-semibold tabular-nums">{date.getDate()}</span>
                    {isToday && !isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />}
                    {extras?.trainedDays.has(i) && (
                      <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-app ${isActive ? "bg-app" : "bg-accent"}`}>
                        <Check size={9} strokeWidth={3.5} className={isActive ? "text-accent" : "text-app"} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <WeekSummary extras={extras} />
          </div>
          <div className="lg:pt-0">
            <CoachMessage extras={extras} onOpen={() => onNavigate?.("messages")} />
            <TodayNutrition extras={extras} onOpen={() => onNavigate?.("nutrition")} />
            <GoalsAndReminders extras={extras} onOpenProgress={() => onNavigate?.("progress")} />
          </div>
        </div>
      </div>
    </div>
  );
}
