import { X } from "lucide-react";

// Marco común de las pantallas de detalle de un alumno: título, nombre y botón de cerrar
export function PanelLayout({ title, subtitle, onClose, width = "max-w-lg", children }) {
  return (
    <div className={`p-4 md:p-8 ${width}`}>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-ink text-xl font-semibold truncate">{title}</h2>
          {subtitle && <p className="text-muted text-sm truncate">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-ink shrink-0">
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  );
}
