"use client";

import { useEffect, useRef, useState } from "react";
import { computeBadges, loadBadgeData } from "@/lib/badges";
import { localDateString, todayDayLabel } from "@/lib/dates";
import { fetchAllRows } from "@/lib/fetchAll";
import { buildDay as buildStudentDay } from "@/lib/studentRoutine";
import { appLocale, dayLetters, detectLang, rememberLang, setLang, tr } from "@/lib/i18n";
import { NotificationBell, addNotifications } from "@/lib/notifications";
import { removePushOnLogout, syncPush, useOpenNotification } from "@/lib/push";
import { PushPromptCard } from "@/components/ui/PushNotifications";
import { supabase } from "@/lib/supabaseClient";
import { signedAvatarUrl } from "@/lib/avatars";
import { HomeScreen } from "@/components/student/HomeScreen";
import { IntakeScreen } from "@/components/student/IntakeScreen";
import { CheckinScreen } from "@/components/student/CheckinScreen";
import { checkinWeekStart, dailyCheckinKey, isCheckinDay } from "@/lib/checkin";
import { PetCheckin } from "@/components/student/PetCheckin";
import { petMood } from "@/lib/chameleon";
import { MEASURE_DAYS } from "@/lib/measurements";
import { MeasurementWizard } from "@/components/measurements/MeasurementWizard";
import { AnnouncementsScreen } from "@/components/student/Announcements";
import { MessagesScreen } from "@/components/student/MessagesScreen";
import { BottomNav, SideNav } from "@/components/student/Navigation";
import { NutritionScreen } from "@/components/student/nutrition/NutritionScreen";
import { ProfileScreen } from "@/components/student/ProfileScreen";
import { ProgressScreen } from "@/components/student/progress/ProgressScreen";
import { ConsentScreen } from "@/components/student/ConsentScreen";
import { LEGAL_VERSION } from "@/lib/legal";
import { RoutineScreen } from "@/components/student/RoutineScreen";
import { CalendarScreen } from "@/components/student/CalendarScreen";

