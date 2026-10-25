"use client";

export function RoutineModeToggle({ mode, onChange }) {
  return (
    <div className="flex gap-2 mb-3">
      {[
        ["lista", "Lista simple"],
        ["bloques", "Por bloques"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 py-2 rounded-lg text-sm ${mode === key ? "bg-accent text-app font-medium" : "bg-card text-soft"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
