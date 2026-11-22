import { AUTHOR, GITHUB_MARK } from '../share/author';

/** Who made Gitsky, with a link to their GitHub. */
export function Credit({ className = '' }: { className?: string }) {
  return (
    <a
      className={`credit ${className}`}
      href={`https://github.com/${AUTHOR}`}
      target="_blank"
      rel="noreferrer"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d={GITHUB_MARK} />
      </svg>
      <span>
        Made by <span className="mono">{AUTHOR}</span>
      </span>
    </a>
  );
}
