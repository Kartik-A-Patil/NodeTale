import { Node, Position } from 'reactflow';

// this helper function returns the intersection point
// of the line between the center of the intersectionNode and the target node
function getNodeIntersection(intersectionNode: Node, targetNodeGeometry: { x: number, y: number, width: number, height: number }) {
  // https://math.stackexchange.com/questions/1724792/an-algorithm-for-finding-the-intersection-point-between-a-center-of-vision-and-a
  const {
    width: intersectionNodeWidth,
    height: intersectionNodeHeight,
    positionAbsolute: intersectionNodePosition,
  } = intersectionNode;
  
  const w = (intersectionNodeWidth ?? 0) / 2;
  const h = (intersectionNodeHeight ?? 0) / 2;

  const x2 = (intersectionNodePosition?.x ?? 0) + w;
  const y2 = (intersectionNodePosition?.y ?? 0) + h;
  const x1 = targetNodeGeometry.x + targetNodeGeometry.width / 2;
  const y1 = targetNodeGeometry.y + targetNodeGeometry.height / 2;

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
function getEdgePosition(node: Node, intersectionPoint: { x: number; y: number }) {
  const n = { ...node.positionAbsolute, ...node };
  const nx = Math.round(n.x ?? 0);
  const ny = Math.round(n.y ?? 0);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  const width = node.width ?? 0;
  const height = node.height ?? 0;

  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + width - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= ny + height - 1) {
    return Position.Bottom;
  }

  return Position.Top;
}

function getHandleCoordsByPosition(node: Node, position: Position) {
  const x = node.positionAbsolute?.x ?? 0;
  const y = node.positionAbsolute?.y ?? 0;
  const width = node.width ?? 0;
  const height = node.height ?? 0;

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
  source: Node, 
  target: Node,
  sourceHandlePos?: { x: number, y: number, position: Position },
  targetHandlePos?: { x: number, y: number, position: Position }
) {
  let sx, sy, sourcePos;
  let tx, ty, targetPos;

  // Calculate Source Point
  if (sourceHandlePos) {
      sx = sourceHandlePos.x;
      sy = sourceHandlePos.y;
      sourcePos = sourceHandlePos.position;
  } else {
      // If source is floating, we need a target reference point
      // If target is fixed, use target handle pos. If target is floating, use target center.
      const targetRef = targetHandlePos 
          ? { x: targetHandlePos.x, y: targetHandlePos.y, width: 0, height: 0 } // Treat handle as a point
          : { x: target.positionAbsolute!.x!, y: target.positionAbsolute!.y!, width: target.width!, height: target.height! };
      
      const sourceIntersectionPoint = getNodeIntersection(source, targetRef);
      sourcePos = getEdgePosition(source, sourceIntersectionPoint);
      const sourceCoords = getHandleCoordsByPosition(source, sourcePos);
      sx = sourceCoords.x;
      sy = sourceCoords.y;
  }

  // Calculate Target Point
  if (targetHandlePos) {
      tx = targetHandlePos.x;
      ty = targetHandlePos.y;
      targetPos = targetHandlePos.position;
  } else {
      // If target is floating, we need a source reference point
      const sourceRef = sourceHandlePos
          ? { x: sourceHandlePos.x, y: sourceHandlePos.y, width: 0, height: 0 }
          : { x: source.positionAbsolute!.x!, y: source.positionAbsolute!.y!, width: source.width!, height: source.height! };

      const targetIntersectionPoint = getNodeIntersection(target, sourceRef);
      targetPos = getEdgePosition(target, targetIntersectionPoint);

      // Prevent target from connecting to the Right side
      if (targetPos === Position.Right) {
        const targetCenterY = (target.positionAbsolute?.y ?? 0) + (target.height ?? 0) / 2;
        const sourceRefCenterY = sourceRef.y + sourceRef.height / 2;

        if (sourceRefCenterY < targetCenterY) {
          targetPos = Position.Top;
        } else {
          targetPos = Position.Bottom;
        }
      }

      const targetCoords = getHandleCoordsByPosition(target, targetPos);
      tx = targetCoords.x;
      ty = targetCoords.y;
  }

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePos,
    targetPos,
  };
}
