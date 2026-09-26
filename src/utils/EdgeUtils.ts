import { Position } from 'reactflow';

// The subset of a node an edge's geometry depends on. FloatingEdge selects
// exactly this from the store so it only re-renders when its own endpoints move.
export interface NodeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HandlePoint {
  x: number;
  y: number;
  position: Position;
}

// this helper function returns the intersection point
// of the line between the center of the intersectionNode and the target node
function getNodeIntersection(node: NodeGeometry, targetGeometry: NodeGeometry) {
  // https://math.stackexchange.com/questions/1724792/an-algorithm-for-finding-the-intersection-point-between-a-center-of-vision-and-a
  const w = node.width / 2;
  const h = node.height / 2;

  const x2 = node.x + w;
  const y2 = node.y + h;
  const x1 = targetGeometry.x + targetGeometry.width / 2;
  const y1 = targetGeometry.y + targetGeometry.height / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

// returns the position (top,right,bottom or right) passed node compared to the intersection point
function getEdgePosition(node: NodeGeometry, intersectionPoint: { x: number; y: number }) {
  const nx = Math.round(node.x);
  const ny = Math.round(node.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + node.width - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= ny + node.height - 1) {
    return Position.Bottom;
  }

  return Position.Top;
}

function getHandleCoordsByPosition(node: NodeGeometry, position: Position) {
  const { x, y, width, height } = node;

  switch (position) {
    case Position.Top:
      return { x: x + width / 2, y };
    case Position.Right:
      return { x: x + width, y: y + height / 2 };
    case Position.Bottom:
      return { x: x + width / 2, y: y + height };
    case Position.Left:
      return { x, y: y + height / 2 };
  }
}

// returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) you need to create an edge
export function getEdgeParams(
  source: NodeGeometry,
  target: NodeGeometry,
  sourceHandlePos?: HandlePoint,
) {
  let sx, sy, sourcePos;

  // Calculate Source Point
  if (sourceHandlePos) {
      sx = sourceHandlePos.x;
      sy = sourceHandlePos.y;
      sourcePos = sourceHandlePos.position;
  } else {
      // Floating source: aim at the target's center.
      const sourceIntersectionPoint = getNodeIntersection(source, target);
      sourcePos = getEdgePosition(source, sourceIntersectionPoint);
      const sourceCoords = getHandleCoordsByPosition(source, sourcePos);
      sx = sourceCoords.x;
      sy = sourceCoords.y;
  }

  // Calculate Target Point (targets always float — any side can receive)
  const sourceRef = sourceHandlePos
      ? { x: sourceHandlePos.x, y: sourceHandlePos.y, width: 0, height: 0 } // Treat handle as a point
      : source;

  const targetIntersectionPoint = getNodeIntersection(target, sourceRef);
  let targetPos = getEdgePosition(target, targetIntersectionPoint);

  // Prevent target from connecting to the Right side
  if (targetPos === Position.Right) {
    const targetCenterY = target.y + target.height / 2;
    const sourceRefCenterY = sourceRef.y + sourceRef.height / 2;
    targetPos = sourceRefCenterY < targetCenterY ? Position.Top : Position.Bottom;
  }

  const { x: tx, y: ty } = getHandleCoordsByPosition(target, targetPos);

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePos,
    targetPos,
  };
}
