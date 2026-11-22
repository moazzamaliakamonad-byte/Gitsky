import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { KIND_COLOR, KIND_LABEL } from '../layout/fileOrbit';
import type { FileSymbol } from '../layout/outline';
import { fileOrbitState } from '../render/fileOrbitState';
import { nearLabels } from '../render/nearConfig';
import { selectFile } from '../state/selection';
import { useStore } from '../state/store';
import { splitPath } from './format';

/** Lines rendered at once; longer files show a window around the focused symbol. */
const WINDOW = 400;

const KEYWORDS = new Set(
  (
    'abstract as async await break case catch class const continue def default delete do elif ' +
    'else enum export extends false final finally fn for from func function go if impl import in ' +
    'interface is let match mod mut new nil none null package private protected pub public return ' +
    'self static struct super switch this throw trait true try type typeof undefined use var void ' +
    'while with yield'
  ).split(' '),
);

/** A tiny, safe highlighter: comments, strings, numbers and keywords, line by line. */
function tokens(line: string): [string, string][] {
  const out: [string, string][] = [];
  const re =
    /(\/\/.*$|#(?![{[]).*$|\/\*.*?\*\/|<!--.*?-->)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\d_.xXa-fA-F]*\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push(['c', m[1]]);
    else if (m[2]) out.push(['s', m[2]]);
    else if (m[3]) out.push(['n', m[3]]);
    else if (m[4]) out.push([KEYWORDS.has(m[4]) ? 'k' : '', m[4]]);
    else out.push(['', m[5]]);
  }
  return out;
}

const Line = memo(function Line({ n, text, on }: { n: number; text: string; on: boolean }) {
  return (
    <div className={`code__line${on ? ' is-on' : ''}`} data-line={n}>
      <span className="code__num">{n}</span>
      <span className="code__text">
        {tokens(text).map(([k, t], i) =>
          k ? (
            <span key={i} className={`t-${k}`}>
              {t}
            </span>
          ) : (
            t
          ),
        )}
      </span>
    </div>
  );
});

function Outline({ outline, focus }: { outline: FileSymbol[]; focus: number }) {
  return (
    <ol className="outline" aria-label="Symbols in this file">
      {outline.map((s, i) => (
        <li key={`${s.line}-${s.name}`}>
          <button
            type="button"
            className={i === focus ? 'is-on' : undefined}
            onClick={() => useStore.getState().set({ symbol: i === focus ? -1 : i })}
            style={{ paddingLeft: s.level > 1 ? `${(s.level - 1) * 12 + 10}px` : undefined }}
          >
            <span className="outline__dot" style={{ background: KIND_COLOR[s.kind] }} />
            <span className="outline__name mono">{s.name}</span>
            <span className="outline__kind">{KIND_LABEL[s.kind]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * The selected file's content: an outline (the same symbols that orbit its star) and
 * the code itself. Clicking a symbol here or its planet in the sky focuses both.
 */
export function CodePanel() {
  const model = useStore((s) => s.model);
  const content = useStore((s) => s.content);
  const focus = useStore((s) => s.symbol);
  const [showAll, setShowAll] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);
  useEffect(() => setShowAll(false), [content?.file]);

  const lines = useMemo(() => content?.text?.split('\n') ?? [], [content?.text]);
  const outline = content?.outline ?? [];
  const sym = focus >= 0 ? outline[focus] : undefined;
  // Which slice of the file to render.
  const [from, to] = useMemo(() => {
    if (showAll || lines.length <= WINDOW) return [1, lines.length];
    if (sym) {
      const start = Math.max(1, sym.line - 40);
      return [start, Math.min(lines.length, start + WINDOW - 1)];
    }
    return [1, WINDOW];
  }, [showAll, lines.length, sym]);

  // Bring the focused symbol into view.
  useEffect(() => {
    if (!sym || !codeRef.current) return;
    const el = codeRef.current.querySelector<HTMLElement>(`[data-line="${sym.line}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [sym, from]);

  if (!model || !content) return null;
  const file = model.data.files[content.file];
  const { name } = splitPath(file.path);
  const ref = (model.data.headSha || model.data.branch).slice(0, 7);

  return (
    <aside className="code-panel panel" aria-label={`Contents of ${name}`}>
      <header className="code-panel__head">
        <h2 className="code-panel__title mono">{name}</h2>
        <p className="code-panel__meta">
          {content.status === 'ready'
            ? `${lines.length.toLocaleString()} lines, ${outline.length} ${outline.length === 1 ? 'symbol' : 'symbols'} in orbit`
            : content.status === 'loading'
              ? 'Opening the file…'
              : ' '}
        </p>
      </header>

      {content.status === 'ready' && outline.length > 0 && (
        <Outline outline={outline} focus={focus} />
      )}

      {content.status === 'ready' && (
        <div className="code" ref={codeRef} tabIndex={0} aria-label="Source code">
          {from > 1 && (
            <button type="button" className="code__more" onClick={() => setShowAll(true)}>
              Show lines 1–{from - 1}
            </button>
          )}
          {lines.slice(from - 1, to).map((text, i) => {
            const n = from + i;
            return (
              <Line key={n} n={n} text={text} on={!!sym && n >= sym.line && n <= sym.endLine} />
            );
          })}
          {to < lines.length && (
            <button type="button" className="code__more" onClick={() => setShowAll(true)}>
              Show the remaining {(lines.length - to).toLocaleString()} lines
            </button>
          )}
        </div>
      )}

      {content.status === 'loading' && (
        <div className="code code--loading" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ width: `${30 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
      )}
      {content.status === 'binary' && (
        <p className="code-panel__note">This is a binary file, so there is no text to show.</p>
      )}
      {(content.status === 'too-big' ||
        content.status === 'unavailable' ||
        content.status === 'error') && <p className="code-panel__note">{content.message}</p>}

      <footer className="code-panel__foot">
        Read from raw.githubusercontent.com at commit <span className="mono">{ref}</span>. This
        doesn’t use your GitHub API requests.
      </footer>
    </aside>
  );
}

/** The two floating planet names: the hovered planet and the focused one. */
export function OrbitLabels() {
  return (
    <div className="sys-labels" aria-hidden="true">
      {[0, 1].map((slot) => (
        <span
          key={slot}
          ref={(el) => {
            if (el) fileOrbitState.labels[slot] = el;
          }}
          className="orbit-label mono"
        />
      ))}
    </div>
  );
}

/** File names on the stars nearest the camera; click one to select that file. */
export function NearLabels() {
  return (
    <div className="sys-labels">
      {Array.from({ length: 10 }, (_, slot) => (
        <button
          key={slot}
          type="button"
          tabIndex={-1}
          ref={(el) => {
            if (el) nearLabels.els[slot] = el;
          }}
          className="near-label mono"
          onClick={() => {
            const f = nearLabels.files[slot];
            if (f >= 0) selectFile(f);
          }}
        />
      ))}
    </div>
  );
}
