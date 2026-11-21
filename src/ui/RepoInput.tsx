import { useState, type FormEvent } from 'react';
import { openRepoInput } from '../state/actions';
import { useStore } from '../state/store';

/** The "paste a repo" field. `size="hero"` on the landing page, compact in the HUD. */
export function RepoInput({ size, autoFocus }: { size: 'hero' | 'compact'; autoFocus?: boolean }) {
  const [value, setValue] = useState('');
  const loading = useStore((s) => s.status === 'loading');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    const ok = await openRepoInput(value);
    if (ok) {
      useStore.getState().set({ heroOpen: false });
      setValue('');
    }
  }

  return (
    <form className={`repo-input repo-input--${size}`} onSubmit={submit} role="search">
      <label htmlFor={`repo-${size}`} className="visually-hidden">
        GitHub repository
      </label>
      <input
        id={`repo-${size}`}
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={size === 'hero' ? 'Paste a GitHub repo' : 'owner/repo or GitHub URL'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn btn--accent" disabled={loading || !value.trim()}>
        {size === 'hero' ? 'Launch' : 'Go'}
      </button>
    </form>
  );
}
