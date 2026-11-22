import { flyToSet, showPerson } from '../state/people';
import { useMemo } from 'react';
import { authorColor } from '../render/cometMath';
import { computeInsights } from '../layout/insights';
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

export function InsightsPanel() {
  const model = useStore((s) => s.model);
  const insights = useMemo(() => (model ? computeInsights(model) : null), [model]);
  if (!model || !insights) return null;
  const { files } = model.data;
  const { tree } = model.layout;
  const close = () => useStore.getState().set({ panel: 'none' });

  const highlightLanguage = (id: number, name: string) => {
    const indices: number[] = [];
    for (let i = 0; i < files.length; i++) if (model.languageIds[i] === id) indices.push(i);
    useStore.getState().set({ selection: null });
    setHighlight({ reason: 'language', label: `${name} files`, indices });
    flyToSet(model, indices);
  };
  const highlightAuthor = (name: string) => showPerson(name);

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
          <h3>Hottest files</h3>
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
        <h3>Largest files</h3>
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
        <h3>Languages</h3>
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
          <h3>Quiet folders</h3>
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
          <h3>Contributors</h3>
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
    </aside>
  );
}
