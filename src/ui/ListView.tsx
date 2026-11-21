import { useEffect, useMemo, useRef, useState } from 'react';
import { languageOf } from '../layout/color';
import { filterFiles, sortFiles, type SortDir, type SortKey } from '../layout/listView';
import { selectFile } from '../state/selection';
import { useStore } from '../state/store';
import { formatBytes, splitPath } from './format';

const PAGE = 200;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; defaultDir: SortDir }[] = [
  { key: 'path', label: 'File', defaultDir: 'asc' },
  { key: 'language', label: 'Language', defaultDir: 'asc' },
  { key: 'size', label: 'Size (bytes)', numeric: true, defaultDir: 'desc' },
  { key: 'churn', label: 'Changes in sample', numeric: true, defaultDir: 'desc' },
];

/**
 * The same data as the sky, as an accessible, sortable table. Rendering 50,000 rows
 * at once would freeze the page, so rows come in pages of 200.
 */
export function ListView() {
  const model = useStore((s) => s.model);
  const [key, setKey] = useState<SortKey>('churn');
  const [dir, setDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = () => useStore.getState().set({ panel: 'none' });

  const sorted = useMemo(() => (model ? sortFiles(model, key, dir) : []), [model, key, dir]);
  const rows = useMemo(
    () => (model ? filterFiles(model, sorted, query) : []),
    [model, sorted, query],
  );

  useEffect(() => setShown(PAGE), [key, dir, query]);
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);

  if (!model) return null;
  const sampled = model.data.commits.length;

  const sortBy = (k: SortKey, d: SortDir) => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setKey(k);
      setDir(d);
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="listview panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="listview-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      >
        <header className="listview__head">
          <h2 id="listview-title">
            Every file in <span className="mono">{model.data.meta.fullName}</span>
          </h2>
          <label className="visually-hidden" htmlFor="listview-filter">
            Filter by path
          </label>
          <input
            id="listview-filter"
            className="listview__filter mono"
            type="search"
            placeholder="Filter by path"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="detail__close"
            aria-label="Close list view"
            onClick={close}
          >
            &times;
          </button>
        </header>
        <p className="listview__note">
          {rows.length.toLocaleString()} of {model.data.files.length.toLocaleString()} files.
          {sampled > 0
            ? ` Changes are counted in the last ${sampled} sampled commits.`
            : ' No commits were sampled.'}
        </p>
        <div className="listview__scroll">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.numeric ? 'is-num' : undefined}
                    aria-sort={
                      key === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <button type="button" onClick={() => sortBy(c.key, c.defaultDir)}>
                      {c.label}
                      <span className="sort-ind" aria-hidden="true">
                        {key === c.key ? (dir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((i) => {
                const f = model.data.files[i];
                const { dir: d, name } = splitPath(f.path);
                const lang = languageOf(f.path);
                return (
                  <tr key={i}>
                    <td className="mono listview__path">
                      <span className="listview__dir">{d}</span>
                      {name}
                    </td>
                    <td>
                      <span
                        className="swatch"
                        style={{ background: lang.color, color: lang.color }}
                      />
                      {lang.name}
                    </td>
                    <td className="is-num mono" title={`${f.size.toLocaleString()} bytes`}>
                      {formatBytes(f.size)}
                    </td>
                    <td className="is-num mono">{model.churn.counts[i]}</td>
                    <td>
                      <button
                        type="button"
                        className="listview__show"
                        aria-label={`Show ${f.path} in the sky`}
                        onClick={() => {
                          close();
                          selectFile(i, { fly: true });
                        }}
                      >
                        Show in sky
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > shown && (
            <button
              type="button"
              className="btn btn--ghost listview__more"
              onClick={() => setShown((s) => s + PAGE)}
            >
              Show {Math.min(PAGE, rows.length - shown)} more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
