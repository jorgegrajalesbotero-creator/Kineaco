// Siluetas animadas que se muestran mientras cargan los datos
export function Skeleton({ rows = 3, height = "h-12", className = "" }) {
  return (
    <div role="status" aria-label="Cargando" className={`space-y-2.5 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${height} rounded-xl bg-gradient-to-r from-card via-field/70 to-card bg-[length:200%_100%] animate-shimmer`}
          style={{ opacity: 1 - i * 0.18 }}
        />
      ))}
    </div>
  );
}
