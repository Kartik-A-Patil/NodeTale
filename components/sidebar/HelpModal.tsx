import React, { useState } from 'react';
import { Keyboard, X, Code, Variable, Box, Zap, GitBranch, BookOpen, Play } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Section = 'getting-started' | 'shortcuts' | 'nodes' | 'variables' | 'scripting' | 'arrays' | 'objects' | 'playmode';

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<Section>('getting-started');

  if (!isOpen) return null;

  const sections = [
    { id: 'getting-started' as Section, label: 'Getting Started', icon: BookOpen },
    { id: 'shortcuts' as Section, label: 'Keyboard Shortcuts', icon: Keyboard },
    { id: 'nodes' as Section, label: 'Node Types', icon: Box },
    { id: 'variables' as Section, label: 'Variables', icon: Variable },
    { id: 'scripting' as Section, label: 'Scripting & Code', icon: Code },
    { id: 'arrays' as Section, label: 'Array Operations', icon: GitBranch },
    { id: 'objects' as Section, label: 'Object Operations', icon: Zap },
    { id: 'playmode' as Section, label: 'Play Mode', icon: Play },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-xl w-full max-w-6xl h-[85vh] border border-zinc-700 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-zinc-100">
            <div className="bg-orange-500/20 p-2 rounded-lg">
              <BookOpen size={24} className="text-orange-500" />
            </div>
            NodeTale Documentation
          </h2>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 p-2 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto">
            <nav className="p-4 space-y-1">
              {sections.map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      isActive 
                        ? 'bg-orange-500/20 text-orange-400 font-medium' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-8">
            {activeSection === 'getting-started' && <GettingStartedContent />}
            {activeSection === 'shortcuts' && <ShortcutsContent />}
            {activeSection === 'nodes' && <NodesContent />}
            {activeSection === 'variables' && <VariablesContent />}
            {activeSection === 'scripting' && <ScriptingContent />}
            {activeSection === 'arrays' && <ArraysContent />}
            {activeSection === 'objects' && <ObjectsContent />}
            {activeSection === 'playmode' && <PlayModeContent />}
          </div>
        </div>
      </div>
    </div>
  );
};

// Content Components
const GettingStartedContent = () => (
  <div className="space-y-6 text-zinc-300">
    <div>
      <h3 className="text-2xl font-bold text-zinc-100 mb-4">Welcome to NodeTale</h3>
      <p className="text-base leading-relaxed mb-4">
        NodeTale is a visual node-based story editor that lets you create interactive branching narratives with variables, conditions, and rich text content.
      </p>
    </div>

    <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
      <h4 className="text-lg font-semibold text-zinc-100 mb-4">Quick Start</h4>
      <ol className="space-y-3 list-decimal list-inside text-zinc-300">
        <li><strong className="text-zinc-100">Create a Project:</strong> Start from the dashboard by creating a new project</li>
        <li><strong className="text-zinc-100">Add Nodes:</strong> Drag node types from the left sidebar onto the canvas</li>
        <li><strong className="text-zinc-100">Connect Nodes:</strong> Drag from one node's handle to another to create story paths</li>
        <li><strong className="text-zinc-100">Add Content:</strong> Double-click nodes to edit their content and properties</li>
        <li><strong className="text-zinc-100">Test Your Story:</strong> Click the Play button to test your interactive narrative</li>
      </ol>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-lg">
        <h5 className="text-blue-400 font-semibold mb-2">Projects & Boards</h5>
        <p className="text-sm text-zinc-400">Organize your story into multiple boards (chapters/scenes) within a single project.</p>
      </div>
      <div className="bg-purple-500/10 border border-purple-500/30 p-5 rounded-lg">
        <h5 className="text-purple-400 font-semibold mb-2">Auto-Save</h5>
        <p className="text-sm text-zinc-400">Your work is automatically saved to your browser's local storage as you create.</p>
      </div>
    </div>
  </div>
);

const ShortcutsContent = () => (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-zinc-100">Keyboard Shortcuts</h3>
    
    <div className="space-y-4">
      <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700">
        <h4 className="text-orange-400 font-semibold mb-4 text-sm uppercase tracking-wider">General</h4>
        <div className="space-y-3">
          <ShortcutItem label="Undo" shortcut="Ctrl+Z" />
          <ShortcutItem label="Redo" shortcut="Ctrl+Y" />
          <ShortcutItem label="Copy" shortcut="Ctrl+C" />
          <ShortcutItem label="Paste" shortcut="Ctrl+V" />
          <ShortcutItem label="Delete Node" shortcut="Delete" />
        </div>
      </div>

      <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700">
        <h4 className="text-orange-400 font-semibold mb-4 text-sm uppercase tracking-wider">Canvas Navigation</h4>
        <div className="space-y-3">
          <ShortcutItem label="Pan Canvas" shortcut="Space+Drag" description="Hold space and drag to move the canvas" />
          <ShortcutItem label="Zoom In/Out" shortcut="Scroll Wheel" description="Use mouse wheel to zoom" />
          <ShortcutItem label="Multi-Select" shortcut="Ctrl+Click" description="Select multiple nodes" />
          <ShortcutItem label="Box Select" shortcut="Shift+Drag" description="Drag to select multiple nodes" />
        </div>
      </div>
    </div>
  </div>
);

