import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoardStore } from '../../store/boardStore'

export function BoardHeader() {
  const { activeBoardId, activeBoard, updateBoardMeta } = useBoardStore()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const headerText = activeBoard?.headerText ?? ''

  useEffect(() => {
    setValue(headerText)
  }, [headerText, activeBoardId])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const save = useCallback(() => {
    setEditing(false)
    const trimmed = value.trim()
    if (activeBoardId && trimmed !== headerText) {
      updateBoardMeta(activeBoardId, { headerText: trimmed })
    }
  }, [activeBoardId, headerText, value, updateBoardMeta])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') {
      setValue(headerText)
      setEditing(false)
    }
  }, [save, headerText])

  if (editing) {
    return (
      <div className="absolute top-2 left-3 z-10">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          className="text-lg font-bold bg-white/80 backdrop-blur-sm border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-indigo-400 text-gray-800 min-w-[200px]"
          placeholder="输入标题..."
        />
      </div>
    )
  }

  return (
    <div
      className="absolute top-2 left-3 z-10 cursor-pointer group"
      onClick={() => setEditing(true)}
    >
      <span className={[
        'text-lg font-bold px-2 py-0.5 rounded transition-colors',
        headerText
          ? 'text-gray-800 bg-white/60 group-hover:bg-white/80'
          : 'text-gray-400 bg-white/40 group-hover:bg-white/60'
      ].join(' ')}>
        {headerText || '点击添加标题'}
      </span>
    </div>
  )
}
