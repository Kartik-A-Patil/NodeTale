import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, { 
  Background, 
  Controls, 
  ControlButton,
  ReactFlowProvider,
  BackgroundVariant,
  ReactFlowInstance,
  PanOnScrollMode,
  useReactFlow,
  useStore,
} from 'reactflow';
import { Hand, MousePointer2, Plus, Minus, Maximize } from 'lucide-react';
import SidebarLeft from './SidebarLeft';
import ContextMenu from './ContextMenu';
import { AssetSelectorModal } from './modals/AssetSelectorModal';
import { TopToolbar } from './TopToolbar';
import { ViewMode, VIEW_MODES } from './views/viewModes';
import { useFlowLogic } from '../hooks/useFlowLogic';
import { useContextMenu } from '../hooks/useContextMenu';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useMenuOptions } from '../hooks/useMenuOptions';
import { deleteElementsCommand } from '../editor/commands/deleteElementsCommand';
import { exportProject } from '../utils/projectUtils';
import { nodeTypes as initialNodeTypes, edgeTypes as initialEdgeTypes } from './flowConfig';
import { EditorAction } from '../editor/shortcuts/types';
import { AppNode, Asset } from '../types';
import { useShortcuts } from '../editor/shortcuts/useShortcuts';
import { CommandPalette } from './CommandPalette';
import { EditorContext } from '../editor/EditorContext';
import { markProjectOpened } from '../utils/localPrefs';

