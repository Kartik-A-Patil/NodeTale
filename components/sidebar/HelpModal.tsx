import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-2xl border border-zinc-800 shadow-2xl my-4 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-zinc-100">
                <Keyboard size={24} className="text-orange-500" />
                Help & Documentation
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <div className="space-y-6 text-sm text-zinc-300 max-h-96 overflow-y-auto">
          {/* Keyboard Shortcuts */}
          <div>
            <h3 className="text-orange-400 font-semibold mb-3 text-xs uppercase tracking-wider">Keyboard Shortcuts</h3>
            <div className="space-y-2 bg-zinc-800/30 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                  <span>Undo</span>
                  <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Ctrl+Z</span>
              </div>
              <div className="flex justify-between items-center">
                  <span>Redo</span>
                  <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Ctrl+Y</span>
              </div>
              <div className="flex justify-between items-center">
                  <span>Delete Node</span>
                  <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Delete</span>
              </div>
              <div className="flex justify-between items-center">
                  <span>Multi-Select</span>
                  <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Ctrl+Click</span>
              </div>
              <div className="flex justify-between items-center">
                  <span>Pan Canvas</span>
                  <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs font-mono text-zinc-400">Space+Drag</span>
              </div>
            </div>
          </div>

          {/* Code Blocks */}
          <div>
            <h3 className="text-orange-400 font-semibold mb-3 text-xs uppercase tracking-wider">Code Blocks & Syntax</h3>
            <div className="bg-zinc-800/30 p-3 rounded-lg space-y-3">
              <div>
                <p className="font-semibold text-zinc-200 mb-1">Insert Code Block</p>
                <p className="text-xs text-zinc-400">Click the code icon in the editor toolbar or select text and apply code formatting</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-200 mb-1">Syntax Highlighting</p>
                <p className="text-xs text-zinc-400">Code blocks are highlighted with Prism.js supporting JavaScript/TypeScript syntax</p>
              </div>
              <div>
                <p className="font-semibold text-zinc-200 mb-1">Runtime Features</p>
                <div className="text-xs text-zinc-400 space-y-1">
                  <p>Supports expressions, math, and string ops</p>
                  <p>Compound assignments: <span className="font-mono text-green-400">score += 5</span></p>
                  <p>Object updates: <span className="font-mono text-green-400">player.stats.hp = 10</span></p>
                  <p>Array ops: <span className="font-mono text-green-400">inventory.push("key")</span>, <span className="font-mono text-green-400">items[0] = "sword"</span></p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-zinc-200 mb-1">Error Detection</p>
                <p className="text-xs text-zinc-400">Red error badge appears on nodes with syntax errors or obvious type mismatches</p>
              </div>
            </div>
          </div>

          {/* Array Operations */}
          <div>
            <h3 className="text-orange-400 font-semibold mb-3 text-xs uppercase tracking-wider">Array Operations</h3>
            <div className="bg-zinc-800/30 p-3 rounded-lg space-y-2 font-mono text-xs">
              <p><span className="text-blue-400">arr</span>.map((x) =&gt; x * 2)</p>
              <p><span className="text-blue-400">arr</span>.filter((x) =&gt; x &gt; 5)</p>
              <p><span className="text-blue-400">arr</span>.reduce((acc, x) =&gt; acc + x, 0)</p>
              <p><span className="text-blue-400">arr</span>.push(item)</p>
              <p><span className="text-blue-400">arr</span>.pop()</p>
              <p><span className="text-blue-400">arr</span>.shift()</p>
              <p><span className="text-blue-400">arr</span>.unshift(item)</p>
            </div>
          </div>

          {/* Object Operations */}
          <div>
            <h3 className="text-orange-400 font-semibold mb-3 text-xs uppercase tracking-wider">Object Operations</h3>
            <div className="bg-zinc-800/30 p-3 rounded-lg space-y-2 font-mono text-xs">
              <p><span className="text-purple-400">Object</span>.keys(obj)</p>
              <p><span className="text-purple-400">Object</span>.values(obj)</p>
              <p><span className="text-purple-400">Object</span>.entries(obj)</p>
              <p>&#123;...<span className="text-blue-400">obj</span>, key: value&#125;</p>
            </div>
          </div>

          {/* Variable Syntax */}
          <div>
            <h3 className="text-orange-400 font-semibold mb-3 text-xs uppercase tracking-wider">Variable References</h3>
            <div className="bg-zinc-800/30 p-3 rounded-lg space-y-2">
              <p className="text-xs text-zinc-400">Use double curly braces to reference variables in content:</p>
              <p className="font-mono text-xs text-green-400">Hello &#123;&#123;player_name&#125;&#125;!</p>
              <p className="text-xs text-zinc-400 mt-2">Variables must be defined in Global Variables section or will show an error</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-sm font-medium transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};
