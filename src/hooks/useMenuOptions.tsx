import React, { useCallback } from 'react';
import { 
    GitFork, ArrowRightCircle, Copy as CopyIcon, Trash2, PlusCircle, 
    MessageSquare, Layout, Info, ArrowUpLeft, ArrowUpRight, 
    ArrowDownLeft, ArrowDownRight, MoveUpLeft, CornerDownRight, Spline, Image as ImageIcon, Play, X
} from 'lucide-react';
import { ContextMenuOption } from '../components/ContextMenu';
import { AppNode, Asset, isAnnotationNode, isConditionNode, isElementNode } from '../types';
import { Edge, ReactFlowInstance } from 'reactflow';
import { MenuState } from './useContextMenu';
import { AlignMode } from '../core/layout/arrange';
import { autoEdgeLabel } from '../utils/edgeLabel';
import {
    Copy as DuplicateIcon, GitFork as BranchIcon, Wand2, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
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
}

const MENU_COLORS = [
    '#18181b', // Zinc 300
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
    nodes: AppNode[];
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
        // Check for multi-selection
        if (menu.selectedNodeIds && menu.selectedNodeIds.length > 1) {
            const selectedNodes = nodes.filter(n => menu.selectedNodeIds!.includes(n.id));
            return [
                {
                    type: 'color-grid',
                    preventClose: true,
                    colors: MENU_COLORS,
                    onColorSelect: (color) => {
                        selectedNodes.forEach(node => updateNodeData(node.id, { color }));
                    }
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    label: `Duplicate ${selectedNodes.length} nodes`,
                    icon: <DuplicateIcon size={14} />,
                    onClick: () => board.duplicate(selectedNodes.map(n => n.id))
                },
                {
                    label: 'Group into a section',
                    icon: <Layout size={14} />,
                    onClick: () => {
                        if (!reactFlowInstance) return;
                        // Calculate bounding box
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        selectedNodes.forEach(node => {
                            minX = Math.min(minX, node.position.x);
                            minY = Math.min(minY, node.position.y);
                            maxX = Math.max(maxX, node.position.x + (node.width || 250));
                            maxY = Math.max(maxY, node.position.y + (node.height || 150));
                        });
                        const padding = 40; // extra space around
                        const width = maxX - minX + 2 * padding;
                        const height = maxY - minY + 2 * padding;
                        const position = { x: minX - padding, y: minY - padding };
                        addNode('sectionNode', position, { 
                            label: 'New Section',
                            style: { width, height }
                        });
                    }
                },
                { type: 'divider' } as ContextMenuOption,
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
                { type: 'divider' } as ContextMenuOption,
                {
                    label: 'Delete Selected',
                    danger: true,
                    icon: <Trash2 size={14} />,
                    onClick: () => {
                        selectedNodes.forEach(node => deleteNode(node.id));
                    }
                }
            ];
        }

        const node = nodes.find(n => n.id === menu.id);
        
        const options: ContextMenuOption[] = [];

        if (node && node.type === 'sectionNode') {
             options.push(
                {
                    type: 'color-grid',
                    preventClose: true,
                    colors: MENU_COLORS,
                    onColorSelect: (color) => updateNodeData(menu.id!, { color })
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    label: 'Delete Section',
                    danger: true,
                    icon: <Trash2 size={14} />,
                    onClick: () => deleteNode(menu.id!, false)
                },
                {
                    label: 'Delete Section & Child',
                    danger: true,
                    icon: <Trash2 size={14} />,
                    onClick: () => deleteNode(menu.id!, true)
                }
             );
             return options;
        }

        if (node && isAnnotationNode(node)) {
            options.push(
                {
                    type: 'icon-row',
                    items: [
                        {
                            label: 'Top Left',
                            icon: <ArrowUpLeft size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'top-left' }),
                            active: node.data.arrowDirection === 'top-left',
                            preventClose: true
                        },
                        {
                            label: 'Top Right',
                            icon: <ArrowUpRight size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'top-right' }),
                            active: node.data.arrowDirection === 'top-right',
                            preventClose: true
                        },
                        {
                            label: 'Bottom Left',
                            icon: <ArrowDownLeft size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'bottom-left' }),
                            active: node.data.arrowDirection === 'bottom-left',
                            preventClose: true
                        },
                        {
                            label: 'Bottom Right',
                            icon: <ArrowDownRight size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'bottom-right' }),
                            active: node.data.arrowDirection === 'bottom-right',
                            preventClose: true
                        }
                    ]
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    type: 'color-grid',
                    preventClose: true,
                    colors: MENU_COLORS,
                    onColorSelect: (color) => updateNodeData(menu.id!, { color })
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    label: 'Delete Annotation',
                    danger: true,
                    icon: <Trash2 size={14} />,
                    onClick: () => deleteNode(menu.id!)
                }
            );
            return options;
        }

        if (node && isConditionNode(node)) {
            options.push(
                {
                    label: 'Add Condition Case',
                    icon: <GitFork size={14} />,
                    preventClose: true,
                    onClick: () => {
                         const branches = node.data.branches || [
                            { id: 'true', label: 'If', condition: 'true' },
                            { id: 'false', label: 'Else', condition: '' }
                         ];
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

        if (node && isElementNode(node)) {
             const nodeAssetIds = node.data.assets || [];
             const nodeAssets = nodeAssetIds
               .map((assetId: string) => assets.find((a) => a.id === assetId))
               .filter(Boolean) as Asset[];

             const submenuItems: ContextMenuOption[] = [
                {
                    label: 'Add Asset',
                    icon: <PlusCircle size={14} className="text-green-400" />,
                    onClick: () => {
                        setSelectedNodeForAsset(menu.id!);
                        setShowAssetSelectorModal(true);
                    }
                }
             ];

             // Add remove options for each asset
             if (nodeAssets.length > 0) {
                nodeAssets.forEach((asset) => {
                    submenuItems.push({
                        label: `Remove ${asset.name}`,
                        icon: <X size={14} />,
                        danger: true,
                        onClick: () => {
                            const currentAssets = node.data.assets || [];
                            const updatedAssets = currentAssets.filter((id: string) => id !== asset.id);
                            updateNodeData(menu.id!, { assets: updatedAssets });
                        }
                    });
                });
             }

             options.push(
                {
                    label: 'Copy as Jump Target',
                    icon: <CopyIcon size={14} />,
                    onClick: () => setJumpClipboard({ id: menu.id!, label: node.data.label || menu.label || 'Untitled' })
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    label: 'Assets',
                    type: 'submenu',
                    icon: <ImageIcon size={14} />,
                    submenu: submenuItems
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    label: 'Play from here',
                    icon: <Play size={14} />,
                    onClick: () => startPlayFromNode(menu.id!)
                },
                {
                    label: 'Add a connected scene',
                    icon: <CirclePlus size={14} />,
                    onClick: () => board.addConnected(menu.id!)
                },
                { type: 'divider' } as ContextMenuOption
             );
        }

        options.push(
            {
                label: 'Duplicate',
                icon: <DuplicateIcon size={14} />,
                onClick: () => board.duplicate([menu.id!])
            },
            { type: 'divider' } as ContextMenuOption,
            {
                type: 'color-grid',
                preventClose: true,
                colors: MENU_COLORS,
                onColorSelect: (color) => updateNodeData(menu.id!, { color })
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
                        const autoText = autoEdgeLabel(
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
            { label: 'Delete selection', danger: true, icon: <Trash2 size={14}/>, onClick: () => deleteEdge(menu.id!) }
        ];
    }

    if (menu.type === 'pane') {
        const at = () => reactFlowInstance?.screenToFlowPosition({ x: menu.x, y: menu.y });
        const addHere = (type: string, label: string, icon: React.ReactNode): ContextMenuOption => ({
            label, icon, onClick: () => { const position = at(); if (position) addNode(type, position); }
        });
        const view: ContextMenuOption[] = [
            { type: 'divider' } as ContextMenuOption,
            { label: 'Select all', icon: <BoxSelect size={14} />, onClick: board.selectAll },
            { label: 'Fit the board', icon: <Maximize size={14} />, onClick: board.fitView },
            { label: board.minimap ? 'Hide minimap' : 'Show minimap', icon: <MapIcon size={14} />, onClick: board.toggleMinimap },
            { label: board.snap ? 'Turn off snap to grid' : 'Snap to grid', icon: <Grid3x3 size={14} />, onClick: board.toggleSnap },
        ];
        if (board.locked) {
            return [{ label: 'Unlock the board', icon: <Unlock size={14} />, onClick: board.onUnlock }, ...view];
        }
        const options: ContextMenuOption[] = [
            addHere('elementNode', 'Add scene here', <PlusCircle size={14} />),
            addHere('conditionNode', 'Add branch here', <BranchIcon size={14} />),
            addHere('jumpNode', 'Add jump here', <ArrowRightCircle size={14} />),
            addHere('commentNode', 'Add comment here', <MessageSquare size={14} />),
            addHere('sectionNode', 'Add section here', <Layout size={14} />),
            addHere('annotationNode', 'Add annotation here', <Info size={14} />),
            ...(board.canPaste() ? [{ type: 'divider' } as ContextMenuOption, { label: 'Paste', icon: <ClipboardPaste size={14} />, onClick: board.paste }] : []),
            { type: 'divider' } as ContextMenuOption,
            { label: 'Tidy up the board', icon: <Wand2 size={14} />, onClick: board.tidyBoard },
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
