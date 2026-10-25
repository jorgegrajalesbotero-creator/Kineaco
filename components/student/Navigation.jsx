"use client";

import { Home, MessageCircle, TrendingUp, User, Utensils } from "lucide-react";
import { tr } from "@/lib/i18n";

export const STUDENT_NAV_ITEMS = [
  { key: "home", get label() { return tr("Inicio"); }, icon: Home },
  { key: "messages", get label() { return tr("Mensajes"); }, icon: MessageCircle },
  { key: "nutrition", get label() { return tr("Nutrición"); }, icon: Utensils },
  { key: "progress", get label() { return tr("Progreso"); }, icon: TrendingUp },
  { key: "profile", get label() { return tr("Perfil"); }, icon: User },
];

export function SideNav({ active, onSelect, unreadCount, fullName, avatarUrl, onLogout, isCoach }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-panel border-r border-field">
      <div className="px-5 py-6 border-b border-field flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-field flex items-center justify-center overflow-hidden shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={18} className="text-muted" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium truncate">{fullName || "..."}</p>
          <p className="text-muted text-xs">{isCoach ? tr("Coach · vista de alumno") : tr("Alumno")}</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {STUDENT_NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active === key ? "bg-card text-accent" : "text-soft hover:bg-card/60"}`}
          >
            <Icon size={17} />
            <span className="flex-1 text-left">{label}</span>
            {key === "messages" && unreadCount > 0 && (
              <span className="bg-danger text-app text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-3 pb-4 space-y-1">
        {isCoach && (
          <a href="/admin" className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-accent bg-card hover:bg-field">
            {tr("Ir al panel de coach")}
          </a>
        )}
        <button onClick={onLogout} className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-card/60">
          {tr("Cerrar sesión")}
        </button>
      </div>
    </aside>
  );
}

export function BottomNav({ active, onSelect, unreadCount }) {
  const items = STUDENT_NAV_ITEMS;
  return (
    <nav className="pointer-events-auto mx-3 flex items-center gap-1 p-1.5 rounded-full bg-card/85 backdrop-blur-xl border border-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      {items.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 rounded-full relative transition-all duration-200 active:scale-90 ${isActive ? "bg-accent/[0.12]" : ""}`}
          >
            <Icon size={21} strokeWidth={isActive ? 2.25 : 2} className={isActive ? "text-accent" : "text-soft"} />
            {key === "messages" && unreadCount > 0 && (
              <span className="absolute top-0.5 left-1/2 ml-1.5 bg-danger text-app text-[9px] font-semibold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{unreadCount}</span>
            )}
            <span className={`text-[10px] font-medium truncate max-w-full ${isActive ? "text-accent" : "text-soft"}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
