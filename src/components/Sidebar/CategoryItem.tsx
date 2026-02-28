import { useState } from 'react'
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

  const catBoards = boardMetas.filter((b) => b.categoryId === category.id)

  function commitRename() {
    if (name.trim()) updateCategory(category.id, { name: name.trim() })
    setEditing(false)
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
