import * as fabric from 'fabric'
import { getStroke } from 'perfect-freehand'

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return ''
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}

export class CalligraphyBrush extends fabric.BaseBrush {
  private points: { x: number; y: number; pressure?: number }[] = []
  private currentPath: fabric.Path | null = null
  public pressureWidth: number = 3
  private fillOpacity: number = 1

  constructor(canvas: fabric.Canvas) {
    super(canvas)
  }

  setHighlighterMode(isHighlighter: boolean, hexColor: string) {
    if (isHighlighter) {
      this.color = hexColor + '55' // Adding transparency to hex
      // Make highlighter thicker and slightly less pressure sensitive
      this.pressureWidth = 20
    } else {
      this.color = hexColor
    }
  }

  onMouseDown(pointer: fabric.Point, options: fabric.TPointerEventInfo) {
    const e = options.e as PointerEvent
    this.points = [{ x: pointer.x, y: pointer.y, pressure: e.pressure || 0.5 }]
  }

  onMouseMove(pointer: fabric.Point, options: fabric.TPointerEventInfo) {
    const e = options.e as PointerEvent
    this.points.push({ x: pointer.x, y: pointer.y, pressure: e.pressure || 0.5 })
    
    if (!this.canvas.contextTop) return
    const ctx = this.canvas.contextTop
    this.canvas.clearContext(ctx)
    
    // Draw the smooth filled stroke on the top canvas layer
    const stroke = getStroke(this.points, {
      size: this.pressureWidth,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true
    })

    const pathData = getSvgPathFromStroke(stroke)
    
    ctx.fillStyle = this.color
    const p2d = new Path2D(pathData)
    ctx.fill(p2d)
  }

  onMouseUp(options: fabric.TPointerEventInfo) {
    if (!this.canvas.contextTop) return
    
    const stroke = getStroke(this.points, {
      size: this.pressureWidth,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true
    })
    
    const pathData = getSvgPathFromStroke(stroke)
    
    this.currentPath = new fabric.Path(pathData, {
      fill: this.color,
      strokeWidth: 0,
      stroke: '',
      selectable: true,
      evented: true,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      // Highlighter strokes look better with normal compositing, but wait, usually default is source-over
    })

    this.canvas.clearContext(this.canvas.contextTop)
    this.canvas.add(this.currentPath)
    this.canvas.fire('path:created', { path: this.currentPath })
    
    this.points = []
    this.currentPath = null
  }
}
