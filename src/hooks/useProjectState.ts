import { useState, useEffect, useRef } from 'react';
import { Project, AppNode } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { saveProject, loadProject } from '../services/storageService';
import { Node, Edge } from 'reactflow';
import { computeBoardHash, hashString } from '../utils/contentHash';

const isDev = import.meta.env.DEV;

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

const projectMetaHash = (project: Project): string =>
  hashString(JSON.stringify({
    name: project.name,
    variables: project.variables,
    assets: project.assets,
    folders: project.folders,
    coverImage: project.coverImage,
  }));

const computeDirtyHash = (nodes: Node[], edges: Edge[], project: Project): string =>
  `${computeBoardHash(nodes, edges)}::${projectMetaHash(project)}`;

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
            lastSavedHashRef.current = computeDirtyHash(normalizedNodes, activeBoard.edges, savedProject);
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
          lastSavedHashRef.current = computeDirtyHash(normalizedNodes, activeBoard.edges, project);
        }

        prevActiveBoardIdRef.current = project.activeBoardId;
    }

  }, [project.activeBoardId, isInitializing, setNodes, setEdges]);

  useEffect(() => {
    if (isInitializing) return;
    if (!hasLoadedInitialDataRef.current) return;

    const hash = computeDirtyHash(nodes, edges, project);
    if (hash === lastSavedHashRef.current) return;

    const timeoutId = setTimeout(async () => {
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

          // Set before the async save resolves, or this effect re-runs (its
          // own setProject call changes the `project` dependency) against a
          // still-stale ref and schedules a redundant duplicate save.
          lastSavedHashRef.current = computeDirtyHash(nodesToSave, edgesToSave, newProject);

          saveProject(newProject).then(() => {
            setLastSaved(new Date());
          }).catch((err) => {
            console.error('[useProjectState] ✗ Auto-save failed:', err);
          });

          return newProject;
      });
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, project, isInitializing]);

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
        lastSavedHashRef.current = computeDirtyHash(nodesToSave, edgesToSave, newProject);
        saveProject(newProject).then(() => {
          setLastSaved(new Date());
        }).catch((e) => console.error('[useProjectState] ✗ Manual save failed:', e));
        return newProject;
    });
  };
  return { project, setProject, isInitializing, lastSaved, saveNow };
}
