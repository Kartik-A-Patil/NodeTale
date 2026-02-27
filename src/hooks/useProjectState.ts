import { useState, useEffect, useRef } from 'react';
import { Project, AppNode } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { saveProject, loadProject } from '../services/storageService';
import { Node, Edge } from 'reactflow';

const isDev = import.meta.env.DEV;

// Ensure width/height persist visually by mirroring onto node.style
const normalizeNodeDimensions = (node: Node): Node => {
  const style: Record<string, any> = { ...(node as any).style };
  const hasWidth = typeof (node as any).width === 'number';
  const hasHeight = typeof (node as any).height === 'number';
  const styleHasWidth = typeof style.width === 'number';
  const styleHasHeight = typeof style.height === 'number';

  if (hasWidth && !styleHasWidth) style.width = (node as any).width;
  if (hasHeight && !styleHasHeight) style.height = (node as any).height;

  const z = (node as any).zIndex ?? style.zIndex;
  if (typeof z === 'number') style.zIndex = z;

  return { ...node, ...(Object.keys(style).length ? { style } : {}) };
};

// Simple hash for quick dirty-check on nodes/edges
const quickHash = (nodes: Node[], edges: Edge[]): string =>
  `${nodes.length}:${edges.length}:${nodes.map(n => n.id).join(',')}`;

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
  const lastSavedHashRef = useRef<string>('');

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Load project
  useEffect(() => {
    const load = async () => {
      if (!projectIdOrName) {
          setIsInitializing(false);
          return;
      }

      try {
        if (isDev) console.log('[useProjectState] Loading project:', projectIdOrName);
        const savedProject = await loadProject(projectIdOrName);
        if (savedProject) {
          if (isDev) console.log('[useProjectState] ✓ Project loaded:', savedProject.name);
          setProject(savedProject);
          
          const activeBoard = savedProject.boards.find(b => b.id === savedProject.activeBoardId) || savedProject.boards[0];
          if (activeBoard) {
            const normalizedNodes = activeBoard.nodes.map(n => normalizeNodeDimensions(n as any));
            setNodes(normalizedNodes as any);
            setEdges(activeBoard.edges);
            hasLoadedInitialDataRef.current = true;
            lastSavedHashRef.current = quickHash(normalizedNodes, activeBoard.edges);
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
    
    if (prevActiveBoardIdRef.current === null) {
      return;
    }

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
            saveProject(newProject);
            return newProject;
        });
        
        const activeBoard = project.boards.find(b => b.id === project.activeBoardId) || project.boards[0];
        if (activeBoard) {
          const normalizedNodes = activeBoard.nodes.map(n => normalizeNodeDimensions(n as any));
          setNodes(normalizedNodes as any);
          setEdges(activeBoard.edges);
          lastSavedHashRef.current = quickHash(normalizedNodes, activeBoard.edges);
        }

        prevActiveBoardIdRef.current = project.activeBoardId;
    }

  }, [project.activeBoardId, isInitializing, setNodes, setEdges]); 

  // Sync Local State to Project (Debounced Save for Nodes/Edges)
  useEffect(() => {
    if (isInitializing) return;
    if (!hasLoadedInitialDataRef.current) return;

    const timeoutId = setTimeout(async () => {
      const nodesToSave = nodesRef.current;
      const edgesToSave = edgesRef.current;
      
      // Skip save if nothing meaningful changed
      const hash = quickHash(nodesToSave, edgesToSave);
      if (hash === lastSavedHashRef.current) return;
      
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
          
          saveProject(newProject).then(() => {
            lastSavedHashRef.current = hash;
            setLastSaved(new Date());
          }).catch((err) => {
            console.error('[useProjectState] ✗ Auto-save failed:', err);
          });
          
          return newProject;
      });
    }, 2500); // Increased from 1000ms to reduce IDB write frequency

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isInitializing]);

  // Auto-save when project-level data changes (variables, metadata, etc)
  useEffect(() => {
    if (isInitializing) return;
    if (!hasLoadedInitialDataRef.current) return;

    const timeoutId = setTimeout(async () => {
      saveProject(project).then(() => {
        setLastSaved(new Date());
      }).catch((err) => {
        console.error('[useProjectState] ✗ Auto-save failed:', err);
      });
    }, 2500);

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
        saveProject(newProject).then(() => {
          lastSavedHashRef.current = quickHash(nodesToSave, edgesToSave);
          setLastSaved(new Date());
        }).catch((e) => console.error('[useProjectState] ✗ Manual save failed:', e));
        return newProject;
    });
  };
  return { project, setProject, isInitializing, lastSaved, saveNow };
}