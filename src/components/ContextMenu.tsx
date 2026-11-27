import React, { useRef } from 'react';
import { Ban, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { dropdownDanger, dropdownItem, dropdownLabel, dropdownPanel } from './editor/editorStyles';
import { ShortcutKbd } from './ui/kbd';
import type { ShortcutKeys } from '../editor/shortcuts/types';
import { formatShortcut } from '../editor/shortcuts/format';

export type ContextMenuAction = {
  type?: 'action';
  label: string;
  onClick?: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  color?: string;
  preventClose?: boolean;
  /** Keyboard shortcut shown on the right as Kbd keys. */
  shortcut?: ShortcutKeys;
  disabled?: boolean;
};

export type ContextMenuOption =
  | ContextMenuAction
  | { type: 'divider' }
  /** Small heading for the group below it. */
  | { type: 'label'; label: string }
  /** Swatches in a row; `onClear` adds a "no colour" swatch. */
  | { type: 'color-grid'; color?: string; colors: string[]; onColorSelect: (color: string) => void; onClear?: () => void; preventClose?: boolean }
  /** Icon-only quick actions in a row (labels become tooltips). */
  | { type: 'icon-row'; items: { icon: React.ReactNode; onClick: () => void; label: string; active?: boolean; preventClose?: boolean; shortcut?: ShortcutKeys }[] }
  | { type: 'submenu'; label: string; icon?: React.ReactNode; submenu: ContextMenuAction[] };

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

const itemClass = `gap-2 rounded-md ${dropdownItem}`;
const swatchClass = 'h-5 w-5 shrink-0 cursor-pointer rounded-full border border-white/10 p-0 outline-none transition-transform hover:scale-110 focus:scale-110 focus-visible:ring-2 focus-visible:ring-nt-focus data-[current=true]:ring-2 data-[current=true]:ring-nt-ink data-[current=true]:ring-offset-2 data-[current=true]:ring-offset-nt-surface';

const keepOpen = (preventClose: boolean | undefined) => (event: Event) => {
  if (preventClose) event.preventDefault();
};

function ColorRow({ option }: { option: Extract<ContextMenuOption, { type: 'color-grid' }> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const current = option.color?.toLowerCase();
  return (
    <div className="grid grid-cols-6 justify-items-center gap-y-1.5 px-2 py-1.5" role="group" aria-label="Colour">
      {option.onClear && (
        <DropdownMenuItem
          aria-label="No colour"
          title="No colour"
          data-current={!current}
          className={`${swatchClass} flex items-center justify-center bg-nt-raised text-nt-ink-3`}
          onSelect={(event) => { keepOpen(option.preventClose)(event); option.onClear!(); }}
        >
          <Ban size={11} />
        </DropdownMenuItem>
      )}
      {option.colors.map((color) => (
        <DropdownMenuItem
          key={color}
          aria-label={`Colour ${color}`}
          title={color}
          data-current={current === color.toLowerCase()}
          className={swatchClass}
          style={{ backgroundColor: color }}
          onSelect={(event) => { keepOpen(option.preventClose)(event); option.onColorSelect(color); }}
        />
      ))}
      <DropdownMenuItem
        aria-label="Custom colour"
        title="Custom colour"
        className={`${swatchClass} flex items-center justify-center bg-nt-raised text-nt-ink-3`}
        onSelect={(event) => { event.preventDefault(); inputRef.current?.click(); }}
      >
        <Palette size={11} />
      </DropdownMenuItem>
      <input
        ref={inputRef}
        type="color"
        aria-label="Custom colour"
        defaultValue={option.color || '#ffffff'}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => option.onColorSelect(event.target.value)}
      />
    </div>
  );
}

const ActionItem = ({ action }: { action: ContextMenuAction }) => (
  <DropdownMenuItem
    disabled={action.disabled}
    className={`${itemClass} ${action.danger ? dropdownDanger : ''}`}
    onSelect={(event) => { keepOpen(action.preventClose)(event); action.onClick?.(); }}
  >
    {action.icon}
    {action.color && <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: action.color }} />}
    <span className="min-w-0 flex-1 truncate">{action.label}</span>
    {action.shortcut && <ShortcutKbd keys={action.shortcut} className="ml-auto" />}
  </DropdownMenuItem>
);

// Right-click menu for the canvas: the same dropdown look as the dock's menus.
const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => (
  <DropdownMenu open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DropdownMenuTrigger asChild>
      <button aria-hidden tabIndex={-1} className="pointer-events-none fixed h-px w-px opacity-0" style={{ left: x, top: y }} />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="start"
      side="bottom"
      sideOffset={0}
      collisionPadding={8}
      className={`z-50 w-60 rounded-lg ${dropdownPanel}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      {options.map((option, index) => {
        switch (option.type) {
          case 'divider':
            return <DropdownMenuSeparator key={index} className="bg-nt-line" />;
          case 'label':
            return <DropdownMenuLabel key={index} className={`truncate ${dropdownLabel}`}>{option.label}</DropdownMenuLabel>;
          case 'color-grid':
            return <ColorRow key={index} option={option} />;
          case 'icon-row':
            return (
              <div key={index} className="flex items-center gap-0.5 px-1 py-0.5">
                {option.items.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    aria-label={item.label}
                    title={item.shortcut ? `${item.label} (${formatShortcut(item.shortcut)})` : item.label}
                    className={`h-8 flex-1 justify-center rounded-md p-0 ${dropdownItem} ${item.active ? 'bg-nt-raised text-nt-ink' : ''}`}
                    onSelect={(event) => { keepOpen(item.preventClose)(event); item.onClick(); }}
                  >
                    {item.icon}
                  </DropdownMenuItem>
                ))}
              </div>
            );
          case 'submenu':
            return (
              <DropdownMenuSub key={index}>
                <DropdownMenuSubTrigger className={`${itemClass} data-[state=open]:bg-nt-raised data-[state=open]:text-nt-ink`}>
                  {option.icon}
                  <span className="flex-1">{option.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className={`w-64 rounded-lg ${dropdownPanel}`}>
                  {option.submenu.map((action, actionIndex) => <ActionItem key={actionIndex} action={action} />)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          default:
            return <ActionItem key={index} action={option} />;
        }
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default ContextMenu;
