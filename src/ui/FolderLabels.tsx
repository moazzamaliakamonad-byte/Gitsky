import { useLayoutEffect, useMemo, useRef } from 'react';
import { labelEls, pickLabelFolders } from '../render/labels';
import { useStore } from '../state/store';
import { focusFolder } from './focus';

/**
 * Star-chart callouts for the main folders. React renders them once per repo; the
 * canvas (LabelDriver) moves them every frame.
 */
export function FolderLabels() {
  const model = useStore((s) => s.model);
  const folders = useMemo(() => (model ? pickLabelFolders(model.layout.tree) : []), [model]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    labelEls.current = folders
      .map((folder, i) => {
        const el = refs.current[i];
        // The button itself is zero-size (its parts are absolutely positioned), so measure
        // the text: the collision box spans from the dot to the end of the text.
        const text = el?.querySelector<HTMLElement>('.flabel__text');
        return el && text ? { folder, el, w: text.offsetWidth + 24 } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return () => {
      labelEls.current = [];
    };
  }, [folders]);

  if (!model) return null;
  const { tree } = model.layout;

  return (
    <div className="flabels" aria-label="Main folders">
      {folders.map((fi, i) => {
        const f = tree.folders[fi];
        return (
          <button
            key={fi}
            type="button"
            className={`flabel flabel--d${f.depth}`}
            ref={(el) => {
              refs.current[i] = el;
            }}
            style={{ opacity: 0 }}
            tabIndex={-1}
            onClick={() => focusFolder(fi)}
            aria-label={`${f.path}, ${f.totalFiles.toLocaleString()} files. Fly to this folder.`}
          >
            <span className="flabel__dot" aria-hidden="true" />
            <span className="flabel__text">
              <span className="flabel__name">
                {f.depth > 1 && (
                  <span className="flabel__parent">
                    {f.path.slice(0, f.path.length - f.name.length)}
                  </span>
                )}
                {f.name}/
              </span>
              <span className="flabel__count">{f.totalFiles.toLocaleString()}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
