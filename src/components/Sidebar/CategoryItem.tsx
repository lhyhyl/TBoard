import { useState } from 'react'
import * as fabric from 'fabric'
import { useBoardStore } from '../../store/boardStore'
import { BoardList } from './BoardList'
import type { Category } from '../../types'

interface CategoryItemProps {
  category: Category
  editingBoardId?: string | null
  onCreateBoard?: (categoryId: string) => void
  onEditDone?: () => void
}

export function CategoryItem({ category, editingBoardId, onCreateBoard, onEditDone }: CategoryItemProps) {
  const { boardMetas, activeBoardId, updateCategory, deleteCategory, setActiveBoard, updateBoardMeta } =
    useBoardStore()
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [dragOver, setDragOver] = useState(false)
  const [exporting, setExporting] = useState(false)

  const catBoards = boardMetas
    .filter((b) => b.categoryId === category.id)
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN', { numeric: true }))

  function commitRename() {
    if (name.trim()) updateCategory(category.id, { name: name.trim() })
    setEditing(false)
  }

  async function handleExportAllPdf() {
    if (exporting || catBoards.length === 0) return
    setExporting(true)
    try {
      const settings = await window.electronAPI.getSettings()
      const storagePath = settings.storagePath ?? ''

      const rendered: { title: string; dataUrl: string }[] = []
      for (const meta of catBoards) {
        const board = await window.electronAPI.readBoard(meta.id)
        if (!board) continue
        const dataUrl = await renderBoardOffscreen(board.canvasJSON, storagePath)
        rendered.push({ title: meta.title, dataUrl })
      }
      await window.electronAPI.exportCategoryPdf(category.name, rendered)
    } catch (err) {
      console.error('Category PDF export error:', err)
      alert('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mb-1">
      {/* Category header */}
      <div
        className={[
          'group flex items-center gap-1 px-3 py-1 hover:bg-gray-100 rounded mx-1 transition-colors',
          dragOver ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''
        ].join(' ')}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const boardId = e.dataTransfer.getData('text/board-id')
          if (boardId) {
            updateBoardMeta(boardId, { categoryId: category.id })
            setCollapsed(false)
          }
        }}
      >
        {/* Collapse arrow */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-gray-600 p-0.5 flex-shrink-0 transition-transform"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Color dot */}
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />

        {/* Name */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex-1 text-left text-xs font-medium text-gray-600 truncate"
        >
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setName(category.name); setEditing(false) }
              }}
              className="w-full bg-transparent border-b border-indigo-400 outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span onDoubleClick={() => setEditing(true)}>{category.name}</span>
          )}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            title="新建白板到此分类"
            onClick={() => onCreateBoard?.(category.id)}
            className="text-gray-400 hover:text-indigo-600 p-0.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            title={exporting ? '导出中…' : '导出全部为 PDF'}
            onClick={handleExportAllPdf}
            disabled={exporting}
            className="text-gray-400 hover:text-indigo-600 p-0.5 disabled:opacity-40"
          >
            {exporting ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 animate-spin">
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <polyline points="9,14 12,17 15,14" />
              </svg>
            )}
          </button>
          <button
            title="删除分类"
            onClick={() => deleteCategory(category.id)}
            className="text-gray-400 hover:text-red-500 p-0.5"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Board list */}
      {!collapsed && catBoards.length > 0 && (
        <div className="pl-3">
          <BoardList
            boards={catBoards}
            activeBoardId={activeBoardId}
            editingBoardId={editingBoardId}
            onSelect={setActiveBoard}
            onEditDone={onEditDone}
          />
        </div>
      )}
    </div>
  )
}

// ── Offscreen Fabric.js renderer ───────────────────────────────────────────

async function renderBoardOffscreen(canvasJSON: string, storagePath: string): Promise<string> {
  if (!canvasJSON) return ''
  let parsed: any
  try { parsed = JSON.parse(canvasJSON) } catch { return '' }

  // Resolve relative image paths (images/xxx) to file:// URLs so Fabric can load them
  const base = storagePath.replace(/\\/g, '/')
  function resolveObjs(objects: any[]) {
    if (!Array.isArray(objects)) return
    for (const obj of objects) {
      if (
        obj.type === 'image' &&
        obj.src &&
        !obj.src.startsWith('data:') &&
        !obj.src.startsWith('http') &&
        !obj.src.startsWith('file:')
      ) {
        obj.src = `file:///${base}/${obj.src}`
      }
      if (obj.objects) resolveObjs(obj.objects)
    }
  }
  resolveObjs(parsed.objects ?? [])

  const width: number = parsed.width || 1920
  const height: number = parsed.height || 1080

  const el = document.createElement('canvas')
  el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none;'
  document.body.appendChild(el)

  const fc = new fabric.Canvas(el, { width, height, backgroundColor: '#ffffff' })
  try {
    await fc.loadFromJSON(parsed)
    fc.renderAll()
    return fc.toDataURL({ format: 'png', multiplier: 2 })
  } finally {
    fc.dispose()
    el.remove()
  }
}
