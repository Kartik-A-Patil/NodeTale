import React, { useCallback } from 'react';
import { 
    ArrowRightCircle, Trash2, PlusCircle, 
    MessageSquare, Layout, Info, ArrowUpLeft, ArrowUpRight, 
    ArrowDownLeft, ArrowDownRight, MoveUpLeft, CornerDownRight, Spline, Image as ImageIcon, Play, Film, Music,
    LocateFixed, Plus, CopyPlus
} from 'lucide-react';
import { ContextMenuAction, ContextMenuOption } from '../components/ContextMenu';
import { Asset, isAnnotationNode, isConditionNode, isElementNode, isJumpNode } from '../models/story';
import { DEFAULT_BRANCHES, withNewCase } from '../core/branch';
import { createId } from '../utils/id';
import { KEYS } from '../editor/shortcuts/keymap';
import { CanvasNode } from '../adapters/reactFlow';
import { Edge, ReactFlowInstance } from 'reactflow';
import { MenuState } from './useContextMenu';
import type { ShortcutKeys } from '../editor/shortcuts/types';
import { AlignMode } from '../core/layout/arrange';
import { autoEdgeLabel } from '../utils/edgeLabel';
import {
    GitFork as BranchIcon, Wand2, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceAround, AlignVerticalSpaceAround,
    ClipboardPaste, BoxSelect, Maximize, Map as MapIcon, Grid3x3, Unlock, CirclePlus,
} from 'lucide-react';

/** Board-level actions the right-click menu offers (wired in ProjectEditor). */
export interface BoardMenuActions {
    locked: boolean;
    onUnlock: () => void;
    canPaste: () => boolean;
    paste: () => void;
    selectAll: () => void;
    fitView: () => void;
    tidyBoard: () => void;
    tidySelection: () => void;
    align: (mode: AlignMode) => void;
    distribute: (axis: 'horizontal' | 'vertical') => void;
    minimap: boolean;
    toggleMinimap: () => void;
    snap: boolean;
    toggleSnap: () => void;
    duplicate: (ids: string[]) => void;
    addConnected: (id: string) => void;
    /** Select and centre a node, switching board if needed. */
    focusNode: (id: string) => void;
}



// "No colour" is its own swatch (onClear), so no near-black entry here.
const MENU_COLORS = [
    '#f87171', // Red 400
    '#fb923c', // Orange 400
    '#fbbf24', // Amber 400
    '#4ade80', // Green 400
    '#34d399', // Emerald 400
    '#22d3ee', // Cyan 400
    '#60a5fa', // Blue 400
    '#818cf8', // Indigo 400
    '#a78bfa', // Violet 400
    '#e879f9'  // Fuchsia 400
];
const EdgeColors = [
    '#71717a', // Zinc 300
    '#f87171', // Red 400
    '#fb923c', // Orange 400
    '#fbbf24', // Amber 400
    '#4ade80', // Green 400
    '#34d399', // Emerald 400
    '#22d3ee', // Cyan 400
    '#60a5fa', // Blue 400
    '#818cf8', // Indigo 400
    '#a78bfa', // Violet 400
    '#e879f9'  // Fuchsia 400
];

interface UseMenuOptionsProps {
    menu: MenuState;
    nodes: CanvasNode[];
    edges: Edge[];
    updateNodeData: (id: string, data: any) => void;
    deleteNode: (id: string, deleteChildren?: boolean) => void;
    setJumpClipboard: (data: { id: string; label: string } | null) => void;
    jumpClipboard: { id: string; label: string } | null;
    updateEdgeLabel: (id: string, label: string) => void;
    updateEdgeColor: (id: string, color: string) => void;
    updateEdgeData: (id: string, data: any) => void;
    deleteEdge: (id: string) => void;
    addNode: (type: any, position?: { x: number, y: number }, extraData?: any) => void;
    assets: Asset[];
    setShowAssetSelectorModal: (show: boolean) => void;
    setSelectedNodeForAsset: (id: string | null) => void;
    reactFlowInstance: ReactFlowInstance | null;
    startPlayFromNode: (nodeId: string) => void;
    board: BoardMenuActions;
}

