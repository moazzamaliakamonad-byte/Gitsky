/**
 * One tick per sampled commit, oldest → newest; lit where the file (or folder) was
 * touched. A tiny timeline that says "when", not just "how often".
 */
export function TouchStrip({ total, touched }: { total: number; touched: Set<number> }) {
  if (total === 0) return null;
  return (
    <span
      className="touch-strip"
      role="img"
      aria-label={`Changed in ${touched.size} of the last ${total} sampled commits`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={touched.has(i) ? 'is-on' : undefined} />
      ))}
    </span>
  );
}
