import { useMemo } from 'react';
import { authorColor } from '../render/cometMath';
import { computeInsights } from '../layout/insights';
import type { SkyModel } from '../state/model';
import { selectFile, selectFolder, setHighlight } from '../state/selection';
import { useStore } from '../state/store';
import { formatBytes, splitPath } from './format';

/** A thin horizontal magnitude bar (single hue per list, rounded data end). */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="ibar" aria-hidden="true">
      <span
        style={{ width: `${Math.max(2, (value / Math.max(1, max)) * 100)}%`, background: color }}
      />
    </span>
  );
}

/** Fly to the centre of a set of stars, far enough back to frame them. */
function flyToSet(model: SkyModel, indices: number[]) {
  if (indices.length === 0) return;
  const p = model.layout.positions;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of indices) {
    x += p[i * 3];
    y += p[i * 3 + 1];
    z += p[i * 3 + 2];
  }
  const k = indices.length;
  const c: [number, number, number] = [x / k, y / k, z / k];
  let r = 0;
  for (const i of indices) r = Math.max(r, Math.hypot(p[i * 3] - c[0], p[i * 3 + 2] - c[2]));
  useStore.getState().fly(c, Math.max(18, Math.min(r * 1.6, model.layout.extent * 2.2)));
}

export function InsightsPanel() {
  const model = useStore((s) => s.model);
  const insights = useMemo(() => (model ? computeInsights(model) : null), [model]);
  if (!model || !insights) return null;
  const { files, commits } = model.data;
  const { tree } = model.layout;
  const k = commits.length;
  const close = () => useStore.getState().set({ panel: 'none' });

  const highlightLanguage = (id: number, name: string) => {
    const indices: number[] = [];
    for (let i = 0; i < files.length; i++) if (model.languageIds[i] === id) indices.push(i);
    useStore.getState().set({ selection: null });
    setHighlight({ reason: 'language', label: `${name} files`, indices });
  };
  const highlightAuthor = (name: string) => {
    const set = new Set<number>();
    for (const c of commits) if (c.author === name) for (const i of c.files) set.add(i);
    const indices = [...set];
    useStore.getState().set({ selection: null });
    setHighlight({ reason: 'author', label: `Touched by ${name}`, indices });
    flyToSet(model, indices);
  };

  return (
    <aside className="insights panel" aria-labelledby="insights-title">
      <header className="insights__head">
        <h2 id="insights-title">Understand this repo in 30 seconds</h2>
        <button type="button" className="detail__close" aria-label="Close insights" onClick={close}>
          &times;
        </button>
      </header>

      <div className="insights__summary">
        {insights.summary.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>

      {insights.hottest.length > 0 && (
        <section className="insights__block">
          <h3>
            Hottest files <span>changes in the last {k} commits</span>
          </h3>
          <ul className="irows">
            {insights.hottest.map((h) => (
              <li key={h.index}>
                <button type="button" onClick={() => selectFile(h.index, { fly: true })}>
                  <span className="irows__label mono" title={files[h.index].path}>
                    {splitPath(files[h.index].path).name}
                  </span>
                  <span className="irows__value mono">{h.count}</span>
                  <Bar value={h.count} max={insights.hottest[0].count} color="var(--arcturus)" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="insights__block">
        <h3>
          Largest files <span>in bytes, not lines</span>
        </h3>
        <ul className="irows">
          {insights.largest.map((l) => (
            <li key={l.index}>
              <button type="button" onClick={() => selectFile(l.index, { fly: true })}>
                <span className="irows__label mono" title={files[l.index].path}>
                  {splitPath(files[l.index].path).name}
                </span>
                <span className="irows__value mono">{formatBytes(l.bytes)}</span>
                <Bar value={l.bytes} max={insights.largest[0].bytes} color="#9db6ff" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="insights__block">
        <h3>
          Languages <span>share of bytes</span>
        </h3>
        <span className="ilangbar" aria-hidden="true">
          {insights.languages.map((l) => (
            <span key={l.id} style={{ flexGrow: l.share, background: l.color }} />
          ))}
        </span>
        <ul className="irows irows--langs">
          {insights.languages.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => highlightLanguage(l.id, l.name)}>
                <span className="swatch" style={{ background: l.color, color: l.color }} />
                <span className="irows__label">{l.name}</span>
                <span className="irows__value mono">
                  {(l.share * 100).toFixed(l.share < 0.1 ? 1 : 0)}%
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {insights.quiet.length > 0 && (
        <section className="insights__block">
          <h3>
            Quiet zones <span>big folders unchanged in the last {k} commits</span>
          </h3>
          <ul className="irows">
            {insights.quiet.map((q) => (
              <li key={q.folder}>
                <button type="button" onClick={() => selectFolder(q.folder)}>
                  <span className="irows__label mono">{tree.folders[q.folder].path}/</span>
                  <span className="irows__value mono">{q.files.toLocaleString()} files</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insights.contributors.length > 0 && (
        <section className="insights__block">
          <h3>
            Contributors <span>commits in the sample</span>
          </h3>
          <ul className="irows">
            {insights.contributors.map((c) => (
              <li key={c.name}>
                <button type="button" onClick={() => highlightAuthor(c.name)}>
                  <span
                    className="swatch"
                    style={{ background: authorColor(c.name), color: authorColor(c.name) }}
                  />
                  <span className="irows__label mono">{c.name}</span>
                  <span className="irows__value mono">{c.commits}</span>
                  <Bar
                    value={c.commits}
                    max={insights.contributors[0].commits}
                    color={authorColor(c.name)}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="insights__foot">
        Based on {files.length.toLocaleString()} files
        {model.data.capped
          ? ` (a sample of ${model.data.capped.originalFileCount.toLocaleString()})`
          : ''}
        {k > 0 ? ` and the last ${k} of ${model.data.sampling.listed} listed commits` : ''}. Click
        anything to find it in the sky.
      </p>
    </aside>
  );
}
