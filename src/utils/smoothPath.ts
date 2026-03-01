/**
 * smoothPath.ts
 *
 * Stroke beautification via Chaikin corner-cutting algorithm.
 * After each pen stroke is committed to the Fabric.js canvas,
 * this utility smooths the raw polyline into a fluid Bézier curve.
 */

// Fabric.js path command element: ['M' | 'L' | 'Q' | 'C' | 'Z', ...numbers]
type PathCmd = (string | number)[]

/** Extract anchor points from a Fabric.js path command array */
function extractPoints(pathData: PathCmd[]): [number, number][] {
  const pts: [number, number][] = []
  for (const cmd of pathData) {
    const type = cmd[0] as string
    if (type === 'M' || type === 'L') {
      pts.push([cmd[1] as number, cmd[2] as number])
    } else if (type === 'Q') {
      // Quadratic Bézier: control point (cmd[1], cmd[2]), end point (cmd[3], cmd[4])
      pts.push([cmd[3] as number, cmd[4] as number])
    } else if (type === 'C') {
      // Cubic Bézier: use end point only
      pts.push([cmd[5] as number, cmd[6] as number])
    }
  }
  return pts
}

/**
 * Chaikin corner-cutting
 * Each iteration replaces every edge P0→P1 with two new points:
 *   Q = 0.75*P0 + 0.25*P1
 *   R = 0.25*P0 + 0.75*P1
 * After 2–3 iterations the polyline converges toward a quadratic B-spline.
 */
function chaikin(points: [number, number][], iterations = 2): [number, number][] {
  let pts = points
  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = [pts[0]] // keep first point
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[i + 1]
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1])
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
    }
    next.push(pts[pts.length - 1]) // keep last point
    pts = next
  }
  return pts
}

/**
 * Convert a smoothed point array to Fabric.js quadratic Bézier path commands.
 * Uses the midpoint method: mid-points become on-curve anchors, original
 * smoothed points become control points → produces a smooth G1-continuous curve.
 */
function pointsToPathData(points: [number, number][]): PathCmd[] {
  if (points.length < 2) return [['M', points[0][0], points[0][1]]]

  const cmds: PathCmd[] = [['M', points[0][0], points[0][1]]]

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    // Mid-point between current and next is the on-curve anchor
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    cmds.push(['Q', x0, y0, mx, my])
  }

  // End at the last actual point
  const last = points[points.length - 1]
  cmds.push(['L', last[0], last[1]])

  return cmds
}

/**
 * Main entry point: smooth a Fabric.js path's data array.
 *
 * Returns the original data unchanged if there are fewer than 3 points
 * (nothing meaningful to smooth).
 *
 * @param pathData  The `path` property of a `fabric.Path` object
 * @param iterations  Chaikin iterations (default 2; raise to 3 for extra-smooth)
 */
export function smoothFabricPath(pathData: PathCmd[], iterations = 2): PathCmd[] {
  const points = extractPoints(pathData)
  if (points.length < 3) return pathData

  const smoothed = chaikin(points, iterations)
  return pointsToPathData(smoothed)
}
