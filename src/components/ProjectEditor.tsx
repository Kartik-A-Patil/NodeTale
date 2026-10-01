import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
  ReactFlowInstance,
  PanOnScrollMode,
  Node,
} from 'reactflow';
import ContextMenu from './ContextMenu';
import { AssetSelectorModal } from './modals/AssetSelectorModal';
import { ExportProjectModal } from './modals/ExportProjectModal';
import { HelpModal } from './modals/HelpModal';
import { ViewMode, VIEW_MODES } from './views/viewModes';
import { EditorTopBar, PanelId } from './editor/EditorTopBar';
import { SidePanel } from './editor/SidePanel';
import { BoardDock } from './editor/BoardDock';
import { useFlowLogic } from '../hooks/useFlowLogic';
import { useResolvedEdgeLabels } from '../hooks/useResolvedEdgeLabels';
import { useContextMenu } from '../hooks/useContextMenu';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useMenuOptions } from '../hooks/useMenuOptions';
import { deleteElementsCommand } from '../editor/commands/deleteElementsCommand';
import { moveNodesCommand, NodeMove } from '../editor/commands/moveNodeCommand';
import { nodeTypes as initialNodeTypes, edgeTypes as initialEdgeTypes } from './flowConfig';
import { EditorAction, ShortcutKeys } from '../editor/shortcuts/types';
import { KEYS } from '../editor/shortcuts/keymap';
import { requestNodeEdit } from './nodes/nodeChrome';
import { Board, Project } from '../models/story';
import { useShortcuts } from '../editor/shortcuts/useShortcuts';
import { CommandPalette } from './CommandPalette';
import { EditorContext } from '../editor/EditorContext';
import { useNodeStatusStore } from '../editor/nodeStatusStore';
import { markProjectOpened, useLocalPref } from '../utils/localPrefs';
import { validateProject } from '../core/validation/Validator';
import { autoArrange, align, distribute, AlignMode, Box, Positions } from '../core/layout/arrange';
import { NodeTypeKey } from '../core/nodes/nodeRegistry';
import { createId } from '../utils/id';
import { withAttachedAsset } from '../utils/nodeAssets';
import { CanvasNode, toStoryEdge, toStoryNode } from '../adapters/reactFlow';

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
  const navigate = useNavigate();
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [exporting, setExporting] = useState<Project | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [minimap, setMinimap] = useLocalPref('nodetale:board:minimap', false);
  const [snap, setSnap] = useLocalPref('nodetale:board:snap', false);
  const [locked, setLocked] = useState(false);

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
    hasClipboard,
    duplicateNodes,
    addConnectedScene,
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

  // A choice into a condition/jump node shows what the player actually lands
  // on, not that logic node's own name — see resolvedEdgeLabels. Only these
  // wrapped edges (not the real `edges`) go to the canvas and the edge menu.
  const edgesForCanvas = useResolvedEdgeLabels(nodes, edges, project);

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

  const nodeStatus = useNodeStatusStore(nodes, edges, getLiveProject, project.boards);
  const editorContext = useMemo(
    () => ({ variables: project.variables, assets: project.assets, updateNodeData, updateNode, updateEdge, nodeStatus }),
    [project.variables, project.assets, updateNodeData, updateNode, updateEdge, nodeStatus]
  );

  const onToolbarPlay = useCallback(() => { setPlayStartNodeId(null); setIsPlaying(true); }, []);
  // The single export: a dialog with the formats, fed the live canvas.
  const onToolbarExport = useCallback(() => setExporting(getLiveProject()), [getLiveProject]);

  const startPlayFromNode = React.useCallback((nodeId: string) => {
      setPlayStartNodeId(nodeId);
      setIsPlaying(true);
  }, []);

  // Snapshot of the live canvas taken when Play starts.
  const playProject = useMemo(() => (isPlaying ? getLiveProject() : null), [isPlaying, getLiveProject]);

  // From the live canvas, not project.boards (which lags until autosave).
  const canPlay = nodes.some(n => typeof n.data?.label === 'string' && n.data.label.toLowerCase() === 'start');
  const startId = nodes.find(n => typeof n.data?.label === 'string' && n.data.label.toLowerCase() === 'start')?.id ?? null;

  // Problems for the active board (the Problems panel and its badge).
  const diagnostics = useMemo(() => validateProject(project, { boardIds: [project.activeBoardId] }), [project]);

  // The command palette's "Validate Project" action opens the Problems panel.
  React.useEffect(() => {
    const show = () => setPanel('problems');
    window.addEventListener('nodetale:show-problems', show);
    return () => window.removeEventListener('nodetale:show-problems', show);
  }, []);

  const switchBoard = useCallback((id: string) => setProject((p) => ({ ...p, activeBoardId: id })), [setProject]);
  const addBoard = useCallback(() => {
    const board: Board = { id: createId('board'), name: 'New board', nodes: [], edges: [] };
    setProject((p) => ({ ...p, boards: [...p.boards, board], activeBoardId: board.id }));
  }, [setProject]);

  /** Add a node in the middle of what's on screen. */
  const addAtCenter = useCallback((type: NodeTypeKey) => {
    const box = reactFlowWrapper.current?.getBoundingClientRect();
    if (!reactFlowInstance || !box) return addNode(type);
    const center = reactFlowInstance.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    addNode(type, { x: center.x - 125, y: center.y - 60 });
  }, [reactFlowInstance, addNode]);

  // ---------- arrange / align ----------
  const FLOW_TYPES = useMemo(() => new Set(['elementNode', 'conditionNode', 'jumpNode']), []);
  const boxOf = (n: Node): Box => ({
    id: n.id, x: n.position.x, y: n.position.y,
    width: n.width ?? (typeof n.style?.width === 'number' ? n.style.width : 250),
    height: n.height ?? (typeof n.style?.height === 'number' ? n.style.height : 150),
  });
  const applyPositions = useCallback((positions: Positions) => {
    const moves: NodeMove[] = [];
    for (const n of nodes) {
      const to = positions.get(n.id);
      if (!to || (to.x === n.position.x && to.y === n.position.y)) continue;
      const extent = (n as CanvasNode & { extent?: NodeMove['from']['extent'] }).extent;
      moves.push({ id: n.id, from: { position: n.position, parentNode: n.parentNode, extent }, to: { position: to, parentNode: n.parentNode, extent } });
    }
    if (moves.length) executeCommand(moveNodesCommand(ctx, moves));
  }, [nodes, executeCommand, ctx]);

  // Only nodes that share a coordinate space (same parent section) move together.
  const selectionBoxes = () => {
    const sel = nodes.filter((n) => n.selected);
    const parent = sel[0]?.parentNode;
    return sel.filter((n) => n.parentNode === parent).map(boxOf);
  };
  const arrange = (scope: 'board' | 'selection') => {
    const boxes = scope === 'selection' ? selectionBoxes() : nodes.filter((n) => FLOW_TYPES.has(n.type ?? '') && !n.parentNode).map(boxOf);
    applyPositions(autoArrange(boxes, edges, startId));
    if (scope === 'board') requestAnimationFrame(() => reactFlowInstance?.fitView({ duration: 300, padding: 0.15 }));
  };
  const arrangeRef = useRef(arrange);
  arrangeRef.current = arrange;
  const tidyBoard = useCallback(() => arrangeRef.current('board'), []);
  const alignSelection = (mode: AlignMode) => applyPositions(align(selectionBoxes(), mode));
  const distributeSelection = (axis: 'horizontal' | 'vertical') => applyPositions(distribute(selectionBoxes(), axis));

  const findable = useMemo(
    () => nodes.filter((n) => n.type !== 'sectionNode').map((n) => ({ id: n.id, label: String(n.data?.label || n.data?.text || 'Untitled'), content: n.data?.content ?? n.data?.text })),
    [nodes]
  );

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
      boards: project.boards.map((b) => (b.id === project.activeBoardId ? {
        ...b,
        nodes: nodes.map(n => toStoryNode(n as CanvasNode)),
        edges: edges.map(toStoryEdge),
      } : b)),
    }),
    [viewMode, project, nodes, edges]
  );

  // Open a node on the canvas from a story view: switch board if needed, back
  // to Flow, then select + centre it once the canvas and node are ready.
  // State, not a ref: focusing a node that's already on the open board (Find)
  // changes nothing else, and the effect below must still run.
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusNode = useCallback((nodeId: string) => {
    const live = getLiveProject();
    const board = live.boards.find((b) => b.nodes.some((n) => n.id === nodeId));
    setPendingFocus(nodeId);
    setFocusOnMount(true);
    if (board && board.id !== live.activeBoardId) setProject((p) => ({ ...p, activeBoardId: board.id }));
    setViewMode('flow');
  }, [getLiveProject, setProject, setViewMode]);

  React.useEffect(() => {
    const id = pendingFocus;
    if (!id || viewMode !== 'flow' || !reactFlowInstance || !nodes.some((n) => n.id === id)) return;
    setPendingFocus(null);
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
  }, [pendingFocus, viewMode, reactFlowInstance, nodes, setNodes]);
  React.useEffect(() => () => clearTimeout(focusTimerRef.current), []);

  const editorActions: EditorAction[] = useMemo(() => {
    const flow = viewMode === 'flow';
    const single = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
    const editable = flow && !locked;
    const add = (id: string, label: string, type: NodeTypeKey, keys: ShortcutKeys): EditorAction =>
      ({ id, label, category: 'Edit', keys, run: () => addAtCenter(type), enabled: editable });
    const panelAction = (id: PanelId, label: string, keys: ShortcutKeys): EditorAction =>
      ({ id: `panel-${id}`, label: `Open the ${label} panel`, category: 'View', keys, run: () => setPanel(id) });
    return [
      { id: 'undo', label: 'Undo', category: 'Edit', keys: KEYS.undo, run: undo, enabled: canUndo },
      { id: 'redo', label: 'Redo', category: 'Edit', keys: [KEYS.redo, KEYS.redoAlt], run: redo, enabled: canRedo },
      { id: 'delete', label: 'Delete selected', category: 'Edit', keys: KEYS.delete, run: () => executeCommand(deleteElementsCommand(ctx, selectedNodes.map(n => n.id))), enabled: selectedNodes.length > 0 },
      { id: 'copy', label: 'Copy', category: 'Edit', keys: KEYS.copy, run: copySelected, enabled: selectedNodes.length > 0 },
      { id: 'cut', label: 'Cut', category: 'Edit', keys: KEYS.cut, run: cutSelected, enabled: selectedNodes.length > 0 },
      { id: 'paste', label: 'Paste', category: 'Edit', keys: KEYS.paste, run: pasteClipboard },
      { id: 'duplicate', label: 'Duplicate selected', category: 'Edit', keys: KEYS.duplicate, run: () => duplicateNodes(selectedNodes.map(n => n.id)), enabled: editable && selectedNodes.length > 0 },
      { id: 'select-all', label: 'Select all', category: 'Edit', keys: KEYS.selectAll, run: selectAll },
      { id: 'deselect', label: 'Deselect', category: 'Edit', keys: KEYS.deselect, run: deselectAll },
      { id: 'edit-node', label: 'Edit the selected node', category: 'Edit', keys: [KEYS.edit, KEYS.editAlt], run: () => single && requestNodeEdit(single.id, 'content'), enabled: flow && !!single && (single.type === 'elementNode' || single.type === 'commentNode') },
      { id: 'rename-node', label: 'Rename the selected node', category: 'Edit', keys: KEYS.rename, run: () => single && requestNodeEdit(single.id, 'title'), enabled: flow && !!single },
      add('add-scene', 'Add a scene', 'elementNode', KEYS.addScene),
      add('add-branch', 'Add a branch', 'conditionNode', KEYS.addBranch),
      add('add-jump', 'Add a jump', 'jumpNode', KEYS.addJump),
      add('add-comment', 'Add a comment', 'commentNode', KEYS.addComment),
      add('add-section', 'Add a section', 'sectionNode', KEYS.addSection),
      add('add-annotation', 'Add an annotation', 'annotationNode', KEYS.addAnnotation),
      { id: 'tidy-board', label: 'Tidy up the whole board', category: 'Edit', keys: KEYS.tidyBoard, run: tidyBoard, enabled: editable },
      { id: 'toggle-lock', label: locked ? 'Unlock the board' : 'Lock the board', category: 'Edit', keys: KEYS.lock, run: () => setLocked(!locked), enabled: flow },
      { id: 'save', label: 'Save', category: 'File', keys: KEYS.save, run: saveNow },
      { id: 'validate', label: 'Show problems', category: 'File', run: () => window.dispatchEvent(new CustomEvent('nodetale:show-problems')) },
      { id: 'export', label: 'Export the story', category: 'File', run: onToolbarExport },
      { id: 'play', label: 'Play the story', category: 'Story', run: () => { setPlayStartNodeId(null); setIsPlaying(true); }, enabled: canPlay },
      { id: 'play-here', label: 'Play from the selected scene', category: 'Story', keys: KEYS.playFromHere, run: () => single && startPlayFromNode(single.id), enabled: flow && single?.type === 'elementNode' },
      ...VIEW_MODES.map((v, i) => ({ id: `view-${v.id}`, label: `View: ${v.label}`, category: 'View' as const, keys: { key: String(i + 1), alt: true }, run: () => setViewMode(v.id) })),
      { id: 'find', label: 'Find a scene', category: 'View', keys: KEYS.find, run: () => { setViewMode('flow'); setFindOpen(true); } },
      { id: 'palette', label: 'Command palette', category: 'View', keys: KEYS.palette, run: () => setShowCommandPalette(true) },
      { id: 'help', label: 'Help', category: 'View', keys: KEYS.help, run: () => setHelpOpen(true) },
      { id: 'tool-select', label: 'Select tool', category: 'View', keys: KEYS.toolSelect, run: () => setIsPanMode(false), enabled: flow },
      { id: 'tool-pan', label: 'Pan tool', category: 'View', keys: KEYS.toolPan, run: () => setIsPanMode(true), enabled: flow },
      { id: 'fit-view', label: 'Fit the board', category: 'View', keys: KEYS.fitView, run: () => reactFlowInstance?.fitView({ duration: 300, padding: 0.15 }), enabled: flow },
      { id: 'zoom-in', label: 'Zoom in', category: 'View', keys: KEYS.zoomIn, run: () => reactFlowInstance?.zoomIn({ duration: 200 }), enabled: flow },
      { id: 'zoom-out', label: 'Zoom out', category: 'View', keys: KEYS.zoomOut, run: () => reactFlowInstance?.zoomOut({ duration: 200 }), enabled: flow },
      { id: 'toggle-minimap', label: minimap ? 'Hide minimap' : 'Show minimap', category: 'View', keys: KEYS.minimap, run: () => setMinimap(!minimap), enabled: flow },
      { id: 'toggle-snap', label: snap ? 'Turn off snap to grid' : 'Snap to grid', category: 'View', run: () => setSnap(!snap) },
      panelAction('boards', 'Boards', KEYS.panelBoards),
      panelAction('variables', 'Variables', KEYS.panelVariables),
      panelAction('assets', 'Assets', KEYS.panelAssets),
      panelAction('problems', 'Problems', KEYS.panelProblems),
    ];
  }, [undo, redo, canUndo, canRedo, selectedNodes, ctx, executeCommand, saveNow, copySelected, cutSelected, pasteClipboard, selectAll, deselectAll, canPlay, onToolbarExport, setViewMode, viewMode, locked, minimap, snap, setMinimap, setSnap, tidyBoard, addAtCenter, duplicateNodes, startPlayFromNode, reactFlowInstance]);

  useShortcuts(editorActions);


  // Latest arrange/align handlers for the menu without rebuilding it every render.
  const alignRef = useRef({ alignSelection, distributeSelection, arrange });
  alignRef.current = { alignSelection, distributeSelection, arrange };
  const boardMenu = useMemo(() => ({
    locked,
    onUnlock: () => setLocked(false),
    canPaste: hasClipboard,
    paste: pasteClipboard,
    selectAll,
    fitView: () => reactFlowInstance?.fitView({ duration: 300, padding: 0.15 }),
    tidyBoard,
    tidySelection: () => alignRef.current.arrange('selection'),
    align: (mode: AlignMode) => alignRef.current.alignSelection(mode),
    distribute: (axis: 'horizontal' | 'vertical') => alignRef.current.distributeSelection(axis),
    minimap,
    toggleMinimap: () => setMinimap(!minimap),
    snap,
    toggleSnap: () => setSnap(!snap),
    duplicate: duplicateNodes,
    addConnected: addConnectedScene,
    focusNode,
  }), [locked, hasClipboard, pasteClipboard, selectAll, reactFlowInstance, tidyBoard, minimap, setMinimap, snap, setSnap, duplicateNodes, addConnectedScene, focusNode]);

  const getMenuOptions = useMenuOptions({
      menu,
      nodes,
      edges: edgesForCanvas,
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
      startPlayFromNode,
      board: boardMenu
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
    {/* Canvas-first: the board fills the window; everything else floats over it.
        overflow-clip (not hidden) so focusing off-screen items can't scroll the page. */}
    <div className={`relative h-screen w-screen overflow-clip bg-[#0f0f11] text-zinc-100 ${isConnecting ? 'is-connecting' : ''}`}>
        <div className="absolute inset-0" ref={reactFlowWrapper}>
          {viewMode === 'flow' ? (
            <ReactFlow
            key={project.activeBoardId}
            nodes={nodes}
            edges={edgesForCanvas}
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
            onDrop={locked ? undefined : onDrop}
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
            snapToGrid={snap}
            snapGrid={[20, 20]}
            nodesDraggable={!locked}
            nodesConnectable={!locked}
            edgesUpdatable={!locked}
          >
            <Background color="#52525b" gap={20} size={1} variant={BackgroundVariant.Dots} />
            {minimap && (
              <MiniMap position="bottom-right" pannable zoomable ariaLabel="Board overview"
                className="!bottom-16 !right-3 !m-0 overflow-hidden !rounded-xl !border !border-nt-line !bg-nt-surface"
                maskColor="oklch(0.1 0.005 55 / 0.6)" nodeColor="oklch(0.6 0.01 55)" nodeBorderRadius={4} />
            )}
          </ReactFlow>
          ) : (
            <div className="absolute inset-0 pt-16">
              <div className="relative h-full">
                <React.Suspense fallback={null}>
                  <StoryViews mode={viewMode} project={viewProject!} onFocusNode={focusNode} onUpdateProject={setProject} />
                </React.Suspense>
              </div>
            </div>
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

        <EditorTopBar
          projectName={project.name}
          boards={project.boards}
          activeBoardId={project.activeBoardId}
          lastSaved={lastSaved ?? (project.modifiedAt ? new Date(project.modifiedAt) : null)}
          viewMode={viewMode}
          panel={panel}
          problemCount={diagnostics.length}
          canPlay={canPlay}
          jumpClipboard={jumpClipboard}
          onBack={() => navigate('/')}
          onSwitchBoard={switchBoard}
          onAddBoard={addBoard}
          onViewMode={setViewMode}
          onPanel={setPanel}
          onExport={onToolbarExport}
          onPalette={() => setShowCommandPalette(true)}
          onHelp={() => setHelpOpen(true)}
          onSave={saveNow}
          onPlay={onToolbarPlay}
          onClearJump={() => setJumpClipboard(null)}
        />

        {panel && <SidePanel panel={panel} project={project} setProject={setProject} diagnostics={diagnostics} onClose={() => setPanel(null)} />}

        {viewMode === 'flow' && (
          <BoardDock
            isPanMode={isPanMode}
            onPanMode={setIsPanMode}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onAdd={addAtCenter}
            selectionCount={selectedNodes.length}
            onArrange={arrange}
            onAlign={alignSelection}
            onDistribute={distributeSelection}
            findOpen={findOpen}
            onFindOpen={setFindOpen}
            findable={findable}
            onFocusNode={focusNode}
            startId={startId}
            minimap={minimap}
            onMinimap={setMinimap}
            snap={snap}
            onSnap={setSnap}
            locked={locked}
            onLocked={setLocked}
          />
        )}

      {isPlaying && (
          <React.Suspense fallback={null}>
            <PlayMode project={playProject!} startNodeId={playStartNodeId} onClose={() => { setIsPlaying(false); setPlayStartNodeId(null); }} />
          </React.Suspense>
      )}

      <ExportProjectModal project={exporting} onClose={() => setExporting(null)} />
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

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
                  const current: string[] = node?.data.assets || [];
                  const next = withAttachedAsset(current, asset, project.assets);
                  if (node && next !== current) {
                      // Height back to auto so the node grows to fit the new media.
                      updateNode(selectedNodeForAsset, {
                          style: { ...node.style, height: undefined },
                          data: { ...node.data, assets: next }
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
