import { enterSystem } from '../state/systemActions';
import { useEffect, useMemo, useRef } from 'react';
import { languageOf } from '../layout/color';
import { fileDetail, folderStats } from '../layout/stats';
import type { SkyModel } from '../state/model';
import { clearSelection, selectFile, selectFolder } from '../state/selection';
import { useStore } from '../state/store';
import { focusFile, focusFolder } from './focus';
import { formatBytes, plural, relativeTime, splitPath } from './format';
import { Spectrum } from './Spectrum';
import { TouchStrip } from './TouchStrip';

/** Clickable path segments: each one selects that folder. */
function Breadcrumb({ model, path, isFile }: { model: SkyModel; path: string; isFile: boolean }) {
  const parts = path.split('/');
  const crumbs = isFile ? parts.slice(0, -1) : parts;
  return (
    <nav className="crumbs mono" aria-label="Path">
      <button type="button" onClick={() => clearSelection()}>
        {model.data.meta.repo}
      </button>
      {crumbs.map((p, i) => {
        const folderPath = parts.slice(0, i + 1).join('/');
        const fi = model.layout.tree.byPath.get(folderPath);
        return (
          <span key={folderPath}>
            <span className="crumbs__sep">/</span>
            <button type="button" onClick={() => fi !== undefined && selectFolder(fi)}>
              {p}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function FileView({ model, index }: { model: SkyModel; index: number }) {
  const system = useStore((st) => st.system);
  const file = model.data.files[index];
  const detail = useMemo(() => fileDetail(model, index), [model, index]);
  const lang = languageOf(file.path);
  const { name } = splitPath(file.path);
  const commits = model.data.commits;
  const touched = useMemo(() => new Set(detail.touches), [detail]);
  const isNova = model.supernova?.file === index;

  return (
    <>
      <Breadcrumb model={model} path={file.path} isFile />
      <h2 className="detail__title mono">{name}</h2>
      {isNova && model.supernova && (
        <p className="detail__phenomenon">
          <span className="detail__glyph detail__glyph--nova" aria-hidden="true" />
          <span>
            <strong>Supernova.</strong> The most-changed file in the sample (
            {model.supernova.touches} of {commits.length} commits). It explodes when the first of
            those comets lands.
          </span>
        </p>
      )}
      <dl className="facts">
        <div>
          <dt>Language</dt>
          <dd>
            <span className="swatch" style={{ background: lang.color, color: lang.color }} />
            {lang.name}
          </dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>
            <span className="mono">{formatBytes(file.size)}</span>
            <span className="facts__aside">
              larger than {Math.max(0, detail.sizePercentile - 1)}% of files
            </span>
          </dd>
        </div>
        <div>
          <dt>Activity</dt>
          <dd>
            {commits.length === 0 ? (
              <span className="facts__aside">No commits were sampled for this sky.</span>
            ) : (
              <>
                <span>
                  {detail.touches.length > 0
                    ? `Changed in ${detail.touches.length} of the last ${commits.length} commits`
                    : `Unchanged in the last ${commits.length} commits`}
                </span>
                <TouchStrip total={commits.length} touched={touched} />
              </>
            )}
          </dd>
        </div>
      </dl>

      {detail.touches.length > 0 && (
        <section className="detail__section">
          <h3>Recent commits touching it</h3>
          <ol className="commit-list">
            {detail.touches.slice(0, 5).map((c) => (
              <li key={commits[c].sha}>
                <a
                  href={`${model.data.meta.htmlUrl}/commit/${commits[c].sha}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {commits[c].message}
                </a>
                <span className="commit-list__meta">
                  <span className="mono">{commits[c].author}</span>
                  <span>{relativeTime(commits[c].date)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="detail__actions">
        <a className="btn btn--accent" href={detail.githubUrl} target="_blank" rel="noreferrer">
          Open on GitHub
        </a>
        {system === null && (
          <button type="button" className="btn btn--ghost" onClick={() => focusFile(index)}>
            Fly here
          </button>
        )}
      </div>
    </>
  );
}

function FolderView({ model, index }: { model: SkyModel; index: number }) {
  const system = useStore((st) => st.system);
  const folder = model.layout.tree.folders[index];
  const stats = useMemo(() => folderStats(model, index), [model, index]);
  const commits = model.data.commits;
  const touchedCommits = useMemo(() => {
    const inside = new Set(stats.members);
    const s = new Set<number>();
    commits.forEach((c, ci) => {
      if (c.files.some((i) => inside.has(i))) s.add(ci);
    });
    return s;
  }, [stats, commits]);
  const pct = stats.files ? Math.round((stats.touchedFiles / stats.files) * 100) : 0;

  return (
    <>
      <Breadcrumb model={model} path={folder.path} isFile={false} />
      <h2 className="detail__title mono">{folder.name}/</h2>
      <Spectrum parts={stats.spectrum} className="detail__spectrum" />
      <dl className="facts">
        <div>
          <dt>Contents</dt>
          <dd>
            {plural(stats.files, 'file')}
            <span className="facts__aside mono">{formatBytes(stats.bytes)}</span>
          </dd>
        </div>
        {commits.length > 0 && (
          <div>
            <dt>Activity</dt>
            <dd>
              <span>
                {stats.touchedFiles > 0
                  ? `${pct}% of its files changed in ${touchedCommits.size} of the last ${commits.length} commits`
                  : `Quiet: nothing changed in the last ${commits.length} commits`}
              </span>
              <TouchStrip total={commits.length} touched={touchedCommits} />
            </dd>
          </div>
        )}
      </dl>

      {stats.hottest.length > 0 && (
        <section className="detail__section">
          <h3>Busiest files here</h3>
          <ul className="rank-list">
            {stats.hottest.map((h) => (
              <li key={h.index}>
                <button type="button" onClick={() => selectFile(h.index, { fly: true })}>
                  <span className="mono">{splitPath(model.data.files[h.index].path).name}</span>
                  <span className="rank-list__n mono">{h.count}×</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.subfolders.length > 0 && (
        <section className="detail__section">
          <h3>Inside</h3>
          <ul className="rank-list">
            {stats.subfolders.slice(0, 6).map((s) => (
              <li key={s.index}>
                <button type="button" onClick={() => selectFolder(s.index)}>
                  <span className="mono">{model.layout.tree.folders[s.index].name}/</span>
                  <span className="rank-list__n mono">{s.files.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.authors.length > 0 && (
        <section className="detail__section">
          <h3>Who worked here, in the sample</h3>
          <p className="authors">
            {stats.authors.map((a) => (
              <span key={a.name}>
                <span className="mono">{a.name}</span>{' '}
                <span className="facts__aside">{a.commits}</span>
              </span>
            ))}
          </p>
        </section>
      )}

      <div className="detail__actions">
        <a
          className="btn btn--accent"
          href={`${model.data.meta.htmlUrl}/tree/${encodeURIComponent(model.data.branch)}/${folder.path
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`}
          target="_blank"
          rel="noreferrer"
        >
          Open on GitHub
        </a>
        {system !== index && (
          <button type="button" className="btn btn--ghost" onClick={() => enterSystem(index)}>
            Warp in
          </button>
        )}
        {system === null && (
          <button type="button" className="btn btn--ghost" onClick={() => focusFolder(index)}>
            Fly here
          </button>
        )}
      </div>
    </>
  );
}

export function DetailPanel() {
  const selection = useStore((s) => s.selection);
  const model = useStore((s) => s.model);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [selection]);

  if (!model || !selection) return null;
  const label = selection.kind === 'file' ? 'File details' : 'Folder details';

  return (
    <aside ref={ref} className="detail panel" aria-label={label}>
      <button
        type="button"
        className="detail__close"
        aria-label="Close details"
        onClick={() => clearSelection()}
      >
        &times;
      </button>
      {selection.kind === 'file' ? (
        <FileView model={model} index={selection.index} />
      ) : (
        <FolderView model={model} index={selection.index} />
      )}
    </aside>
  );
}
