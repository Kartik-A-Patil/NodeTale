import React, { useState, useEffect, useCallback } from 'react';
import { Project, AppNode, Variable, VariableType } from '../types';
import { X, RefreshCcw, Play } from 'lucide-react';
import { evaluateCondition, replaceVariablesInText } from '../services/logicService';

interface PlayModeProps {
  project: Project;
  onClose: () => void;
}

const PlayMode: React.FC<PlayModeProps> = ({ project, onClose }) => {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [runtimeVars, setRuntimeVars] = useState<Variable[]>(JSON.parse(JSON.stringify(project.variables)));
  
  // Initialize start node
  useEffect(() => {
    const board = project.boards.find(b => b.id === project.activeBoardId) || project.boards[0];
    if (board && board.nodes.length > 0) {
        // Try to find a node labelled 'Start' or just the first one
        const startNode = board.nodes.find(n => n.data.label === 'Start') || board.nodes[0];
        setCurrentNodeId(startNode.id);
    }
  }, []);

  const findNode = (id: string) => {
      // Search all boards for the node
      for (const board of project.boards) {
          const found = board.nodes.find(n => n.id === id);
          if (found) return { node: found, board };
      }
      return null;
  };

  const currentNodeContext = currentNodeId ? findNode(currentNodeId) : null;
  const currentNode = currentNodeContext?.node;
  const currentBoard = currentNodeContext?.board;

  // Logic Execution for Scripts (Code Blocks)
  const executeNodeScript = useCallback((content: string) => {
      // Parse HTML content to find <pre> blocks
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const preBlocks = doc.querySelectorAll('pre');

      if (preBlocks.length === 0) return;

      const newRuntimeVars = [...runtimeVars];
      let hasUpdates = false;

      preBlocks.forEach(block => {
          const text = block.innerText;
          const lines = text.split('\n');
          
          lines.forEach(line => {
              const trimmed = line.trim();
              if (!trimmed) return;

              // Very basic assignment parser: varName = value
              // Supports =, +=, -=
              let operator = '';
              if (trimmed.includes('=')) operator = '=';
              // Simple implementation - expand for += later if needed, sticking to basic assignment for now as per strict regex request earlier
              // But let's support basic arithmetic assignment if possible
              
              if (!operator) return;

              const [left, right] = trimmed.split('=').map(s => s.trim());
              const targetVarIndex = newRuntimeVars.findIndex(v => v.name === left);

              if (targetVarIndex !== -1) {
                  const targetVar = newRuntimeVars[targetVarIndex];
                  let newValue: any = right;

                  // Type coercion
                  if (targetVar.type === VariableType.NUMBER) {
                      newValue = Number(right);
                  } else if (targetVar.type === VariableType.BOOLEAN) {
                      newValue = right === 'true';
                  } else {
                      newValue = right.replace(/['"]/g, '');
                  }
                  
                  if (!isNaN(newValue) || targetVar.type !== VariableType.NUMBER) {
                       newRuntimeVars[targetVarIndex] = { ...targetVar, value: newValue };
                       hasUpdates = true;
                  }
              }
          });
      });

      if (hasUpdates) {
          setRuntimeVars(newRuntimeVars);
      }
  }, [runtimeVars]);


  // Effect to handle instant nodes (Condition, Jump) AND execute scripts for Element Nodes
  useEffect(() => {
      if (!currentNode || !currentBoard) return;

      // 1. Execute Scripts if it's an Element Node
      if (currentNode.type === 'elementNode') {
          executeNodeScript(currentNode.data.content);
      }

      // 2. Handle Control Flow Nodes
      if (currentNode.type === 'jumpNode') {
          // Instant Jump
          if (currentNode.data.jumpTargetId) {
              setHistory(h => [...h, currentNodeId!]);
              setCurrentNodeId(currentNode.data.jumpTargetId);
          }
      } else if (currentNode.type === 'conditionNode') {
          // Instant Branch Evaluation
          const branches = currentNode.data.branches || [];
          let targetHandleId = 'else'; // Default fallback (if else exists)
          
          // Find first true branch
          for (const branch of branches) {
              if (branch.label === 'Else') {
                  targetHandleId = branch.id;
                  continue; // Keep else as fallback, don't break yet, usually else is last
              }
              if (evaluateCondition(branch.condition, runtimeVars)) {
                  targetHandleId = branch.id;
                  break; // Stop at first true
              }
          }

          // Find edge connected to this handle
          const edge = currentBoard.edges.find(
              e => e.source === currentNode.id && e.sourceHandle === targetHandleId
          );

          if (edge) {
              setHistory(h => [...h, currentNodeId!]);
              setCurrentNodeId(edge.target);
          } else {
              // Dead end in logic?
          }
      }

  }, [currentNodeId]); // Only run when node ID changes to avoid infinite loops with var updates


  const getOptions = () => {
    if (!currentNode || !currentBoard || currentNode.type !== 'elementNode') return [];
    
    // Get direct edges from this element
    const edges = currentBoard.edges.filter(e => e.source === currentNode.id);
    
    return edges.map(edge => {
        const target = currentBoard.nodes.find(n => n.id === edge.target);
        return {
            label: target?.data.label || "Continue",
            targetId: target?.id
        };
    }).filter(opt => opt.targetId);
  };

  const handleOptionClick = (targetId: string) => {
      setHistory([...history, currentNodeId!]);
      setCurrentNodeId(targetId);
  };

  const restart = () => {
      const board = project.boards.find(b => b.id === project.activeBoardId) || project.boards[0];
      const startNode = board.nodes.find(n => n.data.label === 'Start') || board.nodes[0];
      if(startNode) setCurrentNodeId(startNode.id);
      setRuntimeVars(JSON.parse(JSON.stringify(project.variables)));
      setHistory([]);
  };

  if (!currentNode) return <div className="fixed inset-0 z-50 bg-black text-white flex items-center justify-center">Loading...</div>;

  // Don't render content for logic nodes, they should flicker past instantly. 
  const isLogicNode = currentNode.type === 'conditionNode' || currentNode.type === 'jumpNode';

  if (isLogicNode) {
       return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center text-zinc-500">
           <span className="animate-pulse">Processing Logic...</span>
           <button onClick={onClose} className="mt-4 text-xs hover:text-white underline">Force Exit</button>
        </div>
       )
  }

  const bgImage = currentNode.data.assets && currentNode.data.assets.length > 0 
    ? project.assets.find(a => a.id === currentNode.data.assets![0])?.url 
    : null;

  const processedContent = replaceVariablesInText(currentNode.data.content, runtimeVars);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
        
        {/* Background Layer */}
        {bgImage && (
            <div className="absolute inset-0 z-0">
                <img src={bgImage} className="w-full h-full object-cover opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
            </div>
        )}

        {/* Top Controls */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
            <button onClick={restart} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-300">
                <RefreshCcw size={20} />
            </button>
            <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 text-zinc-300">
                <X size={20} />
            </button>
        </div>

        {/* Narrative Container */}
        <div className="z-10 w-full max-w-2xl p-8 flex flex-col gap-8">
            
            {/* Main Text */}
            <div className="space-y-4">
                <h1 className="text-3xl font-bold text-orange-500 font-serif tracking-wide">{currentNode.data.label}</h1>
                <div 
                    className="play-content text-xl text-zinc-200 leading-relaxed font-serif whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: processedContent }}
                />
            </div>

            {/* Choices */}
            <div className="flex flex-col gap-3 mt-8">
                {getOptions().map((opt, idx) => (
                    <button 
                        key={idx}
                        onClick={() => handleOptionClick(opt.targetId!)}
                        className="px-6 py-4 bg-zinc-900/80 border border-zinc-700 hover:border-orange-500 hover:bg-zinc-800 text-left rounded-lg transition-all text-lg group flex items-center justify-between"
                    >
                        <span>{opt.label}</span>
                        <Play size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-orange-500 fill-current" />
                    </button>
                ))}
                
                {getOptions().length === 0 && (
                    <div className="text-center text-zinc-500 italic mt-4">End of story</div>
                )}
            </div>

            {/* Debug Variables */}
            <div className="mt-12 p-4 bg-black/50 rounded border border-zinc-800 text-xs font-mono text-zinc-500">
                <div className="mb-2 uppercase font-bold">Debug Variables</div>
                <div className="grid grid-cols-2 gap-2">
                    {runtimeVars.map(v => (
                        <div key={v.id} className="flex items-center justify-between border-b border-zinc-900 pb-1">
                            <span>{v.name}</span>
                            <span className={`font-bold ${
                                v.type === 'boolean' ? (v.value ? 'text-green-500' : 'text-red-500') : 
                                v.type === 'number' ? 'text-purple-400' : 'text-blue-400'
                            }`}>
                                {String(v.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        <style>{`
            .play-content blockquote { 
                border-left: 4px solid #f97316; 
                padding-left: 16px; 
                font-style: italic; 
                color: #d4d4d8; 
                margin: 16px 0; 
                background: rgba(249, 115, 22, 0.1);
                padding: 8px 16px;
                border-radius: 0 8px 8px 0;
            }
            .play-content pre { 
                background: #0f0f11; 
                padding: 16px; 
                border-radius: 8px; 
                font-family: 'JetBrains Mono', monospace; 
                border: 1px solid #3f3f46; 
                color: #a1a1aa; 
                margin: 12px 0; 
                font-size: 0.85em;
                white-space: pre-wrap;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
            }
            .play-content ul { 
                list-style-type: disc; 
                padding-left: 24px; 
                margin: 8px 0; 
            }
            /* Ensure highlighted colors from editor carry over */
            .play-content .text-blue-400 { color: #60a5fa; font-weight: bold; }
            .play-content .text-white { color: #e4e4e7; }
            .play-content .text-zinc-400 { color: #a1a1aa; }
            .play-content .text-purple-400 { color: #c084fc; }
        `}</style>
    </div>
  );
};

export default PlayMode;