import * as fabric from 'fabric'

export type RecognizedShape = 
  | { type: 'line', x1: number, y1: number, x2: number, y2: number }
  | { type: 'rectangle', left: number, top: number, width: number, height: number }
  | { type: 'ellipse', rx: number, ry: number, cx: number, cy: number }
  | { type: 'triangle', x1: number, y1: number, x2: number, y2: number, x3: number, y3: number }

interface Point { x: number, y: number }

function getDistance(p1: Point, p2: Point) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

function distanceToSegment(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return getDistance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return getDistance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

export function recognizeShape(points: Point[]): RecognizedShape | null {
  if (points.length < 10) return null;

  const startPt = points[0];
  const endPt = points[points.length - 1];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  
  const width = maxX - minX;
  const height = maxY - minY;
  const diag = Math.sqrt(width * width + height * height);
  if (diag < 20) return null; // Too small

  const isClosed = getDistance(startPt, endPt) < diag * 0.25; // start and end are 25% diag close to each other.

  if (!isClosed) {
    // Check for straight line
    let maxDist = 0;
    for (const pt of points) {
      const d = distanceToSegment(pt, startPt, endPt);
      if (d > maxDist) maxDist = d;
    }
    if (maxDist < diag * 0.1) {
      return { type: 'line', x1: startPt.x, y1: startPt.y, x2: endPt.x, y2: endPt.y };
    }
    return null;
  }

  // It's closed. Check Circle/Ellipse
  const cx = minX + width / 2;
  const cy = minY + height / 2;
  const rx = width / 2;
  const ry = height / 2;

  let avgEllipseDist = 0;
  for (const pt of points) {
    const nx = rx === 0 ? 0 : (pt.x - cx) / rx;
    const ny = ry === 0 ? 0 : (pt.y - cy) / ry;
    const d = Math.sqrt(nx * nx + ny * ny);
    // Approximation of physical distance to the ellipse boundary
    const radiusAtAngle = d === 0 ? Math.max(rx, ry) : Math.sqrt(((nx/d)*rx)**2 + ((ny/d)*ry)**2);
    avgEllipseDist += Math.abs(d - 1) * radiusAtAngle;
  }
  avgEllipseDist /= points.length;

  // Check Rectangle
  let avgRectDist = 0;
  for (const pt of points) {
    const dLeft = Math.abs(pt.x - minX);
    const dRight = Math.abs(pt.x - maxX);
    const dTop = Math.abs(pt.y - minY);
    const dBottom = Math.abs(pt.y - maxY);
    avgRectDist += Math.min(dLeft, dRight, dTop, dBottom);
  }
  avgRectDist /= points.length;

  // Check Triangle 
  // Find roughly the 3 extreme points (simplistic convex hull approach)
  // Let's pick 3 points that form the largest area.
  let p1 = startPt, p2 = startPt, p3 = startPt;
  let maxTriArea = 0;

  // We sub-sample for performance
  const step = Math.max(1, Math.floor(points.length / 20));
  const subPts = points.filter((_, i) => i % step === 0);
  
  for (let i = 0; i < subPts.length; i++) {
    for (let j = i + 1; j < subPts.length; j++) {
      for (let k = j + 1; k < subPts.length; k++) {
        const area = Math.abs(
          (subPts[i].x * (subPts[j].y - subPts[k].y) +
           subPts[j].x * (subPts[k].y - subPts[i].y) +
           subPts[k].x * (subPts[i].y - subPts[j].y)) / 2
        );
        if (area > maxTriArea) {
          maxTriArea = area;
          p1 = subPts[i];
          p2 = subPts[j];
          p3 = subPts[k];
        }
      }
    }
  }

  // test distance to the 3 edges
  let avgTriDist = 0;
  for (const pt of points) {
    const d1 = distanceToSegment(pt, p1, p2);
    const d2 = distanceToSegment(pt, p2, p3);
    const d3 = distanceToSegment(pt, p3, p1);
    avgTriDist += Math.min(d1, d2, d3);
  }
  avgTriDist /= points.length;

  // Compare distances and pick the best matching shape
  const threshold = diag * 0.1;
  const shapes = [
    { type: 'ellipse', dist: avgEllipseDist, shape: { type: 'ellipse', rx, ry, cx, cy } },
    { type: 'rectangle', dist: avgRectDist, shape: { type: 'rectangle', left: minX, top: minY, width, height } },
    { type: 'triangle', dist: avgTriDist, shape: { type: 'triangle', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, x3: p3.x, y3: p3.y } }
  ];

  // Sort by lowest deviation distance
  shapes.sort((a, b) => a.dist - b.dist);

  if (shapes[0].dist < threshold) {
    return shapes[0].shape as RecognizedShape;
  }

  return null;
}
