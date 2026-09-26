import { memo } from 'react';
import { VIEW_MODES, ViewMode } from './viewModes';

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

// Segmented control (radio group semantics). Labels show on wide screens;
// narrower toolbars fall back to icons with the label as the accessible name.
export const ViewSwitcher = memo(({ value, onChange }: ViewSwitcherProps) => (
  <div role="radiogroup" aria-label="View" className="flex rounded-lg border border-nt-line bg-nt-bg p-0.5">
    {VIEW_MODES.map(({ id, label, description, icon: Icon }, i) => {
      const active = id === value;
      return (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={label}
          title={`${label}: ${description} (Alt+${i + 1})`}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus ${
            active ? 'bg-nt-raised text-nt-ink' : 'text-nt-ink-3 hover:text-nt-ink-2'
          }`}
        >
          <Icon size={15} aria-hidden />
          <span className="hidden xl:inline">{label}</span>
        </button>
      );
    })}
  </div>
));
