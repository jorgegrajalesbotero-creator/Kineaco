"use client";

import { useEffect, useState } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { tr } from "@/lib/i18n";
import { canPromptInstall, isInstalled, onInstallChange, platformOf, promptInstall } from "@/lib/installApp";

// "Descargar la app": en Android y computador (Chrome/Edge) se instala con un toque; en iPhone
// muestra los 3 pasos de Safari. Si la app ya está instalada, no se muestra.
export function InstallAppButton({ className = "" }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState("desktop");
  const [canPrompt, setCanPrompt] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());
    setPlatform(platformOf(navigator.userAgent, navigator.maxTouchPoints || 0));
    setCanPrompt(canPromptInstall());
    setReady(true);
    return onInstallChange(() => { setCanPrompt(canPromptInstall()); setInstalled(isInstalled()); });
  }, []);

  if (!ready || installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      const ok = await promptInstall();
      if (ok) setInstalled(true);
      return;
    }
    setHelp(true);
  };

  const steps = platform === "ios"
    ? [
        { icon: Share, text: tr("En Safari, toque el botón Compartir (el cuadro con la flecha hacia arriba).") },
        { icon: PlusSquare, text: tr("Baje y toque «Agregar a pantalla de inicio».") },
        { icon: Download, text: tr("Toque «Agregar». Kineaco queda con su ícono, como cualquier app.") },
      ]
    : platform === "android"
      ? [
          { icon: null, text: tr("En Chrome, toque el menú ⋮ (arriba a la derecha).") },
          { icon: Download, text: tr("Toque «Instalar app» o «Agregar a pantalla de inicio».") },
          { icon: null, text: tr("Confirme. Kineaco queda con su ícono, como cualquier app.") },
        ]
      : [
          { icon: Download, text: tr("En Chrome o Edge, toque el ícono de instalar al final de la barra de direcciones.") },
          { icon: null, text: tr("Confirme con «Instalar». Kineaco se abre en su propia ventana.") },
        ];

  return (
    <>
      <button type="button" onClick={onClick}
        className={`w-full flex items-center justify-center gap-2 bg-card border border-accent/30 text-accent text-sm font-semibold rounded-2xl py-3 active:scale-[0.98] transition-transform ${className}`}>
        <Download size={16} /> {tr("Descargar la app")}
      </button>
      {help && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[80]" onClick={() => setHelp(false)}>
          <div role="dialog" aria-label={tr("Descargar la app")} onClick={(e) => e.stopPropagation()}
            className="bg-panel border border-white/[0.06] w-full max-w-md rounded-t-3xl md:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-ink text-base font-semibold">{tr("Descargar la app")}</p>
              <button onClick={() => setHelp(false)} aria-label={tr("Cerrar")} className="text-muted"><X size={20} /></button>
            </div>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-accent text-app text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-soft text-sm leading-snug pt-1">{s.text}{s.icon && <s.icon size={14} className="inline ml-1 -mt-0.5 text-accent" />}</span>
                </li>
              ))}
            </ol>
            <button onClick={() => setHelp(false)} className="w-full mt-5 bg-accent text-app text-sm font-semibold rounded-xl py-3">{tr("Listo")}</button>
          </div>
        </div>
      )}
    </>
  );
}
