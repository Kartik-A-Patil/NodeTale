import { useEffect, useRef, useState } from 'react';

interface EditableTitleProps {
  name: string;
  editing: boolean;
  /** Resolves with an error message, or null once renamed. */
  onSubmit: (name: string) => Promise<string | null>;
  onDone: () => void;
  className: string;
}

// Inline rename: Enter saves, Escape (or an unchanged/empty name) cancels.
export function EditableTitle({ name, editing, onSubmit, onDone, className }: EditableTitleProps) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    setValue(name);
    setError('');
    requestAnimationFrame(() => inputRef.current?.select());
  }, [editing, name]);

  if (!editing) return <span className={className} title={name}>{name}</span>;

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) return onDone();
    const problem = await onSubmit(trimmed);
    if (problem) setError(problem);
    else onDone();
  };

  return (
    <span className="block min-w-0">
      <input
        ref={inputRef}
        value={value}
        aria-label="Story name"
        aria-invalid={!!error}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); onDone(); }
        }}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        className={`${className} -mx-1 w-full rounded border border-nt-focus bg-nt-bg px-1 outline-none`}
      />
      {error && <span role="alert" className="mt-1 block text-xs text-nt-danger">{error}</span>}
    </span>
  );
}
