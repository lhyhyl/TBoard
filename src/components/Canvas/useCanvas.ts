import { useEffect, useRef, useCallback } from 'react'
import * as fabric from 'fabric'
import { useToolStore } from '../../store/toolStore'
import { useBoardStore } from '../../store/boardStore'
import { useShortcutStore, matchesShortcut, type ShortcutAction } from '../../store/shortcutStore'
import type { BackgroundType, ToolType } from '../../types'

/* History stack for undo/redo */
const MAX_HISTORY = 50

/* ---------- Pressure-sensitive brush ---------- */
class PressureBrush extends fabric.PencilBrush {
  pressureWidth = 3

  onMouseDown(pointer: fabric.Point, ev: fabric.TPointerEventInfo) {
    const pe = ev.e as PointerEvent
    if (pe.pressure && pe.pressure > 0) {
      this.width = this.pressureWidth * (0.3 + pe.pressure * 0.7)
    } else {
      this.width = this.pressureWidth
    }
    return super.onMouseDown(pointer, ev)
  }

  onMouseMove(pointer: fabric.Point, ev: fabric.TPointerEventInfo) {
    const pe = ev.e as PointerEvent
    if (pe.pressure && pe.pressure > 0) {
      this.width = this.pressureWidth * (0.3 + pe.pressure * 0.7)
    }
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

  const { activeTool, penOptions } = useToolStore()
  const { activeBoardId, activeBoard, updateBoardCanvas } = useBoardStore()

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

    // Load board data if exists
    if (activeBoard?.canvasJSON && activeBoard.canvasJSON !== '') {
      canvas.loadFromJSON(JSON.parse(activeBoard.canvasJSON)).then(() => {
        canvas.renderAll()
        pushHistory(canvas)
      })
    } else {
      pushHistory(canvas)
    }

    // Object changed → save
    canvas.on('object:added', onCanvasChanged)
    canvas.on('object:modified', onCanvasChanged)
    canvas.on('object:removed', onCanvasChanged)

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId])

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

    canvas.isDrawingMode = activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'highlighter'
    canvas.selection = activeTool === 'select'

    if (activeTool === 'pen') {
      const brush = new PressureBrush(canvas)
      brush.color = penOptions.color
      brush.pressureWidth = penOptions.width
      brush.width = penOptions.width
      canvas.freeDrawingBrush = brush
    } else if (activeTool === 'eraser') {
      const eraserBrush = new fabric.PencilBrush(canvas)
      eraserBrush.color = '#ffffff'
      eraserBrush.width = penOptions.width * 4
      canvas.freeDrawingBrush = eraserBrush
    } else if (activeTool === 'highlighter') {
      const hlBrush = new PressureBrush(canvas)
      const hex = penOptions.color
      hlBrush.color = hex + '55'
      hlBrush.pressureWidth = 20
      hlBrush.width = 20
      hlBrush.strokeLineCap = 'round'
      hlBrush.strokeLineJoin = 'round'
      canvas.freeDrawingBrush = hlBrush
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
  }, [activeTool, penOptions])

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
    const canvas = fabricRef.current
    if (!canvas) return
    pushHistory(canvas)
    saveBoardState(canvas)
  }, [activeBoardId])

  /* ---------- Save ---------- */
  function saveBoardState(canvas: fabric.Canvas) {
    if (!activeBoardId) return
    const canvasJSON = JSON.stringify(canvas.toJSON())
    const thumbnail = canvas.toDataURL({ format: 'png', multiplier: 0.2 })
    updateBoardCanvas(activeBoardId, canvasJSON, thumbnail)
  }

  /* ---------- Undo / Redo ---------- */
  const undo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    skipHistoryRef.current = true
    canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current])).then(() => {
      canvas.renderAll()
      skipHistoryRef.current = false
      saveBoardState(canvas)
    })
  }, [activeBoardId])

  const redo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    skipHistoryRef.current = true
    canvas.loadFromJSON(JSON.parse(historyRef.current[historyIndexRef.current])).then(() => {
      canvas.renderAll()
      skipHistoryRef.current = false
      saveBoardState(canvas)
    })
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
      // Fill white base first, then draw pattern
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width!, canvas.height!)
      ctx.restore()
      drawBackgroundPattern(ctx, bgType, canvas.viewportTransform!, canvas.width!, canvas.height!)
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

  return { fabricRef, undo, redo, clearCanvas, insertImage, insertText, toggleLockSelected }
}