const NodesContent = () => (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-zinc-100">Node Types</h3>
    
    <div className="space-y-4">
      <NodeTypeCard
        title="Element Node"
        color="bg-blue-500/20 border-blue-500/30"
        description="Standard story content node with rich text editor. Use this for narrative text, dialogue, and interactive content."
      />
      <NodeTypeCard
        title="Condition Node"
        color="bg-purple-500/20 border-purple-500/30"
        description="Creates branching paths based on variable conditions. Evaluates logic expressions to determine which path to follow."
      />
      <NodeTypeCard
        title="Jump Node"
        color="bg-green-500/20 border-green-500/30"
        description="Teleports execution to another node, even across different boards. Useful for creating loops or linking distant story sections."
      />
      <NodeTypeCard
        title="Section Node"
        color="bg-yellow-500/20 border-yellow-500/30"
        description="Visual divider to organize your story into sections. Doesn't affect story flow, purely organizational."
      />
      <NodeTypeCard
        title="Comment Node"
        color="bg-gray-500/20 border-gray-500/30"
        description="Add notes and comments to your story graph. Ignored during play mode."
      />
      <NodeTypeCard
        title="Annotation Node"
        color="bg-pink-500/20 border-pink-500/30"
        description="Floating labels with arrows to document and explain your story structure."
      />
    </div>
  </div>
);

const VariablesContent = () => (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-zinc-100">Variables</h3>
    
    <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
      <h4 className="text-lg font-semibold text-zinc-100 mb-3">Using Variables in Content</h4>
      <p className="text-zinc-300 mb-4">Reference variables in your story text using double curly braces:</p>
      <div className="bg-zinc-900 p-4 rounded-lg font-mono text-green-400 border border-zinc-700">
        Hello &#123;&#123;playerName&#125;&#125;! You have &#123;&#123;score&#125;&#125; points.
      </div>
    </div>

    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-lg">
        <h5 className="text-blue-400 font-semibold mb-2">String Variables</h5>
        <p className="text-sm text-zinc-400 mb-2">Text values for names, dialogue, and content.</p>
        <code className="text-xs bg-zinc-900 px-3 py-1 rounded">playerName = "Alex"</code>
      </div>

      <div className="bg-purple-500/10 border border-purple-500/30 p-5 rounded-lg">
        <h5 className="text-purple-400 font-semibold mb-2">Number Variables</h5>
        <p className="text-sm text-zinc-400 mb-2">Numeric values for scores, health, counters.</p>
        <code className="text-xs bg-zinc-900 px-3 py-1 rounded">score = 100</code>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 p-5 rounded-lg">
        <h5 className="text-green-400 font-semibold mb-2">Boolean Variables</h5>
        <p className="text-sm text-zinc-400 mb-2">True/false flags for story states.</p>
        <code className="text-xs bg-zinc-900 px-3 py-1 rounded">hasKey = true</code>
      </div>

      <div className="bg-orange-500/10 border border-orange-500/30 p-5 rounded-lg">
        <h5 className="text-orange-400 font-semibold mb-2">Array Variables</h5>
        <p className="text-sm text-zinc-400 mb-2">Lists of items, inventory, collections.</p>
        <code className="text-xs bg-zinc-900 px-3 py-1 rounded">inventory = ["sword", "shield", "potion"]</code>
      </div>

      <div className="bg-pink-500/10 border border-pink-500/30 p-5 rounded-lg">
        <h5 className="text-pink-400 font-semibold mb-2">Object Variables</h5>
        <p className="text-sm text-zinc-400 mb-2">Complex data structures with nested properties.</p>
        <code className="text-xs bg-zinc-900 px-3 py-1 rounded block">player = &#123; hp: 100, mana: 50 &#125;</code>
      </div>
    </div>
  </div>
);

const ScriptingContent = () => (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-zinc-100">Scripting & Code Blocks</h3>
    
    <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
      <h4 className="text-lg font-semibold text-zinc-100 mb-3">Creating Code Blocks</h4>
      <p className="text-zinc-300 mb-4">Click the code icon in the rich text editor toolbar to insert executable code blocks. Code runs during play mode when the node is reached.</p>
    </div>

    <div className="space-y-4">
      <CodeExample
        title="Variable Assignment"
        code={`score = 100\nplayerName = "Hero"\nhasKey = true`}
      />
      <CodeExample
        title="Compound Operations"
        code={`score += 10\nhealth -= 5\ncounter++`}
      />
      <CodeExample
        title="Object Properties"
        code={`player.hp = 100\nplayer.stats.strength = 50\nplayer.inventory.gold += 100`}
      />
      <CodeExample
        title="Array Manipulation"
        code={`inventory.push("key")\nitems[0] = "sword"\ninventory.pop()`}
      />
      <CodeExample
        title="Math Operations"
        code={`total = price * quantity\naverage = sum / count\nrandom = Math.random() * 100`}
      />
    </div>

    <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-lg">
      <h5 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded">ERROR</span>
        Error Detection
      </h5>
      <p className="text-sm text-zinc-400">Nodes with syntax errors or type mismatches will show a red error badge. Check your variable names and syntax.</p>
    </div>
  </div>
);

