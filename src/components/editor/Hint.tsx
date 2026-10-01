import type { ReactElement, ReactNode } from 'react';
import type { ShortcutKeys } from '../../editor/shortcuts/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ShortcutKbd } from '../ui/kbd';

interface HintProps {
  label: ReactNode;
  keys?: ShortcutKeys;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
}

/** Tooltip for toolbar buttons: what it does, and its shortcut as Kbd keys. */
export function Hint({ label, keys, side = 'top', children }: HintProps) {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={8} className="flex items-center gap-2 border border-nt-line bg-nt-raised px-2 py-1 text-xs text-nt-ink shadow-lg shadow-black/40">
          {label}
          {keys && <ShortcutKbd keys={keys} />}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
