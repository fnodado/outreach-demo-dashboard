export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      {title && (
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-2">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
