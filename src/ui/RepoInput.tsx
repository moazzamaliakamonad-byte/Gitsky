import { useState, type FormEvent } from 'react';
import { openRepoInput } from '../state/actions';
import { openUserUniverse } from '../state/universeActions';
import { useStore } from '../state/store';

/** The "paste a repo" field. `size="hero"` on the landing page, compact in the HUD. */
export function RepoInput({
  size,
  autoFocus,
  onSubmitValue,
  id,
  cta,
  placeholder,
}: {
  size: 'hero' | 'compact';
  autoFocus?: boolean;
  /** Replaces the default "open this repo"; resolve true to clear the field. */
  onSubmitValue?: (value: string) => Promise<boolean>;
  id?: string;
  cta?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const loading = useStore((s) => s.status === 'loading');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    if (onSubmitValue) {
      if (await onSubmitValue(value)) setValue('');
      return;
    }
    // "@login" opens that person's universe instead of a repo.
    const user = /^@([A-Za-z0-9-]{1,39})$/.exec(value.trim());
    if (user) {
      setValue('');
      await openUserUniverse(user[1]);
      return;
    }
    const ok = await openRepoInput(value);
    if (ok) {
      useStore.getState().set({ heroOpen: false });
      setValue('');
    }
  }

  return (
    <form className={`repo-input repo-input--${size}`} onSubmit={submit} role="search">
      <label htmlFor={id ?? `repo-${size}`} className="visually-hidden">
        GitHub repository
      </label>
      <input
        id={id ?? `repo-${size}`}
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={
          placeholder ??
          (size === 'hero' ? 'Paste a GitHub repo, or @username' : 'owner/repo, URL or @user')
        }
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn btn--accent" disabled={loading || !value.trim()}>
        {cta ?? (size === 'hero' ? 'Launch' : 'Go')}
      </button>
    </form>
  );
}
