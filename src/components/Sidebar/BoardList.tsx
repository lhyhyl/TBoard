import { useState, useEffect, useCallback } from 'react'
import { useBoardStore } from '../../store/boardStore'
import { ContextMenu } from '../ContextMenu'
import type { BoardMeta, Category } from '../../types'

interface BoardListProps {
  boards: BoardMeta[]
  activeBoardId: string | null
  editingBoardId?: string | null
  onSelect: (id: string) => void
  onEditDone?: () => void
}

export function BoardList({ boards, activeBoardId, editingBoardId, onSelect, onEditDone }: BoardListProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {boards.map((board) => (
        <BoardItem
          key={board.id}
          board={board}
          active={board.id === activeBoardId}
          autoEdit={board.id === editingBoardId}
          onSelect={onSelect}
          onEditDone={onEditDone}
        />
      ))}
    </div>
  )
}

function BoardItem({
  board,
  active,
  autoEdit,
  onSelect,
  onEditDone
}: {
  board: BoardMeta
  active: boolean
  autoEdit?: boolean
  onSelect: (id: string) => void
  onEditDone?: () => void
}) {
  const { categories, updateBoardMeta, deleteBoard } = useBoardStore()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(board.title)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // Auto-edit when newly created
  useEffect(() => {
    if (autoEdit) {
      setEditing(true)
      setTitle(board.title)
    }
  }, [autoEdit, board.title])

  function commitRename() {
    if (title.trim()) updateBoardMeta(board.id, { title: title.trim() })
    setEditing(false)
    onEditDone?.()
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

  function buildMenuItems() {
    const moveChildren = [
      {
        label: '未分类',
        onClick: () => updateBoardMeta(board.id, { categoryId: null })
      },
      ...categories.map((cat: Category) => ({
        label: cat.name,
        onClick: () => updateBoardMeta(board.id, { categoryId: cat.id })
      }))
    ]

    return [
      { label: '重命名', onClick: () => { setEditing(true); setTitle(board.title) } },
      { label: '移动到…', children: moveChildren },
      { label: '删除', danger: true, onClick: () => deleteBoard(board.id) }
    ]
  }

  return (
    <div
      className={[
        'group flex items-center gap-2 px-3 py-1.5 rounded mx-1 cursor-pointer transition-colors',
        active ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-gray-100 text-gray-700'
      ].join(' ')}
      onClick={() => onSelect(board.id)}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/board-id', board.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      {/* Thumbnail */}
      {board.thumbnail ? (
        <img
          src={board.thumbnail}
          alt=""
          className="w-8 h-6 object-cover rounded border border-gray-200 flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-6 bg-gray-100 rounded border border-gray-200 flex-shrink-0" />
      )}

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setTitle(board.title); setEditing(false); onEditDone?.() }
            }}
            className="w-full text-xs bg-transparent border-b border-indigo-400 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-xs truncate block"
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
          >
            {board.title}
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        title="删除白板"
        onClick={(e) => { e.stopPropagation(); deleteBoard(board.id) }}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 flex-shrink-0 transition-opacity"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={buildMenuItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
