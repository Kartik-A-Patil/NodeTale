import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  Connection, 
  Edge, 
  NodeChange, 
  EdgeChange, 
  applyNodeChanges, 
  applyEdgeChanges,
  ReactFlowProvider,
  Panel,
  BackgroundVariant,
  ReactFlowInstance,
  Node,
  reconnectEdge,
  SelectionMode,
  PanOnScrollMode
} from 'reactflow';
import SidebarLeft from './components/SidebarLeft';
import ContextMenu, { ContextMenuOption } from './components/ContextMenu';
import ElementNode from './components/nodes/ElementNode';
import ConditionNode from './components/nodes/ConditionNode';
import JumpNode from './components/nodes/JumpNode';
import CommentNode from './components/nodes/CommentNode';
import PlayMode from './components/PlayMode';
import { INITIAL_PROJECT } from './constants';
import { Project, AppNode } from './types';
import { Play, Download, PlusCircle, GitFork, ArrowRightCircle, Home, Copy, X, Trash2, Copy as CopyIcon, Edit, Pipette, MessageSquare } from 'lucide-react';

// Custom Node Types Registration
const nodeTypes = {
  elementNode: ElementNode,
  conditionNode: ConditionNode,
  jumpNode: JumpNode,
  commentNode: CommentNode,
};

