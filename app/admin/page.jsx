"use client";

import { useCallback, useEffect, useState } from "react";
import { NotificationBell, addNotifications } from "@/lib/notifications";
import { removePushOnLogout, syncPush, useOpenNotification } from "@/lib/push";
import { PushPromptCard } from "@/components/ui/PushNotifications";
import { supabase } from "@/lib/supabaseClient";
import { AnnouncementsView } from "@/components/coach/AnnouncementsView";
import { MessagesInbox } from "@/components/coach/MessagesInbox";
import { ExercisesView } from "@/components/coach/ExercisesView";
import { ProfileView } from "@/components/coach/ProfileView";
import { ProgramsView } from "@/components/coach/programs/ProgramsView";
import { ReportView } from "@/components/coach/ReportView";
import { RoutinesView } from "@/components/coach/routines/RoutinesView";
import { Sidebar } from "@/components/coach/Sidebar";
import { StudentsView } from "@/components/coach/students/StudentsView";
import { UsersView } from "@/components/admin/UsersView";
import { BrandMark } from "@/components/ui/BrandMark";

export default function AdminPanel() {
  const [tab, setTab] = useState("rutinas");
  const [pendingStudentAction, setPendingStudentAction] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coachId, setCoachId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifKey, setNotifKey] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [inboxStudent, setInboxStudent] = useState(null);

  // Mensajes sin leer de los alumnos (número en "Mensajes" del menú); se revisa cada minuto
  const refreshUnread = useCallback(async () => {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("read_by_coach", false);
    if (typeof count === "number") setUnreadMessages(count);
  }, []);
  const clearInboxStudent = useCallback(() => setInboxStudent(null), []);
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

      if (profile?.role !== "coach" && profile?.role !== "admin") {
        window.location.href = "/";
        return;
      }
      setIsAdmin(profile?.role === "admin");
      setCoachId(user.id);
      setChecking(false);
      syncPush(supabase, user.id);
      refreshUnread();
      createCoachNotices(user.id).catch(() => { });
    }
    checkAccess();
  }, []);

  useEffect(() => {
    if (checking) return undefined;
    const tick = () => { if (document.visibilityState === "visible") refreshUnread(); };
    const timer = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [checking, refreshUnread, notifKey]);

  const openFromNotification = (n) => {
    setMenuOpen(false);
    // Los mensajes se abren en la bandeja, en la conversación de ese alumno
    if (n.link === "messages" && n.student_id) {
      setInboxStudent(n.student_id);
      setTab("mensajes");
      return;
    }
    if (n.student_id && ["messages", "nutrition", "access", "photos", "progress", "checkin", "measurements"].includes(n.link)) {
      setPendingStudentAction({ id: n.student_id, action: n.link });
    }
    setTab("alumnos");
  };

  // Al tocar una notificación en la barra del celular, abre el aviso en el panel
  useOpenNotification(supabase, coachId, !checking, (n) => {
    openFromNotification(n);
    setNotifKey((k) => k + 1);
  });

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

  const bell = coachId ? (
    <NotificationBell supabase={supabase} userId={coachId} onNavigate={openFromNotification} refreshKey={notifKey} />
  ) : null;

  const tabLabels = { mensajes: "Mensajes", rutinas: "Rutinas", ejercicios: "Ejercicios", alumnos: "Alumnos", reporte: "Reporte semanal", anuncios: "Anuncios", programas: "Programas", usuarios: "Usuarios", perfil: "Mi perfil" };
  const sidebarProps = {
    unreadMessages,
    active: tab,
    email: userEmail,
    fullName,
    isAdmin,
    onLogout: async () => {
      await removePushOnLogout(supabase);
      await supabase.auth.signOut();
      window.location.href = "/login";
    },
  };

  return (
    <div className="fixed inset-0 md:static md:min-h-screen bg-app md:bg-night flex">
      <div className="flex flex-col md:flex-row w-full max-w-6xl mx-auto md:my-6 md:rounded-2xl md:overflow-hidden md:border md:border-field">
        <div className="md:hidden flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] bg-panel border-b border-field">
          <button onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="relative w-10 h-10 -ml-2 flex items-center justify-center text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            {unreadMessages > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-panel" />}
          </button>
          <BrandMark size={30} />
          <div className="min-w-0 flex-1">
            <p className="text-muted text-[11px] leading-none">{isAdmin ? "Panel Admin" : "Panel Coach"}</p>
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
          <div className="px-4 pt-4 md:px-8 md:pt-6 empty:hidden">
            {coachId && <PushPromptCard userId={coachId} className="mb-0!" />}
          </div>
          {tab === "mensajes" && (
            <MessagesInbox onUnreadChange={setUnreadMessages} initialStudentId={inboxStudent} onInitialDone={clearInboxStudent} />
          )}
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
          {tab === "usuarios" && isAdmin && <UsersView />}
          {tab === "perfil" && <ProfileView onProfileUpdate={setFullName} />}
        </div>
      </div>
    </div>
  );
}
