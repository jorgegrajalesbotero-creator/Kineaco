"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const ROLE_LABELS = { alumno: "Alumno", coach: "Coach", admin: "Admin" };

// Vista SOLO-ADMIN: gestiona el rol de cada usuario y asigna cada alumno a su coach.
// Requiere la migración de roles aplicada (profiles.coach_id, is_admin(), etc.).
export function UsersView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, coach_id, access_until")
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) setError(error.message);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const coaches = rows.filter((r) => r.role === "coach" || r.role === "admin");
  const coachName = (id) => coaches.find((c) => c.id === id)?.full_name || "Sin asignar";

  const changeRole = async (id, role) => {
    setSavingId(id);
    setError("");
    // Un coach/admin no tiene coach asignado: se limpia al promover.
    const patch = role === "alumno" ? { role } : { role, coach_id: null };
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) setError(error.message);
    await load();
    setSavingId(null);
  };

  const changeCoach = async (id, coach_id) => {
    setSavingId(id);
    setError("");
    const { error } = await supabase.from("profiles").update({ coach_id: coach_id || null }).eq("id", id);
    if (error) setError(error.message);
    await load();
    setSavingId(null);
  };

  if (loading) return <div className="p-6 text-muted text-sm">Cargando usuarios...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center gap-2 mb-1">
        <Shield size={18} className="text-accent" />
        <h1 className="text-ink text-xl font-semibold">Usuarios y roles</h1>
      </div>
      <p className="text-muted text-sm mb-5">
        Gestione el rol de cada persona y asigne cada alumno a su coach. Solo el administrador ve esta sección.
      </p>

      {error && (
        <p className="text-danger text-xs mb-4 bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{error}</p>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-ink text-sm font-medium truncate">{r.full_name || "(sin nombre)"}</p>
              <p className="text-muted text-xs">
                {ROLE_LABELS[r.role] || r.role}
                {r.role === "alumno" && <> · coach: {coachName(r.coach_id)}</>}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-muted text-xs">Rol</label>
              <select
                value={r.role}
                disabled={savingId === r.id}
                onChange={(e) => changeRole(r.id, e.target.value)}
                className="bg-field text-ink text-sm rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
              >
                <option value="alumno">Alumno</option>
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
              </select>

              {r.role === "alumno" && (
                <select
                  value={r.coach_id || ""}
                  disabled={savingId === r.id}
                  onChange={(e) => changeCoach(r.id, e.target.value)}
                  className="bg-field text-ink text-sm rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
                >
                  <option value="">Sin coach</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || "Coach"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