export default function App() {
  const [lang, setLangState] = useState("es");
  setLang(lang);
  useEffect(() => {
    setLangState(detectLang());
  }, []);
  useEffect(() => {
    try { document.documentElement.lang = lang; } catch { }
  }, [lang]);
  const [tab, setTab] = useState("home");
  const [showRoutine, setShowRoutine] = useState(false);
  const [fullName, setFullName] = useState("");
  const [routine, setRoutine] = useState(null);
  const [loadingRoutine, setLoadingRoutine] = useState(true);

  const [userId, setUserId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayDayLabel());
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [weekStats, setWeekStats] = useState([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [bodyWeightLogs, setBodyWeightLogs] = useState([]);
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [isCoach, setIsCoach] = useState(false);
  const [hasIntake, setHasIntake] = useState(true);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [healthConsent, setHealthConsent] = useState(true);
  const [accessNeverGranted, setAccessNeverGranted] = useState(false);
  const [editingIntake, setEditingIntake] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  // Camaleón: nombre y check-in de hoy (si la columna pet_name no existe todavía, la función queda apagada)
  const [pet, setPet] = useState({ enabled: false, name: "", changes: 0 });
  const [todayCheckin, setTodayCheckin] = useState(null);
  const [checkinReady, setCheckinReady] = useState(false);
  // Check-in opcional abierto a mano (tarjeta de Inicio) o al empezar la rutina de hoy
  const [petCheckinOpen, setPetCheckinOpen] = useState(null); // null | "home" | "routine"
  const pendingPetName = useRef("");
  const [showMeasure, setShowMeasure] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [hasNutritionProfile, setHasNutritionProfile] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notifKey, setNotifKey] = useState(0);

  const loadBodyWeight = async (uid) => {
    const { data } = await supabase
      .from("body_weight_logs")
      .select("*")
      .eq("user_id", uid)
      .order("logged_at", { ascending: false })
      .limit(60);
    setBodyWeightLogs(data || []);
  };

  const addBodyWeight = async (kg) => {
    if (!kg) return;
    const { error } = await supabase.from("body_weight_logs").insert({ user_id: userId, weight_kg: Number(kg) });
    if (error) {
      alert(tr("No se pudo guardar el peso: "));
      return;
    }
    loadBodyWeight(userId);
  };

  const updateBodyWeight = async (id, kg) => {
    const { error } = await supabase.from("body_weight_logs").update({ weight_kg: Number(kg) }).eq("id", id);
    if (error) alert(tr("No se pudo guardar el peso: "));
    loadBodyWeight(userId);
  };

  const deleteBodyWeight = async (id) => {
    const { error } = await supabase.from("body_weight_logs").delete().eq("id", id);
    if (error) alert(tr("No se pudo borrar: "));
    loadBodyWeight(userId);
  };

  const createStudentNotices = async (uid, profile, todayRoutine, healthOk = true) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const rows = [];

    if (todayRoutine) {
      rows.push({
        recipient_id: uid, type: "day", link: "home", dedupe_key: `day:${today}`,
        title: "Hoy le toca entrenar",
        body: (todayRoutine.parts || [todayRoutine]).map((p) => p.title).join(" + "),
      });
    } else {
      rows.push({
        recipient_id: uid, type: "rest", link: "home", dedupe_key: `day:${today}`,
        title: "Hoy es su día de descanso", body: "Aproveche para recuperarse.",
      });
    }

    // Domingo (o lunes): recordatorio del check-in semanal si todavía no lo hizo
    if (isCheckinDay(now)) {
      const week = checkinWeekStart(now);
      const { data: ck } = await supabase.from("weekly_checkins").select("id").eq("user_id", uid).eq("week_start", week).maybeSingle();
      if (!ck) {
        rows.push({
          recipient_id: uid, type: "checkin", link: "checkin", dedupe_key: `checkin:${week}`,
          title: "Hoy toca su check-in semanal", body: "Cuéntele a su coach cómo le fue esta semana (2 minutos).",
        });
      }
    }

    if (profile?.access_until) {
      const until = new Date(profile.access_until);
      const days = Math.ceil((until - now) / 86400000);
      if (days >= 0 && days <= 5) {
        rows.push({
          recipient_id: uid, type: "access", link: "messages", dedupe_key: `access:${profile.access_until.slice(0, 10)}`,
          title: "Su acceso vence pronto",
          body: `Vence el ${until.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}. Hable con su coach para renovarlo.`,
        });
      }
    }

    const { data: lastPhoto } = await supabase
      .from("progress_photo_sets")
      .select("taken_on")
      .eq("user_id", uid)
      .order("taken_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    const daysSincePhoto = lastPhoto ? Math.floor((now - new Date(lastPhoto.taken_on + "T00:00:00")) / 86400000) : null;
    if (healthOk && (daysSincePhoto === null || daysSincePhoto >= 45)) {
      rows.push({
        recipient_id: uid, type: "photos", link: "progress", dedupe_key: `photos:${lastPhoto?.taken_on || "primera"}`,
        title: "Le toca subir fotos de progreso",
        body: lastPhoto ? `Su último registro fue hace ${daysSincePhoto} días.` : "Suba sus primeras fotos para que su coach vea su evolución.",
      });
    }

    const { data: lastMeasure } = await supabase
      .from("body_measurements")
      .select("measured_on")
      .eq("user_id", uid)
      .order("measured_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    const daysSinceMeasure = lastMeasure ? Math.floor((now - new Date(lastMeasure.measured_on + "T00:00:00")) / 86400000) : null;
    if (healthOk && (daysSinceMeasure === null || daysSinceMeasure >= MEASURE_DAYS)) {
      rows.push({
        recipient_id: uid, type: "measures_due", link: "measurements", dedupe_key: `measures-due:${lastMeasure?.measured_on || "primera"}`,
        title: lastMeasure ? "Le toca tomar sus medidas" : "Tome sus primeras medidas",
        body: lastMeasure ? `Su última medición fue hace ${daysSinceMeasure} días.` : "Solo necesita una cinta métrica. Véalo en Progreso → Medidas.",
      });
    }

    // Insignias: la primera vez se guardan como ya leídas (para no llenar la campanita);
    // después, cada insignia nueva llega como aviso.
    const badges = computeBadges(await loadBadgeData(supabase, uid)).filter((b) => b.unlocked);
    if (badges.length > 0) {
      const { count: badgeNotices } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", uid)
        .eq("type", "badge");
      const firstTime = !badgeNotices;
      badges.forEach((b) => {
        rows.push({
          recipient_id: uid, type: "badge", link: "progress", dedupe_key: `badge:${b.key}`,
          title: `¡Ganó la insignia "${b.title}"!`, body: "Véala en Progreso → Logros.",
          read_at: firstTime ? now.toISOString() : null,
        });
      });
    }

    await addNotifications(supabase, rows);
    setNotifKey((k) => k + 1);
  };

  const changeLanguage = async (newLang) => {
    setLangState(newLang);
    rememberLang(newLang);
    if (userId) await supabase.from("profiles").update({ language: newLang }).eq("id", userId);
  };

  // Los avisos se guardan en español; aquí se muestran en el idioma del alumno.
  const formatNotice = (n) => {
    const part = (n.dedupe_key || "").split(":")[1];
    if (n.type === "badge") {
      const badge = computeBadges({}).find((b) => b.key === part);
      if (!badge) return { title: tr(n.title), body: n.body ? tr(n.body) : n.body };
      return { title: tr("¡Ganó la insignia \"{p0}\"!", { p0: badge ? tr(badge.title) : "" }), body: tr("Véala en Progreso → Logros.") };
    }
    if (n.type === "access" && part) {
      const date = new Date(part + "T12:00:00").toLocaleDateString(appLocale(), { day: "2-digit", month: "short" });
      return { title: tr(n.title), body: tr("Vence el {p0}. Hable con su coach para renovarlo.", { p0: date }) };
    }
    if (n.type === "measures_due" && part && part !== "primera") {
      const days = Math.floor((Date.now() - new Date(part + "T00:00:00").getTime()) / 86400000);
      return { title: tr(n.title), body: tr("Su última medición fue hace {p0} días.", { p0: days }) };
    }
    if (n.type === "photos" && part && part !== "primera") {
      const days = Math.floor((Date.now() - new Date(part + "T00:00:00").getTime()) / 86400000);
      return { title: tr(n.title), body: tr("Su último registro fue hace {p0} días.", { p0: days }) };
    }
    if (n.type === "exercise_note") {
      return { title: tr(n.title), body: n.body ? tr("Ejercicio: {p0}. Ábralo en su rutina para leerla.", { p0: n.body }) : "" };
    }
    return { title: tr(n.title), body: n.body ? tr(n.body) : n.body };
  };

  const openFromNotification = (n) => {
    setEditingIntake(false);
    if (n.link === "announcement") {
      setShowAnnouncements(true);
      return;
    }
    if (n.link === "checkin") {
      setShowCheckin(true);
      return;
    }
    const target = { messages: "messages", progress: "progress", photos: "progress", measurements: "progress", nutrition: "nutrition", profile: "profile" }[n.link] || "home";
    handleSelectTab(target);
  };

  const buildDay = (uid, day) => buildStudentDay(supabase, uid, day);

  const refreshRoutine = async (uid, day) => {
    const dayRoutine = await buildDay(uid, day);
    setRoutine(dayRoutine);
    return !!dayRoutine;
  };

  // Al empezar la rutina de HOY se ofrece el check-in del camaleón (opcional), una sola vez por día
  const openRoutineWithCheckin = (day = selectedDay) => {
    if (!pet.enabled || todayCheckin || day !== todayDayLabel() || !userId) return setShowRoutine(true);
    let skipped = false;
    try { skipped = localStorage.getItem(dailyCheckinKey(userId, localDateString())) === "1"; } catch { }
    if (skipped) return setShowRoutine(true);
    setPetCheckinOpen("routine");
  };
  const closePetCheckin = (row) => {
    if (row) setTodayCheckin(row);
    else { try { localStorage.setItem(dailyCheckinKey(userId, localDateString()), "1"); } catch { } }
    const goRoutine = petCheckinOpen === "routine";
    setPetCheckinOpen(null);
    setNotifKey((k) => k + 1);
    if (goRoutine) setShowRoutine(true);
  };

  // Camaleón: nombre + check-in de hoy. Si falta la columna pet_name (SQL sin correr), no se bloquea nada.
  const loadPet = async (uid) => {
    const [{ data: p, error: e }, { data: ck }] = await Promise.all([
      supabase.from("profiles").select("pet_name, pet_name_changes").eq("id", uid).maybeSingle(),
      supabase.from("daily_checkins").select("*").eq("user_id", uid).eq("check_date", localDateString()).maybeSingle(),
    ]);
    setPet({ enabled: !e, name: p?.pet_name || "", changes: p?.pet_name_changes || 0 });
    setTodayCheckin(ck || null);
    setCheckinReady(true);
  };

  const goToAssignedRoutine = async () => {
    const found = await refreshRoutine(userId, selectedDay);
    setTab("home");
    if (found) setShowRoutine(true);
  };

  const handleToggleExercise = (i, newValue) => {
    // Se copian los objetos conservando sus "getters" (etiquetas que cambian con el idioma)
    const cloneWith = (obj, patch) => Object.assign(Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj)), patch);
    setRoutine((r) =>
      cloneWith(r, { exercises: r.exercises.map((e, idx) => (idx === i ? cloneWith(e, { completed: newValue }) : e)) })
    );
  };

  const loadStreak = async (uid) => {
    const rows = await fetchAllRows(() =>
      supabase
        .from("progress")
        .select("completed_at")
        .eq("user_id", uid)
        .order("completed_at", { ascending: true })
    );

    if (!rows || rows.length === 0) {
      setStreak(0);
      setBestStreak(0);
      setTotalCompleted(0);
      setWeekStats(
        Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            get label() { return dayLetters()[(d.getDay() + 6) % 7]; },
            count: 0,
            isToday: i === 6,
          };
        })
      );
      return;
    }

    const dateStrings = rows.map((r) => new Date(r.completed_at).toDateString());
    const uniqueDates = [...new Set(dateStrings)];

    let count = 0;
    let cursor = new Date();

    if (!uniqueDates.includes(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (uniqueDates.includes(cursor.toDateString())) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }

    setStreak(count);
    setTotalCompleted(rows.length);

    const sortedDates = uniqueDates.map((ds) => new Date(ds)).sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    let prev = null;
    sortedDates.forEach((d) => {
      if (prev) {
        const diffDays = Math.round((d - prev) / (1000 * 60 * 60 * 24));
        run = diffDays === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prev = d;
    });
    setBestStreak(best);

    const week = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayCount = dateStrings.filter((ds) => ds === d.toDateString()).length;
      return {
        get label() { return dayLetters()[(d.getDay() + 6) % 7]; },
        count: dayCount,
        isToday: i === 6,
      };
    });
    setWeekStats(week);
  };

  const loadRecentActivity = async (uid) => {
    const { data } = await supabase
      .from("progress")
      .select("*, exercises(name)")
      .eq("user_id", uid)
      .order("completed_at", { ascending: false })
      .limit(8);
    setRecentActivity(data || []);
  };

  const loadedDayRef = useRef(null);
  const uidRef = useRef(null);
  const [routineReady, setRoutineReady] = useState(false);

  // Arranque: se ejecuta UNA sola vez al montar. Antes, con deps [selectedDay],
  // se repetía TODO (auth, perfil, consentimientos, nutrición, mensajes, avisos)
  // cada vez que el alumno cambiaba de día (BUG-B5).
  useEffect(() => {
    async function bootstrap() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      uidRef.current = user.id;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role, access_until")
        .eq("id", user.id)
        .single();

      // El personal (coach o admin) usa la app como alumno, pero sin muros de acceso ni consentimiento.
      const isStaff = profile?.role === "coach" || profile?.role === "admin";

      setFullName(profile?.full_name || "");
      const { data: langRow } = await supabase.from("profiles").select("language").eq("id", user.id).maybeSingle();
      if (langRow?.language === "es" || langRow?.language === "en") {
        setLangState(langRow.language);
        rememberLang(langRow.language);
      }
      setAvatarUrl(await signedAvatarUrl(profile?.avatar_url));
      setUserEmail(user?.email || "");

      let healthOk = true;
      if (!isStaff) {
        const { data: intakeRow } = await supabase
          .from("intake_forms")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        setHasIntake(!!intakeRow);
        // Términos y autorizaciones: si no ha aceptado la versión vigente, se le pide antes de seguir
        const { data: consentRows, error: consentErr } = await supabase
          .from("legal_consents")
          .select("doc_version, health_data_consent")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (!consentErr) {
          const lastConsent = consentRows?.[0];
          healthOk = !!lastConsent?.health_data_consent;
          setNeedsConsent(!lastConsent || lastConsent.doc_version !== LEGAL_VERSION);
          setHealthConsent(healthOk);
        }
      }
      setAccessNeverGranted(!profile?.access_until);

      const until = profile?.access_until ? new Date(profile.access_until) : null;
      const blocked = !isStaff && (!until || until < new Date());
      setAccessBlocked(blocked);
      setIsCoach(isStaff);

      if (blocked) {
        setLoadingRoutine(false);
        return;
      }

      await loadPet(user.id);

      // Rutina del día actual (al montar, el día seleccionado es hoy).
      const today = todayDayLabel();
      const todayRoutine = await buildDay(user.id, today);
      setRoutine(todayRoutine);
      loadedDayRef.current = today;
      setLoadingRoutine(false);

      if (!isStaff) {
        // Los avisos usan SIEMPRE la rutina de hoy, no la del día que se esté mirando.
        createStudentNotices(user.id, profile, todayRoutine, healthOk).catch(() => { });
      }

      loadStreak(user.id);
      const { data: nutritionProfile } = await supabase
        .from("nutrition_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setHasNutritionProfile(!!nutritionProfile); loadRecentActivity(user.id);

      const { data: unreadMsgs } = await supabase
        .from("messages")
        .select("id")
        .eq("user_id", user.id)
        .eq("read_by_alumno", false);
      setUnreadMessageCount((unreadMsgs || []).length);
      loadBodyWeight(user.id);
      // Notificaciones del celular: si ya dio permiso, deja este celular conectado a su cuenta
      syncPush(supabase, user.id);

      setRoutineReady(true);
    }

    bootstrap();
  }, []);

  // Recarga SOLO la rutina cuando cambia el día seleccionado (sin repetir el arranque).
  useEffect(() => {
    if (!routineReady || accessBlocked) return;
    if (loadedDayRef.current === selectedDay) return; // ya cargada (incluida la de hoy al montar)
    loadedDayRef.current = selectedDay;
    refreshRoutine(uidRef.current, selectedDay);
  }, [routineReady, selectedDay, accessBlocked]);

  // Al tocar una notificación en la barra del celular, abre la sección de ese aviso
  useOpenNotification(supabase, userId, routineReady && !accessBlocked && !needsConsent, (n) => {
    openFromNotification(n);
    setNotifKey((k) => k + 1);
  });
  const handleSelectTab = (key) => {
    setShowRoutine(false);
    setShowCheckin(false);
    setShowCalendar(false);
    setShowMeasure(false);
    setShowAnnouncements(false);
    setTab(key);
    if (key === "progress" && userId) loadBodyWeight(userId); // el peso pudo cambiar en Nutrición, Medidas o Check-in
  };

  const signOutNow = async () => {
    await removePushOnLogout(supabase); // este celular deja de recibir los avisos de esta cuenta
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  let content;
  if (showAnnouncements) {
    content = <AnnouncementsScreen userId={userId} onClose={() => { setShowAnnouncements(false); setNotifKey((k) => k + 1); }} />;
  } else if (showMeasure) {
    content = <MeasurementWizard userId={userId} t={tr} onClose={(saved) => { setShowMeasure(false); if (saved) loadBodyWeight(userId); setNotifKey((k) => k + 1); }} />;
  } else if (showCalendar) {
    content = (
      <CalendarScreen
        userId={userId}
        studentName={fullName}
        healthConsent={healthConsent}
        onClose={() => setShowCalendar(false)}
        onOpenDay={async (day) => {
          setSelectedDay(day);
          const found = await refreshRoutine(userId, day);
          setShowCalendar(false);
          if (found) openRoutineWithCheckin(day);
        }}
      />
    );
  } else if (showCheckin) {
    content = <CheckinScreen userId={userId} healthConsent={healthConsent} onClose={() => { setShowCheckin(false); setNotifKey((k) => k + 1); loadBodyWeight(userId); }} />;
  } else if (editingIntake) {
    content = (
      <IntakeScreen
        userId={userId}
        healthConsent={healthConsent}
        title={tr("Mi ficha de ingreso")}
        subtitle={tr("Su coach usa esta información para armar su entrenamiento de forma segura.")}
        onCancel={() => setEditingIntake(false)}
        onSaved={() => { setHasIntake(true); setEditingIntake(false); }}
      />
    );
  } else if (petCheckinOpen) {
    content = (
      <PetCheckin
        userId={userId}
        petName={pet.name}
        healthConsent={healthConsent}
        optional
        onDone={(row) => closePetCheckin(row)}
        onSkip={() => closePetCheckin(null)}
      />
    );
  } else if (showRoutine && routine) {
    content = <RoutineScreen routine={routine} userId={userId} pet={pet.enabled ? { name: pet.name, mood: petMood(todayCheckin) } : null} onClose={() => setShowRoutine(false)} onToggle={handleToggleExercise} onProgressChange={() => { loadStreak(userId); loadRecentActivity(userId); }} />;
  } else if (tab === "nutrition") {
    content = <NutritionScreen userId={userId} onFirstRoutineAssigned={goToAssignedRoutine} />;
  } else if (tab === "home") {
    content = (
      <HomeScreen
        userId={userId}
        onNavigate={handleSelectTab}
        onOpenCheckin={() => setShowCheckin(true)}
        onOpenAnnouncements={() => setShowAnnouncements(true)}
        onAnnouncementRead={() => setNotifKey((k) => k + 1)}
        onOpenRoutine={() => openRoutineWithCheckin()}
        onOpenPetCheckin={() => setPetCheckinOpen("home")}
        onOpenCalendar={() => setShowCalendar(true)}
        fullName={fullName}
        avatarUrl={avatarUrl}
        pet={pet.enabled ? { name: pet.name, mood: petMood(todayCheckin) } : null}
        routine={routine}
        loading={loadingRoutine}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        streak={streak}
        onGoToNutrition={() => handleSelectTab("nutrition")}
        hasNutritionProfile={hasNutritionProfile}
        needsIntake={!hasIntake}
        onOpenIntake={() => setEditingIntake(true)}
        pushCard={<PushPromptCard userId={userId} t={tr} />}
        bell={<NotificationBell supabase={supabase} userId={userId} onNavigate={openFromNotification} refreshKey={notifKey} t={tr} locale={appLocale()} format={formatNotice} />}
      />
    );
  } else if (tab === "messages") {
    content = <MessagesScreen userId={userId} onMessagesRead={() => { setUnreadMessageCount(0); setNotifKey((k) => k + 1); }} />;
  } else if (tab === "progress") {
    content = <ProgressScreen healthConsent={healthConsent} onOpenCheckin={() => setShowCheckin(true)} onOpenMeasure={() => setShowMeasure(true)} streak={streak} bestStreak={bestStreak} totalCompleted={totalCompleted} weekStats={weekStats} recentActivity={recentActivity} bodyWeightLogs={bodyWeightLogs} onAddWeight={addBodyWeight} onUpdateWeight={updateBodyWeight} onDeleteWeight={deleteBodyWeight} userId={userId} fullName={fullName} />;
  } else {
    content = tab === "profile" ? (
      <ProfileScreen
        healthConsent={healthConsent}
        onHealthChange={setHealthConsent}
        fullName={fullName}
        email={userEmail}
        avatarUrl={avatarUrl}
        userId={userId}
        onOpenIntake={() => setEditingIntake(true)}
        onOpenAnnouncements={() => setShowAnnouncements(true)}
        isCoach={isCoach}
        onLogout={signOutNow}
        lang={lang}
        onChangeLang={changeLanguage}
        onProfileUpdate={(name, avatar) => {
          setFullName(name);
          setAvatarUrl(avatar);
        }}
        onEmailUpdate={setUserEmail}
        pet={pet.enabled ? { ...pet, mood: petMood(todayCheckin) } : null}
        onPetRenamed={(name) => setPet((p) => ({ ...p, name, changes: (p.changes || 0) + 1 }))}
      />
    ) : (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted text-sm">{tr("Próximamente")}</p>
      </div>
    );
  }
  const selectTab = (key) => { setEditingIntake(false); handleSelectTab(key); };
  // Check-in obligatorio SOLO la primera vez (cuando le pone nombre al camaleón); después es opcional
  const needsPetCheckin = pet.enabled && checkinReady && !needsConsent && !pet.name;
  const hideNav = accessBlocked || needsConsent || needsPetCheckin;

  return (
    <div className="fixed inset-0 bg-app flex overflow-hidden">
      {!hideNav && (
        <SideNav
          active={tab}
          onSelect={selectTab}
          unreadCount={unreadMessageCount}
          fullName={fullName}
          avatarUrl={avatarUrl}
          onLogout={signOutNow}
          isCoach={isCoach}
        />
      )}
      <div className="relative flex-1 min-w-0 flex flex-col">
        <main className={`flex-1 min-h-0 flex flex-col pt-[env(safe-area-inset-top)] md:pt-6 ${accessBlocked ? "" : "max-md:[&>*]:pb-28"} [&>*>*:not(.fixed)]:w-full [&>*>*:not(.fixed)]:max-w-2xl [&>*>*:not(.fixed)]:mx-auto`}>
          {needsConsent ? (
            <ConsentScreen userId={userId} onSignOut={signOutNow} onAccepted={(h) => { setNeedsConsent(false); setHealthConsent(h); }} />
          ) : accessBlocked && (!hasIntake || editingIntake) ? (
            <IntakeScreen
              userId={userId}
              healthConsent={healthConsent}
              title={hasIntake ? tr("Mi ficha de ingreso") : tr("Antes de empezar")}
              subtitle={hasIntake ? tr("Puede actualizar su información cuando quiera.") : tr("Complete su ficha de ingreso. Su coach la revisa antes de habilitar su acceso.")}
              onCancel={hasIntake ? () => setEditingIntake(false) : null}
              onSaved={() => { setHasIntake(true); setEditingIntake(false); }}
              onSignOut={hasIntake ? null : signOutNow}
            />
          ) : !accessBlocked && needsPetCheckin ? (
            <PetCheckin
              userId={userId}
              petName={pet.name}
              healthConsent={healthConsent}
              onPetNamed={(name) => { pendingPetName.current = name; }}
              onDone={(row) => {
                // El nombre se aplica al terminar, para que el primer check-in no se cierre a mitad de camino
                setTodayCheckin(row);
                setPet((p) => ({ ...p, name: pendingPetName.current || p.name }));
                setNotifKey((k) => k + 1);
              }}
            />
          ) : accessBlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <h1 className="text-ink text-lg font-semibold mb-2">{accessNeverGranted ? tr("¡Ficha recibida!") : tr("Su acceso venció")}</h1>
              <p className="text-soft text-sm mb-6">
                {accessNeverGranted
                  ? tr("Su coach va a revisar su ficha y habilitar su acceso. Vuelva a entrar en un rato.")
                  : tr("Contacte a su coach para renovar su acceso y seguir entrenando.")}
              </p>
              {accessNeverGranted && (
                <button onClick={() => setEditingIntake(true)} className="text-accent text-sm mb-4">
                  {tr("Ver o editar mi ficha")}
                </button>
              )}
              <button onClick={signOutNow} className="text-muted text-sm underline">
                {tr("Cerrar sesión")}
              </button>
            </div>
          ) : (
            content
          )}
        </main>
        {!hideNav && (
          <div className="md:hidden absolute inset-x-0 bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] z-40 pointer-events-none">
            <BottomNav active={tab} onSelect={selectTab} unreadCount={unreadMessageCount} isCoach={isCoach} />
          </div>
        )}
      </div>
    </div>
  );
}
