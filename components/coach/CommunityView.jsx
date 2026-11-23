"use client";

import { useState } from "react";
import { CommunityScreen } from "@/components/student/CommunityScreen";
import { ChallengeManager } from "@/components/coach/ChallengeManager";

// Coach: retos grupales de su comunidad + el muro tal como lo ven sus alumnos (con su propia tarjeta y sus avisos)
export function CommunityView({ userId }) {
  const [key, setKey] = useState(0);

  const header = (
    <div className="mb-6">
      <h1 className="text-ink text-xl font-semibold mb-1">Comunidad</h1>
      <p className="text-soft text-sm mb-4">Sus alumnos entran si quieren. Ven las mascotas, el ejercicio destacado, la constancia, los retos y sus avisos; nunca pesos, medidas, fotos ni molestias. Usted siempre aparece como coach, con su mascota y sus entrenamientos.</p>
      <ChallengeManager onChange={() => setKey((k) => k + 1)} />
    </div>
  );

  return <CommunityScreen key={key} userId={userId} coachMode header={header} />;
}