function FlowApp() {
  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [jumpClipboard, setJumpClipboard] = useState<{ id: string; label: string } | null>(null);
  
  // Context Menu State
  const [menu, setMenu] = useState<{ x: number; y: number; type: 'node' | 'pane' | 'edge'; id?: string; label?: string } | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Derive active view (Board)
  const activeBoard = project.boards.find(b => b.id === project.activeBoardId);
                      
  // Fallback to first board if nothing found
  const currentView = activeBoard || project.boards[0];

  // Inject variables into nodes for highlighting
  const nodesWithContext = useMemo(() => {
    return currentView.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        variables: project.variables
      }
    }));
  }, [currentView.nodes, project.variables]);

  // Helper to update specific board state
  const updateActiveView = useCallback((updates: Partial<typeof currentView>) => {
    setProject(prev => {
      const boardIndex = prev.boards.findIndex(b => b.id === currentView.id);
      if (boardIndex !== -1) {
          const newBoards = [...prev.boards];
          newBoards[boardIndex] = { ...newBoards[boardIndex], ...updates };
          return { ...prev, boards: newBoards };
      }
      return prev;
    });
  }, [currentView.id]);

  // Helper to update a specific node's data
  const updateNodeData = useCallback((id: string, data: any) => {
    const updatedNodes = currentView.nodes.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    });
    updateActiveView({ nodes: updatedNodes });
  }, [currentView.nodes, updateActiveView]);

  // React Flow Handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, currentView.nodes);
    updateActiveView({ nodes: updatedNodes as AppNode[] });
  }, [currentView.nodes, updateActiveView]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updatedEdges = applyEdgeChanges(changes, currentView.edges);
    updateActiveView({ edges: updatedEdges });
  }, [currentView.edges, updateActiveView]);

  const onConnect = useCallback((params: Connection) => {
    const edge: Edge = { 
        ...params, 
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        animated: true,
        style: { stroke: '#71717a', strokeWidth: 2 } // Default styling
    };
    updateActiveView({ edges: addEdge(edge, currentView.edges) });
  }, [currentView.edges, updateActiveView]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    const newEdges = reconnectEdge(oldEdge, newConnection, currentView.edges);
    updateActiveView({ edges: newEdges });
  }, [currentView.edges, updateActiveView]);

  const onPaneClick = useCallback(() => {
      setMenu(null);
  }, []);

  // Context Menu Handlers
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        id: node.id,
        label: node.data.label
      });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'edge',
        id: edge.id
      });
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'pane'
      });
    },
    []
  );

  // CRUD Operations
  const addNode = (type: 'elementNode' | 'conditionNode' | 'jumpNode' | 'commentNode', position?: { x: number, y: number }, extraData?: any) => {
    const id = `node-${Date.now()}`;
    const newNode: AppNode = {
      id,
      type,
      position: position || { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { 
          label: type === 'elementNode' ? 'New Element' : type === 'conditionNode' ? 'Logic Check' : 'Jump', 
          content: '',
          condition: type === 'conditionNode' ? 'var == true' : undefined,
          text: '',
          ...extraData
      },
    };
    updateActiveView({ nodes: [...currentView.nodes, newNode] });
  };

  const deleteNode = (id: string) => {
    const updatedNodes = currentView.nodes.filter(n => n.id !== id);
    const updatedEdges = currentView.edges.filter(e => e.source !== id && e.target !== id);
    updateActiveView({ nodes: updatedNodes, edges: updatedEdges });
  };

  const deleteEdge = (id: string) => {
      const updatedEdges = currentView.edges.filter(e => e.id !== id);
      updateActiveView({ edges: updatedEdges });
  };

  const updateEdgeColor = (id: string, color: string) => {
      const updatedEdges = currentView.edges.map(e => {
          if (e.id === id) {
              return { ...e, style: { ...e.style, stroke: color } };
          }
          return e;
      });
      updateActiveView({ edges: updatedEdges });
  };

  // Drag and Drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow/type');
      const payloadStr = event.dataTransfer.getData('application/reactflow/payload');
      
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const payload = payloadStr ? JSON.parse(payloadStr) : {};
      
      const newNode: AppNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: { 
            label: payload.label || 'New Node',
            ...payload
        },
      };

      updateActiveView({ nodes: [...currentView.nodes, newNode] });
    },
    [reactFlowInstance, currentView, updateActiveView]
  );

  const exportProject = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", project.name.replace(" ", "_") + ".json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const navigateHome = () => {
      if (project.boards.length > 0) {
          setProject(p => ({ ...p, activeBoardId: p.boards[0].id }));
      }
  };

  // Generate Menu Options
  const getMenuOptions = (): ContextMenuOption[] => {
    if (!menu) return [];

    if (menu.type === 'node') {
        const node = currentView.nodes.find(n => n.id === menu.id);
        
        const options: ContextMenuOption[] = [];

        // Special options for Condition Node
        if (node && node.type === 'conditionNode') {
            options.push(
                {
                    label: 'Add Condition Case',
                    icon: <GitFork size={14} />,
                    onClick: () => {
                         const branches = node.data.branches || [];
                         const elseIdx = branches.findIndex((b: any) => b.label === 'Else');
                         const newBranch = { id: `branch-${Date.now()}`, label: 'Else If', condition: 'var == true' };
                         const newBranches = [...branches];
                         
                         // Insert before Else, or at end if no Else
                         if (elseIdx !== -1) {
                             newBranches.splice(elseIdx, 0, newBranch);
                         } else {
                             newBranches.push(newBranch);
                         }
                         updateNodeData(node.id, { branches: newBranches });
                    }
                },
                { type: 'divider' } as ContextMenuOption
            );
        }

        options.push(
            {
                label: 'Copy as Jump Target',
                icon: <CopyIcon size={14} />,
                onClick: () => setJumpClipboard({ id: menu.id!, label: menu.label || 'Untitled' })
            },
            { type: 'divider' } as ContextMenuOption,
            { label: 'Orange', color: '#f97316', onClick: () => updateNodeData(menu.id!, { color: '#f97316' }) },
            { label: 'Blue', color: '#3b82f6', onClick: () => updateNodeData(menu.id!, { color: '#3b82f6' }) },
            { label: 'Green', color: '#22c55e', onClick: () => updateNodeData(menu.id!, { color: '#22c55e' }) },
            { label: 'Purple', color: '#a855f7', onClick: () => updateNodeData(menu.id!, { color: '#a855f7' }) },
            { label: 'Red', color: '#ef4444', onClick: () => updateNodeData(menu.id!, { color: '#ef4444' }) },
            { 
                label: 'Custom Color', 
                type: 'color-picker', 
                color: '#f97316', 
                onChange: (e) => updateNodeData(menu.id!, { color: e.target.value }) 
            },
            { type: 'divider' } as ContextMenuOption,
            {
                label: 'Delete Node',
                danger: true,
                icon: <Trash2 size={14} />,
                onClick: () => deleteNode(menu.id!)
            }
        );
        return options;
    }

    if (menu.type === 'edge') {
        return [
            { label: 'Red', color: '#ef4444', onClick: () => updateEdgeColor(menu.id!, '#ef4444') },
            { label: 'Green', color: '#22c55e', onClick: () => updateEdgeColor(menu.id!, '#22c55e') },
            { label: 'Blue', color: '#3b82f6', onClick: () => updateEdgeColor(menu.id!, '#3b82f6') },
            { 
                label: 'Custom Color', 
                type: 'color-picker', 
                color: '#ffffff', 
                onChange: (e) => updateEdgeColor(menu.id!, e.target.value) 
            },
            { type: 'divider' } as ContextMenuOption,
            { label: 'Delete Connection', danger: true, icon: <Trash2 size={14}/>, onClick: () => deleteEdge(menu.id!) }
        ];
    }

    if (menu.type === 'pane') {
        const options: ContextMenuOption[] = [
             {
                label: 'Add Element',
                icon: <PlusCircle size={14} />,
                onClick: () => {
                     if (reactFlowInstance) {
                        const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
                        addNode('elementNode', position);
                    }
                }
            },
            {
                label: 'Add Comment',
                icon: <MessageSquare size={14} />,
                onClick: () => {
                     if (reactFlowInstance) {
                        const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
                        addNode('commentNode', position);
                    }
                }
            }
        ];

        if (jumpClipboard) {
            options.unshift({
                label: `Paste Jump to "${jumpClipboard.label}"`,
                icon: <ArrowRightCircle size={14} />,
                onClick: () => {
                    if (reactFlowInstance) {
                        const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
                        addNode('jumpNode', position, { 
                            jumpTargetId: jumpClipboard.id,
                            jumpTargetLabel: jumpClipboard.label
                        });
                    }
                }
            });
        }
        return options;
    }

    return [];
  };

  return (
    <div className="flex h-screen w-screen bg-[#121212] text-zinc-100 overflow-hidden font-sans">
      
      {/* Left Sidebar */}
      <SidebarLeft project={project} setProject={setProject} />

      {/* Main Canvas Area */}
      <div className="flex-1 relative flex flex-col h-full">
        
        {/* Top Toolbar */}
        <div className="h-14 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between px-4 z-10 shrink-0">
          <div className="flex items-center gap-4">
             
              <div className="flex gap-1">
                  <button onClick={() => addNode('elementNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                      <PlusCircle size={14} className="text-orange-500" /> Element
                  </button>
                  <button onClick={() => addNode('conditionNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                      <GitFork size={14} className="text-blue-500" /> Branch
                  </button>
                  <button onClick={() => addNode('jumpNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                      <ArrowRightCircle size={14} className="text-purple-500" /> Jump
                  </button>
                  <button onClick={() => addNode('commentNode')} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors border border-zinc-700">
                      <MessageSquare size={14} className="text-yellow-400" /> Comment
                  </button>
              </div>
          </div>
          <div className="flex items-center gap-2">
             {jumpClipboard && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-400 animate-in fade-in">
                      <Copy size={10} />
                      <span className="max-w-[100px] truncate">Copied: {jumpClipboard.label}</span>
                      <button onClick={() => setJumpClipboard(null)} className="hover:text-white ml-1"><X size={10}/></button>
                  </div>
              )}
              <button onClick={() => setIsPlaying(true)} className="flex items-center gap-2 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-semibold transition-colors shadow-lg shadow-orange-900/20">
                  <Play size={14} fill="currentColor" /> Play
              </button>
              <button onClick={exportProject} className="p-2 text-zinc-400 hover:text-white transition-colors">
                  <Download size={18} />
              </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#0f0f11] relative" ref={reactFlowWrapper}>
          <ReactFlow
            key={currentView.id} // Force remount when switching views
            nodes={nodesWithContext}
            edges={currentView.edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid={true}
            snapGrid={[20, 20]}
            proOptions={{ hideAttribution: true }}
            className="bg-[#0f0f11]"
            multiSelectionKeyCode={['Control', 'Meta']}
            selectionOnDrag={true}
            panOnDrag={[1, 2]} // Pan only with Middle(1) or Right(2) mouse button. Left drag selects.
            selectionMode={SelectionMode.Partial}
            panOnScroll={true}
            panOnScrollMode={PanOnScrollMode.Free}
          >
            <Background color="#52525b" gap={20} size={1} variant={BackgroundVariant.Dots} />
            <Controls className="bg-zinc-800 border-zinc-700 text-zinc-400" />
            
            
          </ReactFlow>

          {/* Context Menu */}
          {menu && (
            <ContextMenu 
                x={menu.x} 
                y={menu.y} 
                onClose={() => setMenu(null)}
                options={getMenuOptions()}
            />
          )}
        </div>
      </div>

      {/* Play Mode Overlay */}
      {isPlaying && (
          <PlayMode project={project} onClose={() => setIsPlaying(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowApp />
    </ReactFlowProvider>
  );
}