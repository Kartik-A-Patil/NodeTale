import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Edge } from 'reactflow';
import { Project, StoryEdge, StoryNode } from '../models/story';
import { CanvasNode, toCanvasEdge, toCanvasNode, toStoryEdge, toStoryNode } from '../adapters/reactFlow';
import { withDefaultZIndex } from '../core/nodes/nodeRegistry';
import { liveSession, LiveSession, Op } from '../services/liveSession';
import { compactProject } from '../services/storageService';
import { fileOf } from '../services/liveShare';
import { editingNode } from '../editor/editingNode';

// Keeps the editor and a live session in step. Changes are found by
// comparing state, not by hooking every editing command: whatever changed a
// node (typing, dragging, undo, paste) shows up as that node's new value.

const FLUSH_MS = 40; // ~25 updates a second while dragging or typing

/** A node as it's shared: its measured size stays local (fonts differ between
 *  computers, and two browsers would keep correcting each other forever). */
const sharedNode = (n: CanvasNode): StoryNode => {
  const { width: _w, height: _h, ...rest } = toStoryNode(n);
  return rest as StoryNode;
};
const nodeJson = new WeakMap<object, string>();
const jsonOfNode = (n: CanvasNode) => {
  let j = nodeJson.get(n);
  if (j === undefined) nodeJson.set(n, (j = JSON.stringify(sharedNode(n))));
  return j;
};
const edgeJson = new WeakMap<object, string>();
const jsonOfEdge = (e: Edge) => {
  let j = edgeJson.get(e);
  if (j === undefined) edgeJson.set(e, (j = JSON.stringify(toStoryEdge(e))));
  return j;
};

/** Project-level settings shared as one entity: everything but the boards' contents. */
const metaOf = (p: Project) => ({
  name: p.name,
  variables: p.variables,
  // Files travel separately; urls only mean something on one device.
  assets: p.assets.map((a) => ({ ...a, url: '' })),
  folders: p.folders,
  coverImage: p.coverImage,
  simulationPresets: p.simulationPresets,
  boards: p.boards.map((b) => ({ id: b.id, name: b.name })),
});
type Meta = ReturnType<typeof metaOf>;

const nodeKey = (board: string, id: string) => `node:${board}:${id}`;
const edgeKey = (board: string, id: string) => `edge:${board}:${id}`;

/** Record this board as what everyone has (on joining, or switching boards). */
export function rememberBoard(nodes: CanvasNode[], edges: Edge[], board: string, known: Map<string, string>) {
  for (const n of nodes) { known.set(nodeKey(board, n.id), jsonOfNode(n)); matched.add(n); }
  for (const e of edges) { known.set(edgeKey(board, e.id), jsonOfEdge(e)); matched.add(e); }
  lastCount.set(known, `${board}:${nodes.length}:${edges.length}`);
}

/**
 * Which of this board's entities differ from what everyone has: changed,
 * added, or (in `known` but gone) deleted. Runs on every state change, drag
 * frames included. State objects are never modified in place, so an object
 * already found to match is skipped from then on; only new objects (the
 * dragged node, the edited one) are compared, and the full scan for deleted
 * entities runs only when the count changes or an unknown entity appears.
 */
const matched = new WeakSet<object>();
const lastCount = new WeakMap<Map<string, string>, string>();

export function changedKeys(nodes: CanvasNode[], edges: Edge[], board: string, known: Map<string, string>): string[] {
  const out: string[] = [];
  const count = `${board}:${nodes.length}:${edges.length}`;
  let scan = lastCount.get(known) !== count;
  lastCount.set(known, count);
  const check = (obj: object, key: string, json: string) => {
    if (known.get(key) === json) matched.add(obj);
    else {
      out.push(key);
      if (!known.has(key)) scan = true; // new here: something else may have gone
    }
  };
  for (const n of nodes) if (!matched.has(n)) check(n, nodeKey(board, n.id), jsonOfNode(n));
  for (const e of edges) if (!matched.has(e)) check(e, edgeKey(board, e.id), jsonOfEdge(e));
  if (scan) {
    const present = new Set<string>();
    for (const n of nodes) present.add(nodeKey(board, n.id));
    for (const e of edges) present.add(edgeKey(board, e.id));
    const nodePrefix = `node:${board}:`, edgePrefix = `edge:${board}:`;
    for (const key of known.keys()) {
      if (!present.has(key) && (key.startsWith(nodePrefix) || key.startsWith(edgePrefix))) out.push(key);
    }
  }
  return out;
}

/** The session for this project, if one is running (re-renders when it starts or ends). */
export function useLiveSessionFor(projectId: string | undefined): LiveSession | null {
  const session = useSyncExternalStore(liveSession.subscribe, liveSession.get);
  return session && session.projectId === projectId && !session.ended ? session : null;
}

interface Args {
  session: LiveSession | null;
  ready: boolean;
  nodes: CanvasNode[];
  edges: Edge[];
  setNodes: (fn: (nodes: CanvasNode[]) => CanvasNode[]) => void;
  setEdges: (fn: (edges: Edge[]) => Edge[]) => void;
  project: Project;
  setProject: (fn: (p: Project) => Project) => void;
  getLiveProject: () => Project;
}

