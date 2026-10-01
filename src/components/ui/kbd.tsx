import * as React from "react"

import { cn } from "@/lib/utils"
import type { ShortcutKeys } from "@/editor/shortcuts/types"
import { shortcutParts } from "@/editor/shortcuts/format"

// shadcn/ui Kbd, on the nt tokens.
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded border border-nt-line bg-nt-bg px-1 font-sans text-[11px] font-medium leading-none text-nt-ink-3 shadow-[inset_0_-1px_0_oklch(var(--nt-line))]",
        "[&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="kbd-group" className={cn("inline-flex items-center gap-0.5", className)} {...props} />
}

/** A shortcut as one Kbd per key: Ctrl + Shift + Z. */
function ShortcutKbd({ keys, className }: { keys: ShortcutKeys; className?: string }) {
  return (
    <KbdGroup className={className}>
      {shortcutParts(keys).map((part) => <Kbd key={part}>{part}</Kbd>)}
    </KbdGroup>
  )
}

export { Kbd, KbdGroup, ShortcutKbd }
