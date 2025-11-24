import React from 'react';
import { AppNode, Project, Branch } from '../types';
import { X, AlignLeft, Tag, GitFork, Trash, MoreHorizontal, Plus, Link as LinkIcon, ClipboardPaste } from 'lucide-react';

interface SidebarRightProps {
  selectedNode: AppNode | null;
  updateNode: (id: string, data: any) => void;
  deleteNode: (id: string) => void;
  project: Project;
  jumpClipboard: { id: string; label: string } | null;
}

const SidebarRight: React.FC<SidebarRightProps> = ({ selectedNode, updateNode, deleteNode, project, jumpClipboard }) => {
  if (!selectedNode) {
    return (
      <div className="w-80 bg-[#18181b] border-l border-[#27272a] p-8 flex flex-col items-center justify-center text-zinc-500">
        <MoreHorizontal size={48} className="mb-4 opacity-20" />
        <p className="text-sm text-center">Select an element to edit properties</p>
      </div>
    );
  }

  const isCondition = selectedNode.type === 'conditionNode';
  const isJump = selectedNode.type === 'jumpNode';

  // Helper to get all nodes for jump target selection (flattened from all boards)
  const getAllNodes = () => {
    return project.boards.flatMap(b => b.nodes.map(n => ({...n, boardName: b.name})));
  };

  // Group nodes by board name for the dropdown
  const getNodesByBoard = () => {
      const all = getAllNodes();
      const grouped: Record<string, typeof all> = {};
      all.forEach(node => {
          if (!grouped[node.boardName]) grouped[node.boardName] = [];
          grouped[node.boardName].push(node);
      });
      return grouped;
  };

  const handleAddBranch = () => {
      const currentBranches = selectedNode.data.branches || [];
      // Insert before the last 'Else' if it exists, or just append
      const elseIndex = currentBranches.findIndex(b => b.label === 'Else');
      
      const newBranch: Branch = {
          id: `branch-${Date.now()}`,
          label: 'Else If',
          condition: 'var == true'
      };

      let newBranches;
      if (elseIndex !== -1) {
          newBranches = [
              ...currentBranches.slice(0, elseIndex),
              newBranch,
              ...currentBranches.slice(elseIndex)
          ];
      } else {
          newBranches = [...currentBranches, newBranch];
      }
      
      updateNode(selectedNode.id, { branches: newBranches });
  };

  const updateBranch = (index: number, field: keyof Branch, value: string) => {
      const branches = [...(selectedNode.data.branches || [])];
      branches[index] = { ...branches[index], [field]: value };
      updateNode(selectedNode.id, { branches });
  };

  const removeBranch = (index: number) => {
      const branches = [...(selectedNode.data.branches || [])];
      branches.splice(index, 1);
      updateNode(selectedNode.id, { branches });
  };

  const currentBranches = selectedNode.data.branches || [];

  return (
    <div className="w-80 bg-[#18181b] border-l border-[#27272a] flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="h-14 border-b border-[#27272a] flex items-center justify-between px-4 bg-[#202023]">
        <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">Properties</span>
        </div>
        <button onClick={() => deleteNode(selectedNode.id)} className="text-zinc-500 hover:text-red-500 transition-colors">
            <Trash size={16} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Label Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
              <Tag size={12}/> Title
          </label>
          <input
            type="text"
            className="w-full bg-[#09090b] border border-[#27272a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
            value={selectedNode.data.label}
            onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
          />
        </div>

        {/* Condition Logic Editor */}
        {isCondition && (
             <div className="space-y-4">
             <div className="flex items-center justify-between">
                 <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                     <GitFork size={12}/> Branches
                 </label>
                 <button onClick={handleAddBranch} className="text-[10px] flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-blue-400 transition-colors">
                     <Plus size={10} /> Add Else If
                 </button>
             </div>
             
             <div className="space-y-2">
                 {currentBranches.map((branch, idx) => (
                     <div key={branch.id} className="bg-[#27272a] p-2 rounded border border-zinc-700 flex flex-col gap-2">
                         <div className="flex items-center justify-between">
                             <span className={`text-[10px] font-bold uppercase ${branch.label === 'Else' ? 'text-zinc-500' : 'text-blue-400'}`}>
                                 {branch.label}
                             </span>
                             {branch.label === 'Else If' && (
                                 <button onClick={() => removeBranch(idx)} className="text-zinc-600 hover:text-red-500">
                                     <X size={12} />
                                 </button>
                             )}
                         </div>
                         {branch.label !== 'Else' && (
                             <input
                                type="text"
                                className="w-full bg-[#09090b] border border-zinc-700 rounded px-2 py-1 text-xs text-green-400 font-mono focus:outline-none focus:border-blue-500"
                                value={branch.condition}
                                onChange={(e) => updateBranch(idx, 'condition', e.target.value)}
                                placeholder="e.g. var == true"
                             />
                         )}
                     </div>
                 ))}
             </div>
             
             <div className="text-[10px] text-zinc-500 mt-1">
                 Check logic: <code>variable operator value</code>
             </div>
           </div>
        )}

        {/* Jump Target Selector */}
        {isJump && (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                        <LinkIcon size={12}/> Target Node
                    </label>
                    {jumpClipboard && (
                        <button 
                            onClick={() => updateNode(selectedNode.id, { 
                                jumpTargetId: jumpClipboard.id,
                                jumpTargetLabel: jumpClipboard.label
                            })}
                            className="text-[10px] flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors bg-purple-900/30 px-2 py-1 rounded border border-purple-500/30"
                            title={`Paste target: ${jumpClipboard.label}`}
                        >
                            <ClipboardPaste size={10} /> Paste
                        </button>
                    )}
                </div>
                
                <select 
                    className="w-full bg-[#09090b] border border-[#27272a] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                    value={selectedNode.data.jumpTargetId || ''}
                    onChange={(e) => {
                        const target = getAllNodes().find(n => n.id === e.target.value);
                        updateNode(selectedNode.id, { 
                            jumpTargetId: e.target.value,
                            jumpTargetLabel: target?.data.label || 'Unknown'
                        });
                    }}
                >
                    <option value="">Select a target...</option>
                    {Object.entries(getNodesByBoard()).map(([boardName, nodes]) => (
                        <optgroup label={boardName} key={boardName} className="bg-zinc-800 text-zinc-300">
                            {nodes
                                .filter(n => n.id !== selectedNode.id && n.type !== 'jumpNode')
                                .map(n => (
                                <option key={n.id} value={n.id}>
                                    {n.data.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <div className="text-[10px] text-zinc-500">
                    Select a target node to jump to. You can also right-click a node to "Copy as Jump Target" and paste here.
                </div>
            </div>
        )}

        {/* Element Content Editor */}
        {!isCondition && !isJump && (
          <div className="space-y-2 flex-1 flex flex-col">
            <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                <AlignLeft size={12}/> Content
            </label>
            <textarea
              className="w-full h-64 bg-[#09090b] border border-[#27272a] rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-orange-500 transition-colors resize-none leading-relaxed"
              value={selectedNode.data.content}
              onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
              placeholder="Write your story text here... Use {{variableName}} to embed values."
            />
            <div className="text-[10px] text-zinc-500">Supports variable embedding e.g. "Hello {'{{playerName}}'}"</div>
          </div>
        )}

        {/* Asset Attachments */}
        {!isCondition && !isJump && (
             <div className="space-y-2 pt-4 border-t border-[#27272a]">
             <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                 Attached Assets
             </label>
             <div className="grid grid-cols-3 gap-2">
                 {project.assets.map(asset => {
                     const isAttached = selectedNode.data.assets?.includes(asset.id);
                     return (
                        <div 
                            key={asset.id} 
                            onClick={() => {
                                const current = selectedNode.data.assets || [];
                                const newAssets = isAttached 
                                    ? current.filter((id: string) => id !== asset.id)
                                    : [...current, asset.id];
                                updateNode(selectedNode.id, { assets: newAssets });
                            }}
                            className={`cursor-pointer rounded border overflow-hidden aspect-square relative ${isAttached ? 'border-orange-500 ring-1 ring-orange-500' : 'border-zinc-700 opacity-50 hover:opacity-100'}`}
                        >
                            <img src={asset.url} className="w-full h-full object-cover" alt={asset.name} />
                        </div>
                     )
                 })}
             </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default SidebarRight;