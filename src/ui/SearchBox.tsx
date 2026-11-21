import { useEffect, useMemo, useRef, useState } from 'react';
import { languageOf } from '../layout/color';
import { searchFiles } from '../layout/search';
import { selectFile, setHighlight } from '../state/selection';
import { useStore } from '../state/store';
import { splitPath } from './format';

const SHOWN = 8;

/** Highlights the query's occurrences inside a path. */
function Marked({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().lastIndexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/**
 * Search the sky. Every match pulses (up to 2,000); the list shows the best eight.
 * Enter flies to the highlighted result. "/" focuses this box from anywhere.
 */
export function SearchBox() {
  const model = useStore((s) => s.model);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => (model ? searchFiles(model.searchPaths, query, 2000) : []),
    [model, query],
  );

  // Pulse every match in the sky.
  useEffect(() => {
    const h = useStore.getState().highlight;
    if (results.length > 0) {
      setHighlight({ reason: 'search', label: query.trim(), indices: results });
    } else if (h?.reason === 'search') {
      setHighlight(null);
    }
  }, [results, query]);

  useEffect(() => {
    setQuery('');
  }, [model]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (i: number) => {
    const idx = results[i];
    if (idx === undefined) return;
    selectFile(idx, { fly: true });
    setOpen(false);
    inputRef.current?.blur();
  };

  const shown = results.slice(0, SHOWN);
  const listId = 'search-results';

  return (
    <div className="search" role="search">
      <label htmlFor="search-input" className="visually-hidden">
        Find a file in this sky
      </label>
      <svg className="search__icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.6" />
        <path d="M10.4 10.4 14 14" />
      </svg>
      <input
        id="search-input"
        ref={inputRef}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Find a file"
        value={query}
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-activedescendant={
          open && shown[active] !== undefined ? `sr-${shown[active]}` : undefined
        }
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(shown.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            go(active);
          } else if (e.key === 'Escape') {
            setQuery('');
            inputRef.current?.blur();
          }
        }}
      />
      {query && (
        <span className="search__count mono">
          {results.length >= 2000 ? '2,000+' : results.length.toLocaleString()}
        </span>
      )}
      {!query && <kbd className="search__kbd">/</kbd>}
      {open && query && model && (
        <ul className="search__results panel" id={listId} role="listbox">
          {shown.length === 0 && (
            <li className="search__empty">No file matches &ldquo;{query.trim()}&rdquo;.</li>
          )}
          {shown.map((idx, i) => {
            const { dir, name } = splitPath(model.data.files[idx].path);
            const lang = languageOf(name);
            return (
              <li
                key={idx}
                id={`sr-${idx}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'is-active' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(i)}
              >
                <span className="swatch" style={{ background: lang.color, color: lang.color }} />
                <span className="search__name mono">
                  <Marked text={name} query={query} />
                </span>
                <span className="search__dir mono">
                  {dir.length > 42 ? `…${dir.slice(-41)}` : dir}
                </span>
              </li>
            );
          })}
          {results.length > SHOWN && (
            <li className="search__more">
              {results.length >= 2000 ? 'Over 2,000' : results.length.toLocaleString()} matches
              pulse in the sky
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
