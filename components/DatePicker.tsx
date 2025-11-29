import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import clsx from 'clsx';

interface DatePickerProps {
  date: string | null;
  onChange: (date: string | null) => void;
}

export const DatePicker = ({ date, onChange }: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize current month from prop
  useEffect(() => {
    if (date) {
      setCurrentMonth(new Date(date));
    }
  }, [date]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Preserve time if exists
    if (date) {
      const oldDate = new Date(date);
      newDate.setHours(oldDate.getHours());
      newDate.setMinutes(oldDate.getMinutes());
    } else {
        // Default to 9:00 AM
        newDate.setHours(9, 0);
    }
    onChange(newDate.toISOString());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!date) return;
    const [hours, minutes] = e.target.value.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    onChange(newDate.toISOString());
  };

  const handleRemove = () => {
    onChange(null);
    setIsOpen(false);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const daysArray = [];

    for (let i = 0; i < firstDay; i++) {
      daysArray.push(<div key={`empty-${i}`} className="w-6 h-6" />);
    }

    for (let d = 1; d <= days; d++) {
      const currentDate = new Date(year, month, d);
      const isSelected = date && new Date(date).toDateString() === currentDate.toDateString();
      const isToday = new Date().toDateString() === currentDate.toDateString();

      daysArray.push(
        <button
          key={d}
          onClick={() => handleDateClick(d)}
          className={clsx(
            "w-6 h-6 text-[10px] rounded-full flex items-center justify-center transition-colors",
            isSelected ? "bg-blue-500 text-white" : "hover:bg-zinc-700 text-zinc-300",
            isToday && !isSelected && "text-blue-400 font-bold"
          )}
        >
          {d}
        </button>
      );
    }
    return daysArray;
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="group/date flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-zinc-700/50 transition-colors cursor-pointer"
      >
        <CalendarIcon 
            size={14} 
            className={`shrink-0 transition-colors ${date ? 'text-blue-400' : 'text-zinc-500 group-hover/date:text-zinc-300'}`} 
        />
        {date && (
            <span className="text-[10px] text-gray-400 font-mono font-medium pt-0.5">
                {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
            </span>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-[#18181b] border border-zinc-700 rounded-lg shadow-xl p-3 z-50 w-56 nodrag cursor-default" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="p-1 hover:bg-zinc-700 rounded text-zinc-400"><ChevronLeft size={14} /></button>
            <span className="text-xs font-medium text-zinc-200">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-zinc-700 rounded text-zinc-400"><ChevronRight size={14} /></button>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
              <div key={day} className="text-[10px] text-zinc-500 font-medium">{day}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {renderCalendar()}
          </div>

          {/* Time Picker */}
          {date && (
             <div className="flex items-center gap-2 mb-3 px-1 py-1 bg-zinc-800 rounded border border-zinc-700">
                <Clock size={12} className="text-zinc-500" />
                <input 
                    type="time" 
                    value={new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    onChange={handleTimeChange}
                    className="bg-transparent border-none text-xs text-zinc-300 focus:outline-none w-full font-mono"
                    style={{ colorScheme: 'dark' }}
                />
             </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
             <button 
                onClick={handleRemove}
                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-400/10 transition-colors"
             >
                <X size={10} /> Remove
             </button>
             <button 
                onClick={() => setIsOpen(false)}
                className="text-[10px] text-zinc-400 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
             >
                Done
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
