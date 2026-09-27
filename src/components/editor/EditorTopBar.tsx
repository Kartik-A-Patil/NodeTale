import { memo } from 'react';
import {
  ArrowLeft, ChevronDown, Plus, Settings2, Variable, Image as ImageIcon, TriangleAlert, MoreHorizontal,
  Download, Command, HelpCircle, Play, Copy, X, LayoutList,
} from 'lucide-react';
import { Board } from '../../models/story';
import { VIEW_MODES, ViewMode } from '../views/viewModes';
import { formatRelativeTime } from '../../utils/localPrefs';
import { island, toolButton, toolButtonActive } from './editorStyles';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export type PanelId = 'boards' | 'variables' | 'assets' | 'problems';

interface EditorTopBarProps {
  projectName: string;
  boards: Board[];
  activeBoardId: string;
  lastSaved: Date | null;
  viewMode: ViewMode;
  panel: PanelId | null;
  problemCount: number;
  canPlay: boolean;
  jumpClipboard: { id: string; label: string } | null;
  onBack: () => void;
  onSwitchBoard: (id: string) => void;
  onAddBoard: () => void;
  onViewMode: (mode: ViewMode) => void;
  onPanel: (panel: PanelId | null) => void;
  onExport: () => void;
  onPalette: () => void;
  onHelp: () => void;
  onSave: () => void;
  onPlay: () => void;
  onClearJump: () => void;
}

const divider = <span aria-hidden className="mx-0.5 h-5 w-px bg-nt-line" />;

// Everything above the canvas: one floating pill top-left (story, board, view,
// panels, more) and Play top-right. Board editing tools live in the dock.
export const EditorTopBar = memo((props: EditorTopBarProps) => {
  const { projectName, boards, activeBoardId, lastSaved, viewMode, panel, problemCount, canPlay, jumpClipboard } = props;
  const board = boards.find((b) => b.id === activeBoardId) ?? boards[0];
  const view = VIEW_MODES.find((v) => v.id === viewMode)!;

  const panelButton = (id: PanelId, label: string, Icon: typeof Variable, badge?: number) => (
    <button type="button" onClick={() => props.onPanel(panel === id ? null : id)} aria-pressed={panel === id}
      title={label} aria-label={badge ? `${label} (${badge})` : label} className={`${toolButton} relative ${panel === id ? toolButtonActive : ''}`}>
      <Icon size={16} />
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-nt-danger px-1 text-[10px] font-semibold text-nt-bg">{badge > 99 ? '99+' : badge}</span>
      ) : null}
    </button>
  );

  return (
    <>
      <div className={`absolute left-3 top-3 z-30 flex max-w-[calc(100vw-9rem)] items-center gap-0.5 p-1 ${island}`}>
        <button type="button" onClick={props.onBack} className={toolButton} title="All stories" aria-label="Back to all stories">
          <ArrowLeft size={16} />
        </button>
        <button type="button" onClick={props.onSave} title={lastSaved ? `Saved ${lastSaved.toLocaleTimeString()} · Ctrl+S to save now` : 'Ctrl+S to save'}
          className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-nt-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-nt-focus">
          <span className="max-w-44 truncate text-sm font-semibold text-nt-ink">{projectName}</span>
          <span className="hidden whitespace-nowrap text-xs text-nt-ink-3 md:inline">{lastSaved ? `Saved ${formatRelativeTime(lastSaved.getTime())}` : 'Not saved yet'}</span>
        </button>
        {divider}

        {/* Board switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-haspopup="menu" className={`${toolButton} max-w-40 px-2 text-sm`}>
              <LayoutList size={15} aria-hidden /><span className="truncate">{board?.name}</span><ChevronDown size={14} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52 border-nt-line bg-nt-surface text-nt-ink shadow-2xl shadow-black/50">
            <DropdownMenuRadioGroup value={activeBoardId} onValueChange={props.onSwitchBoard}>
              {boards.map((b) => (
                <DropdownMenuRadioItem key={b.id} value={b.id} className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink">
                  <span className="truncate">{b.name}</span>
                  <span className="ml-auto pl-4 text-xs text-nt-ink-3">{b.nodes.length}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator className="bg-nt-line" />
            <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={props.onAddBoard}>
                <Plus size={14} /> New board
            </DropdownMenuItem>
            <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={() => props.onPanel('boards')}>
                <Settings2 size={14} /> Rename or delete boards…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-haspopup="menu" aria-label={`View: ${view.label}`} className={`${toolButton} px-2 text-sm`}>
              <view.icon size={15} aria-hidden /><span className="hidden sm:inline">{view.label}</span><ChevronDown size={14} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 border-nt-line bg-nt-surface text-nt-ink shadow-2xl shadow-black/50">
            <DropdownMenuRadioGroup value={viewMode} onValueChange={(id) => props.onViewMode(id as ViewMode)}>
              {VIEW_MODES.map((v, i) => (
                <DropdownMenuRadioItem key={v.id} value={v.id} className="items-start py-2 text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink">
                  <v.icon size={15} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${v.id === viewMode ? 'font-semibold text-nt-ink' : ''}`}>{v.label}</span>
                    <span className="block text-xs text-nt-ink-3">{v.description}</span>
                  </span>
                  <DropdownMenuShortcut>Alt {i + 1}</DropdownMenuShortcut>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {divider}

        {panelButton('variables', 'Variables', Variable)}
        {panelButton('assets', 'Assets', ImageIcon)}
        {panelButton('problems', 'Problems', TriangleAlert, problemCount)}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-haspopup="menu" aria-label="More" title="More" className={toolButton}>
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border-nt-line bg-nt-surface text-nt-ink shadow-2xl shadow-black/50">
              <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={props.onExport}>
                <Download size={14} /> Export…
              </DropdownMenuItem>
              <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={props.onPalette}>
                <Command size={14} /> All commands <DropdownMenuShortcut>Ctrl K</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={props.onHelp}>
                <HelpCircle size={14} /> Help & shortcuts
              </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
        {jumpClipboard && (
          <div className={`flex items-center gap-2 py-1.5 pl-3 pr-1.5 text-xs text-nt-ink-2 ${island}`}>
            <Copy size={13} aria-hidden />
            <span className="max-w-40 truncate">Jump target: {jumpClipboard.label}</span>
            <button type="button" onClick={props.onClearJump} className={`${toolButton} h-6 min-w-6`} aria-label="Clear jump target"><X size={13} /></button>
          </div>
        )}
        {viewMode === 'flow' && (
          <button type="button" onClick={props.onPlay} disabled={!canPlay}
            title={canPlay ? 'Play the story from Start' : 'Name a scene “Start” to play'}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-nt-accent px-4 text-sm font-semibold text-nt-accent-ink shadow-lg shadow-black/40 transition-[filter] duration-150 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nt-focus disabled:cursor-not-allowed disabled:opacity-50">
            <Play size={15} fill="currentColor" aria-hidden /> Play
          </button>
        )}
      </div>
    </>
  );
});
