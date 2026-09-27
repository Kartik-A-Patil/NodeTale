import React, { useRef } from 'react';
import { Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type ContextMenuAction = {
  type?: 'action';
  label: string;
  onClick?: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  color?: string;
  preventClose?: boolean;
};

export type ContextMenuOption =
  | ContextMenuAction
  | { type: 'divider' }
  | { type: 'color-grid'; color?: string; colors: string[]; onColorSelect: (color: string) => void; preventClose?: boolean }
  | { type: 'icon-row'; items: { icon: React.ReactNode; onClick: () => void; label: string; active?: boolean; preventClose?: boolean }[] }
  | { type: 'submenu'; label: string; icon?: React.ReactNode; submenu: ContextMenuAction[] };

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

const itemClass = 'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs text-nt-ink-2 outline-none focus:bg-nt-raised focus:text-nt-ink data-[disabled]:opacity-40';
const colorClass = 'h-5 w-5 rounded-sm border border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-nt-focus';

const ColorGridSubmenu = ({ option }: { option: Extract<ContextMenuOption, { type: 'color-grid' }> }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-xs text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink">
        <Palette size={14} /> Color
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-0 rounded-lg border border-nt-line bg-nt-surface p-2 shadow-2xl">
        <div className="grid grid-cols-6 gap-1" aria-label="Choose color">
          {option.colors.map((color) => (
            <DropdownMenuItem
              key={color}
              aria-label={`Set color ${color}`}
              title={color}
              className={`${colorClass} p-0`}
              style={{ backgroundColor: color }}
              onSelect={(event) => {
                if (option.preventClose) event.preventDefault();
                option.onColorSelect(color);
              }}
            />
          ))}
          <DropdownMenuItem
            aria-label="Choose custom color"
            title="Custom color"
            className={`${colorClass} relative flex items-center justify-center overflow-hidden bg-nt-raised p-0`}
            onSelect={(event) => {
              event.preventDefault();
              inputRef.current?.click();
            }}
          >
            <Palette size={12} />
          </DropdownMenuItem>
        </div>
        <input
          ref={inputRef}
          type="color"
          aria-label="Custom color"
          defaultValue={option.color || '#ffffff'}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => option.onColorSelect(event.target.value)}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

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
      className="z-50 min-w-[200px] rounded-lg border border-nt-line bg-nt-surface py-1.5 text-nt-ink shadow-2xl shadow-black/50"
      onContextMenu={(event) => event.preventDefault()}
    >
      {options.map((option, index) => {
        if (option.type === 'divider') return <DropdownMenuSeparator key={index} className="my-1 bg-nt-line" />;

        if (option.type === 'color-grid') {
          return <ColorGridSubmenu key={index} option={option} />;
        }

        if (option.type === 'icon-row') {
          return (
            <div key={index} className="flex items-center justify-around px-2 py-2">
              {option.items.map((item, itemIndex) => (
                <DropdownMenuItem
                  key={itemIndex}
                  aria-label={item.label}
                  title={item.label}
                  className={`h-8 min-w-8 justify-center p-1.5 ${item.active ? 'bg-nt-raised text-nt-ink' : ''}`}
                  onSelect={(event) => {
                    if (item.preventClose) event.preventDefault();
                    item.onClick();
                  }}
                >
                  {item.icon}
                </DropdownMenuItem>
              ))}
            </div>
          );
        }

        if (option.type === 'submenu') {
          return (
            <DropdownMenuSub key={index}>
              <DropdownMenuSubTrigger className={itemClass}>
                {option.icon}
                <span className="flex-1">{option.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[180px] rounded-lg border border-nt-line bg-nt-surface py-1.5 text-nt-ink shadow-2xl shadow-black/50">
                {option.submenu.map((action, actionIndex) => (
                  <DropdownMenuItem
                    key={actionIndex}
                    className={`${itemClass} ${action.danger ? 'text-red-400 focus:bg-red-900/20 focus:text-red-300' : ''}`}
                    onSelect={(event) => {
                      if (action.preventClose) event.preventDefault();
                      action.onClick?.();
                    }}
                  >
                    {action.icon}<span>{action.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }

        return (
          <DropdownMenuItem
            key={index}
            className={`${itemClass} justify-between ${option.danger ? 'text-red-400 focus:bg-red-900/20 focus:text-red-300' : ''}`}
            onSelect={(event) => {
              if (option.preventClose) event.preventDefault();
              option.onClick?.();
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              {option.icon}
              {option.color && <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: option.color }} />}
              <span>{option.label}</span>
            </span>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);

export default ContextMenu;
