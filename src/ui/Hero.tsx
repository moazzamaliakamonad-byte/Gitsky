import { openBundled } from '../state/actions';
import { useStore } from '../state/store';
import { RepoInput } from './RepoInput';
import { Spectrum } from './Spectrum';
import { Wordmark } from './Wordmark';
import { Credit } from './Credit';
import { startTour } from '../state/tour';

/** The caption for the sky behind the hero, written like an astronomical plate's. */
function PlateCaption() {
  const model = useStore((s) => s.model);
  const bundled = useStore((s) => s.bundled);
  if (!model) return null;
  const { meta } = model.data;
  const plate = bundled.findIndex((b) => b.fullName === meta.fullName);
  const folders = model.layout.tree.folders.length - 1;
  const commits = model.data.commits.length;

  return (
    <figure className="plate" aria-label="About the sky shown">
      <figcaption>
        <span className="plate__no">
          {plate >= 0 ? `Plate ${plate + 1} of ${bundled.length}` : 'Live plate'}
        </span>
        <span className="plate__name">{meta.fullName}</span>
        <span>
          {model.data.files.length.toLocaleString()} stars in {folders.toLocaleString()} systems
        </span>
        {commits > 0 && (
          <span>
            {commits} comets from the last {commits} commits
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export function Hero() {
  const bundled = useStore((s) => s.bundled);
  const model = useStore((s) => s.model);
  const shown = model?.data.meta.fullName;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <Wordmark id="hero-title" />
        <p className="tagline">Your repo&rsquo;s night sky.</p>
        <RepoInput size="hero" autoFocus={!useStore.getState().isTouch} />
        {bundled.length > 0 && (
          <ul className="chips" aria-label="Example skies">
            {bundled.map((b) => (
              <li key={b.fullName}>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={shown === b.fullName}
                  onClick={() => {
                    void openBundled(b);
                    useStore.getState().set({ heroOpen: false });
                  }}
                >
                  <span className="chip__name">{b.fullName}</span>
                  <span className="chip__blurb">{b.blurb}</span>
                  {b.spectrum && <Spectrum parts={b.spectrum} className="chip__spectrum" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="hero__more">
          <button type="button" className="btn btn--ghost hero__tour" onClick={startTour}>
            Take the guided tour
          </button>
          <button
            type="button"
            className="hero__explore link"
            onClick={() => useStore.getState().set({ heroOpen: false })}
          >
            Or explore it yourself
          </button>
        </div>
      </section>
      <PlateCaption />
      <Credit className="credit--hero" />
    </>
  );
}
