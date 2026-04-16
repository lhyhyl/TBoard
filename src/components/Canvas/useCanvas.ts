import { useEffect, useRef, useCallback } from 'react'
import * as fabric from 'fabric'
import { useToolStore } from '../../store/toolStore'
import { smoothFabricPath } from '../../utils/smoothPath'
import { TOOL_CURSORS } from '../../utils/cursors'
import { useBoardStore } from '../../store/boardStore'
import { useShortcutStore, matchesShortcut, type ShortcutAction } from '../../store/shortcutStore'
import type { BackgroundType, ToolType } from '../../types'
import { CalligraphyBrush } from './CalligraphyBrush'

/* History stack for undo/redo */
const MAX_HISTORY = 50

/* ---------- Utilities ---------- */
function pointInPolygon(point: {x: number, y: number}, vs: {x: number, y: number}[]) {
  let x = point.x, y = point.y
  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y
    let xj = vs[j].x, yj = vs[j].y
    let intersect = ((yi > y) != (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/* ---------- Pressure-sensitive brush ---------- */
class PressureBrush extends fabric.PencilBrush {
  pressureWidth = 3

  onMouseDown(pointer: fabric.Point, ev: fabric.TPointerEventInfo) {
    this.width = this.pressureWidth
    return super.onMouseDown(pointer, ev)
  }

  onMouseMove(pointer: fabric.Point, ev: fabric.TPointerEventInfo) {
    return super.onMouseMove(pointer, ev)
  }
}

/* ---------- Draw background pattern via native Canvas2D ---------- */
function drawBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  bgType: BackgroundType,
  vpt: number[],
  canvasWidth: number,
  canvasHeight: number
) {
  if (bgType === 'blank') return

  const zoom = vpt[0]
  const panX = vpt[4]
  const panY = vpt[5]
  const gap = 30 * zoom
  if (gap < 4) return // too dense at extreme zoom-out

  ctx.save()
  const startX = panX % gap
  const startY = panY % gap

  if (bgType === 'grid') {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let x = startX; x < canvasWidth; x += gap) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasHeight)
    }
    for (let y = startY; y < canvasHeight; y += gap) {
      ctx.moveTo(0, y)
      ctx.lineTo(canvasWidth, y)
    }
    ctx.stroke()
  } else if (bgType === 'lines') {
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.5)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let y = startY; y < canvasHeight; y += gap) {
      ctx.moveTo(0, y)
      ctx.lineTo(canvasWidth, y)
    }
    ctx.stroke()
  } else if (bgType === 'dots') {
    const dotR = Math.max(1, 1.2 * zoom)
    ctx.fillStyle = 'rgba(180, 180, 180, 0.6)'
    for (let x = startX; x < canvasWidth; x += gap) {
      for (let y = startY; y < canvasHeight; y += gap) {
        ctx.beginPath()
        ctx.arc(x, y, dotR, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  ctx.restore()
}

export function useCanvas(
  canvasEl: React.RefObject<HTMLCanvasElement | null>,
  width: number,
  height: number
) {
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef<number>(-1)
  const skipHistoryRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { activeTool, penOptions, calligraphyMode } = useToolStore()
  const { activeBoardId, activeBoard, updateBoardCanvas } = useBoardStore()
  const loadedIdRef = useRef<string | null>(null)

  /* ---------- Init canvas ---------- */
  useEffect(() => {
    if (!canvasEl.current) return

    const canvas = new fabric.Canvas(canvasEl.current, {
      backgroundColor: 'transparent',
      isDrawingMode: activeTool === 'pen' || activeTool === 'eraser',
      selection: activeTool === 'select',
      preserveObjectStacking: true,
      enablePointerEvents: true
    })

    fabricRef.current = canvas
    loadedIdRef.current = null // Reset on new ID

    // Load board data if it's already available in store
    if (activeBoard?.id === activeBoardId && activeBoard.canvasJSON) {
      skipHistoryRef.current = true // Lock observers during initial load
      canvas.loadFromJSON(JSON.parse(activeBoard.canvasJSON))
        .then(() => {
          canvas.renderAll()
          skipHistoryRef.current = false
          pushHistory(canvas)
          loadedIdRef.current = activeBoardId
        })
        .catch(err => {
          console.error('Failed to load board JSON:', err)
          skipHistoryRef.current = false
        })
    } else {
      pushHistory(canvas)
    }

    // Smooth pen strokes on lift
    const onPathCreated = (e: { path: fabric.Path }) => {
      const { smoothStroke, activeTool, calligraphyMode } = useToolStore.getState()
      if (!smoothStroke || calligraphyMode) return
      if (activeTool !== 'pen' && activeTool !== 'highlighter') return
      const path = e.path
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (path as any).path as (string | number)[][]
      if (!raw || raw.length < 3) return
      const smoothed = smoothFabricPath(raw)
      // Use Fabric.js v6's internal _setPath(data, adjustPosition) so that
      // pathOffset, width and height are all recalculated together.
      // Direct mutation of .path leaves pathOffset stale, causing the path
      // to render displaced (composited over white → appears colour-faded).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(path as any)._setPath(smoothed, true)
      path.dirty = true
      path.setCoords()
      canvas.requestRenderAll()
    }

    // Object changed → save
    canvas.on('object:added', onCanvasChanged)
    canvas.on('object:modified', onCanvasChanged)
    canvas.on('object:removed', onCanvasChanged)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on('path:created', onPathCreated as any)

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId])

  /* ---------- Handle async loading of board data ---------- */
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !activeBoard || activeBoard.id !== activeBoardId) return
    if (loadedIdRef.current === activeBoardId) return // Already loaded

    if (activeBoard.canvasJSON) {
      skipHistoryRef.current = true // Lock observers during async load
      canvas.loadFromJSON(JSON.parse(activeBoard.canvasJSON))
        .then(() => {
          canvas.renderAll()
          skipHistoryRef.current = false
          pushHistory(canvas)
          loadedIdRef.current = activeBoardId
        })
        .catch(err => {
          console.error('Failed to async load board JSON:', err)
          skipHistoryRef.current = false
        })
    } else {
      loadedIdRef.current = activeBoardId
    }
  }, [activeBoard, activeBoardId])

  /* ---------- Resize canvas when container changes ---------- */
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || width <= 0 || height <= 0) return
    canvas.setDimensions({ width, height })
    canvas.renderAll()
  }, [width, height])

  /* ---------- Sync tool changes ---------- */
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const shapePreviewRef = useRef<fabric.FabricObject | null>(null)
  const laserDotRef = useRef<fabric.Circle | null>(null)

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const { activeShape } = useToolStore.getState()

    // Clean up any previous laser dot
    if (laserDotRef.current) {
      canvas.remove(laserDotRef.current)
      laserDotRef.current = null
    }

    canvas.isDrawingMode = activeTool === 'pen' || activeTool === 'highlighter'
    canvas.selection = activeTool === 'select'

    // Apply matching cursor for active tool
    const toolCursor = TOOL_CURSORS[activeTool] ?? 'default'
    canvas.defaultCursor = toolCursor
    canvas.freeDrawingCursor = toolCursor
    canvas.hoverCursor = toolCursor
    canvas.moveCursor = toolCursor

    if (activeTool === 'pen') {
      if (calligraphyMode) {
        const cBrush = new CalligraphyBrush(canvas)
        cBrush.color = penOptions.color
        cBrush.pressureWidth = penOptions.width
        canvas.freeDrawingBrush = cBrush
      } else {
        const brush = new PressureBrush(canvas)
        brush.color = penOptions.color
        brush.pressureWidth = penOptions.width
        brush.width = penOptions.width
        canvas.freeDrawingBrush = brush
      }
    } else if (activeTool === 'highlighter') {
      if (calligraphyMode) {
        const hlBrushC = new CalligraphyBrush(canvas)
        hlBrushC.color = penOptions.color + '55'
        hlBrushC.pressureWidth = 20
        canvas.freeDrawingBrush = hlBrushC
      } else {
        const hlBrush = new PressureBrush(canvas)
        const hex = penOptions.color
        hlBrush.color = hex + '55'
        hlBrush.pressureWidth = 20
        hlBrush.width = 20
        hlBrush.strokeLineCap = 'round'
        hlBrush.strokeLineJoin = 'round'
        canvas.freeDrawingBrush = hlBrush
      }
    }

    if (activeTool === 'text') {
      canvas.isDrawingMode = false
      const handleTextClick = (e: fabric.TPointerEventInfo) => {
        const pointer = canvas.getScenePoint(e.e as MouseEvent)
        const textbox = new fabric.Textbox('输入文字', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 18,
          fontFamily: 'sans-serif',
          fill: penOptions.color,
          width: 200
        })
        canvas.add(textbox)
        canvas.setActiveObject(textbox)
        textbox.enterEditing()
        canvas.off('mouse:down', handleTextClick)
        useToolStore.getState().setTool('select')
      }
      canvas.on('mouse:down', handleTextClick)
      return () => { canvas.off('mouse:down', handleTextClick) }
    }

    // ---------- Eraser (Object stroke eraser) ----------
    if (activeTool === 'eraser') {
      canvas.isDrawingMode = false
      canvas.selection = false
      canvas.defaultCursor = TOOL_CURSORS['eraser']
      
      let isErasing = false

      const eraseObjectUnderPointer = (e: MouseEvent) => {
        const pointer = canvas.getScenePoint(e)
        const targets = canvas.getObjects().filter(
          obj => obj.containsPoint(pointer) && obj.type !== 'image' && obj.type !== 'Image'
        )
        if (targets.length > 0) {
          targets.forEach(t => canvas.remove(t))
          canvas.requestRenderAll()
        }
      }

      const onEraserDown = (opt: fabric.TPointerEventInfo) => {
        const e = opt.e as MouseEvent
        if (spaceHeldRef.current || e.button === 1) return
        isErasing = true
        eraseObjectUnderPointer(e)
      }

      const onEraserMove = (opt: fabric.TPointerEventInfo) => {
        if (!isErasing) return
        eraseObjectUnderPointer(opt.e as MouseEvent)
      }

      const onEraserUp = () => {
        isErasing = false
      }

      canvas.on('mouse:down', onEraserDown)
      canvas.on('mouse:move', onEraserMove)
      canvas.on('mouse:up', onEraserUp)

      return () => {
        canvas.off('mouse:down', onEraserDown)
        canvas.off('mouse:move', onEraserMove)
        canvas.off('mouse:up', onEraserUp)
      }
    }

    // ---------- Lasso Select (Circle select to drag) ----------
    if (activeTool === 'lasso') {
      canvas.isDrawingMode = false
      canvas.selection = false
      canvas.defaultCursor = 'crosshair'
      
      let isDrawing = false
      const trailPoints: {x: number, y: number}[] = []
      let trailPath: fabric.Polyline | null = null

      const onLassoDown = (opt: fabric.TPointerEventInfo) => {
        const e = opt.e as MouseEvent
        if (spaceHeldRef.current || e.button === 1) return
        isDrawing = true
        trailPoints.length = 0
        const pointer = canvas.getScenePoint(e)
        trailPoints.push({ x: pointer.x, y: pointer.y })
      }

      const onLassoMove = (opt: fabric.TPointerEventInfo) => {
        if (!isDrawing) return
        const pointer = canvas.getScenePoint(opt.e as MouseEvent)
        trailPoints.push({ x: pointer.x, y: pointer.y })
        
        if (trailPath) canvas.remove(trailPath)
        
        if (trailPoints.length > 1) {
          trailPath = new fabric.Polyline(trailPoints, {
            stroke: 'rgba(100, 150, 255, 0.8)',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            fill: 'rgba(100, 150, 255, 0.1)',
            selectable: false,
            evented: false,
            excludeFromExport: true
          })
          canvas.add(trailPath)
          canvas.requestRenderAll()
        }
      }

      const onLassoUp = () => {
        if (!isDrawing) return
        isDrawing = false
        
        if (trailPath) {
          canvas.remove(trailPath)
          trailPath = null
        }
        
        if (trailPoints.length > 2) {
          const objects = canvas.getObjects()
          const toSelect: fabric.FabricObject[] = []
          
          for (const obj of objects) {
            if (obj.lockMovementX) continue // Skip locked objects
            
            let intersect = false
            const center = obj.getCenterPoint()
            
            // 1. the object's center is inside the lasso
            if (pointInPolygon(center, trailPoints)) {
              intersect = true
            } else {
              // 2. any of the object's bounding corners are inside the lasso
              const coords = obj.getCoords()
              for (const pt of coords) {
                if (pointInPolygon(pt, trailPoints)) {
                  intersect = true
                  break
                }
              }
              
              // 3. lasso line overlaps the object
              if (!intersect) {
                const step = Math.max(1, Math.floor(trailPoints.length / 20))
                for (let i = 0; i < trailPoints.length; i += step) {
                  if (obj.containsPoint(new fabric.Point(trailPoints[i].x, trailPoints[i].y))) {
                    intersect = true
                    break
                  }
                }
              }
            }
            
            if (intersect) {
              toSelect.push(obj)
            }
          }
          
          if (toSelect.length > 0) {
            if (toSelect.length === 1) {
              canvas.setActiveObject(toSelect[0])
            } else {
              const sel = new fabric.ActiveSelection(toSelect, { canvas })
              canvas.setActiveObject(sel)
            }
            canvas.requestRenderAll()
            useToolStore.getState().setTool('select')
          }
        }
        trailPoints.length = 0
      }

      canvas.on('mouse:down', onLassoDown)
      canvas.on('mouse:move', onLassoMove)
      canvas.on('mouse:up', onLassoUp)
      
      return () => {
        canvas.off('mouse:down', onLassoDown)
        canvas.off('mouse:move', onLassoMove)
        canvas.off('mouse:up', onLassoUp)
        if (trailPath) canvas.remove(trailPath)
        canvas.defaultCursor = 'default'
      }
    }

    // ---------- Trail pen (fade after lift) ----------
    if (activeTool === 'trail') {
      canvas.isDrawingMode = false
      canvas.selection = false
      canvas.defaultCursor = 'crosshair'
      let isDrawing = false
      const trailPoints: fabric.Point[] = []
      let trailPath: fabric.Path | null = null

      const onTrailDown = (opt: fabric.TPointerEventInfo) => {
        const e = opt.e as MouseEvent
        if (spaceHeldRef.current || e.button === 1) return
        isDrawing = true
        trailPoints.length = 0
        const pointer = canvas.getScenePoint(e)
        trailPoints.push(new fabric.Point(pointer.x, pointer.y))
      }

      const onTrailMove = (opt: fabric.TPointerEventInfo) => {
        if (!isDrawing) return
        const pointer = canvas.getScenePoint(opt.e as MouseEvent)
        trailPoints.push(new fabric.Point(pointer.x, pointer.y))
        if (trailPath) canvas.remove(trailPath)
        if (trailPoints.length < 2) return
        let d = `M ${trailPoints[0].x} ${trailPoints[0].y}`
        for (let i = 1; i < trailPoints.length; i++) {
          d += ` L ${trailPoints[i].x} ${trailPoints[i].y}`
        }
        trailPath = new fabric.Path(d, {
          stroke: penOptions.color,
          strokeWidth: penOptions.width,
          fill: '',
          selectable: false,
          evented: false,
          excludeFromExport: true,
          strokeLineCap: 'round',
          strokeLineJoin: 'round'
        })
        canvas.add(trailPath)
        canvas.requestRenderAll()
      }

      const onTrailUp = () => {
        if (!isDrawing) return
        isDrawing = false
        if (trailPath) {
          const path = trailPath
          let opacity = 1
          const fade = () => {
            opacity -= 0.05
            if (opacity <= 0) {
              canvas.remove(path)
              canvas.requestRenderAll()
            } else {
              path.set({ opacity })
              canvas.requestRenderAll()
              requestAnimationFrame(fade)
            }
          }
          requestAnimationFrame(fade)
        }
        trailPath = null
        trailPoints.length = 0
      }

      canvas.on('mouse:down', onTrailDown)
      canvas.on('mouse:move', onTrailMove)
      canvas.on('mouse:up', onTrailUp)
      return () => {
        canvas.off('mouse:down', onTrailDown)
        canvas.off('mouse:move', onTrailMove)
        canvas.off('mouse:up', onTrailUp)
        if (trailPath) canvas.remove(trailPath)
        canvas.defaultCursor = 'default'
      }
    }

    // ---------- Laser pointer ----------
    if (activeTool === 'laser') {
      canvas.isDrawingMode = false
      canvas.selection = false
      canvas.skipTargetFind = true
      canvas.defaultCursor = 'none'

      const onLaserMove = (opt: fabric.TPointerEventInfo) => {
        const pointer = canvas.getScenePoint(opt.e as MouseEvent)
        if (!laserDotRef.current) {
          const dot = new fabric.Circle({
            radius: 8,
            fill: 'rgba(255, 30, 30, 0.85)',
            stroke: 'rgba(255, 100, 100, 0.5)',
            strokeWidth: 4,
            left: pointer.x - 10,
            top: pointer.y - 10,
            selectable: false,
            evented: false,
            excludeFromExport: true
          })
          canvas.add(dot)
          laserDotRef.current = dot
        } else {
          laserDotRef.current.set({ left: pointer.x - 10, top: pointer.y - 10 })
        }
        canvas.requestRenderAll()
      }

      const onLaserOut = () => {
        if (laserDotRef.current) {
          canvas.remove(laserDotRef.current)
          laserDotRef.current = null
          canvas.requestRenderAll()
        }
      }

      canvas.on('mouse:move', onLaserMove)
      canvas.on('mouse:out', onLaserOut)
      return () => {
        canvas.off('mouse:move', onLaserMove)
        canvas.off('mouse:out', onLaserOut)
        onLaserOut()
        canvas.defaultCursor = 'default'
        canvas.skipTargetFind = false
      }
    }

    // ---------- Shape tool ----------
    if (activeTool === 'shape') {
      canvas.isDrawingMode = false
      canvas.selection = false

      const onShapeDown = (opt: fabric.TPointerEventInfo) => {
        const e = opt.e as MouseEvent
        if (spaceHeldRef.current || e.button === 1) return // let pan handle it
        const pointer = canvas.getScenePoint(e)
        shapeStartRef.current = { x: pointer.x, y: pointer.y }
      }

      const onShapeMove = (opt: fabric.TPointerEventInfo) => {
        if (!shapeStartRef.current) return
        const pointer = canvas.getScenePoint(opt.e as MouseEvent)
        const { x: sx, y: sy } = shapeStartRef.current
        const x = Math.min(sx, pointer.x)
        const y = Math.min(sy, pointer.y)
        const w = Math.abs(pointer.x - sx)
        const h = Math.abs(pointer.y - sy)

        // Remove previous preview
        if (shapePreviewRef.current) canvas.remove(shapePreviewRef.current)

        const shapeProps = {
          stroke: penOptions.color,
          strokeWidth: penOptions.width,
          fill: 'transparent',
          selectable: false,
          evented: false
        }

        let shape: fabric.FabricObject
        const currentShape = useToolStore.getState().activeShape
        switch (currentShape) {
          case 'rect':
            shape = new fabric.Rect({ left: x, top: y, width: w, height: h, ...shapeProps })
            break
          case 'ellipse':
            shape = new fabric.Ellipse({ left: x, top: y, rx: w / 2, ry: h / 2, ...shapeProps })
            break
          case 'line':
            shape = new fabric.Line([sx, sy, pointer.x, pointer.y], { ...shapeProps })
            break
          case 'arrow': {
            // Arrow as a group: line + arrowhead
            const angle = Math.atan2(pointer.y - sy, pointer.x - sx)
            const headLen = 14
            const arrowPath = `M ${sx} ${sy} L ${pointer.x} ${pointer.y} ` +
              `M ${pointer.x} ${pointer.y} L ${pointer.x - headLen * Math.cos(angle - Math.PI / 6)} ${pointer.y - headLen * Math.sin(angle - Math.PI / 6)} ` +
              `M ${pointer.x} ${pointer.y} L ${pointer.x - headLen * Math.cos(angle + Math.PI / 6)} ${pointer.y - headLen * Math.sin(angle + Math.PI / 6)}`
            shape = new fabric.Path(arrowPath, { ...shapeProps, fill: '' })
            break
          }
          default:
            shape = new fabric.Rect({ left: x, top: y, width: w, height: h, ...shapeProps })
        }

        shapePreviewRef.current = shape
        canvas.add(shape)
        canvas.requestRenderAll()
      }

      const onShapeUp = () => {
        if (!shapeStartRef.current || !shapePreviewRef.current) {
          shapeStartRef.current = null
          return
        }
        // Finalize: make selectable
        shapePreviewRef.current.set({ selectable: true, evented: true })
        shapePreviewRef.current.setCoords()
        canvas.setActiveObject(shapePreviewRef.current)
        canvas.requestRenderAll()
        shapeStartRef.current = null
        shapePreviewRef.current = null
      }

      canvas.on('mouse:down', onShapeDown)
      canvas.on('mouse:move', onShapeMove)
      canvas.on('mouse:up', onShapeUp)
      return () => {
        canvas.off('mouse:down', onShapeDown)
        canvas.off('mouse:move', onShapeMove)
        canvas.off('mouse:up', onShapeUp)
      }
    }

    return undefined
  }, [activeTool, penOptions, calligraphyMode, activeBoardId])

  /* ---------- History ---------- */
  function pushHistory(canvas: fabric.Canvas) {
    if (skipHistoryRef.current) return
    const json = JSON.stringify(canvas.toJSON())
    // Truncate forward history if we branched
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(json)
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    }
    historyIndexRef.current = historyRef.current.length - 1
  }

  const onCanvasChanged = useCallback(() => {
    if (skipHistoryRef.current) return
    const canvas = fabricRef.current
    if (!canvas) return
    pushHistory(canvas)

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveBoardState(canvas)
    }, 500)
  }, [activeBoardId])

  /* ---------- Save ---------- */
  function saveBoardState(canvas: fabric.Canvas) {
    if (!activeBoardId) return
    const canvasJSON = JSON.stringify(canvas.toJSON())
    const thumbnail = canvas.toDataURL({ format: 'png', multiplier: 0.2 })
    updateBoardCanvas(activeBoardId, canvasJSON, thumbnail)
  }

  /* ---------- Undo / Redo ---------- */
  const undo = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas || historyIndexRef.current <= 0 || skipHistoryRef.current) return
    
    skipHistoryRef.current = true
    historyIndexRef.current -= 1
    
    try {
      await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]))
      canvas.renderAll()
      saveBoardState(canvas)
    } catch (e) {
      console.error('Undo error:', e)
      historyIndexRef.current += 1
    } finally {
      skipHistoryRef.current = false
    }
  }, [activeBoardId])

  const redo = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1 || skipHistoryRef.current) return
    
    skipHistoryRef.current = true
    historyIndexRef.current += 1
    
    try {
      await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current]))
      canvas.renderAll()
      saveBoardState(canvas)
    } catch (e) {
      console.error('Redo error:', e)
      historyIndexRef.current -= 1
    } finally {
      skipHistoryRef.current = false
    }
  }, [activeBoardId])

  const clearCanvas = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.clear()
    canvas.backgroundColor = 'transparent'
    canvas.renderAll()
    pushHistory(canvas)
    if (activeBoardId) updateBoardCanvas(activeBoardId, '', '')
  }, [activeBoardId])

  /* ---------- Insert image from URL/dataURL ---------- */
  const insertImage = useCallback(async (src: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    // Only set crossOrigin for http(s) URLs; data: and file: don't need it
    const crossOrigin = src.startsWith('http') ? 'anonymous' : undefined
    const img = await fabric.FabricImage.fromURL(src, { crossOrigin })
    const maxW = canvas.getWidth() * 0.6
    if (img.width! > maxW) img.scaleToWidth(maxW)
    img.set({ left: 80, top: 80 })
    canvas.add(img)
    canvas.setActiveObject(img)
    canvas.renderAll()
  }, [])

  /* ---------- Insert text onto canvas ---------- */
  const insertText = useCallback((text: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const textbox = new fabric.Textbox(text, {
      left: 80,
      top: 80,
      fontSize: 18,
      fontFamily: 'sans-serif',
      fill: '#333333',
      width: 300
    })
    canvas.add(textbox)
    canvas.setActiveObject(textbox)
    canvas.renderAll()
  }, [])

  /* ---------- Background pattern rendering ---------- */
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const bgType: BackgroundType = activeBoard?.background ?? 'blank'

    const onBeforeRender = () => {
      const ctx = canvas.getContext() as unknown as CanvasRenderingContext2D
      if (bgType !== 'blank') {
        // Only fill background if we have a pattern (grid/lines/dots)
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset to device pixels for full fill
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width!, canvas.height!)
        ctx.restore()
        drawBackgroundPattern(ctx, bgType, canvas.viewportTransform!, canvas.width!, canvas.height!)
      }
    }

    canvas.on('before:render', onBeforeRender)
    canvas.requestRenderAll()

    return () => {
      canvas.off('before:render', onBeforeRender)
    }
  }, [activeBoardId, activeBoard?.background])

  /* ---------- Element locking ---------- */
  const toggleLockSelected = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const objs = canvas.getActiveObjects()
    if (!objs.length) return

    for (const obj of objs) {
      const isLocked = obj.lockMovementX === true
      if (isLocked) {
        // Unlock
        obj.set({
          lockMovementX: false, lockMovementY: false,
          lockRotation: false, lockScalingX: false, lockScalingY: false,
          hasControls: true,
          borderColor: undefined,
          borderDashArray: undefined
        })
      } else {
        // Lock
        obj.set({
          lockMovementX: true, lockMovementY: true,
          lockRotation: true, lockScalingX: true, lockScalingY: true,
          hasControls: false,
          borderColor: '#999999',
          borderDashArray: [4, 3]
        })
      }
    }
    canvas.requestRenderAll()
  }, [])

  /* ---------- Pan & Zoom ---------- */
  const isPanningRef = useRef(false)
  const lastPanPosRef = useRef({ x: 0, y: 0 })
  const spaceHeldRef = useRef(false)

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const handleMouseDown = (opt: fabric.TPointerEventInfo) => {
      const e = opt.e as MouseEvent
      // Space+left-click or middle mouse button → start pan
      if (spaceHeldRef.current || e.button === 1) {
        isPanningRef.current = true
        lastPanPosRef.current = { x: e.clientX, y: e.clientY }
        canvas.selection = false
        canvas.skipTargetFind = true
        canvas.defaultCursor = 'grabbing'
        canvas.discardActiveObject()
        canvas.requestRenderAll()
      }
    }

    const handleMouseMove = (opt: fabric.TPointerEventInfo) => {
      if (!isPanningRef.current) return
      const e = opt.e as MouseEvent
      const vpt = canvas.viewportTransform!
      vpt[4] += e.clientX - lastPanPosRef.current.x
      vpt[5] += e.clientY - lastPanPosRef.current.y
      lastPanPosRef.current = { x: e.clientX, y: e.clientY }
      canvas.setViewportTransform(vpt)
    }

    const handleMouseUp = () => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      canvas.defaultCursor = 'default'
      // Restore selection state based on current tool
      const tool = useToolStore.getState().activeTool
      canvas.selection = tool === 'select'
      canvas.skipTargetFind = false
      canvas.requestRenderAll()
    }

    const handleWheel = (opt: fabric.TPointerEventInfo<WheelEvent>) => {
      const e = opt.e
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY
      let zoom = canvas.getZoom()
      zoom *= 0.999 ** delta
      zoom = Math.min(Math.max(zoom, 0.1), 10)
      const point = canvas.getScenePoint(e)
      canvas.zoomToPoint(point, zoom)
    }

    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)
    canvas.on('mouse:wheel', handleWheel)

    return () => {
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
      canvas.off('mouse:wheel', handleWheel)
    }
  }, [activeBoardId])

  /* ---------- Keyboard shortcuts ---------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.code === 'Space' && !e.repeat) {
        spaceHeldRef.current = true
        const canvas = fabricRef.current
        if (canvas) canvas.defaultCursor = 'grab'
      }

      const { shortcuts } = useShortcutStore.getState()

      if (matchesShortcut(e, shortcuts['action:undo'])) {
        e.preventDefault(); undo(); return
      }
      if (matchesShortcut(e, shortcuts['action:redo'])) {
        e.preventDefault(); redo(); return
      }
      if (matchesShortcut(e, shortcuts['action:delete']) || e.key === 'Backspace') {
        const canvas = fabricRef.current
        if (!canvas) return
        const active = canvas.getActiveObjects()
        if (active.length) {
          active.forEach((o) => canvas.remove(o))
          canvas.discardActiveObject()
          canvas.renderAll()
        }
        return
      }
      if (matchesShortcut(e, shortcuts['action:presentation'])) {
        e.preventDefault()
        useToolStore.getState().togglePresentation()
        return
      }
      if (matchesShortcut(e, shortcuts['action:escape']) && useToolStore.getState().presentationMode) {
        useToolStore.getState().togglePresentation()
        return
      }

      // Tool shortcuts (only when no modifiers held)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const { setTool } = useToolStore.getState()
        const toolActions: { action: ShortcutAction; tool: ToolType }[] = [
          { action: 'tool:select', tool: 'select' },
          { action: 'tool:pen', tool: 'pen' },
          { action: 'tool:highlighter', tool: 'highlighter' },
          { action: 'tool:eraser', tool: 'eraser' },
          { action: 'tool:lasso', tool: 'lasso' },
          { action: 'tool:text', tool: 'text' },
          { action: 'tool:shape', tool: 'shape' },
          { action: 'tool:laser', tool: 'laser' },
          { action: 'tool:trail', tool: 'trail' },
        ]
        for (const { action, tool } of toolActions) {
          if (matchesShortcut(e, shortcuts[action])) {
            setTool(tool)
            return
          }
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        const canvas = fabricRef.current
        if (canvas && !isPanningRef.current) {
          canvas.defaultCursor = 'default'
        }
      }
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    globalThis.addEventListener('keyup', handleKeyUp)
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown)
      globalThis.removeEventListener('keyup', handleKeyUp)
    }
  }, [undo, redo])

  /* ---------- Export as PDF ---------- */
  const exportAsPdf = useCallback(async (): Promise<void> => {
    const canvas = fabricRef.current
    if (!canvas || !window.electronAPI) return
    const { activeBoard, categories } = useBoardStore.getState()
    const title = activeBoard?.title || 'board'
    const category = categories.find((c) => c.id === activeBoard?.categoryId)
    const categoryName = category?.name || ''
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
    try {
      const saved = await window.electronAPI.exportBoardPdf(title, categoryName, dataUrl)
      if (!saved) return // user cancelled the dialog
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF 导出失败！')
    }
  }, [])

  return { fabricRef, undo, redo, clearCanvas, insertImage, insertText, toggleLockSelected, exportAsPdf }
}
