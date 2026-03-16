import { useState } from 'react'
import { useBoardStore } from '../../store/boardStore'
import { useToolStore } from '../../store/toolStore'
import { CategoryItem } from './CategoryItem'
import { BoardList } from './BoardList'

export function Sidebar() {
  const {
    boardMetas, categories, activeBoardId,
    createBoard, createCategory, setActiveBoard, updateBoardMeta,
    importFromFolder
  } = useBoardStore()

  const { setTool } = useToolStore()

  const [newCatName, setNewCatName] = useState('')
  const [showCatInput, setShowCatInput] = useState(false)
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [dragOverUncat, setDragOverUncat] = useState(false)

  const uncategorized = boardMetas
    .filter((b) => b.categoryId === null)
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN', { numeric: true }))

  function handleSelectBoard(id: string) {
    setActiveBoard(id)
    setTool('pen')
  }

  function handleCreateBoard(categoryId: string | null = null) {
    const board = createBoard(categoryId)
    setEditingBoardId(board.id)
    setTool('pen')
  }

  function handleCreateCategory() {
    if (newCatName.trim()) {
      createCategory(newCatName.trim())
      setNewCatName('')
      setShowCatInput(false)
    }
  }

  const handleSwitchWorkspace = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.selectStorageFolder()
      if (result) window.location.reload()
    }
  }

  return (
    <div className="w-56 h-full bg-gray-50 border-r border-gray-200 flex flex-col select-none no-drag">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-gray-200">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <button
            onClick={handleSwitchWorkspace}
            title="切换项目 / 打开文件夹"
            className="text-gray-400 hover:text-indigo-600 transition-colors p-1 -ml-1 rounded hover:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 truncate">白板</span>
        </div>
        <button
          onClick={() => handleCreateBoard(null)}
          title="新建白板"
          className="text-gray-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-gray-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Board list + categories */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Uncategorized boards */}
        {uncategorized.length > 0 && (
          <div
            className={['mb-2 rounded transition-colors', dragOverUncat ? 'bg-indigo-50' : ''].join(' ')}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverUncat(true)
            }}
            onDragLeave={() => setDragOverUncat(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverUncat(false)
              const boardId = e.dataTransfer.getData('text/board-id')
              if (boardId) updateBoardMeta(boardId, { categoryId: null })
            }}
          >
            <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wider">未分类</div>
            <BoardList
              boards={uncategorized}
              activeBoardId={activeBoardId}
              editingBoardId={editingBoardId}
              onSelect={handleSelectBoard}
              onEditDone={() => setEditingBoardId(null)}
            />
          </div>
        )}

        {/* Each category */}
        {categories.map((cat) => (
          <CategoryItem
            key={cat.id}
            category={cat}
            editingBoardId={editingBoardId}
            onSelectBoard={handleSelectBoard}
            onCreateBoard={handleCreateBoard}
            onEditDone={() => setEditingBoardId(null)}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-gray-200 p-2 flex flex-col gap-1">
        {showCatInput ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory()
                if (e.key === 'Escape') { setShowCatInput(false); setNewCatName('') }
              }}
              placeholder="分类名称"
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-400"
            />
            <button
              onClick={handleCreateCategory}
              className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 px-2 rounded"
            >
              确定
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowCatInput(true)}
              className="w-full text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1 py-1 hover:bg-gray-100 rounded px-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建分类
            </button>
            <button
              onClick={importFromFolder}
              className="w-full text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1 py-1 hover:bg-gray-100 rounded px-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              导入文件夹
            </button>
          </>
        )}
      </div>
    </div>
  )
}
