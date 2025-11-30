import React, { useState, useRef, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  ControlButton,
  ReactFlowProvider,
  BackgroundVariant,
  ReactFlowInstance,
  PanOnScrollMode,
  useReactFlow,
  useViewport,
} from 'reactflow';
import { Hand, MousePointer2, Plus, Minus, Maximize } from 'lucide-react';
import SidebarLeft from './components/SidebarLeft';
import ContextMenu from './components/ContextMenu';
import PlayMode from './components/PlayMode';
import { AssetSelectorModal } from './components/AssetSelectorModal';
import { TopToolbar } from './components/TopToolbar';
import { TimelineView } from './components/TimelineView';
import { useFlowLogic } from './hooks/useFlowLogic';
import { useContextMenu } from './hooks/useContextMenu';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useMenuOptions } from './hooks/useMenuOptions';
import { exportProject } from './utils/projectUtils';
import { nodeTypes as initialNodeTypes, edgeTypes as initialEdgeTypes } from './components/flowConfig';

const CustomControls = ({ isPanMode, setIsPanMode }: { isPanMode: boolean, setIsPanMode: (v: boolean) => void }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <Controls 
      position="bottom-left" 
      orientation="horizontal" 
      showZoom={false} 
      showFitView={false} 
      showInteractive={false}
      className="!flex !flex-row !gap-2 !bg-transparent !border-none !shadow-none !items-center"
    >
       <ControlButton onClick={() => zoomOut({ duration: 300 })} className="!w-9 !h-9 !bg-zinc-800 !border !border-zinc-700 !text-zinc-400 hover:!text-zinc-100 !rounded-md !shadow-sm !flex !items-center !justify-center !p-0" title="Zoom Out">
        <Minus size={18} />
      </ControlButton>
      
      <div className="flex items-center justify-center w-14 h-9 text-xs font-medium text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-md shadow-sm select-none">
        {Math.round(zoom * 100)}%
      </div>

      <ControlButton onClick={() => zoomIn({ duration: 300 })} className="!w-9 !h-9 !bg-zinc-800 !border !border-zinc-700 !text-zinc-400 hover:!text-zinc-100 !rounded-md !shadow-sm !flex !items-center !justify-center !p-0" title="Zoom In">
        <Plus size={18} />
      </ControlButton>

      <ControlButton onClick={() => fitView({ duration: 300 })} className="!w-9 !h-9 !bg-zinc-800 !border !border-zinc-700 !text-zinc-400 hover:!text-zinc-100 !rounded-md !shadow-sm !flex !items-center !justify-center !p-0" title="Fit View">
        <Maximize size={18} />
      </ControlButton>

      <ControlButton onClick={() => setIsPanMode(!isPanMode)} className="!w-9 !h-9 !bg-zinc-800 !border !border-zinc-700 !text-zinc-400 hover:!text-zinc-100 !rounded-md !shadow-sm !flex !items-center !justify-center !p-0" title={isPanMode ? "Switch to Selection Mode" : "Switch to Pan Mode"}>
        {isPanMode ? <MousePointer2 size={18} /> : <Hand size={18} />}
      </ControlButton>
    </Controls>
  );
};

