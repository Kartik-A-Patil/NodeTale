import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Project } from '../../types';
import { Diagnostic } from '../../core/validation/types';
import { BoardsList } from '../sidebar/BoardsList';
import { VariablesList } from '../sidebar/VariablesList';
import { AssetsList } from '../sidebar/AssetsList';
import { ProblemsList } from '../sidebar/ProblemsList';
import { island, toolButton } from './usePopover';
import { PanelId } from './EditorTopBar';

interface SidePanelProps {
  panel: PanelId;
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  diagnostics: Diagnostic[];
  onClose: () => void;
}

const TITLES: Record<PanelId, string> = { boards: 'Boards', variables: 'Variables', assets: 'Assets', problems: 'Problems' };

// One floating panel over the canvas's left side for the story's lists.
// Escape closes it (unless focus is in one of its fields).
export function SidePanel({ panel, project, setProject, diagnostics, onClose }: SidePanelProps) {
  // Registered once, reading the latest onClose from a ref. Re-registering on
  // every render (onClose is a new function each time) lost Escape presses: the
  // shortcut handler's state update committed between document listeners, and
  // a listener removed/added mid-dispatch is never called for that event.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Escape' && !t.closest('input, textarea, select, [contenteditable=true], [role=dialog], dialog')) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside aria-label={TITLES[panel]}
      className={`absolute bottom-3 left-3 top-[4.25rem] z-20 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden ${island}`}>
      <header className="flex items-center justify-between border-b border-nt-line py-1.5 pl-4 pr-1.5">
        <h2 className="text-sm font-semibold text-nt-ink">
          {TITLES[panel]}
          {panel === 'problems' && diagnostics.length > 0 && <span className="ml-2 font-normal text-nt-ink-3">{diagnostics.length}</span>}
        </h2>
        <button type="button" onClick={onClose} className={toolButton} aria-label={`Close ${TITLES[panel]}`}><X size={16} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {panel === 'boards' && <BoardsList project={project} setProject={setProject} />}
        {panel === 'variables' && <VariablesList project={project} setProject={setProject} />}
        {panel === 'assets' && <AssetsList project={project} setProject={setProject} />}
        {panel === 'problems' && <ProblemsList diagnostics={diagnostics} />}
      </div>
    </aside>
  );
}
