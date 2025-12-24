import React, { useCallback } from 'react';
import { 
    GitFork, ArrowRightCircle, Copy as CopyIcon, Trash2, PlusCircle, 
    MessageSquare, Layout, Info, ArrowUpLeft, ArrowUpRight, 
    ArrowDownLeft, ArrowDownRight, MoveUpLeft, CornerDownRight, Spline, Image as ImageIcon, Play,
    FileAudio, FileVideo, X
} from 'lucide-react';
import { ContextMenuOption } from '../components/ContextMenu';
import { AppNode, Asset } from '../types';
import { Edge, ReactFlowInstance } from 'reactflow';
import { MenuState } from './useContextMenu';

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

interface UseMenuOptionsProps {
    menu: MenuState;
    nodes: AppNode[];
    edges: Edge[];
    updateNodeData: (id: string, data: any) => void;
    updateNode: (id: string, patch: Partial<AppNode>) => void;
    deleteNode: (id: string, deleteChildren?: boolean) => void;
    setJumpClipboard: (data: { id: string; label: string } | null) => void;
    jumpClipboard: { id: string; label: string } | null;
    updateEdgeLabel: (id: string, label: string) => void;
    updateEdgeColor: (id: string, color: string) => void;
    updateEdgeData: (id: string, data: any) => void;
    deleteEdge: (id: string) => void;
    addNode: (type: any, position?: { x: number, y: number }, extraData?: any) => void;
    addAsset: (asset: Asset) => void;
    setShowAssetSelectorModal: (show: boolean) => void;
    setSelectedNodeForAsset: (id: string | null) => void;
    reactFlowInstance: ReactFlowInstance | null;
    startPlayFromNode: (nodeId: string) => void;
}

export function useMenuOptions({
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
                    colors: MENU_COLORS,
                    onColorSelect: (color) => {
                        selectedNodes.forEach(node => updateNodeData(node.id, { color }));
                    }
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    label: 'Create Section',
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

        if (node && node.type === 'annotationNode') {
            options.push(
                {
                    type: 'icon-row',
                    items: [
                        {
                            label: 'Top Left',
                            icon: <ArrowUpLeft size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'top-left' }),
                            active: node.data.arrowDirection === 'top-left'
                        },
                        {
                            label: 'Top Right',
                            icon: <ArrowUpRight size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'top-right' }),
                            active: node.data.arrowDirection === 'top-right'
                        },
                        {
                            label: 'Bottom Left',
                            icon: <ArrowDownLeft size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'bottom-left' }),
                            active: node.data.arrowDirection === 'bottom-left'
                        },
                        {
                            label: 'Bottom Right',
                            icon: <ArrowDownRight size={16} />,
                            onClick: () => updateNodeData(menu.id!, { arrowDirection: 'bottom-right' }),
                            active: node.data.arrowDirection === 'bottom-right'
                        }
                    ]
                },
                { type: 'divider' } as ContextMenuOption,
                {
                    type: 'color-grid',
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

        if (node && node.type === 'conditionNode') {
            options.push(
                {
                    label: 'Add Condition Case',
                    icon: <GitFork size={14} />,
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

        if (node && node.type === 'elementNode') {
             const projectAssets = (node.data.projectAssets as Asset[]) || [];
             const nodeAssetIds = node.data.assets || [];
             const nodeAssets = nodeAssetIds
               .map((assetId: string) => projectAssets.find((a) => a.id === assetId))
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
                    const getAssetIcon = () => {
                        if (asset.type === 'image') return <ImageIcon size={14} />;
                        if (asset.type === 'video') return <FileVideo size={14} />;
                        if (asset.type === 'audio') return <FileAudio size={14} />;
                        return <ImageIcon size={14} />;
                    };

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
                    label: 'Start Play from Here',
                    icon: <Play size={14} />,
                    onClick: () => startPlayFromNode(menu.id!)
                },
                { type: 'divider' } as ContextMenuOption
             );
        }

        options.push(
            {
                type: 'color-grid',
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
        const labelEnabled = !!edge?.data?.labelEnabled;

        return [
            {
                label: labelEnabled ? 'Remove label' : 'Add label',
                onClick: () => {
                    if (labelEnabled) {
                        updateEdgeData(menu.id!, { labelEnabled: false });
                        updateEdgeLabel(menu.id!, '');
                    } else {
                        updateEdgeData(menu.id!, { labelEnabled: true });
                    }
                }
            },
            { type: 'divider' } as ContextMenuOption,
            {
                type: 'color-grid',
                colors: MENU_COLORS,
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
                        active: edge?.data?.pathType === 'straight'
                    },
                    { 
                        label: 'Smooth Stepper', 
                        icon: <CornerDownRight size={18} />, 
                        onClick: () => updateEdgeData(menu.id!, { pathType: 'smoothstep' }),
                        active: edge?.data?.pathType === 'smoothstep'
                    },
                    { 
                        label: 'Bezier', 
                        icon: <Spline size={18} />, 
                        onClick: () => updateEdgeData(menu.id!, { pathType: 'bezier' }),
                        active: !edge?.data?.pathType || edge?.data?.pathType === 'bezier'
                    }
                ]
            },
            { type: 'divider' } as ContextMenuOption,
            { label: 'Delete selection', danger: true, icon: <Trash2 size={14}/>, onClick: () => deleteEdge(menu.id!) }
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
            },
            {
                label: 'Add Section',
                icon: <Layout size={14} />,
                onClick: () => {
                     if (reactFlowInstance) {
                        const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
                        addNode('sectionNode', position);
                    }
                }
            },
            {
                label: 'Add Annotation',
                icon: <Info size={14} />,
                onClick: () => {
                     if (reactFlowInstance) {
                        const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
                        addNode('annotationNode', position);
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
    }, [menu, nodes, edges, updateNodeData, deleteNode, setJumpClipboard, jumpClipboard, updateEdgeLabel, updateEdgeColor, updateEdgeData, deleteEdge, addNode, reactFlowInstance, setShowAssetSelectorModal, setSelectedNodeForAsset, startPlayFromNode]);

  return getMenuOptions;
}
