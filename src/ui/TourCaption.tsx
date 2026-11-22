import { useEffect, useState } from 'react';
import { stopTour } from '../state/tour';
import { useStore } from '../state/store';

/**
 * The tour's captions, as an incoming transmission: a step counter, the caption typed
 * out, and a bar for the time left on this step. Any click on the sky or Escape ends it.
 */
export function TourCaption() {
  const tour = useStore((s) => s.tour);
  const reduced = useStore((s) => s.reducedMotion);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!tour) return;
    if (reduced) {
      setShown(tour.caption.length);
      return;
    }
    setShown(0);
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const n = Math.min(tour.caption.length, Math.floor((performance.now() - start) / 18));
      setShown(n);
      if (n < tour.caption.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tour, reduced]);

  // Taking the controls ends the tour.
  useEffect(() => {
    if (!tour) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.tour')) return;
      stopTour();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && stopTour();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [tour]);

  if (!tour) return null;
  return (
    <section className="tour panel" aria-live="polite" aria-label="Guided tour">
      <header className="tour__head mono">
        <span>
          TRANSMISSION {tour.step + 1}/{tour.total}
        </span>
        <button type="button" className="tour__skip" onClick={stopTour}>
          End tour
        </button>
      </header>
      <p className="tour__text">
        {tour.caption.slice(0, shown)}
        <span className="tour__caret" aria-hidden="true" />
      </p>
      <span
        key={tour.step}
        className="tour__time"
        style={{ animationDuration: `${tour.seconds}s` }}
        aria-hidden="true"
      />
    </section>
  );
}
