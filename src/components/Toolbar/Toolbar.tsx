import { useCallback, useState, useRef, useEffect } from 'react'
import { useToolStore } from '../../store/toolStore'
import { useShortcutStore } from '../../store/shortcutStore'
import { useBoardStore } from '../../store/boardStore'
import { openImageDialog } from '../../services/storage'
import type { ToolType, ShapeType, BackgroundType } from '../../types'
import { ToolButton } from './ToolButton'
import { PenOptions } from './PenOptions'

// Simple inline SVG icons
const Icons = {
  select: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M4 4l7 18 3-7 7-3z" />
    </svg>
  ),
  pen: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  highlighter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5z" />
      <path d="M5 21h14" opacity={0.4} />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M20 20H7L3 16l11-11 7 7-1 8z" />
      <path d="M6.0001 17.9999L10 14" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  ),
  laser: (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <circle cx="12" cy="12" r="4" fill="#ef4444" opacity={0.7} />
      <circle cx="12" cy="12" r="7" stroke="#ef4444" strokeWidth={1.5} opacity={0.4} />
      <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth={1} opacity={0.2} />
    </svg>
  ),
  // Shape sub-icons
  shapeRect: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="3" y="5" width="18" height="14" rx="1" />
    </svg>
  ),
  shapeEllipse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <ellipse cx="12" cy="12" rx="9" ry="7" />
    </svg>
  ),
  shapeLine: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <line x1="5" y1="19" x2="19" y2="5" />
    </svg>
  ),
  shapeArrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="10 5 19 5 19 14" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
    </svg>
  ),
  redo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  presentation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21l4-4 4 4" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  trail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M4 18c2-4 4-8 8-10s6 2 8-2" strokeLinecap="round" strokeDasharray="2 3" />
      <circle cx="20" cy="6" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  bgGrid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

const shapeOptions: { id: ShapeType; label: string; icon: React.ReactNode }[] = [
  { id: 'rect', label: '矩形', icon: Icons.shapeRect },
  { id: 'ellipse', label: '椭圆', icon: Icons.shapeEllipse },
  { id: 'line', label: '直线', icon: Icons.shapeLine },
  { id: 'arrow', label: '箭头', icon: Icons.shapeArrow }
]

const bgOptions: { id: BackgroundType; label: string }[] = [
  { id: 'blank', label: '空白' },
  { id: 'grid', label: '方格纸' },
  { id: 'lines', label: '横线纸' },
  { id: 'dots', label: '点阵纸' }
]

