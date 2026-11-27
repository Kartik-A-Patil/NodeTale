import { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ChoiceRules } from '../../utils/edgeLabel';

interface ChoiceRulesPopoverProps {
  rules: ChoiceRules;
  onChange: (patch: Partial<ChoiceRules>) => void;
  children: ReactNode;
}

const field = 'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 outline-none focus-visible:border-orange-500';

// When a choice can be taken (condition) and what taking it does (effect).
export function ChoiceRulesPopover({ rules, onChange, children }: ChoiceRulesPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="nodrag nopan w-72 space-y-3 border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <label className="block space-y-1">
          <span className="font-medium text-zinc-200">Only when</span>
          <input
            className={field}
            value={rules.condition ?? ''}
            onChange={(e) => onChange({ condition: e.target.value })}
            placeholder="gold >= 50"
          />
        </label>
        {rules.condition?.trim() && (
          <>
            <label className="block space-y-1">
              <span className="text-zinc-400">Message when locked</span>
              <input
                className={field}
                value={rules.lockedText ?? ''}
                onChange={(e) => onChange({ lockedText: e.target.value })}
                placeholder={`Needs ${rules.condition.trim()}`}
              />
            </label>
            <label className="flex items-center gap-2 text-zinc-400">
              <input
                type="checkbox"
                checked={!!rules.hideWhenLocked}
                onChange={(e) => onChange({ hideWhenLocked: e.target.checked })}
              />
              Hide it instead of showing it locked
            </label>
          </>
        )}
        <label className="block space-y-1">
          <span className="font-medium text-zinc-200">When chosen, run</span>
          <textarea
            className={`${field} min-h-[56px] resize-y`}
            value={rules.effect ?? ''}
            onChange={(e) => onChange({ effect: e.target.value })}
            placeholder={'gold -= 10\ntrust += 1'}
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}
