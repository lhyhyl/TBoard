import * as fabric from 'fabric'
import { getStroke } from 'perfect-freehand'
import { recognizeShape } from '../../utils/shapeRecognizer'

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
  private currentPath: fabric.Object | null = null
  public pressureWidth: number = 3
  private fillOpacity: number = 1
  private _renderFrame: number = 0

  // Shape Recognition Properties
  private _holdTimer: number = 0;
  private _recognizedShape: any = null; // Store the preview metadata

  constructor(canvas: fabric.Canvas) {
    super(canvas)
    // Hook into the render cycle to ensure the preview is redrawn if the canvas re-renders
    // (e.g., due to background tasks or other object changes).
    canvas.on('after:render', this.onCanvasAfterRender);
  }

  private onCanvasAfterRender = () => {
    // Only redraw if we are the active brush and in the middle of a drawing operation.
    // This prevents background brushes from lingering after a tool change.
    if (this.canvas.freeDrawingBrush === this && this.points.length > 0) {
      this.renderBrushFrame();
    }
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
    this._recognizedShape = null;
    this.resetHoldTimer();
    this.renderBrushFrame()
  }

  private resetHoldTimer() {
    if (this._holdTimer) {
      window.clearTimeout(this._holdTimer);
    }
    this._holdTimer = window.setTimeout(this.checkHoldEvent, 500);
  }

  private checkHoldEvent = () => {
    if (this.points.length < 10 || this._recognizedShape) return;
    const shape = recognizeShape(this.points);
    if (shape) {
      this._recognizedShape = shape;
      // Use requestAnimationFrame for consistency
      if (this._renderFrame) cancelAnimationFrame(this._renderFrame);
      this._renderFrame = requestAnimationFrame(() => {
        this.renderBrushFrame();
        this.canvas.requestRenderAll(); // Ensure canvas knows it changed
      });
    }
  }

  public _render() {
    // Implementing abstract method, but we have our own custom rendering flow
  }

  private renderBrushFrame = () => {
    if (!this.canvas.contextTop || this.points.length === 0) return
    const ctx = this.canvas.contextTop
    this.canvas.clearContext(ctx)
    
    ctx.save()
    if (this.canvas.viewportTransform) {
      ctx.transform(...this.canvas.viewportTransform)
    }

    if (this._recognizedShape) {
      // Draw standard shape geometric preview
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.pressureWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const shape = this._recognizedShape;
      ctx.beginPath();
      if (shape.type === 'line') {
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
      } else if (shape.type === 'rectangle') {
        ctx.rect(shape.left, shape.top, shape.width, shape.height);
      } else if (shape.type === 'ellipse') {
        ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      } else if (shape.type === 'triangle') {
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.lineTo(shape.x3, shape.y3);
        ctx.closePath();
      }
      ctx.stroke();
    } else {
      // Draw the smooth filled stroke on the top canvas layer
      const stroke = getStroke(this.points, {
        size: this.pressureWidth,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.3,
        simulatePressure: true
      })

      const pathData = getSvgPathFromStroke(stroke)
      
      ctx.fillStyle = this.color
      const p2d = new Path2D(pathData)
      ctx.fill(p2d)
    }
    
    ctx.restore()
  }

  onMouseMove(pointer: fabric.Point, options: fabric.TPointerEventInfo) {
    if (this._recognizedShape) {
      // Keep redrawing the recognized shape preview to prevent flickering
      // if something else clears the contextTop.
      this.renderBrushFrame();
      return;
    }

    const e = options.e as PointerEvent
    
    // Decimate points: only add if moved more than 1.5 pixels or it's the first move
    if (this.points.length > 0) {
      const lastPoint = this.points[this.points.length - 1]
      const dx = pointer.x - lastPoint.x
      const dy = pointer.y - lastPoint.y
      if (dx * dx + dy * dy < 2.25) return // 1.5 * 1.5
    }

    this.points.push({ x: pointer.x, y: pointer.y, pressure: e.pressure || 0.5 })
    
    this.resetHoldTimer();

    if (this._renderFrame) {
      cancelAnimationFrame(this._renderFrame)
    }
    
    // Throttle the intense Path2D calculation by bounding to animation frames
    this._renderFrame = requestAnimationFrame(this.renderBrushFrame)
  }

  onMouseUp(options: fabric.TPointerEventInfo) {
    if (this._holdTimer) {
      window.clearTimeout(this._holdTimer);
      this._holdTimer = 0;
    }
    if (this._renderFrame) {
      cancelAnimationFrame(this._renderFrame)
      this._renderFrame = 0
    }

    if (!this.canvas.contextTop || this.points.length === 0) return
    
    let isStandardShape = false;

    if (this._recognizedShape) {
      // User held pen, and shape was recognized.
      // Generate actual Fabric shape objects
      const shape = this._recognizedShape;
      const strokeOptions = {
        stroke: this.color,
        strokeWidth: this.pressureWidth,
        fill: 'transparent', // Usually we don't want black fill for drawn shapes
        selectable: true,
        evented: true,
        strokeUniform: true,
        strokeLineCap: 'round' as CanvasLineCap,
        strokeLineJoin: 'round' as CanvasLineJoin
      };

      if (shape.type === 'line') {
        this.currentPath = new fabric.Line([shape.x1, shape.y1, shape.x2, shape.y2], strokeOptions) as any;
      } else if (shape.type === 'rectangle') {
        this.currentPath = new fabric.Rect({
          left: shape.left, top: shape.top, width: shape.width, height: shape.height, ...strokeOptions
        }) as any;
      } else if (shape.type === 'ellipse') {
        this.currentPath = new fabric.Ellipse({
          left: shape.cx - shape.rx, top: shape.cy - shape.ry,
          rx: shape.rx, ry: shape.ry, ...strokeOptions
        }) as any;
      } else if (shape.type === 'triangle') {
        this.currentPath = new fabric.Polygon([
          {x: shape.x1, y: shape.y1},
          {x: shape.x2, y: shape.y2},
          {x: shape.x3, y: shape.y3}
        ], strokeOptions) as any;
      }
      isStandardShape = true;
    } else {
      // Normal freehand calligraphy flow
      const stroke = getStroke(this.points, {
        size: this.pressureWidth,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.3,
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
        objectCaching: true
      })
    }

    this.canvas.clearContext(this.canvas.contextTop)
    
    if (this.currentPath) {
      this.canvas.add(this.currentPath)
      this.canvas.fire('path:created', { path: this.currentPath })
    }
    
    this.points = []
    this._recognizedShape = null;
    this.currentPath = null
  }
}