function FlowApp() {
  const [viewMode, setViewMode] = useState<'flow' | 'timeline'>('flow');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playStartNodeId, setPlayStartNodeId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [showAssetSelectorModal, setShowAssetSelectorModal] = useState(false);
  const [selectedNodeForAsset, setSelectedNodeForAsset] = useState<string | null>(null);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => initialNodeTypes, []);
  const edgeTypes = useMemo(() => initialEdgeTypes, []);

  const {
    nodes,
    edges,
    nodesWithContext,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    addNode,
    deleteNode,
    deleteEdge,
    updateNodeData,
    updateNode,
    updateEdgeData,
    updateEdgeColor,
    updateEdgeLabel,
    project,
    setProject,
    isInitializing,
    lastSaved,
    jumpClipboard,
    setJumpClipboard,
    undo,
    redo,
    canUndo,
    canRedo,
    onNodeDragStart,
    takeSnapshot
  } = useFlowLogic();

  const selectedNodes = React.useMemo(() => nodes.filter(n => n.selected), [nodes]);

  const {
    menu,
    setMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    onPaneContextMenu,
    onPaneClick
  } = useContextMenu(selectedNodes);

  const { onDragOver, onNodeDragStop, onDrop } = useDragAndDrop(
      nodes,
      setNodes,
      reactFlowInstance,
      reactFlowWrapper,
      takeSnapshot
  );

  const addAsset = React.useCallback((asset: any) => {
      setProject(prev => ({
          ...prev,
          assets: [...prev.assets, asset]
      }));
  }, [setProject]);

  const startPlayFromNode = React.useCallback((nodeId: string) => {
      setPlayStartNodeId(nodeId);
      setIsPlaying(true);
  }, []);

  const canPlay = React.useMemo(() => {
      const board = project.boards.find(b => b.id === project.activeBoardId) || project.boards[0];
      return board && board.nodes.some(n => n.data.label.toLowerCase() === 'start');
  }, [project.boards, project.activeBoardId]);

  // Keyboard shortcuts
  React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Ignore if input or textarea is focused
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          return;
        }

        // Undo / Redo
        if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          event.preventDefault();
          return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'y') {
          redo();
          event.preventDefault();
          return;
        }

        // Delete / Backspace: remove selected node(s)
        if (event.key === 'Delete') {
          if (selectedNodes.length > 0) {
            const idsToDelete = selectedNodes.map(n => n.id);
            // Create a single snapshot for the batch delete and remove nodes + connected edges
            takeSnapshot();
            setNodes((nds) => nds.filter(n => !idsToDelete.includes(n.id)));
            setEdges((eds) => eds.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));
            event.preventDefault();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, selectedNodes, setNodes, setEdges, takeSnapshot]);

  const getMenuOptions = useMenuOptions({
      menu,
      nodes,
      edges,
      updateNodeData,
      updateNode,
      deleteNode,
      setJumpClipboard,
      jumpClipboard,
      updateEdgeLabel,
      updateEdgeColor,
      updateEdgeData,
      deleteEdge,
      addNode,
      addAsset,
      setShowAssetSelectorModal,
      setSelectedNodeForAsset,
      reactFlowInstance,
      startPlayFromNode
  });

  const onConnectStart = React.useCallback(() => {
    setIsConnecting(true);
  }, []);

  const onConnectEnd = React.useCallback(() => {
    setIsConnecting(false);
  }, []);

  const onEdgeDoubleClick = React.useCallback((event: React.MouseEvent, edge: any) => {
      event.stopPropagation();
      deleteEdge(edge.id);
  }, [deleteEdge]);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-400 flex-col gap-4">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p>Loading Project...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#121212] text-zinc-100 overflow-hidden">
      
      <SidebarLeft project={project} setProject={setProject} />

      <div className={`flex-1 relative flex flex-col h-full ${isConnecting ? 'is-connecting' : ''}`}>
        
        <TopToolbar 
            onAddNode={(type) => addNode(type)}
            onPlay={() => { setPlayStartNodeId(null); setIsPlaying(true); }}
            onExport={() => exportProject(project)}
            lastSaved={lastSaved}
            jumpClipboard={jumpClipboard}
            setJumpClipboard={setJumpClipboard}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            canPlay={canPlay}
        />

        <div className="flex-1 bg-[#0f0f11] relative" ref={reactFlowWrapper}>
          {viewMode === 'flow' ? (
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
            onNodeDragStop={onNodeDragStop}
            onNodeDragStart={onNodeDragStart}
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
            proOptions={{ hideAttribution: true }}
            className="bg-[#0f0f11]"
            multiSelectionKeyCode={['Control', 'Meta']}
            selectionOnDrag={!isPanMode}
            panOnDrag={isPanMode ? [0, 1, 2] : [1, 2]}
            panOnScroll={true}
            panOnScrollMode={PanOnScrollMode.Free}
            connectionRadius={30}
            elevateNodesOnSelect={false}
          >
            <Background color="#52525b" gap={20} size={1} variant={BackgroundVariant.Dots} />
            <CustomControls isPanMode={isPanMode} setIsPanMode={setIsPanMode} />
          </ReactFlow>
          ) : (
            <TimelineView nodes={nodesWithContext} />
          )}

          {menu && viewMode === 'flow' && (
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
          <PlayMode project={project} startNodeId={playStartNodeId} onClose={() => { setIsPlaying(false); setPlayStartNodeId(null); }} />
      )}

      {showAssetSelectorModal && selectedNodeForAsset && (
          <AssetSelectorModal
              project={project}
              currentAssets={nodes.find(n => n.id === selectedNodeForAsset)?.data.assets || []}
              onSelect={(asset) => {
                  const node = nodes.find(n => n.id === selectedNodeForAsset);
                  if (node) {
                      const currentAssets = node.data.assets || [];
                      const projectAssets = project.assets;
                      const nodeAssets = currentAssets.map(id => projectAssets.find(a => a.id === id)).filter(Boolean);
                      
                      // Check if asset already exists
                      if (currentAssets.includes(asset.id)) return;
                      
                      // Check if adding a visual asset and there's already one
                      const isVisual = asset.type === 'image' || asset.type === 'video';
                      const hasVisual = nodeAssets.some(a => a.type === 'image' || a.type === 'video');
                      if (isVisual && hasVisual) return;
                      
                      updateNode(selectedNodeForAsset, {
                          style: { ...node.style, height: undefined },
                          data: { ...node.data, assets: [...currentAssets, asset.id] }
                      });
                  }
                  setShowAssetSelectorModal(false);
                  setSelectedNodeForAsset(null);
              }}
              onClose={() => {
                  setShowAssetSelectorModal(false);
                  setSelectedNodeForAsset(null);
              }}
          />
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
        .react-flow__nodesselection-rect {
            display: none !important;
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
