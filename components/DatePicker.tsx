import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  X, 
  Check,
  ChevronLeft, 
  ChevronRight,
  History,
  Link as LinkIcon,
  ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import { useReactFlow, Node } from 'reactflow';
import { NodeData } from '../types';

interface DatePickerProps {
  date: string | null;
  onChange: (date: string | null) => void;
  nodeId?: string;
}

export const DatePicker = ({ date, onChange, nodeId }: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(new Date()); // For calendar navigation
  const timeInputRef = useRef<HTMLInputElement>(null);
  
  const { getNodes, getEdges } = useReactFlow();

  // Formatters
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Smart Initialization
  useEffect(() => {
    if (isOpen) {
      if (date) {
        const d = new Date(date);
        setDraftDate(d);
        setViewDate(d);
      } else {
        // Find smart default
        const nodes = getNodes();
        const edges = getEdges();
        
        // 1. Look for connected nodes
        const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
        const connectedNodeIds = new Set(connectedEdges.map(e => e.source === nodeId ? e.target : e.source));
        
        let bestDate: Date | null = null;
        let maxTime = 0;

        connectedNodeIds.forEach(id => {
          const node = nodes.find(n => n.id === id);
          if (node?.data?.date) {
            const t = new Date(node.data.date).getTime();
            if (t > maxTime) {
              maxTime = t;
              bestDate = new Date(node.data.date);
            }
          }
        });

        // 2. If no connected dates, look for any recent date in the project
        if (!bestDate) {
           // Find the node with the latest date
           nodes.forEach(node => {
             if (node.data?.date) {
               const t = new Date(node.data.date).getTime();
               if (t > maxTime) {
                 maxTime = t;
                 bestDate = new Date(node.data.date);
               }
             }
           });
        }

        // 3. Initialize
        if (bestDate) {
          // Add 1 hour as "logical continuation"
          const nextStep = new Date(bestDate);
          nextStep.setHours(nextStep.getHours() + 1);
          setDraftDate(nextStep);
          setViewDate(nextStep);
        } else {
          // Default to now if absolutely nothing exists
          const now = new Date();
          now.setHours(9, 0, 0, 0); // Morning start
          setDraftDate(now);
          setViewDate(now);
        }
      }
    }
  }, [isOpen, date, nodeId, getNodes, getEdges]);

  // Connected Nodes Context
  const contextNodes = useMemo(() => {
    if (!isOpen || !nodeId) return [];
    const nodes = getNodes();
    const edges = getEdges();
    
    const connected = edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId = e.source === nodeId ? e.target : e.source;
        return nodes.find(n => n.id === otherId);
      })
      .filter((n): n is Node<NodeData> => !!n && !!n.data?.date)
      .map(n => ({
        id: n.id,
        label: n.data.label || 'Untitled',
        date: new Date(n.data.date!),
        relation: edges.find(e => e.source === nodeId && e.target === n.id) ? 'Next' : 'Prev'
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
      
    return connected;
  }, [isOpen, nodeId, getNodes, getEdges]);

  const handleSave = () => {
    if (draftDate) {
      onChange(draftDate.toISOString());
    } else {
      onChange(null);
    }
    setIsOpen(false);
  };

  const updateDraft = (newDate: Date) => {
    setDraftDate(newDate);
    setViewDate(newDate);
  };

  const adjustTime = (amount: number, unit: 'minutes' | 'hours' | 'days' | 'years') => {
    if (!draftDate) return;
    const d = new Date(draftDate);
    if (unit === 'minutes') d.setMinutes(d.getMinutes() + amount);
    if (unit === 'hours') d.setHours(d.getHours() + amount);
    if (unit === 'days') d.setDate(d.getDate() + amount);
    if (unit === 'years') d.setFullYear(d.getFullYear() + amount);
    updateDraft(d);
  };

  // Calendar Logic
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  
  const renderCalendarDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
      const isSelected = draftDate && 
        current.getDate() === draftDate.getDate() && 
        current.getMonth() === draftDate.getMonth() && 
        current.getFullYear() === draftDate.getFullYear();
      
      days.push(
        <button
          key={d}
          onClick={() => {
            const newDate = new Date(current);
            if (draftDate) {
              newDate.setHours(draftDate.getHours(), draftDate.getMinutes());
            } else {
              newDate.setHours(9, 0);
            }
            updateDraft(newDate);
          }}
          className={clsx(
            "h-8 w-8 rounded-md text-xs font-medium transition-all",
            isSelected 
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
            !isSelected && 
            new Date().toDateString() === current.toDateString() && 
            "border border-orange-500/30 text-orange-400"
          )}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  return (
    <>
      {/* Trigger */}
      <div className="relative group ml-2">
        <button
          onClick={() => setIsOpen(true)}
          className={clsx(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all border text-xs font-medium",
            date 
              ? "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20" 
              : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
          )}
        >
          <CalendarIcon size={14} />
        </button>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-black text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {date ? `${formatDate(new Date(date))} ${formatTime(new Date(date))}` : "Set Date"}
        </div>
      </div>

      {/* Modal */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl w-full max-w-xl flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Sidebar: Context & Quick Actions */}
            <div className="w-full md:w-48 bg-zinc-900/30 border-b md:border-b-0 md:border-r border-zinc-800 p-3 flex flex-col gap-4">
              
              {/* Connected Nodes */}
              <div className="flex-1 overflow-y-auto max-h-[200px] md:max-h-none">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <LinkIcon size={12} /> Context
                </h3>
                {contextNodes.length > 0 ? (
                  <div className="space-y-1.5">
                    {contextNodes.map(node => (
                      <button
                        key={node.id}
                        onClick={() => updateDraft(new Date(node.date))}
                        className="w-full text-left p-2 rounded-md bg-zinc-800/50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-medium text-zinc-500 group-hover:text-zinc-400 truncate max-w-[100px]">
                            {node.label}
                          </span>
                          <span className={clsx("text-[8px] px-1 py-0.5 rounded-full", node.relation === 'Next' ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400")}>
                            {node.relation}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-300 font-mono">
                          {formatDate(node.date)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-600 italic px-1">No events</div>
                )}
              </div>

              {/* Quick Adjustments */}
              <div className="mt-auto pt-3 border-t border-zinc-800 md:border-t-0 md:pt-0">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <History size={12} /> Adjust
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => adjustTime(-1, 'hours')} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 hover:text-zinc-200">-1h</button>
                  <button onClick={() => adjustTime(1, 'hours')} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 hover:text-zinc-200">+1h</button>
                  <button onClick={() => adjustTime(-1, 'days')} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 hover:text-zinc-200">-1d</button>
                  <button onClick={() => adjustTime(1, 'days')} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 hover:text-zinc-200">+1d</button>
                </div>
              </div>
            </div>

            {/* Main Picker */}
            <div className="flex-1 p-4 flex flex-col">
              
              {/* Header: Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {/* Month Dropdown */}
                  <div className="relative">
                    <select
                      value={viewDate.getMonth()}
                      onChange={(e) => setViewDate(new Date(viewDate.setMonth(parseInt(e.target.value))))}
                      className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium rounded-md pl-2.5 pr-6 py-1.5 focus:outline-none focus:border-orange-500/50 hover:border-zinc-700 transition-colors cursor-pointer min-w-[4.5rem]"
                    >
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                        <option key={i} value={i}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>

                  {/* Year Dropdown */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setViewDate(new Date(viewDate.setFullYear(viewDate.getFullYear() - 1)))}
                      className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Previous Year"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <div className="relative">
                      <select
                        value={viewDate.getFullYear()}
                        onChange={(e) => setViewDate(new Date(viewDate.setFullYear(parseInt(e.target.value))))}
                        className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium rounded-md pl-2.5 pr-6 py-1.5 focus:outline-none focus:border-orange-500/50 hover:border-zinc-700 transition-colors cursor-pointer"
                      >
                        {Array.from({ length: 300 }, (_, i) => viewDate.getFullYear() - 200 + i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    </div>
                    <button 
                      onClick={() => setViewDate(new Date(viewDate.setFullYear(viewDate.getFullYear() + 1)))}
                      className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Next Year"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Time Picker */}
                <div 
                  className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 hover:border-zinc-700 transition-colors cursor-pointer"
                  onClick={() => timeInputRef.current?.showPicker()}
                >
                   <input 
                     ref={timeInputRef}
                     type="time"
                     value={draftDate ? formatTime(draftDate) : "09:00"}
                     onChange={(e) => {
                       const [h, m] = e.target.value.split(':').map(Number);
                       const newDate = new Date(draftDate || viewDate);
                       newDate.setHours(h, m);
                       updateDraft(newDate);
                     }}
                     className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none w-[4.5rem] p-0 cursor-pointer"
                     style={{ colorScheme: 'dark' }}
                   />
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="flex-1 min-h-[280px]">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-zinc-600 uppercase">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {renderCalendarDays()}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-800">
                <button 
                  onClick={() => { onChange(null); setIsOpen(false); }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-400/10 transition-colors"
                >
                  <X size={14} /> Clear Date
                </button>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all"
                  >
                    <Check size={14} /> Apply Date
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