// memo: rendered inside ReactFlow, which re-renders with the editor on every drag frame.
const CustomControls = React.memo(({ isPanMode, setIsPanMode }: { isPanMode: boolean, setIsPanMode: (v: boolean) => void }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  // Only the zoom level is shown; useViewport() also changes on every pan frame.
  const zoomPercent = useStore((s) => Math.round(s.transform[2] * 100));

  return (
    <Controls 
      position="bottom-left" 
      showZoom={false} 
      showFitView={false} 
      showInteractive={false}
      className="!flex !flex-row !gap-2 !bg-transparent !border-none !shadow-none !items-center"
    >
       <ControlButton onClick={() => zoomOut({ duration: 300 })} className="!w-9 !h-9 !bg-zinc-800 !border !border-zinc-700 !text-zinc-400 hover:!text-zinc-100 !rounded-md !shadow-sm !flex !items-center !justify-center !p-0" title="Zoom Out">
        <Minus size={18} />
      </ControlButton>
      
      <div className="flex items-center justify-center w-14 h-9 text-xs font-medium text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-md shadow-sm select-none">
        {zoomPercent}%
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
});

// Loaded on demand: play mode isn't needed until the author presses Play, and
// the story views (with d3) until one is opened.
const PlayMode = React.lazy(() => import('./PlayMode'));
const StoryViews = React.lazy(() => import('./views/StoryViews'));

function ProjectEditor() {
  const { projectId } = useParams();
  const [viewMode, setViewModeState] = useState<ViewMode>('flow');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playStartNodeId, setPlayStartNodeId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [showAssetSelectorModal, setShowAssetSelectorModal] = useState(false);
  const [selectedNodeForAsset, setSelectedNodeForAsset] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => initialNodeTypes, []);
  const edgeTypes = useMemo(() => initialEdgeTypes, []);

  const sizeRefreshDone = React.useRef(false);

  const {
    nodes,
    edges,
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
    updateEdge,
    updateEdgeData,
    updateEdgeColor,
    updateEdgeLabel,
    project,
    setProject,
    isInitializing,
    lastSaved,
    saveNow,
    getLiveProject,
    copySelected,
    pasteClipboard,
    jumpClipboard,
    setJumpClipboard,
    undo,
    redo,
    canUndo,
    canRedo,
    onNodeDragStart,
    dragStartRef,
    ctx,
    executeCommand
  } = useFlowLogic(projectId);

  // Keyed on the selected ids, not `nodes`: a drag changes `nodes` every frame,
  // and a fresh array here would rebuild editorActions (re-binding the global
  // keydown listener) and the context-menu callbacks on every frame.
  // For the dashboard's "Recently opened" sort (per device).
  React.useEffect(() => {
    if (!isInitializing && project.id) markProjectOpened(project.id);
  }, [isInitializing, project.id]);

  const selectedKey = nodes.filter(n => n.selected).map(n => n.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedNodes = useMemo(() => nodes.filter(n => n.selected), [selectedKey]);

  // The hooks' callbacks are already stable; pass them through directly. (Wrapping
  // them in useCallback keyed on the hooks' return objects — new every render —
  // changed their identity each render, and ReactFlow hands onEdgeContextMenu to
  // every edge, so every edge re-rendered whenever the editor did.)
  const { menu, setMenu, onNodeContextMenu, onEdgeContextMenu: openEdgeMenu, onPaneContextMenu, onPaneClick } = useContextMenu(selectedNodes);
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: any) => {
    openEdgeMenu(event, edge);
    setEdges((eds) => eds.map((e) => e.id === edge.id ? { ...e, selected: false } : e));
  }, [openEdgeMenu, setEdges]);

  const { onDragOver, onNodeDragStop, onDrop } = useDragAndDrop(
    nodes,
    ctx,
    reactFlowInstance,
    reactFlowWrapper,
    executeCommand,
    dragStartRef
  );

  const editorContext = useMemo(
    () => ({ variables: project.variables, assets: project.assets, updateNodeData, updateNode, updateEdge }),
    [project.variables, project.assets, updateNodeData, updateNode, updateEdge]
  );

  const onToolbarAddNode = useCallback((type: Parameters<typeof addNode>[0]) => addNode(type), [addNode]);
  const onToolbarPlay = useCallback(() => { setPlayStartNodeId(null); setIsPlaying(true); }, []);
  const onToolbarExport = useCallback(() => exportProject(getLiveProject()), [getLiveProject]);

  const startPlayFromNode = React.useCallback((nodeId: string) => {
      setPlayStartNodeId(nodeId);
      setIsPlaying(true);
  }, []);

  // Snapshot of the live canvas taken when Play starts.
  const playProject = useMemo(() => (isPlaying ? getLiveProject() : null), [isPlaying, getLiveProject]);

  // From the live canvas, not project.boards (which lags until autosave).
  const canPlay = nodes.some(n => typeof n.data?.label === 'string' && n.data.label.toLowerCase() === 'start');

  // Every editor action — keyboard shortcut and/or command palette entry.
  // Migrated from a single scattered keydown handler (Phase 8): one list drives
  // both, so there's one place that knows the full shortcut/action surface.
  const cutSelected = React.useCallback(() => {
    if (selectedNodes.length === 0) return;
    copySelected();
    executeCommand(deleteElementsCommand(ctx, selectedNodes.map(n => n.id)));
  }, [selectedNodes, copySelected, executeCommand, ctx]);

  const selectAll = React.useCallback(() => {
    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
    setEdges(eds => eds.map(e => ({ ...e, selected: true })));
  }, [setNodes, setEdges]);

  const deselectAll = React.useCallback(() => {
    setNodes(nds => nds.map(n => (n.selected ? { ...n, selected: false } : n)));
    setEdges(eds => eds.map(e => (e.selected ? { ...e, selected: false } : e)));
  }, [setNodes, setEdges]);

  // Leaving Flow unmounts the canvas; dropping the instance means focusNode's
  // effect waits for the fresh one (onInit) instead of using a dead viewport.
  // When a story view opens a node, the canvas mounts centred on that node, so
  // its usual fit-everything-on-mount must not run (it would win the race).
  const [focusOnMount, setFocusOnMount] = useState(false);
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState((prev) => {
      if (prev === 'flow' && mode !== 'flow') {
        setReactFlowInstance(null);
        setFocusOnMount(false);
      }
      return mode;
    });
  }, []);

  // Story views read the live canvas (the active board's nodes/edges), not
  // project.boards, which only catches up on autosave.
  const viewProject = useMemo(
    () => (viewMode === 'flow' ? null : {
      ...project,
      boards: project.boards.map((b) => (b.id === project.activeBoardId ? { ...b, nodes: nodes as AppNode[], edges } : b)),
    }),
    [viewMode, project, nodes, edges]
  );

  // Open a node on the canvas from a story view: switch board if needed, back
  // to Flow, then select + centre it once the canvas and node are ready.
  const pendingFocusRef = useRef<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusNode = useCallback((nodeId: string) => {
    const live = getLiveProject();
    const board = live.boards.find((b) => b.nodes.some((n) => n.id === nodeId));
    pendingFocusRef.current = nodeId;
    setFocusOnMount(true);
    if (board && board.id !== live.activeBoardId) setProject((p) => ({ ...p, activeBoardId: board.id }));
    setViewMode('flow');
  }, [getLiveProject, setProject, setViewMode]);

  React.useEffect(() => {
    const id = pendingFocusRef.current;
    if (!id || viewMode !== 'flow' || !reactFlowInstance || !nodes.some((n) => n.id === id)) return;
    pendingFocusRef.current = null;
    setNodes((nds) => nds.map((n) => (n.selected || n.id === id ? { ...n, selected: n.id === id } : n)));
    // Give ReactFlow a frame to measure the freshly mounted nodes. A node
    // outside the viewport was never rendered (culling), so it has no size and
    // fitView would ignore it: centre on its stored position instead.
    const timer = setTimeout(() => {
      const node = reactFlowInstance.getNode(id);
      if (node?.width && node.height) {
        reactFlowInstance.fitView({ nodes: [{ id }], duration: 400, padding: 0.5, maxZoom: 1.5 });
      } else if (node) {
        const at = node.positionAbsolute ?? node.position;
        reactFlowInstance.setCenter(at.x + 125, at.y + 75, { zoom: 1.1, duration: 400 });
      }
    }, 60);
    // Not cleared on re-run: selecting the node above changes `nodes`, which
    // re-runs this effect and would cancel the centring before it happens.
    focusTimerRef.current = timer;
  }, [viewMode, reactFlowInstance, nodes, setNodes]);
  React.useEffect(() => () => clearTimeout(focusTimerRef.current), []);

  const editorActions: EditorAction[] = useMemo(() => [
    { id: 'undo', label: 'Undo', category: 'Edit', keys: { key: 'z', ctrlOrCmd: true }, run: undo, enabled: canUndo },
    { id: 'redo', label: 'Redo', category: 'Edit', keys: [{ key: 'z', ctrlOrCmd: true, shift: true }, { key: 'y', ctrlOrCmd: true }], run: redo, enabled: canRedo },
    { id: 'delete', label: 'Delete Selected', category: 'Edit', keys: { key: 'Delete' }, run: () => executeCommand(deleteElementsCommand(ctx, selectedNodes.map(n => n.id))), enabled: selectedNodes.length > 0 },
    { id: 'save', label: 'Save', category: 'File', keys: { key: 's', ctrlOrCmd: true }, run: saveNow },
    { id: 'copy', label: 'Copy', category: 'Edit', keys: { key: 'c', ctrlOrCmd: true }, run: copySelected, enabled: selectedNodes.length > 0 },
    { id: 'cut', label: 'Cut', category: 'Edit', keys: { key: 'x', ctrlOrCmd: true }, run: cutSelected, enabled: selectedNodes.length > 0 },
    { id: 'paste', label: 'Paste', category: 'Edit', keys: { key: 'v', ctrlOrCmd: true }, run: pasteClipboard },
    { id: 'select-all', label: 'Select All', category: 'Edit', keys: { key: 'a', ctrlOrCmd: true }, run: selectAll },
    { id: 'deselect', label: 'Deselect', category: 'Edit', keys: { key: 'Escape' }, run: deselectAll },
    { id: 'validate', label: 'Validate Project', category: 'File', run: () => window.dispatchEvent(new CustomEvent('nodetale:show-problems')) },
    { id: 'play', label: 'Run Story', category: 'Story', run: () => { setPlayStartNodeId(null); setIsPlaying(true); }, enabled: canPlay },
    { id: 'export', label: 'Export Project', category: 'File', run: onToolbarExport },
    ...VIEW_MODES.map((v, i) => ({ id: `view-${v.id}`, label: `View: ${v.label}`, category: 'View' as const, keys: { key: String(i + 1), alt: true }, run: () => setViewMode(v.id) })),
  ], [undo, redo, canUndo, canRedo, selectedNodes, ctx, executeCommand, saveNow, copySelected, cutSelected, pasteClipboard, selectAll, deselectAll, canPlay, onToolbarExport, setViewMode]);

  useShortcuts(editorActions);

  // Command palette: Ctrl/Cmd+K, standard convention (VSCode/Notion/Linear).
  React.useEffect(() => {
    const handleOpenPalette = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };
    document.addEventListener('keydown', handleOpenPalette);
    return () => document.removeEventListener('keydown', handleOpenPalette);
  }, []);

  const getMenuOptions = useMenuOptions({
      menu,
      nodes,
      edges,
      updateNodeData,
      deleteNode,
      setJumpClipboard,
      jumpClipboard,
      updateEdgeLabel,
      updateEdgeColor,
      updateEdgeData,
      deleteEdge,
      addNode,
      assets: project.assets,
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

  // One-time size refresh right after a project/board load to avoid user interaction requirement
  React.useEffect(() => {
    if (!reactFlowInstance || isInitializing || sizeRefreshDone.current) return;
    const updater = (reactFlowInstance as any).updateNodeInternals;
    if (typeof updater !== 'function') return;

    // Defer to next frame so React Flow has mounted DOM nodes
    const id = requestAnimationFrame(() => {
      nodes.forEach((n) => {
        const hasSize = typeof n.width === 'number' || typeof n.height === 'number' || typeof (n as any)?.style?.width === 'number' || typeof (n as any)?.style?.height === 'number';
        if (hasSize) updater(n.id);
      });
      sizeRefreshDone.current = true;
    });

    return () => cancelAnimationFrame(id);
  }, [reactFlowInstance, isInitializing, nodes]);

  // Reset the one-time refresh when switching boards/projects
  React.useEffect(() => {
    sizeRefreshDone.current = false;
  }, [project.activeBoardId, project.id]);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#121212] text-zinc-400 flex-col gap-4">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p>Loading Project...</p>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={editorContext}>
    <div className="flex h-screen w-screen bg-[#121212] text-zinc-100 overflow-clip">
      
      <SidebarLeft project={project} setProject={setProject} />

      <div className={`flex-1 min-w-0 relative flex flex-col h-full ${isConnecting ? 'is-connecting' : ''}`}>
        
        <TopToolbar 
            onAddNode={onToolbarAddNode}
            onPlay={onToolbarPlay}
            onExport={onToolbarExport}
            lastSaved={lastSaved}
          onSave={saveNow}
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
            nodes={nodes}
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
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView={!focusOnMount}
            edgeTypes={edgeTypes}
            proOptions={{ hideAttribution: true }}
            className="bg-[#0f0f11]"
            multiSelectionKeyCode={['Control', 'Meta']}
            selectionOnDrag={!isPanMode}
            panOnDrag={isPanMode ? [0, 1, 2] : [1, 2]}
            panOnScroll={true}
            panOnScrollMode={PanOnScrollMode.Free}
            connectionRadius={40}
            elevateNodesOnSelect={false}
            onlyRenderVisibleElements
          >
            <Background color="#52525b" gap={20} size={1} variant={BackgroundVariant.Dots} />
            <CustomControls isPanMode={isPanMode} setIsPanMode={setIsPanMode} />
          </ReactFlow>
          ) : (
            <React.Suspense fallback={null}>
              <StoryViews mode={viewMode} project={viewProject!} onFocusNode={focusNode} onUpdateProject={setProject} />
            </React.Suspense>
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
          <React.Suspense fallback={null}>
            <PlayMode project={playProject!} startNodeId={playStartNodeId} onClose={() => { setIsPlaying(false); setPlayStartNodeId(null); }} />
          </React.Suspense>
      )}

      <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          actions={editorActions}
      />

      {showAssetSelectorModal && selectedNodeForAsset && (
          <AssetSelectorModal
              project={project}
              currentAssets={nodes.find(n => n.id === selectedNodeForAsset)?.data.assets || []}
              onSelect={(asset) => {
                  const node = nodes.find(n => n.id === selectedNodeForAsset);
                  if (node) {
                      const currentAssets: string[] = node.data.assets || [];
                      const projectAssets = project.assets;
                      const nodeAssets = currentAssets
                        .map((id) => projectAssets.find((a) => a.id === id))
                        .filter((a): a is Asset => a !== undefined);
                      
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
    </div>
    </EditorContext.Provider>
  );
}

export default function ProjectEditorRoute() {
  return (
    <ReactFlowProvider>
      <ProjectEditor />
    </ReactFlowProvider>
  );
}