function BackgroundButton() {
  const { activeBoardId, activeBoard, updateBoardMeta } = useBoardStore()
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const current = activeBoard?.background ?? 'blank'

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={popRef}>
      <ToolButton title="背景模板" active={current !== 'blank'} onClick={() => setOpen((v) => !v)}>
        {Icons.bgGrid}
      </ToolButton>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[100px]">
          {bgOptions.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                if (activeBoardId) updateBoardMeta(activeBoardId, { background: b.id })
                setOpen(false)
              }}
              className={[
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors',
                current === b.id ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700'
              ].join(' ')}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ShapeButton() {
  const { activeTool, activeShape, setTool, setShape } = useToolStore()
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)

  const active = activeTool === 'shape'
  const currentIcon = shapeOptions.find((s) => s.id === activeShape)?.icon ?? Icons.shapeRect

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={popRef}>
      <div className="flex">
        <ToolButton active={active} title={`形状 (${useShortcutStore.getState().shortcuts['tool:shape']})`} onClick={() => setTool('shape')}>
          {currentIcon}
        </ToolButton>
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-3 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 -ml-1"
        >
          <svg viewBox="0 0 8 5" className="w-2 h-2" fill="currentColor"><path d="M0 0l4 5 4-5z" /></svg>
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[100px]">
          {shapeOptions.map((s) => (
            <button
              key={s.id}
              onClick={() => { setShape(s.id); setTool('shape'); setOpen(false) }}
              className={[
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors',
                activeShape === s.id ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700'
              ].join(' ')}
            >
              <span className="w-5 h-5">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ToolbarProps {
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onInsertImage: (src: string) => void
  onImportJson: () => void
  onToggleLock: () => void
  onOpenSettings: () => void
}

export function Toolbar({ onUndo, onRedo, onClear, onInsertImage, onImportJson, onToggleLock, onOpenSettings }: ToolbarProps) {
  const { activeTool, setTool, presentationMode, togglePresentation } = useToolStore()
  const shortcuts = useShortcutStore((s) => s.shortcuts)

  const handleOpenImage = useCallback(async () => {
    const url = await openImageDialog()
    if (url) onInsertImage(url)
  }, [onInsertImage])

  const tools: { id: ToolType; label: string; shortcutAction: string; icon: React.ReactNode }[] = [
    { id: 'select', label: '选择', shortcutAction: 'tool:select', icon: Icons.select },
    { id: 'pen', label: '画笔', shortcutAction: 'tool:pen', icon: Icons.pen },
    { id: 'highlighter', label: '荧光笔', shortcutAction: 'tool:highlighter', icon: Icons.highlighter },
    { id: 'eraser', label: '橡皮擦', shortcutAction: 'tool:eraser', icon: Icons.eraser },
    { id: 'text', label: '文字', shortcutAction: 'tool:text', icon: Icons.text }
  ]

  return (
    <div className={['h-12 bg-white border-b border-gray-200 flex items-center gap-1 px-3 select-none no-drag transition-opacity', presentationMode ? 'opacity-0 hover:opacity-100' : ''].join(' ')}>
      {tools.map((t) => (
        <ToolButton
          key={t.id}
          active={activeTool === t.id}
          title={`${t.label} (${shortcuts[t.shortcutAction as keyof typeof shortcuts]})`}
          onClick={() => setTool(t.id)}
        >
          {t.icon}
        </ToolButton>
      ))}

      {/* Shape tool with dropdown */}
      <ShapeButton />

      {/* Laser pointer */}
      <ToolButton active={activeTool === 'laser'} title={`激光笔 (${shortcuts['tool:laser']})`} onClick={() => setTool('laser')}>
        {Icons.laser}
      </ToolButton>

      {/* Trail pen */}
      <ToolButton active={activeTool === 'trail'} title={`轨迹笔 (${shortcuts['tool:trail']})`} onClick={() => setTool('trail')}>
        {Icons.trail}
      </ToolButton>

      {/* Pen/highlighter options */}
      {(activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'highlighter' || activeTool === 'shape') && (
        <div className="ml-2 border-l border-gray-200 pl-2">
          <PenOptions />
        </div>
      )}

      <div className="flex-1" />

      {/* Background selector */}
      <BackgroundButton />

      {/* Lock selected */}
      <ToolButton title="锁定/解锁选中元素" onClick={onToggleLock}>
        {Icons.lock}
      </ToolButton>

      <div className="border-l border-gray-200 mx-1 h-6" />

      {/* Image insert */}
      <ToolButton title="插入图片" onClick={handleOpenImage}>
        {Icons.image}
      </ToolButton>

      {/* Import JSON */}
      <ToolButton title="导入JSON" onClick={onImportJson}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
      </ToolButton>

      {/* Presentation mode */}
      <ToolButton title={`演示模式 (${shortcuts['action:presentation']})`} active={presentationMode} onClick={togglePresentation}>
        {Icons.presentation}
      </ToolButton>

      <div className="border-l border-gray-200 mx-1 h-6" />

      {/* Undo / Redo / Clear */}
      <ToolButton title={`撤销 (${shortcuts['action:undo']})`} onClick={onUndo}>
        {Icons.undo}
      </ToolButton>
      <ToolButton title={`重做 (${shortcuts['action:redo']})`} onClick={onRedo}>
        {Icons.redo}
      </ToolButton>
      <ToolButton title="清空画布" onClick={onClear} danger>
        {Icons.trash}
      </ToolButton>

      <div className="border-l border-gray-200 mx-1 h-6" />

      {/* Settings */}
      <ToolButton title="设置" onClick={onOpenSettings}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </ToolButton>
    </div>
  )
}
