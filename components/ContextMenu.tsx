import React, { useEffect, useRef } from 'react';
import { Trash2, Palette } from 'lucide-react';

export interface ContextMenuOption {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  type?: 'action' | 'color-picker' | 'divider';
  icon?: React.ReactNode;
  color?: string; // For preset indicators or initial value
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[#1e1e20] border border-[#27272a] rounded-lg shadow-2xl py-1.5 min-w-[200px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {options.map((opt, i) => {
        if (opt.type === 'divider') {
            return <div key={i} className="h-[1px] bg-[#27272a] my-1 mx-2" />;
        }

        if (opt.type === 'color-picker') {
             return (
                <label key={i} className="flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-[#27272a] hover:text-white cursor-pointer transition-colors group">
                    <div className="flex items-center gap-2">
                        <Palette size={14} className="text-zinc-500 group-hover:text-zinc-300"/>
                        <span>{opt.label}</span>
                    </div>
                    <div className="relative w-5 h-5 rounded-full overflow-hidden border border-zinc-600 group-hover:border-zinc-400">
                        <input 
                            type="color" 
                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                            value={opt.color || '#ffffff'}
                            onChange={(e) => {
                                opt.onChange?.(e);
                                onClose();
                            }}
                        />
                    </div>
                </label>
             );
        }

        return (
          <button
            key={i}
            className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#27272a] transition-colors flex items-center justify-between group ${
              opt.danger ? 'text-red-400 hover:text-red-300 hover:bg-red-900/10' : 'text-zinc-300 hover:text-white'
            }`}
            onClick={() => {
              if (opt.onClick) opt.onClick();
              onClose();
            }}
          >
            <div className="flex items-center gap-2">
                {opt.icon && <span className={opt.danger ? 'text-red-400' : 'text-zinc-500 group-hover:text-zinc-300'}>{opt.icon}</span>}
                {opt.color && (
                    <span 
                        className="w-3 h-3 rounded-full border border-white/10 shadow-sm" 
                        style={{ backgroundColor: opt.color }}
                    />
                )}
                <span>{opt.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ContextMenu;