import React, { useCallback } from 'react';
import { 
    GitFork, ArrowRightCircle, Copy as CopyIcon, Trash2, PlusCircle, 
    MessageSquare, Layout, Info, ArrowUpLeft, ArrowUpRight, 
    ArrowDownLeft, ArrowDownRight, Minus, CornerDownRight, Spline 
} from 'lucide-react';
import { ContextMenuOption } from '../components/ContextMenu';
import { AppNode } from '../types';
import { Edge, ReactFlowInstance } from 'reactflow';
import { MenuState } from './useContextMenu';

const MENU_COLORS = [
    '#27272a', // Zinc 300
    '#f87171', // Red 400
    '#fb923c', // Orange 400
    '#fbbf24', // Amber 400
    '#4ade80', // Green 400
    '#34d399', // Emerald 400
    '#22d3ee', // Cyan 400
    '#60a5fa', // Blue 400
    '#818cf8', // Indigo 400
    '#a78bfa', // Violet 400
    '#e879f9', // Fuchsia 400
    '#fb7185'  // Rose 400
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
    reactFlowInstance: ReactFlowInstance | null;
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
    reactFlowInstance
}: UseMenuOptionsProps) {

  const getMenuOptions = useCallback((): ContextMenuOption[] => {
    if (!menu) return [];

    if (menu.type === 'node') {
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
                    label: 'Top Left',
                    icon: <ArrowUpLeft size={14} />,
                    onClick: () => updateNodeData(menu.id!, { arrowDirection: 'top-left' })
                },
                {
                    label: 'Top Right',
                    icon: <ArrowUpRight size={14} />,
                    onClick: () => updateNodeData(menu.id!, { arrowDirection: 'top-right' })
                },
                {
                    label: 'Bottom Left',
                    icon: <ArrowDownLeft size={14} />,
                    onClick: () => updateNodeData(menu.id!, { arrowDirection: 'bottom-left' })
                },
                {
                    label: 'Bottom Right',
                    icon: <ArrowDownRight size={14} />,
                    onClick: () => updateNodeData(menu.id!, { arrowDirection: 'bottom-right' })
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

        if (node && node.type !== 'jumpNode') {
            options.push(
                {
                    label: 'Copy as Jump Target',
                    icon: <CopyIcon size={14} />,
                    onClick: () => setJumpClipboard({ id: menu.id!, label: menu.label || 'Untitled' })
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
        const hasLabel = edge?.label;

        return [
            { 
                label: hasLabel ? 'Remove label' : 'Add label', 
                // icon: <Type size={14} />,
                onClick: () => {
                    if (hasLabel) {
                        updateEdgeLabel(menu.id!, '');
                    } else {
                        const newLabel = window.prompt('Enter edge label:', '');
                        if (newLabel !== null) {
                            updateEdgeLabel(menu.id!, newLabel);
                        }
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
                        icon: <Minus size={18} />, 
                        onClick: () => updateEdgeData(menu.id!, { pathType: 'straight' }),
                        active: edge?.data?.pathType === 'straight'
                    },
                    { 
                        label: 'Step', 
                        icon: <CornerDownRight size={18} />, 
                        onClick: () => updateEdgeData(menu.id!, { pathType: 'step' }),
                        active: edge?.data?.pathType === 'step' || edge?.data?.pathType === 'smoothstep'
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
  }, [menu, nodes, edges, updateNodeData, deleteNode, setJumpClipboard, jumpClipboard, updateEdgeLabel, updateEdgeColor, updateEdgeData, deleteEdge, addNode, reactFlowInstance]);

  return getMenuOptions;
}