export function useMenuOptions({
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
    assets,
    setShowAssetSelectorModal,
    setSelectedNodeForAsset,
    reactFlowInstance,
    startPlayFromNode,
    board
}: UseMenuOptionsProps) {

  const getMenuOptions = useCallback((): ContextMenuOption[] => {
    if (!menu) return [];

    if (menu.type === 'node') {
        const colorRow = (ids: string[], current?: string): ContextMenuOption => ({
            type: 'color-grid',
            preventClose: true,
            colors: MENU_COLORS,
            color: current,
            onColorSelect: (color) => ids.forEach(id => updateNodeData(id, { color })),
            onClear: () => ids.forEach(id => updateNodeData(id, { color: undefined })),
        });
        const divider = { type: 'divider' } as ContextMenuOption;

        // Several nodes selected: act on all of them.
        if (menu.selectedNodeIds && menu.selectedNodeIds.length > 1) {
            const selectedNodes = nodes.filter(n => menu.selectedNodeIds!.includes(n.id));
            const ids = selectedNodes.map(n => n.id);
            return [
                { type: 'label', label: `${selectedNodes.length} selected` },
                colorRow(ids),
                divider,
                { label: 'Duplicate', icon: <CopyPlus size={14} />, shortcut: KEYS.duplicate, onClick: () => board.duplicate(ids) },
                {
                    label: 'Group into a section',
                    icon: <Layout size={14} />,
                    onClick: () => {
                        if (!reactFlowInstance) return;
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        selectedNodes.forEach(node => {
                            minX = Math.min(minX, node.position.x);
                            minY = Math.min(minY, node.position.y);
                            maxX = Math.max(maxX, node.position.x + (node.width || 250));
                            maxY = Math.max(maxY, node.position.y + (node.height || 150));
                        });
                        const padding = 40;
                        addNode('sectionNode', { x: minX - padding, y: minY - padding }, {
                            label: 'New section',
                            style: { width: maxX - minX + 2 * padding, height: maxY - minY + 2 * padding }
                        });
                    }
                },
                divider,
                { type: 'label', label: 'Arrange' },
                { label: 'Tidy up the selection', icon: <Wand2 size={14} />, onClick: board.tidySelection },
                {
                    label: 'Align',
                    type: 'submenu',
                    icon: <AlignStartVertical size={14} />,
                    submenu: ([
                        ['left', 'Left edges', AlignStartVertical], ['center', 'Centres (vertical line)', AlignCenterVertical], ['right', 'Right edges', AlignEndVertical],
                        ['top', 'Top edges', AlignStartHorizontal], ['middle', 'Middles (horizontal line)', AlignCenterHorizontal], ['bottom', 'Bottom edges', AlignEndHorizontal],
                    ] as const).map(([mode, label, Icon]) => ({ label, icon: <Icon size={14} />, onClick: () => board.align(mode) }))
                },
                ...(selectedNodes.length >= 3 ? [{
                    label: 'Space evenly',
                    type: 'submenu' as const,
                    icon: <AlignHorizontalSpaceAround size={14} />,
                    submenu: [
                        { label: 'Across', icon: <AlignHorizontalSpaceAround size={14} />, onClick: () => board.distribute('horizontal') },
                        { label: 'Down', icon: <AlignVerticalSpaceAround size={14} />, onClick: () => board.distribute('vertical') },
                    ]
                }] : []),
                divider,
                { label: `Delete ${selectedNodes.length} nodes`, danger: true, icon: <Trash2 size={14} />, shortcut: KEYS.delete, onClick: () => ids.forEach(id => deleteNode(id)) }
            ];
        }

        const node = nodes.find(n => n.id === menu.id);
        if (!node) return [];
        const id = node.id;
        const title = (node.data as { label?: string }).label?.trim();
        const header = (kind: string): ContextMenuOption => ({ type: 'label', label: title ? `${kind} · ${title}` : kind });
        const duplicate = { label: 'Duplicate', icon: <CopyPlus size={16} />, shortcut: KEYS.duplicate, onClick: () => board.duplicate([id]) };
        // A row of icons reads well from two actions up; a lone one gets its label.
        const quick = (items: { label: string; icon: React.ReactNode; onClick: () => void; preventClose?: boolean; shortcut?: ShortcutKeys }[]): ContextMenuOption[] =>
            items.length > 1 ? [{ type: 'icon-row', items }] : items.map(({ label, icon, onClick, shortcut }) => ({ label, icon, onClick, shortcut }));
        const remove = (what: string): ContextMenuOption => ({ label: `Delete ${what}`, danger: true, icon: <Trash2 size={14} />, shortcut: KEYS.delete, onClick: () => deleteNode(id) });

        if (node.type === 'sectionNode') {
            return [
                header('Section'),
                colorRow([id], node.data.color),
                divider,
                { label: 'Delete section only', danger: true, icon: <Trash2 size={14} />, onClick: () => deleteNode(id, false) },
                { label: 'Delete section and what’s inside', danger: true, icon: <Trash2 size={14} />, onClick: () => deleteNode(id, true) },
            ];
        }

        if (isAnnotationNode(node)) {
            const arrow = (direction: string, label: string, icon: React.ReactNode) => ({
                label, icon, preventClose: true, active: node.data.arrowDirection === direction,
                onClick: () => updateNodeData(id, { arrowDirection: direction }),
            });
            return [
                header('Annotation'),
                { type: 'icon-row', items: [
                    arrow('top-left', 'Arrow to the top left', <ArrowUpLeft size={16} />),
                    arrow('top-right', 'Arrow to the top right', <ArrowUpRight size={16} />),
                    arrow('bottom-left', 'Arrow to the bottom left', <ArrowDownLeft size={16} />),
                    arrow('bottom-right', 'Arrow to the bottom right', <ArrowDownRight size={16} />),
                ] },
                colorRow([id], node.data.color),
                divider,
                remove('annotation'),
            ];
        }

        if (isConditionNode(node)) {
            return [
                header('Branch'),
                ...quick([
                    { label: 'Add a case', icon: <Plus size={16} />, preventClose: true,
                      onClick: () => updateNodeData(id, { branches: withNewCase(node.data.branches || DEFAULT_BRANCHES, createId('branch')) }) },
                    duplicate,
                ]),
                colorRow([id], node.data.color),
                divider,
                remove('branch'),
            ];
        }

        if (isJumpNode(node)) {
            const target = node.data.jumpTargetId;
            return [
                header('Jump'),
                ...quick([
                    ...(target ? [{ label: 'Go to the target scene', icon: <LocateFixed size={16} />, onClick: () => board.focusNode(target) }] : []),
                    duplicate,
                ]),
                colorRow([id], node.data.color),
                divider,
                remove('jump'),
            ];
        }

        if (isElementNode(node)) {
            const nodeAssets = (node.data.assets || [])
                .map((assetId: string) => assets.find((a) => a.id === assetId))
                .filter(Boolean) as Asset[];
            const assetIcon = { image: ImageIcon, video: Film, audio: Music } as const;
            const assetItems: ContextMenuAction[] = [
                {
                    label: nodeAssets.length ? 'Attach another asset…' : 'Attach an asset…',
                    icon: <PlusCircle size={14} />,
                    onClick: () => {
                        setSelectedNodeForAsset(id);
                        setShowAssetSelectorModal(true);
                    }
                },
                ...nodeAssets.map((asset): ContextMenuAction => {
                    const Icon = assetIcon[asset.type];
                    return {
                        label: `Detach “${asset.name}”`,
                        icon: <Icon size={14} />,
                        danger: true,
                        onClick: () => updateNodeData(id, { assets: (node.data.assets || []).filter((a: string) => a !== asset.id) })
                    };
                })
            ];
            return [
                header('Scene'),
                ...quick([
                    { label: 'Play from here', icon: <Play size={16} />, shortcut: KEYS.playFromHere, onClick: () => startPlayFromNode(id) },
                    { label: 'Add a connected scene', icon: <CirclePlus size={16} />, onClick: () => board.addConnected(id) },
                    duplicate,
                    { label: 'Copy as a jump target', icon: <CornerDownRight size={16} />, onClick: () => setJumpClipboard({ id, label: title || 'Untitled' }) },
                ]),
                colorRow([id], node.data.color),
                divider,
                { label: nodeAssets.length ? `Assets (${nodeAssets.length})` : 'Assets', type: 'submenu', icon: <ImageIcon size={14} />, submenu: assetItems },
                divider,
                remove('scene'),
            ];
        }

        // Comments and anything else.
        return [
            // Comments have no title of their own.
            { type: 'label', label: 'Comment' },
            ...quick([duplicate]),
            colorRow([id], node.data.color),
            divider,
            remove('comment'),
        ];
    }

    if (menu.type === 'edge') {
        const edge = edges.find(e => e.id === menu.id);
        const isManual = !!edge?.data?.manualLabel;
        const sourceNode = edge ? nodes.find(n => n.id === edge.source) : undefined;
        const targetNode = edge ? nodes.find(n => n.id === edge.target) : undefined;

        return [
            {
                // Every edge always shows a label now (the target's title, or a
                // branch's own text) — this just mirrors the on-canvas toggle icon.
                label: isManual ? 'Use automatic label' : 'Use custom label',
                preventClose: true,
                onClick: () => {
                    if (isManual) {
                        updateEdgeData(menu.id!, { manualLabel: false });
                        updateEdgeLabel(menu.id!, '');
                    } else {
                        // `edges` already carries the resolved-through-logic-nodes
                        // label when this edge needed one (see resolvedEdgeLabels) —
                        // reuse it so switching to manual pre-fills the exact same
                        // text the canvas was just showing, not the raw target title.
                        const autoText = typeof edge?.data?.autoResolvedLabel === 'string'
                            ? edge.data.autoResolvedLabel
                            : autoEdgeLabel(
                                sourceNode ? { type: sourceNode.type, branches: (sourceNode.data as any)?.branches } : null,
                                targetNode ? { label: (targetNode.data as any)?.label } : null,
                                edge?.sourceHandle
                              );
                        updateEdgeData(menu.id!, { manualLabel: true });
                        updateEdgeLabel(menu.id!, autoText);
                    }
                }
            },
            { type: 'divider' } as ContextMenuOption,
            {
                type: 'color-grid',
                preventClose: true,
                colors: EdgeColors,
                onColorSelect: (color) => updateEdgeColor(menu.id!, color)
            },
            { type: 'divider' } as ContextMenuOption,
            {
                type: 'icon-row',
                items: [
                    { 
                        label: 'Straight', 
                        icon: <MoveUpLeft size={18} />, 
                        onClick: () => updateEdgeData(menu.id!, { pathType: 'straight' }),
                        active: edge?.data?.pathType === 'straight',
                        preventClose: true
                    },
                    { 
                        label: 'Smooth Stepper', 
                        icon: <CornerDownRight size={18} />, 
                        onClick: () => updateEdgeData(menu.id!, { pathType: 'smoothstep' }),
                        active: edge?.data?.pathType === 'smoothstep',
                        preventClose: true
                    },
                    { 
                        label: 'Bezier', 
                        icon: <Spline size={18} />, 
                        onClick: () => updateEdgeData(menu.id!, { pathType: 'bezier' }),
                        active: !edge?.data?.pathType || edge?.data?.pathType === 'bezier',
                        preventClose: true
                    }
                ]
            },
            { type: 'divider' } as ContextMenuOption,
            { label: 'Delete connection', danger: true, icon: <Trash2 size={14}/>, shortcut: KEYS.delete, onClick: () => deleteEdge(menu.id!) }
        ];
    }

    if (menu.type === 'pane') {
        const at = () => reactFlowInstance?.screenToFlowPosition({ x: menu.x, y: menu.y });
        const addHere = (type: string, label: string, icon: React.ReactNode, shortcut: ShortcutKeys): ContextMenuOption => ({
            label, icon, shortcut, onClick: () => { const position = at(); if (position) addNode(type, position); }
        });
        const view: ContextMenuOption[] = [
            { type: 'divider' } as ContextMenuOption,
            { type: 'label', label: 'View' },
            { label: 'Select all', icon: <BoxSelect size={14} />, shortcut: KEYS.selectAll, onClick: board.selectAll },
            { label: 'Fit the board', icon: <Maximize size={14} />, shortcut: KEYS.fitView, onClick: board.fitView },
            { label: board.minimap ? 'Hide minimap' : 'Show minimap', icon: <MapIcon size={14} />, shortcut: KEYS.minimap, onClick: board.toggleMinimap },
            { label: board.snap ? 'Turn off snap to grid' : 'Snap to grid', icon: <Grid3x3 size={14} />, onClick: board.toggleSnap },
        ];
        if (board.locked) {
            return [{ label: 'Unlock the board', icon: <Unlock size={14} />, onClick: board.onUnlock }, ...view];
        }
        const options: ContextMenuOption[] = [
            { type: 'label', label: 'Add here' },
            addHere('elementNode', 'Scene', <PlusCircle size={14} />, KEYS.addScene),
            addHere('conditionNode', 'Branch', <BranchIcon size={14} />, KEYS.addBranch),
            addHere('jumpNode', 'Jump', <ArrowRightCircle size={14} />, KEYS.addJump),
            addHere('commentNode', 'Comment', <MessageSquare size={14} />, KEYS.addComment),
            addHere('sectionNode', 'Section', <Layout size={14} />, KEYS.addSection),
            addHere('annotationNode', 'Annotation', <Info size={14} />, KEYS.addAnnotation),
            ...(board.canPaste() ? [{ type: 'divider' } as ContextMenuOption, { label: 'Paste', icon: <ClipboardPaste size={14} />, shortcut: KEYS.paste, onClick: board.paste }] : []),
            { type: 'divider' } as ContextMenuOption,
            { label: 'Tidy up the board', icon: <Wand2 size={14} />, shortcut: KEYS.tidyBoard, onClick: board.tidyBoard },
            ...view,
        ];

        if (jumpClipboard) {
            options.unshift({
                label: `Paste jump to “${jumpClipboard.label}”`,
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
    }, [menu, nodes, edges, updateNodeData, deleteNode, setJumpClipboard, jumpClipboard, updateEdgeLabel, updateEdgeColor, updateEdgeData, deleteEdge, addNode, assets, reactFlowInstance, setShowAssetSelectorModal, setSelectedNodeForAsset, startPlayFromNode, board]);

  return getMenuOptions;
}
