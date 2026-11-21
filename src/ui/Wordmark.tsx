/**
 * "Gitsky", with a four-pointed star (the accent colour) where the i's dot would be.
 * The dotless ı keeps the letter shape; screen readers get the plain word.
 */
export function Wordmark({ as: Tag = 'h1', id }: { as?: 'h1' | 'span'; id?: string }) {
  return (
    <Tag className="wordmark" id={id} aria-label="Gitsky">
      <span aria-hidden="true">
        G
        <span className="wordmark__i">
          ı
          <svg className="wordmark__star" viewBox="-10 -10 20 20">
            <path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10Z" />
          </svg>
        </span>
        tsky
      </span>
    </Tag>
  );
}
