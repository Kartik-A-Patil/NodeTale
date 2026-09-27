import { useRef } from 'react';
import { MoreHorizontal, FolderOpen, PenLine, Copy, ImagePlus, ImageOff, Download, Trash2 } from 'lucide-react';
import { buttonGhostIcon } from '../ui/styles';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '../ui/dropdown-menu';

export interface ProjectActions {
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onChangeCover: (file: File) => void;
  onRemoveCover?: () => void;
  onDelete: () => void;
}

export function ProjectActionsMenu({ name, actions }: { name: string; actions: ProjectActions }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={buttonGhostIcon} aria-label={`Actions for ${name}`} aria-haspopup="menu">
            <MoreHorizontal size={17} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border-nt-line bg-nt-surface text-nt-ink shadow-2xl">
          <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={actions.onOpen}><FolderOpen size={15} aria-hidden /> Open</DropdownMenuItem>
          <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={actions.onRename}><PenLine size={15} aria-hidden /> Rename <DropdownMenuShortcut>F2</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={actions.onDuplicate}><Copy size={15} aria-hidden /> Duplicate</DropdownMenuItem>
          <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={actions.onExport}><Download size={15} aria-hidden /> Export as .json</DropdownMenuItem>
          <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={() => fileRef.current?.click()}><ImagePlus size={15} aria-hidden /> Change cover…</DropdownMenuItem>
          {actions.onRemoveCover && (
            <DropdownMenuItem className="text-nt-ink-2 focus:bg-nt-raised focus:text-nt-ink" onSelect={actions.onRemoveCover}><ImageOff size={15} aria-hidden /> Remove cover</DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-nt-line" />
          <DropdownMenuItem className="text-nt-danger focus:bg-red-900/20 focus:text-nt-danger" onSelect={actions.onDelete}>
            <Trash2 size={15} aria-hidden /> Delete <DropdownMenuShortcut>Del</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) actions.onChangeCover(file);
        }} />
    </div>
  );
}
