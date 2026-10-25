"use client";

import { BrandMark } from "@/components/ui/BrandMark";
import { Calendar, CalendarRange, ClipboardList, Dumbbell, LayoutDashboard, Megaphone, User, Users } from "lucide-react";

export function Sidebar({ active, onSelect, email, fullName, onLogout, bell }) {
  const items = [
    { key: "rutinas", label: "Rutinas", icon: LayoutDashboard },
    { key: "ejercicios", label: "Ejercicios", icon: Dumbbell },
    { key: "alumnos", label: "Alumnos", icon: Users },
    { key: "reporte", label: "Reporte semanal", icon: ClipboardList },
    { key: "anuncios", label: "Anuncios", icon: Megaphone },
    { key: "programas", label: "Programas", icon: Calendar },
    { key: "planeacion", label: "Planeación", icon: CalendarRange },
    { key: "perfil", label: "Mi perfil", icon: User },
  ];
  return (
    <div className="w-64 md:w-56 h-full bg-panel border-r border-field flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-field flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark size={32} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-ink font-semibold text-[15px] tracking-tight leading-tight whitespace-nowrap">Panel Coach</p>
            <p className="text-muted text-xs truncate">{fullName || email}</p>
          </div>
        </div>
        {bell}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onSelect(key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active === key ? "bg-accent/[0.10] text-accent" : "text-soft hover:bg-card/60 hover:text-ink"}`}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-1">
        <a href="/" className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-accent bg-card hover:bg-field">
          Ver como alumno
        </a>
        <button onClick={onLogout} className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-danger hover:bg-card/60">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
