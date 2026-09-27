// Board layout helpers for the dock's Arrange menu. Pure: they take node boxes
// and edges and return new top-left positions; the caller applies them through
// the (undoable) move command.

export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Link {
  source: string;
  target: string;
}

export type Positions = Map<string, { x: number; y: number }>;

const GAP_X = 120;
const GAP_Y = 48;

/**
 * Layered left-to-right layout: each node goes one column after the furthest
 * node leading into it (loops ignored), columns are ordered to reduce crossings,
 * and the result keeps the arranged set's top-left corner where it was.
 */
export function autoArrange(boxes: Box[], links: Link[], startId?: string | null): Positions {
  const result: Positions = new Map();
  if (boxes.length === 0) return result;
  const ids = new Set(boxes.map((b) => b.id));
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const out = new Map<string, string[]>(boxes.map((b) => [b.id, []]));
  for (const l of links) if (ids.has(l.source) && ids.has(l.target) && l.source !== l.target) out.get(l.source)!.push(l.target);

  // DFS from roots (Start first) to drop back-edges, so layering terminates.
  const incoming = new Map<string, number>(boxes.map((b) => [b.id, 0]));
  for (const [, targets] of out) for (const t of targets) incoming.set(t, incoming.get(t)! + 1);
  const roots = [
    ...(startId && ids.has(startId) ? [startId] : []),
    ...boxes.filter((b) => incoming.get(b.id) === 0 && b.id !== startId).sort((a, b) => a.y - b.y).map((b) => b.id),
  ];
  const forward = new Map<string, string[]>(boxes.map((b) => [b.id, []]));
  const state = new Map<string, 1 | 2>(); // 1 = on stack, 2 = done
  const visit = (root: string) => {
    const stack: { id: string; i: number }[] = [{ id: root, i: 0 }];
    state.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const targets = out.get(top.id)!;
      if (top.i >= targets.length) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const t = targets[top.i++];
      if (state.get(t) === 1) continue; // back-edge: a loop
      forward.get(top.id)!.push(t);
      if (!state.has(t)) {
        state.set(t, 1);
        stack.push({ id: t, i: 0 });
      }
    }
  };
  for (const r of roots) if (!state.has(r)) visit(r);
  for (const b of [...boxes].sort((a, c) => a.x - c.x)) if (!state.has(b.id)) visit(b.id);

  // Longest-path layering over the acyclic edges (Kahn order).
  const indeg = new Map<string, number>(boxes.map((b) => [b.id, 0]));
  for (const [, ts] of forward) for (const t of ts) indeg.set(t, indeg.get(t)! + 1);
  const layer = new Map<string, number>(boxes.map((b) => [b.id, 0]));
  const queue = boxes.filter((b) => indeg.get(b.id) === 0).map((b) => b.id);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    for (const t of forward.get(id)!) {
      layer.set(t, Math.max(layer.get(t)!, layer.get(id)! + 1));
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }

  const columns: string[][] = [];
  for (const b of boxes) (columns[layer.get(b.id)!] ??= []).push(b.id);

  // Order: first column by current y; later columns by the average row of their predecessors.
  const row = new Map<string, number>();
  const preds = new Map<string, string[]>(boxes.map((b) => [b.id, []]));
  for (const [s, ts] of forward) for (const t of ts) preds.get(t)!.push(s);
  columns.forEach((col, ci) => {
    const key = (id: string) => {
      const p = preds.get(id)!.filter((s) => row.has(s));
      return ci === 0 || p.length === 0 ? byId.get(id)!.y : p.reduce((sum, s) => sum + row.get(s)!, 0) / p.length;
    };
    const keys = new Map(col.map((id) => [id, key(id)]));
    col.sort((a, b) => keys.get(a)! - keys.get(b)! || byId.get(a)!.y - byId.get(b)!.y);
    col.forEach((id, i) => row.set(id, i));
  });

  // Place: columns left to right, each column vertically centred on the tallest one.
  const colHeights = columns.map((col) => col.reduce((h, id) => h + byId.get(id)!.height, 0) + GAP_Y * (col.length - 1));
  const maxHeight = Math.max(...colHeights);
  const originX = Math.min(...boxes.map((b) => b.x));
  const originY = Math.min(...boxes.map((b) => b.y));
  let x = originX;
  columns.forEach((col, ci) => {
    let y = originY + (maxHeight - colHeights[ci]) / 2;
    for (const id of col) {
      result.set(id, { x: Math.round(x), y: Math.round(y) });
      y += byId.get(id)!.height + GAP_Y;
    }
    x += Math.max(...col.map((id) => byId.get(id)!.width)) + GAP_X;
  });
  return result;
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export function align(boxes: Box[], mode: AlignMode): Positions {
  const result: Positions = new Map();
  if (boxes.length < 2) return result;
  const left = Math.min(...boxes.map((b) => b.x));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const top = Math.min(...boxes.map((b) => b.y));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  for (const b of boxes) {
    const x = mode === 'left' ? left : mode === 'right' ? right - b.width : mode === 'center' ? (left + right) / 2 - b.width / 2 : b.x;
    const y = mode === 'top' ? top : mode === 'bottom' ? bottom - b.height : mode === 'middle' ? (top + bottom) / 2 - b.height / 2 : b.y;
    result.set(b.id, { x: Math.round(x), y: Math.round(y) });
  }
  return result;
}

/** Equal gaps between neighbours along one axis; the outermost two stay put. */
export function distribute(boxes: Box[], axis: 'horizontal' | 'vertical'): Positions {
  const result: Positions = new Map();
  if (boxes.length < 3) return result;
  const h = axis === 'horizontal';
  const sorted = [...boxes].sort((a, b) => (h ? a.x - b.x : a.y - b.y));
  const start = h ? sorted[0].x : sorted[0].y;
  const last = sorted[sorted.length - 1];
  const end = h ? last.x + last.width : last.y + last.height;
  const total = sorted.reduce((sum, b) => sum + (h ? b.width : b.height), 0);
  const gap = (end - start - total) / (sorted.length - 1);
  let cursor = start;
  for (const b of sorted) {
    result.set(b.id, h ? { x: Math.round(cursor), y: b.y } : { x: b.x, y: Math.round(cursor) });
    cursor += (h ? b.width : b.height) + gap;
  }
  return result;
}
