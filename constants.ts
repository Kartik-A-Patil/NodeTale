import { Project, VariableType } from './types';

export const INITIAL_PROJECT: Project = {
  id: 'project-1',
  name: 'The Dark Castle',
  activeBoardId: 'board-1',
  variables: [
    { id: 'var-1', name: 'hasKey', type: VariableType.BOOLEAN, value: false },
    { id: 'var-2', name: 'health', type: VariableType.NUMBER, value: 100 },
    { id: 'var-3', name: 'playerName', type: VariableType.STRING, value: 'Traveler' },
  ],
  assets: [
    { id: 'asset-1', name: 'Castle Image', type: 'image', url: 'https://picsum.photos/400/250', parentId: null },
    { id: 'asset-2', name: 'Forest Bg', type: 'image', url: 'https://picsum.photos/400/251', parentId: null },
  ],
  folders: [],
  boards: [
    {
      id: 'board-1',
      name: 'Main Chapter',
      nodes: [
        {
          id: 'node-1',
          type: 'elementNode',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: 'You stand before a dark castle gate. The wind howls.' },
        },
        {
          id: 'node-2',
          type: 'elementNode',
          position: { x: 500, y: 50 },
          data: { label: 'Enter', content: 'You push the heavy doors open. It smells of dust.' },
        },
        {
            id: 'node-3',
            type: 'conditionNode',
            position: { x: 500, y: 300 },
            data: { 
              label: 'Has Key?', 
              content: '', 
              branches: [
                { id: 'branch-1', label: 'If', condition: 'hasKey == true' },
                { id: 'else', label: 'Else', condition: '' }
              ]
            },
        }
      ],
      edges: [
        { id: 'e1-2', source: 'node-1', target: 'node-2', type: 'floating', animated: true, style: { stroke: '#71717a' } },
        { id: 'e1-3', source: 'node-1', target: 'node-3', type: 'floating', animated: true, style: { stroke: '#71717a' } },
      ],
    },
    {
      id: 'board-2',
      name: 'Dungeon Level',
      nodes: [],
      edges: []
    }
  ],
};