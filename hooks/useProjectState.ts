import { useState, useEffect, useRef } from 'react';
import { Project, AppNode } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { saveProject, loadProject } from '../services/storageService';
import { Node, Edge } from 'reactflow';

export function useProjectState(
    nodes: Node[], 
    edges: Edge[], 
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void, 
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void
) {
  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const prevActiveBoardIdRef = useRef<string | null>(null);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Load project
  useEffect(() => {
    const load = async () => {
      try {
        const savedProject = await loadProject();
        if (savedProject) {
          // Migration: Ensure tracks exist
          // if (!savedProject.tracks) {
          //     savedProject.tracks = INITIAL_PROJECT.tracks;
          // }
          
          setProject(savedProject);
          const savedActiveBoardId = localStorage.getItem('activeBoardId');
          if (savedActiveBoardId && savedProject.boards.some(b => b.id === savedActiveBoardId)) {
               setProject(prev => ({ ...prev, activeBoardId: savedActiveBoardId }));
          }
        }
      } catch (error) {
        console.error("Failed to load project:", error);
      } finally {
        setIsInitializing(false);
      }
    };
    load();
  }, []);

  // Sync Project to Local State (Handle Board Switching)
  useEffect(() => {
    if (isInitializing) return;

    // 1. Save OLD board state if switching
    if (prevActiveBoardIdRef.current && prevActiveBoardIdRef.current !== project.activeBoardId) {
        const oldBoardId = prevActiveBoardIdRef.current;
        const nodesToSave = nodesRef.current;
        const edgesToSave = edgesRef.current;

        setProject(prev => {
            const boardIndex = prev.boards.findIndex(b => b.id === oldBoardId);
            if (boardIndex === -1) return prev;

            const newBoards = [...prev.boards];
            newBoards[boardIndex] = { 
                ...newBoards[boardIndex], 
                nodes: nodesToSave as AppNode[], 
                edges: edgesToSave 
            };
            
            const newProject = { ...prev, boards: newBoards };
            saveProject(newProject);
            return newProject;
        });
    }

    // 2. Load NEW board state
    const activeBoard = project.boards.find(b => b.id === project.activeBoardId) || project.boards[0];
    if (activeBoard) {
        // We need to cast here because setNodes expects Node[] but we have AppNode[]
        // In a real app we should align types better
        setNodes(activeBoard.nodes as any);
        setEdges(activeBoard.edges);
    }

    // 3. Update ref
    prevActiveBoardIdRef.current = project.activeBoardId;

  }, [project.activeBoardId, isInitializing]); 

  // Sync Local State to Project (Debounced Save)
  useEffect(() => {
    if (isInitializing) return;

    const timeoutId = setTimeout(async () => {
      setProject(prev => {
          const boardIndex = prev.boards.findIndex(b => b.id === prev.activeBoardId);
          if (boardIndex === -1) return prev;

          const newBoards = [...prev.boards];
          newBoards[boardIndex] = { 
              ...newBoards[boardIndex], 
              nodes: nodes as AppNode[], 
              edges 
          };
          
          const newProject = { ...prev, boards: newBoards };
          
          saveProject(newProject).then(() => setLastSaved(new Date()));
          
          return newProject;
      });
      
      localStorage.setItem('activeBoardId', project.activeBoardId);
    }, 1000); 

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isInitializing]);

  return { project, setProject, isInitializing, lastSaved };
}