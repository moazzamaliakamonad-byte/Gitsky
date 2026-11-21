/** A hairline bar of a repo's language mix by bytes: one segment per language. */
export function Spectrum({ parts, className }: { parts: [string, number][]; className?: string }) {
  if (parts.length === 0) return null;
  return (
    <span className={`spectrum ${className ?? ''}`} aria-hidden="true">
      {parts.map(([color, frac], i) => (
        <span key={i} style={{ background: color, flexGrow: frac }} />
      ))}
    </span>
  );
}