export function useLiveSync({ session, ready, nodes, edges, setNodes, setEdges, project, setProject, getLiveProject }: Args) {
  const activeBoard = project.activeBoardId;
  /** Entity key -> the value everyone has (as JSON), sent or received. */
  const known = useRef(new Map<string, string>());
  const baselineBoard = useRef<string | null>(null);
  const knownAssets = useRef(new Set<string>());
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ nodes, edges, project, activeBoard });
  latest.current = { nodes, edges, project, activeBoard };

  // Host: people joining get the story as it is right now (media goes separately).
  useEffect(() => {
    if (!session || session.role !== 'host') return;
    session.getProject = () => {
      const p = compactProject(getLiveProject());
      return { ...p, assets: p.assets.map((a) => ({ ...a, url: '' })) };
    };
  }, [session, getLiveProject]);

  // ---- sending ----

  /** The state the last comparison ran on: a board switch flushes against it. */
  const compared = useRef(latest.current);

  const flush = useCallback((state = latest.current) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!session) return;
    const { nodes, edges, project, activeBoard } = state;
    const byNode = new Map(nodes.map((n) => [nodeKey(activeBoard, n.id), n]));
    const byEdge = new Map(edges.map((e) => [edgeKey(activeBoard, e.id), e]));
    const ops: Op[] = [];
    for (const key of dirty.current) {
      if (key === 'meta') {
        const meta = metaOf(project);
        const json = JSON.stringify(meta);
        if (known.current.get(key) === json) continue;
        known.current.set(key, json);
        ops.push({ key, value: meta });
        // Media added here: send the files too.
        for (const a of project.assets) {
          if (knownAssets.current.has(a.id)) continue;
          knownAssets.current.add(a.id);
          fileOf(a).then((blob) => blob && session.shareAsset(a.id, blob));
        }
        continue;
      }
      const node = byNode.get(key), edge = byEdge.get(key);
      const json = node ? jsonOfNode(node) : edge ? jsonOfEdge(edge) : null;
      if (json === (known.current.get(key) ?? null)) continue;
      if (json === null) known.current.delete(key); else known.current.set(key, json);
      ops.push({ key, value: node ? sharedNode(node) : edge ? toStoryEdge(edge) : null });
    }
    dirty.current.clear();
    session.sendOps(ops);
  }, [session]);

  const mark = useCallback((key: string) => {
    dirty.current.add(key);
    if (!timer.current) timer.current = setTimeout(() => flush(), FLUSH_MS);
  }, [flush]);

  // What everyone has, before anything is sent: the story as it is now.
  useEffect(() => {
    if (!session || !ready) return;
    knownAssets.current = new Set(latest.current.project.assets.map((a) => a.id));
    known.current.set('meta', JSON.stringify(metaOf(latest.current.project)));
  }, [session, ready]);

  useEffect(() => {
    if (!session || !ready) return;
    // On a board switch the incoming board is the baseline, not a pile of changes.
    if (baselineBoard.current !== activeBoard) {
      // Changes still waiting belong to the board being left: send them first.
      if (dirty.current.size) flush(compared.current);
      baselineBoard.current = activeBoard;
      compared.current = latest.current;
      rememberBoard(nodes, edges, activeBoard, known.current);
      return;
    }
    changedKeys(nodes, edges, activeBoard, known.current).forEach(mark);
    compared.current = latest.current;
  }, [session, ready, nodes, edges, activeBoard, mark, flush]);

  useEffect(() => {
    if (!session || !ready) return;
    if (known.current.get('meta') !== JSON.stringify(metaOf(project))) mark('meta');
  }, [session, ready, project, mark]);

  // ---- receiving ----

  useEffect(() => {
    if (!session || !ready) return;
    const applyNodes = (board: string, ops: { id: string; value: StoryNode | null }[]) => {
      if (board === latest.current.activeBoard) {
        setNodes((nds) => {
          let next = nds;
          for (const { id, value } of ops) {
            const key = nodeKey(board, id);
            const i = next.findIndex((n) => n.id === id);
            if (value === null) {
              known.current.delete(key);
              if (i >= 0) next = next.filter((n) => n.id !== id);
              continue;
            }
            const old = i >= 0 ? next[i] : undefined;
            // Keep what's local: selection and the measured size.
            const node = { ...withDefaultZIndex(toCanvasNode(value)), selected: old?.selected ?? false, width: old?.width, height: old?.height } as CanvasNode;
            known.current.set(key, jsonOfNode(node));
            next = i >= 0 ? next.map((n, j) => (j === i ? node : n)) : [...next, node];
          }
          return next;
        });
      } else {
        setProject((p) => ({
          ...p,
          boards: p.boards.map((b) => {
            if (b.id !== board) return b;
            let nodes = b.nodes;
            for (const { id, value } of ops) {
              nodes = value === null ? nodes.filter((n) => n.id !== id) : nodes.some((n) => n.id === id) ? nodes.map((n) => (n.id === id ? value : n)) : [...nodes, value];
            }
            return { ...b, nodes };
          }),
        }));
      }
    };
    const applyEdges = (board: string, ops: { id: string; value: StoryEdge | null }[]) => {
      if (board === latest.current.activeBoard) {
        setEdges((eds) => {
          let next = eds;
          for (const { id, value } of ops) {
            const key = edgeKey(board, id);
            const i = next.findIndex((e) => e.id === id);
            if (value === null) {
              known.current.delete(key);
              if (i >= 0) next = next.filter((e) => e.id !== id);
              continue;
            }
            const edge = { ...toCanvasEdge(value), selected: i >= 0 ? next[i].selected : false };
            known.current.set(key, jsonOfEdge(edge));
            next = i >= 0 ? next.map((e, j) => (j === i ? edge : e)) : [...next, edge];
          }
          return next;
        });
      } else {
        setProject((p) => ({
          ...p,
          boards: p.boards.map((b) => {
            if (b.id !== board) return b;
            let edges = b.edges;
            for (const { id, value } of ops) {
              edges = value === null ? edges.filter((e) => e.id !== id) : edges.some((e) => e.id === id) ? edges.map((e) => (e.id === id ? value : e)) : [...edges, value];
            }
            return { ...b, edges };
          }),
        }));
      }
    };
    const applyMeta = (meta: Meta) => {
      meta.assets.forEach((a) => knownAssets.current.add(a.id));
      setProject((p) => {
        const urls = new Map(p.assets.map((a) => [a.id, a.url]));
        const boards = meta.boards.map((b) => {
          const mine = p.boards.find((x) => x.id === b.id);
          return mine ? { ...mine, name: b.name } : { id: b.id, name: b.name, nodes: [], edges: [] };
        });
        const next: Project = {
          ...p,
          ...meta,
          assets: meta.assets.map((a) => ({ ...a, url: urls.get(a.id) ?? '' })),
          boards,
          activeBoardId: boards.some((b) => b.id === p.activeBoardId) ? p.activeBoardId : boards[0]?.id ?? p.activeBoardId,
        };
        known.current.set('meta', JSON.stringify(metaOf(next)));
        return next;
      });
    };

    // A node's name for the activity list, from the change or from what's here.
    const labelOf = (board: string, id: string, value: StoryNode | null) => {
      const data = (value?.data ?? (board === latest.current.activeBoard
        ? latest.current.nodes.find((n) => n.id === id)?.data
        : latest.current.project.boards.find((b) => b.id === board)?.nodes.find((n) => n.id === id)?.data)) as { label?: string; text?: string } | undefined;
      return data?.label || data?.text?.slice(0, 40) || 'a node';
    };

    // Others' changes to the node you're typing in wait until you stop. If you
    // changed it meanwhile, yours is the later edit and theirs is dropped.
    const held = new Map<string, { board: string; id: string; value: StoryNode | null; seenJson: string | undefined }>();
    const offStop = editingNode.onStop(() => {
      for (const [key, h] of held) {
        if (editingNode.get() === h.id) continue;
        held.delete(key);
        const now = latest.current.nodes.find((n) => n.id === h.id);
        if ((now ? jsonOfNode(now) : undefined) === h.seenJson) applyNodes(h.board, [{ id: h.id, value: h.value }]);
      }
    });

    const detach = session.attach({
      onOps: (ops, from) => {
        const peer = session.peers.find((p) => p.id === from);
        const nodeOps = new Map<string, { id: string; value: StoryNode | null }[]>();
        const edgeOps = new Map<string, { id: string; value: StoryEdge | null }[]>();
        for (const op of ops) {
          if (op.key === 'meta') {
            applyMeta(op.value as Meta);
            if (peer) session.record({ peerId: peer.id, name: peer.name, color: peer.color, key: op.key, label: 'story settings' });
            continue;
          }
          const [kind, board, ...rest] = op.key.split(':');
          const id = rest.join(':');
          const into = kind === 'node' ? nodeOps : kind === 'edge' ? edgeOps : null;
          if (!into) continue;
          if (kind === 'node') {
            if (peer) session.record({ peerId: peer.id, name: peer.name, color: peer.color, key: op.key, nodeId: id, label: labelOf(board, id, op.value as StoryNode | null), deleted: op.value === null });
            if (board === latest.current.activeBoard && editingNode.get() === id) {
              const now = latest.current.nodes.find((n) => n.id === id);
              held.set(op.key, { board, id, value: op.value as StoryNode | null, seenJson: now ? jsonOfNode(now) : undefined });
              continue;
            }
          }
          if (!into.has(board)) into.set(board, []);
          into.get(board)!.push({ id, value: op.value as never });
        }
        nodeOps.forEach((list, board) => applyNodes(board, list));
        edgeOps.forEach((list, board) => applyEdges(board, list));
      },
    });
    return () => { detach(); offStop(); };
  }, [session, ready, setNodes, setEdges, setProject]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
}
