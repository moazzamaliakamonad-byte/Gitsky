import { useEffect, useRef, useState } from 'react';
import { renderShareCard } from '../share/renderCard';
import { shareFileName, shareUrl } from '../share/shareLayout';
import { useStore } from '../state/store';

type Status = { kind: 'idle' | 'ok' | 'error'; text: string };

// Dev-only hook used to render the site's own preview image (public/og-image.jpg).
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__gitskyCard = (footer: string) => {
    const { model } = useStore.getState();
    return model
      ? renderShareCard(model, window.location.href, { footer, type: 'image/jpeg' })
      : null;
  };
}

/** "Share your sky": a 1200×630 card of the current view, plus the deep link. */
export function ShareDialog() {
  const model = useStore((s) => s.model);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = () => useStore.getState().set({ panel: 'none' });

  const link = model
    ? shareUrl(
        window.location.href,
        model.data.meta.fullName,
        model.data.branch !== model.data.meta.defaultBranch ? model.data.branch : undefined,
      )
    : '';

  useEffect(() => {
    if (!model) return;
    let url: string | null = null;
    let alive = true;
    renderShareCard(model, window.location.href)
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        setBlob(b);
        setPreview(url);
      })
      .catch(
        () =>
          alive &&
          setStatus({ kind: 'error', text: 'The image could not be made in this browser.' }),
      );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [model]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Opening Share copies the link straight away (the click that opened this dialog is
  // the user gesture the clipboard needs). Only claim success if it actually worked.
  useEffect(() => {
    if (!link) return;
    navigator.clipboard
      ?.writeText(link)
      .then(() => setStatus({ kind: 'ok', text: 'Link copied to your clipboard.' }))
      .catch(() => undefined);
  }, [link]);

  if (!model) return null;
  const fileName = shareFileName(model.data.meta.fullName);
  const canCopyImage = typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write);
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
  const canNativeShare = Boolean(file && navigator.canShare?.({ files: [file] }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setStatus({ kind: 'ok', text: 'Link copied.' });
    } catch {
      setStatus({ kind: 'error', text: 'Copy was blocked. Select the link above and copy it.' });
    }
  };
  const copyImage = async () => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus({ kind: 'ok', text: 'Image copied.' });
    } catch {
      setStatus({ kind: 'error', text: 'Copying images was blocked. Download it instead.' });
    }
  };
  const nativeShare = async () => {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        title: `${model.data.meta.fullName} on Gitsky`,
        url: link,
      });
    } catch {
      // The user closed the share sheet: nothing to report.
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="share panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && close()}
      >
        <header className="share__head">
          <h2 id="share-title">Share your sky</h2>
          <button type="button" className="detail__close" aria-label="Close" onClick={close}>
            &times;
          </button>
        </header>

        <div className="share__preview">
          {preview ? (
            <img
              src={preview}
              width={1200}
              height={630}
              alt={`Share card for ${model.data.meta.fullName}`}
            />
          ) : (
            <p className="share__developing">Developing the plate&hellip;</p>
          )}
        </div>

        <div className="share__link">
          <label htmlFor="share-link" className="visually-hidden">
            Link to this sky
          </label>
          <input
            id="share-link"
            className="mono"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="btn btn--ghost" onClick={copyLink}>
            Copy link
          </button>
        </div>

        <div className="share__actions">
          {preview && (
            <a className="btn btn--accent" href={preview} download={fileName}>
              Download PNG
            </a>
          )}
          {canCopyImage && blob && (
            <button type="button" className="btn btn--ghost" onClick={copyImage}>
              Copy image
            </button>
          )}
          {canNativeShare && (
            <button type="button" className="btn btn--ghost" onClick={nativeShare}>
              Share&hellip;
            </button>
          )}
          <span className={`share__status share__status--${status.kind}`} role="status">
            {status.text}
          </span>
        </div>
        <p className="share__note">
          The image shows your current view, 1200&times;630, sized for link previews. The link opens
          this repo directly.
        </p>
      </div>
    </div>
  );
}