const ArraysContent = () => (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-zinc-100">Array Operations</h3>
    
    <div className="space-y-4">
      <CodeExample
        title="Transform Elements"
        code={`numbers.map((x) => x * 2)\nnames.map((n) => n.toUpperCase())`}
      />
      <CodeExample
        title="Filter Elements"
        code={`numbers.filter((x) => x > 5)\nitems.filter((item) => item.price < 100)`}
      />
      <CodeExample
        title="Reduce to Value"
        code={`numbers.reduce((acc, x) => acc + x, 0)\nprices.reduce((total, p) => total + p, 0)`}
      />
      <CodeExample
        title="Add/Remove Elements"
        code={`arr.push(item)        // Add to end\narr.pop()             // Remove from end\narr.unshift(item)     // Add to start\narr.shift()           // Remove from start`}
      />
      <CodeExample
        title="Array Access"
        code={`arr[0]                // First element\narr[arr.length - 1]   // Last element\narr.length            // Array size`}
      />
    </div>
  </div>
);

const ObjectsContent = () => (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-zinc-100">Object Operations</h3>
    
    <div className="space-y-4">
      <CodeExample
        title="Access Properties"
        code={`player.name\nplayer.stats.hp\nplayer["inventory"]`}
      />
      <CodeExample
        title="Update Properties"
        code={`player.hp = 100\nplayer.stats.strength += 5\nplayer.inventory.gold = 500`}
      />
      <CodeExample
        title="Object Methods"
        code={`Object.keys(obj)      // Get all keys\nObject.values(obj)    // Get all values\nObject.entries(obj)   // Get key-value pairs`}
      />
      <CodeExample
        title="Spread Operator"
        code={`newObj = {...player, hp: 100}\nmerged = {...obj1, ...obj2}`}
      />
      <CodeExample
        title="Nested Objects"
        code={`player = {\n  name: "Hero",\n  stats: { hp: 100, mp: 50 },\n  inventory: { gold: 100 }\n}`}
      />
    </div>
  </div>
);

const PlayModeContent = () => (
  <div className="space-y-6">
    <h3 className="text-2xl font-bold text-zinc-100">Play Mode</h3>
    
    <div className="bg-zinc-800/50 p-6 rounded-xl border border-zinc-700">
      <h4 className="text-lg font-semibold text-zinc-100 mb-3">Testing Your Story</h4>
      <p className="text-zinc-300 mb-4">Click the Play button in the top toolbar to test your interactive narrative. The story starts from the "Start" node and follows connections based on your conditions and jumps.</p>
    </div>

    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-lg">
        <h5 className="text-blue-400 font-semibold mb-2">Runtime Execution</h5>
        <p className="text-sm text-zinc-400">Code blocks execute when their node is reached. Variables update in real-time and affect subsequent conditions.</p>
      </div>

      <div className="bg-purple-500/10 border border-purple-500/30 p-5 rounded-lg">
        <h5 className="text-purple-400 font-semibold mb-2">Condition Evaluation</h5>
        <p className="text-sm text-zinc-400">Condition nodes automatically evaluate and follow the matching branch. If no condition matches, the story stops.</p>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 p-5 rounded-lg">
        <h5 className="text-green-400 font-semibold mb-2">Debug Overlay</h5>
        <p className="text-sm text-zinc-400">View current variable values in the debug panel during play mode to track story state.</p>
      </div>

      <div className="bg-orange-500/10 border border-orange-500/30 p-5 rounded-lg">
        <h5 className="text-orange-400 font-semibold mb-2">Cross-Board Jumps</h5>
        <p className="text-sm text-zinc-400">Jump nodes can teleport to nodes on different boards, allowing complex story structures.</p>
      </div>
    </div>
  </div>
);

// Helper Components
const ShortcutItem = ({ label, shortcut, description }: { label: string; shortcut: string; description?: string }) => (
  <div className="flex justify-between items-start">
    <div className="flex-1">
      <span className="text-zinc-200 font-medium">{label}</span>
      {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
    </div>
    <span className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded text-xs font-mono text-zinc-300 whitespace-nowrap ml-4">
      {shortcut}
    </span>
  </div>
);

const NodeTypeCard = ({ title, color, description }: { title: string; color: string; description: string }) => (
  <div className={`${color} border p-5 rounded-lg`}>
    <h5 className="font-semibold mb-2 text-zinc-100">{title}</h5>
    <p className="text-sm text-zinc-400">{description}</p>
  </div>
);

const CodeExample = ({ title, code }: { title: string; code: string }) => (
  <div className="bg-zinc-800/50 p-5 rounded-xl border border-zinc-700">
    <h5 className="text-zinc-200 font-semibold mb-3">{title}</h5>
    <pre className="bg-zinc-900 p-4 rounded-lg text-sm font-mono text-green-400 overflow-x-auto border border-zinc-800">
      {code}
    </pre>
  </div>
);
