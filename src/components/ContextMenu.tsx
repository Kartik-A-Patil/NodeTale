import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Palette, ChevronRight } from 'lucide-react';

export interface ContextMenuOption {
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  type?: 'action' | 'color-picker' | 'divider' | 'color-grid' | 'icon-row' | 'submenu';
  icon?: React.ReactNode;
  color?: string; // For preset indicators or initial value
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  colors?: string[];
  onColorSelect?: (color: string) => void;
  items?: { icon: React.ReactNode; onClick: () => void; label: string; active?: boolean; preventClose?: boolean }[];
  submenu?: ContextMenuOption[];
  preventClose?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoveredSubmenuIndex, setHoveredSubmenuIndex] = useState<number | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleWheel = () => {
      onClose();
    };

    // Use capture phase for click to ensure we catch all clicks
    document.addEventListener('mousedown', handleClickOutside, true);
    // Listen to scroll on document and window
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('scroll', handleScroll, true);
    // Also listen to wheel events for scroll
    document.addEventListener('wheel', handleWheel, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('wheel', handleWheel, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-[#1e1e20] border border-[#27272a] rounded-lg shadow-2xl py-1.5 min-w-[200px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ease-out"
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {options.map((opt, i) => {
        if (opt.type === 'divider') {
            return <div key={i} className="h-[1px] bg-[#27272a] my-1 mx-2" />;
        }

        if (opt.type === 'color-grid') {
            return (
                <div key={i} className="grid grid-cols-6 gap-1 px-2 py-2">
                    {opt.colors?.map((c, idx) => (
                        <button
                            key={idx}
                            className="w-5 h-5 rounded-sm hover:scale-110 transition-transform border border-white/10"
                            style={{ backgroundColor: c }}
                            onClick={() => {
                                opt.onColorSelect?.(c);
                                if (!opt.preventClose) onClose();
                            }}
                            title={c}
                        />
                    ))}
                    <label
                        className="relative w-5 h-5 rounded-sm border border-white/10 bg-[#27272a] hover:scale-110 transition-transform cursor-pointer flex items-center justify-center"
                        title="Custom color"
                    >
                        <Palette size={12} className="text-zinc-300" />
                        <input
                            type="color"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            defaultValue={opt.color || '#ffffff'}
                            onBlur={(e) => {
                                opt.onColorSelect?.(e.target.value);
                            }}
                            style={{ colorScheme: 'dark' }}
                        />
                    </label>
                </div>
            );
        }

        if (opt.type === 'icon-row') {
            return (
                <div key={i} className="flex items-center justify-around px-2 py-2">
                    {opt.items?.map((item, idx) => (
                        <button
                            key={idx}
                            className={`p-1.5 rounded hover:bg-[#27272a] text-zinc-400 hover:text-zinc-100 transition-colors ${item.active ? 'bg-[#27272a] text-zinc-100' : ''}`}
                            onClick={() => {
                                item.onClick();
                                if (!item.preventClose) onClose();
                            }}
                            title={item.label}
                        >
                            {item.icon}
                        </button>
                    ))}
                </div>
            );
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
                            onBlur={(e) => {
                                opt.onChange?.(e);
                                if (!opt.preventClose) onClose();
                            }}
                        />
                    </div>
                </label>
             );
        }

        if (opt.type === 'submenu') {
            return (
                <div
                    key={i}
                    className="relative"
                    onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredSubmenuIndex(i);
                        setSubmenuPosition({
                            top: rect.top,
                            left: rect.right
                        });
                    }}
                    onMouseLeave={() => {
                        setHoveredSubmenuIndex(null);
                        setSubmenuPosition(null);
                    }}
                >
                    <button
                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#27272a] transition-colors flex items-center justify-between group text-zinc-300 hover:text-white"
                    >
                        <div className="flex items-center gap-2">
                            {opt.icon && <span className="text-zinc-500 group-hover:text-zinc-300">{opt.icon}</span>}
                            <span>{opt.label}</span>
                        </div>
                        <ChevronRight size={14} className="text-zinc-500" />
                    </button>
                    {hoveredSubmenuIndex === i && submenuPosition && opt.submenu && (
                        <div
                            className="fixed z-[60] bg-[#1e1e20] border border-[#27272a] rounded-lg shadow-2xl py-1.5 min-w-[180px] animate-in fade-in slide-in-from-left-1 duration-100"
                            style={{
                                top: submenuPosition.top,
                                left: submenuPosition.left + 4
                            }}
                        >
                            {opt.submenu.map((subOpt, subIdx) => (
                                <button
                                    key={subIdx}
                                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-[#27272a] transition-colors flex items-center gap-2 ${
                                        subOpt.danger ? 'text-red-400 hover:text-red-300 hover:bg-red-900/10' : 'text-zinc-300 hover:text-white'
                                    }`}
                                    onClick={() => {
                                        if (subOpt.onClick) subOpt.onClick();
                                        if (!subOpt.preventClose) onClose();
                                    }}
                                >
                                    {subOpt.icon && <span className={subOpt.danger ? 'text-red-400' : 'text-zinc-500'}>{subOpt.icon}</span>}
                                    <span>{subOpt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
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
              if (!opt.preventClose) onClose();
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