// Marca de la app (Kineaco): el punto lima de la conciencia y el arco del movimiento,
// igual al ícono instalado en el celular
export function BrandMark({ size = 40, className = "" }) {
  return (
    <div
      className={`relative rounded-[28%] bg-app flex items-center justify-center border border-white/[0.08] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.72} height={size * 0.72} aria-hidden="true">
        <circle cx="50" cy="50" r="13" fill="var(--color-accent, #D6FF5C)" />
        <path d="M50 14 A36 36 0 1 1 18.8 68" fill="none" stroke="var(--color-accent, #D6FF5C)" strokeWidth="9" strokeLinecap="round" />
      </svg>
    </div>
  );
}
