"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Share, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { addNotifications } from "@/lib/notifications";
import { disablePush, enablePush, pushStatus } from "@/lib/push";

const plainT = (s) => s;
const DISMISS_KEY = (uid) => `push_prompt_dismissed_${uid}`;

function usePushStatus(userId) {
  const [status, setStatus] = useState(null); // null = revisando
  useEffect(() => {
    let alive = true;
    pushStatus(userId).then((s) => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, [userId]);
  return [status, setStatus];
}

function statusText(status, t) {
  if (status === "on") return t("Le llegan los avisos a la barra del celular, aunque la app esté cerrada.");
  if (status === "denied") return t("Están bloqueadas. Actívelas en los ajustes del celular o del navegador para este sitio.");
  if (status === "ios-install") return t("En iPhone primero instale la app: toque Compartir y luego \"Agregar a inicio\". Ábrala desde ese ícono.");
  if (status === "unsupported") return t("Este navegador no permite notificaciones. Pruebe con Chrome en Android o con la app instalada en iPhone.");
  return t("Reciba mensajes, anuncios y recordatorios en la barra del celular.");
}

// Interruptor para Perfil (alumno) y Mi perfil (coach). t = traductor (el coach no lo pasa).
export function PushToggle({ userId, t = plainT }) {
  const [status, setStatus] = usePushStatus(userId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testSent, setTestSent] = useState(false);

  const on = status === "on";
  const canToggle = status === "on" || status === "off";

  async function toggle() {
    setBusy(true); setError(""); setTestSent(false);
    try {
      setStatus(on ? await disablePush(supabase, userId) : await enablePush(supabase, userId));
    } catch {
      setError(t("No se pudo activar. Revise su conexión e intente de nuevo."));
    }
    setBusy(false);
  }

  async function sendTest() {
    setTestSent(false);
    await addNotifications(supabase, [{
      recipient_id: userId, type: "test", link: "home", dedupe_key: `test:${Date.now()}`,
      title: "Notificación de prueba", body: "Si ve esto en la barra del celular, ya quedó todo listo. ✓",
    }]);
    setTestSent(true);
  }

  return (
    <div className="bg-card rounded-2xl px-4 py-3 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {on ? <Bell size={16} className="text-accent shrink-0" /> : <BellOff size={16} className="text-muted shrink-0" />}
          <span className="text-ink text-sm">{t("Notificaciones en este celular")}</span>
        </div>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t("Notificaciones en este celular")}
            disabled={busy}
            onClick={toggle}
            className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-60 ${on ? "bg-accent" : "bg-field"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${on ? "translate-x-5 bg-app" : "bg-soft"}`} />
          </button>
        )}
      </div>
      {status && <p className="text-muted text-xs mt-1.5">{statusText(status, t)}</p>}
      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
      {on && (
        <button type="button" onClick={sendTest} className="text-accent text-xs mt-2 underline-offset-2 hover:underline">
          {testSent ? t("Enviada. Debe llegarle en unos segundos.") : t("Enviar una notificación de prueba")}
        </button>
      )}
    </div>
  );
}

// Tarjeta para Inicio (alumno) y el panel (coach): aparece hasta que active o la cierre.
export function PushPromptCard({ userId, t = plainT, className = "" }) {
  const [status, setStatus] = usePushStatus(userId);
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY(userId)) === "1"); } catch { setDismissed(false); }
  }, [userId]);

  if (!userId || dismissed || !(status === "off" || status === "ios-install")) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY(userId), "1"); } catch { }
    setDismissed(true);
  };

  async function activate() {
    setBusy(true);
    try {
      const s = await enablePush(supabase, userId);
      setStatus(s);
      if (s === "on" || s === "denied") close();
    } catch { }
    setBusy(false);
  }

  const ios = status === "ios-install";
  return (
    <div className={`relative w-full flex items-start gap-3 bg-accent/[0.08] border border-accent/25 rounded-2xl p-3.5 mb-5 ${className}`}>
      <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
        {ios ? <Share size={17} className="text-accent" /> : <Bell size={17} className="text-accent" />}
      </div>
      <div className="flex-1 min-w-0 pr-5">
        <p className="text-ink text-sm font-medium">{ios ? t("Instale la app para recibir notificaciones") : t("Active las notificaciones")}</p>
        <p className="text-soft text-xs mt-0.5">
          {ios
            ? t("En Safari toque Compartir y luego \"Agregar a inicio\". Abra Kineaco desde ese ícono y active las notificaciones en Perfil.")
            : t("Le avisamos de mensajes, anuncios y su entrenamiento del día, aunque la app esté cerrada.")}
        </p>
        {!ios && (
          <button type="button" onClick={activate} disabled={busy} className="mt-2.5 bg-accent text-app text-xs font-semibold rounded-lg px-3.5 py-2 disabled:opacity-60">
            {busy ? t("Activando...") : t("Activar")}
          </button>
        )}
      </div>
      <button type="button" onClick={close} aria-label={t("Cerrar")} className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center text-muted hover:text-ink">
        <X size={15} />
      </button>
    </div>
  );
}
