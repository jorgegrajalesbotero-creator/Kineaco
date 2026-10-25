"use client";

import { useEffect, useState } from "react";
import { NotificationBell, addNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import { AnnouncementsView } from "@/components/coach/AnnouncementsView";
import { ExercisesView } from "@/components/coach/ExercisesView";
import PlanningView from "@/components/coach/planning/PlanningView";
import { ProfileView } from "@/components/coach/ProfileView";
import { ProgramsView } from "@/components/coach/programs/ProgramsView";
import { ReportView } from "@/components/coach/ReportView";
import { RoutinesView } from "@/components/coach/routines/RoutinesView";
import { Sidebar } from "@/components/coach/Sidebar";
import { StudentsView } from "@/components/coach/students/StudentsView";
import { BrandMark } from "@/components/ui/BrandMark";

export default function AdminPanel() {
  const [tab, setTab] = useState("rutinas");
  const [pendingStudentAction, setPendingStudentAction] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coachId, setCoachId] = useState(null);
  const [notifKey, setNotifKey] = useState(0);
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || "");
      const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      setFullName(profileData?.full_name || "");
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "coach") {
        window.location.href = "/";
        return;
      }
      setCoachId(user.id);
      setChecking(false);
      createCoachNotices(user.id).catch(() => { });
    }
    checkAccess();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-night flex items-center justify-center">
        <p className="text-muted text-sm">Verificando acceso...</p>
      </div>
    );
  }

  async function createCoachNotices(uid) {
    const now = new Date();
    const limit = new Date(now.getTime() + 5 * 86400000);
    const { data: expiring } = await supabase
      .from("profiles")
      .select("id, full_name, access_until")
      .eq("role", "alumno")
      .gte("access_until", now.toISOString())
      .lte("access_until", limit.toISOString());
    const rows = (expiring || []).map((p) => ({
      recipient_id: uid,
      type: "access",
      link: "access",
      student_id: p.id,
      dedupe_key: `access:${p.id}:${p.access_until.slice(0, 10)}`,
      title: `Acceso por vencer: ${p.full_name || "alumno"}`,
      body: `Vence el ${new Date(p.access_until).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}.`,
    }));
    await addNotifications(supabase, rows);
    setNotifKey((k) => k + 1);
  }

  const openFromNotification = (n) => {
    setMenuOpen(false);
    if (n.student_id && ["messages", "nutrition", "access", "photos", "progress", "checkin", "measurements"].includes(n.link)) {
      setPendingStudentAction({ id: n.student_id, action: n.link });
    }
    setTab("alumnos");
  };

  const bell = coachId ? (
    <NotificationBell supabase={supabase} userId={coachId} onNavigate={openFromNotification} refreshKey={notifKey} />
  ) : null;

  const tabLabels = { rutinas: "Rutinas", ejercicios: "Ejercicios", alumnos: "Alumnos", reporte: "Reporte semanal", anuncios: "Anuncios", programas: "Programas", planeacion: "Planeación", perfil: "Mi perfil" };
  const sidebarProps = {
    active: tab,
    email: userEmail,
    fullName,
    onLogout: async () => {
      await supabase.auth.signOut();
      window.location.href = "/login";
    },
  };

  return (
    <div className="fixed inset-0 md:static md:min-h-screen bg-app md:bg-night flex">
      <div className="flex flex-col md:flex-row w-full max-w-6xl mx-auto md:my-6 md:rounded-2xl md:overflow-hidden md:border md:border-field">
        <div className="md:hidden flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] bg-panel border-b border-field">
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="w-10 h-10 -ml-2 flex items-center justify-center text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <BrandMark size={30} />
          <div className="min-w-0 flex-1">
            <p className="text-muted text-[11px] leading-none">Panel Coach</p>
            <p className="text-ink text-base font-semibold truncate">{tabLabels[tab]}</p>
          </div>
          {bell}
        </div>

        <div className="hidden md:flex">
          <Sidebar {...sidebarProps} onSelect={setTab} bell={bell} />
        </div>

        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <div className="relative h-full pt-[env(safe-area-inset-top)] bg-panel">
              <Sidebar {...sidebarProps} onSelect={(key) => { setTab(key); setMenuOpen(false); }} />
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-app overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {tab === "rutinas" && <RoutinesView />}
          {tab === "ejercicios" && <ExercisesView />}
          {tab === "alumnos" && (
            <StudentsView initialAction={pendingStudentAction} onInitialActionDone={() => setPendingStudentAction(null)} />
          )}
          {tab === "reporte" && (
            <ReportView
              onStudentAction={(id, action) => {
                setPendingStudentAction({ id, action });
                setTab("alumnos");
              }}
            />
          )}
          {tab === "anuncios" && <AnnouncementsView />}
          {tab === "programas" && <ProgramsView />}
          {tab === "planeacion" && (
            <PlanningView
              onOpenProgression={(id) => {
                setPendingStudentAction({ id, action: "progression" });
                setTab("alumnos");
              }}
            />
          )}
          {tab === "perfil" && <ProfileView onProfileUpdate={setFullName} />}
        </div>
      </div>
    </div>
  );
}
