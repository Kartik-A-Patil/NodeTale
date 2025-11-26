import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  Connection, 
  Edge, 
  ReactFlowProvider,
  BackgroundVariant,
  ReactFlowInstance,
  Node,
  reconnectEdge,
  PanOnScrollMode,
  useNodesState,
  useEdgesState
} from 'reactflow';
import SidebarLeft from './components/SidebarLeft';
import ContextMenu, { ContextMenuOption } from './components/ContextMenu';
import ElementNode from './components/nodes/ElementNode';
import ConditionNode from './components/nodes/ConditionNode';
import JumpNode from './components/nodes/JumpNode';
import CommentNode from './components/nodes/CommentNode';
import PlayMode from './components/PlayMode';
import { AppNode } from './types';
import { GitFork, ArrowRightCircle, Copy as CopyIcon, Trash2, PlusCircle, MessageSquare } from 'lucide-react';
import FloatingEdge from '@/components/edge/FloatingEdge';
import { useProjectState } from './hooks/useProjectState';
import { TopToolbar } from './components/TopToolbar';

function FlowApp() {
  // Local state for React Flow performance
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { project, setProject, isInitializing, lastSaved } = useProjectState(nodes, edges, setNodes, setEdges);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [jumpClipboard, setJumpClipboard] = useState<{ id: string; label: string } | null>(null);
  
  // Context Menu State
  const [menu, setMenu] = useState<{ x: number; y: number; type: 'node' | 'pane' | 'edge'; id?: string; label?: string } | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  // Memoize nodeTypes and edgeTypes
  const nodeTypes = useMemo(() => ({
    elementNode: ElementNode,
    conditionNode: ConditionNode,
    jumpNode: JumpNode,
    commentNode: CommentNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    floating: FloatingEdge,
  }), []);

  // Cache for memoized nodes
  const nodeWrapperCache = useRef(new WeakMap<AppNode, AppNode>());

  // Inject variables into nodes for highlighting
  const nodesWithContext = useMemo(() => {
    return nodes.map(node => {
      const cached = nodeWrapperCache.current.get(node as AppNode);
      if (cached && cached.data.variables === project.variables) {
        return cached;
      }

      const newNode = {
        ...node,
        data: {
          ...node.data,
          variables: project.variables
        }
      };
      nodeWrapperCache.current.set(node as AppNode, newNode as AppNode);
      return newNode;
    });
  }, [nodes, project.variables]);

  // Helper to update a specific node's data
  const updateNodeData = useCallback((id: string, data: any) => {
    setNodes(nds => nds.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    }));
  }, [setNodes]);

  const onConnectStart = useCallback(() => {
    setIsConnecting(true);
  }, []);

  const onConnectEnd = useCallback(() => {
    setIsConnecting(false);
  }, []);

  const onConnect = useCallback((params: Connection) => {
    if (params.source === params.target) return;

    const isDuplicate = edges.some(edge => 
      (edge.source === params.source && edge.target === params.target) ||
      (edge.source === params.target && edge.target === params.source)
    );

    if (isDuplicate) return;

    const sourceNode = nodes.find(n => n.id === params.source);
    let currentEdges = edges;

    if (sourceNode?.type === 'conditionNode') {
        const existingBranchEdge = currentEdges.find(e => 
            e.source === params.source && 
            e.sourceHandle === params.sourceHandle
        );
        
        if (existingBranchEdge) {
            currentEdges = currentEdges.filter(e => e.id !== existingBranchEdge.id);
        }
    }

    const edge: Edge = { 
        ...params, 
        type: 'floating',
        id: `e-${params.source}-${params.target}-${Date.now()}`,
        animated: true,
        style: { stroke: '#71717a'}
    };
    setEdges(eds => addEdge(edge, currentEdges));
  }, [edges, nodes, setEdges]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    setEdges(eds => reconnectEdge(oldEdge, newConnection, eds));
  }, [setEdges]);

  const onPaneClick = useCallback(() => {
      setMenu(null);
  }, []);

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
      if (!edge.selected) return;
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
    setNodes(nds => [...nds, newNode]);
  };

  const deleteNode = (id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
  };

  const deleteEdge = (id: string) => {
      setEdges(eds => eds.filter(e => e.id !== id));
  };

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      deleteEdge(edge.id);
  }, []);

  const updateEdgeColor = (id: string, color: string) => {
      setEdges(eds => eds.map(e => {
          if (e.id === id) {
              return { ...e, style: { ...e.style, stroke: color } };
          }
          return e;
      }));
  };

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

      setNodes(nds => [...nds, newNode]);
    },
    [reactFlowInstance]
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

  const getMenuOptions = (): ContextMenuOption[] => {
    if (!menu) return [];

    if (menu.type === 'node') {
        const node = nodes.find(n => n.id === menu.id);
        
        const options: ContextMenuOption[] = [];

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

  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-400 flex-col gap-4">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p>Loading Project...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#121212] text-zinc-100 overflow-hidden font-sans">
      
      <SidebarLeft project={project} setProject={setProject} />

      <div className={`flex-1 relative flex flex-col h-full ${isConnecting ? 'is-connecting' : ''}`}>
        
        <TopToolbar 
            onAddNode={(type) => addNode(type)}
            onPlay={() => setIsPlaying(true)}
            onExport={exportProject}
            lastSaved={lastSaved}
            jumpClipboard={jumpClipboard}
            setJumpClipboard={setJumpClipboard}
        />

        <div className="flex-1 bg-[#0f0f11] relative" ref={reactFlowWrapper}>
          <ReactFlow
            key={project.activeBoardId}
            nodes={nodesWithContext}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onReconnect={onReconnect}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            edgeTypes={edgeTypes}
            snapToGrid={true}
            snapGrid={[20, 20]}
            proOptions={{ hideAttribution: true }}
            className="bg-[#0f0f11]"
            multiSelectionKeyCode={['Control', 'Meta']}
            selectionOnDrag={false}
            panOnDrag={[1, 2]}
            panOnScroll={true}
            panOnScrollMode={PanOnScrollMode.Free}
            connectionRadius={30}
          >
            <Background color="#52525b" gap={20} size={1} variant={BackgroundVariant.Dots} />
            <Controls className="bg-zinc-800 border-zinc-700 text-zinc-400" />
          </ReactFlow>

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

      {isPlaying && (
          <PlayMode project={project} onClose={() => setIsPlaying(false)} />
      )}
      <style>{`
        .is-connecting .react-flow__handle-source {
            pointer-events: none !important;
            opacity: 0 !important;
        }
        .is-connecting .react-flow__handle-target {
            opacity: 0.4 !important;
            background-color: #3b82f6 !important;
            transition: all 0.2s ease;
            z-index: 100 !important;
        }
      `}</style>
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