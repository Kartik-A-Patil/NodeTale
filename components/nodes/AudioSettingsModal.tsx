import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Asset, AudioSettings } from '../../types';
import { X, Play, Pause, RotateCcw, Clock, FileAudio } from 'lucide-react';

interface AudioSettingsModalProps {
  asset: Asset;
  settings: AudioSettings;
  onSave: (settings: AudioSettings) => void;
  onClose: () => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  asset,
  settings,
  onSave,
  onClose
}) => {
  const [loop, setLoop] = useState(settings.loop);
  const [delay, setDelay] = useState(settings.delay);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSave = () => {
    onSave({ loop, delay });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200">
      <div 
        className="bg-zinc-950 border border-zinc-800 w-[420px] flex flex-col shadow-2xl rounded-lg overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex flex-col gap-0.5">
             <h3 className="text-sm font-semibold text-zinc-100 tracking-wide uppercase">Audio Configuration</h3>
             <p className="text-xs text-zinc-400 font-mono truncate max-w-[300px]" title={asset.name}>{asset.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 hover:bg-zinc-800 rounded">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Preview Player */}
          <div className="flex flex-col gap-4 bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/50">
            <div className="flex items-center gap-4">
               <button
                onClick={handleTogglePlay}
                className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-orange-500/50 text-zinc-200 hover:text-orange-400 rounded-full transition-all shrink-0 shadow-sm"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              
              <div className="flex-1 flex flex-col gap-2">
                 <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.01"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:hover:bg-orange-400 [&::-webkit-slider-thumb]:transition-colors"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-medium">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={asset.url}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              loop={loop}
            />
          </div>

          {/* Settings */}
          <div className="space-y-5">
            
            {/* Loop Toggle */}
            <div className="flex items-center justify-between group p-2 -mx-2 rounded hover:bg-zinc-900/50 transition-colors cursor-pointer" onClick={() => setLoop(!loop)}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md transition-colors ${loop ? 'bg-orange-500/10 text-orange-500' : 'bg-zinc-900 text-zinc-500'}`}>
                  <RotateCcw size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-200 font-medium">Loop Playback</span>
                  <span className="text-xs text-zinc-500">Restart automatically when finished</span>
                </div>
              </div>
              <div
                className={`w-10 h-5 rounded-full transition-colors relative border ${
                  loop ? 'border-orange-500/50 bg-orange-500/20' : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all shadow-sm ${
                    loop ? 'bg-orange-500 left-5' : 'bg-zinc-500 left-0.5'
                  }`}
                />
              </div>
            </div>

            {/* Delay Input */}
            <div className="flex items-center justify-between group p-2 -mx-2 rounded hover:bg-zinc-900/50 transition-colors">
               <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-zinc-900 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <Clock size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-200 font-medium">Start Delay</span>
                  <span className="text-xs text-zinc-500">Wait before playing</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all">
                <input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                  className="w-16 bg-transparent text-right text-sm text-zinc-200 focus:outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="text-xs text-zinc-500 font-medium">ms</span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white rounded-md shadow-lg shadow-orange-900/20 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
