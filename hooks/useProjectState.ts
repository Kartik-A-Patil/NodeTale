import { useState, useEffect, useRef } from 'react';
import { Project, AppNode } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { saveProject, loadProject } from '../services/storageService';
import { Node, Edge } from 'reactflow';

export function useProjectState(
    nodes: Node[], 
    edges: Edge[], 
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void, 
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void,
    projectIdOrName?: string
) {
  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const prevActiveBoardIdRef = useRef<string | null>(null);
  const hasLoadedInitialDataRef = useRef(false);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Load project
  useEffect(() => {
    const load = async () => {
      if (!projectIdOrName) {
          // If no project ID/Name provided, we might be in a state where we shouldn't load anything
          // or we are creating a new one. But for now, let's just stop initializing.
          setIsInitializing(false);
          return;
      }

      try {
        console.log('[useProjectState] Loading project:', projectIdOrName);
        const savedProject = await loadProject(projectIdOrName);
        if (savedProject) {
          console.log('[useProjectState] ✓ Project loaded, setting state:', savedProject.name);
          setProject(savedProject);
          
          // Load the active board's nodes and edges immediately
          const activeBoard = savedProject.boards.find(b => b.id === savedProject.activeBoardId) || savedProject.boards[0];
          if (activeBoard) {
            console.log('[useProjectState] Setting nodes/edges from loaded board:', activeBoard.nodes.length, 'nodes');
            setNodes(activeBoard.nodes as any);
            setEdges(activeBoard.edges);
            // Mark that we've loaded initial data
            hasLoadedInitialDataRef.current = true;
          }
          prevActiveBoardIdRef.current = savedProject.activeBoardId;
        } else {
            console.error('[useProjectState] ✗ Project not found:', projectIdOrName);
        }
      } catch (error) {
        console.error('[useProjectState] ✗ Failed to load project:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    load();
  }, [projectIdOrName, setNodes, setEdges]);

  // Sync Project to Local State (Handle Board Switching)
  useEffect(() => {
    if (isInitializing) return;
    
    // Skip if this is the first render after loading (nodes already set in load effect)
    if (prevActiveBoardIdRef.current === null) {
      return;
    }

    // 1. Save OLD board state if switching
    if (prevActiveBoardIdRef.current !== project.activeBoardId) {
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
            console.log('Saving old board before switch:', oldBoardId);
            saveProject(newProject);
            return newProject;
        });
        
        // 2. Load NEW board state
        const activeBoard = project.boards.find(b => b.id === project.activeBoardId) || project.boards[0];
        if (activeBoard) {
            console.log('[useProjectState] Loading new board:', project.activeBoardId, 'Nodes:', activeBoard.nodes.length);
            setNodes(activeBoard.nodes as any);
            setEdges(activeBoard.edges);
        }

        // 3. Update ref
        prevActiveBoardIdRef.current = project.activeBoardId;
    }

  }, [project.activeBoardId, isInitializing, setNodes, setEdges]); 

  // Sync Local State to Project (Debounced Save for Nodes/Edges)
  useEffect(() => {
    if (isInitializing) return;
    
    // Skip saves until we've actually loaded initial data
    if (!hasLoadedInitialDataRef.current) return;

    const timeoutId = setTimeout(async () => {
      const nodesToSave = nodesRef.current;
      const edgesToSave = edgesRef.current;
      
      console.log('[useProjectState] Refs contain:', nodesToSave.length, 'nodes', edgesToSave.length, 'edges');
      
      setProject(prev => {
          const boardIndex = prev.boards.findIndex(b => b.id === prev.activeBoardId);
          if (boardIndex === -1) return prev;

          const newBoards = [...prev.boards];
          newBoards[boardIndex] = { 
              ...newBoards[boardIndex], 
              nodes: nodesToSave as AppNode[], 
              edges: edgesToSave 
          };
          
          const newProject = { ...prev, boards: newBoards };
          
          console.log('[useProjectState] Auto-saving project:', newProject.name, 'Board:', newProject.activeBoardId, 'Nodes:', nodesToSave.length);
          saveProject(newProject).then(() => {
            console.log('[useProjectState] ✓ Auto-save complete');
            setLastSaved(new Date());
          }).catch((err) => {
            console.error('[useProjectState] ✗ Auto-save failed:', err);
          });
          
          return newProject;
      });
    }, 1000); 

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isInitializing]);

  // Auto-save when project-level data changes (variables, metadata, etc)
  useEffect(() => {
    if (isInitializing) return;
    if (!hasLoadedInitialDataRef.current) return;

    const timeoutId = setTimeout(async () => {
      console.log('[useProjectState] Auto-saving project state (variables/metadata):', project.name);
      saveProject(project).then(() => {
        console.log('[useProjectState] ✓ Auto-save complete');
        setLastSaved(new Date());
      }).catch((err) => {
        console.error('[useProjectState] ✗ Auto-save failed:', err);
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [project.variables, isInitializing]);

  // Immediate save function exposed to callers
  const saveNow = async () => {
    if (isInitializing) return;
    const nodesToSave = nodesRef.current;
    const edgesToSave = edgesRef.current;

    setProject(prev => {
        const boardIndex = prev.boards.findIndex(b => b.id === prev.activeBoardId);
        if (boardIndex === -1) return prev;

        const newBoards = [...prev.boards];
        newBoards[boardIndex] = {
            ...newBoards[boardIndex],
            nodes: nodesToSave as AppNode[],
            edges: edgesToSave
        };

        const newProject = { ...prev, boards: newBoards };
        // call save and set timestamp
        console.log('[useProjectState] Manual save triggered:', newProject.name, 'Board:', newProject.activeBoardId, 'Nodes:', nodesToSave.length);
        saveProject(newProject).then(() => {
          console.log('[useProjectState] ✓ Manual save complete');
          setLastSaved(new Date());
        }).catch((e) => console.error('[useProjectState] ✗ Manual save failed:', e));
        return newProject;
    });
  };
  return { project, setProject, isInitializing, lastSaved, saveNow };
}