import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoardStore } from '../../store/boardStore'

const FONTS: { id: string; label: string; family: string }[] = [
  { id: '',           label: '默认',    family: 'inherit' },
  { id: 'KaiTi',     label: '楷体',    family: '"KaiTi","楷体","STKaiti",serif' },
  { id: 'FangSong',  label: '仿宋',    family: '"FangSong","仿宋","STFangsong",serif' },
  { id: 'STXingkai', label: '行楷',    family: '"STXingkai","华文行楷",cursive' },
  { id: 'STLiti',    label: '隶书',    family: '"STLiti","华文隶书",serif' },
  { id: 'STXinwei',  label: '新魏',    family: '"STXinwei","华文新魏",serif' },
  { id: 'STCaiyun',  label: '彩云',    family: '"STCaiyun","华文彩云",serif' },
  { id: 'Impact',    label: 'Impact',  family: '"Impact","Arial Black",sans-serif' },
  { id: 'Georgia',   label: 'Georgia', family: '"Georgia",serif' },
]

function getFontFamily(id: string): string {
  return FONTS.find((f) => f.id === id)?.family ?? 'inherit'
}

export function BoardHeader() {
  const { activeBoardId, activeBoard, updateBoardMeta } = useBoardStore()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [showFontPicker, setShowFontPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fontPickerRef = useRef<HTMLDivElement>(null)

  const headerText = activeBoard?.headerText ?? ''
  const headerFont = activeBoard?.headerFont ?? ''
  const headerFontSize = activeBoard?.headerFontSize ?? 18
  const fontFamily = getFontFamily(headerFont)

  useEffect(() => { setValue(headerText) }, [headerText, activeBoardId])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    if (!showFontPicker) return
    const handler = (e: MouseEvent) => {
      if (fontPickerRef.current && !fontPickerRef.current.contains(e.target as Node))
        setShowFontPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFontPicker])

  const save = useCallback(() => {
    setEditing(false)
    const trimmed = value.trim()
    if (activeBoardId && trimmed !== headerText)
      updateBoardMeta(activeBoardId, { headerText: trimmed })
  }, [activeBoardId, headerText, value, updateBoardMeta])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setValue(headerText); setEditing(false) }
  }, [save, headerText])

  const handleFontSelect = useCallback((fontId: string) => {
    if (activeBoardId) updateBoardMeta(activeBoardId, { headerFont: fontId })
    setShowFontPicker(false)
  }, [activeBoardId, updateBoardMeta])

  const adjustSize = useCallback((delta: number) => {
    if (!activeBoardId) return
    const next = Math.min(120, Math.max(10, headerFontSize + delta))
    updateBoardMeta(activeBoardId, { headerFontSize: next })
  }, [activeBoardId, headerFontSize, updateBoardMeta])

  return (
    <div className="absolute top-2 left-3 z-10 flex items-center gap-1 group">
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          style={{ fontFamily, fontSize: headerFontSize }}
          className="font-bold bg-white/80 backdrop-blur-sm border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-indigo-400 text-gray-800 min-w-[200px]"
          placeholder="输入标题..."
        />
      ) : (
        <span
          className={[
            'font-bold px-2 py-0.5 rounded transition-colors cursor-pointer',
            headerText
              ? 'text-gray-800 bg-white/60 group-hover:bg-white/80'
              : 'text-gray-400 bg-white/40 group-hover:bg-white/60'
          ].join(' ')}
          style={{ fontFamily, fontSize: headerFontSize }}
          onClick={() => setEditing(true)}
        >
          {headerText || '点击添加标题'}
        </span>
      )}

      {/* Size controls — visible on hover */}
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded border border-gray-200 shadow-sm">
        <button
          title="缩小字号"
          onClick={(e) => { e.stopPropagation(); adjustSize(-2) }}
          className="w-5 h-6 flex items-center justify-center text-gray-500 hover:text-indigo-600 text-sm leading-none"
        >−</button>
        <span className="text-xs text-gray-600 w-7 text-center select-none">{headerFontSize}</span>
        <button
          title="放大字号"
          onClick={(e) => { e.stopPropagation(); adjustSize(2) }}
          className="w-5 h-6 flex items-center justify-center text-gray-500 hover:text-indigo-600 text-sm leading-none"
        >+</button>
      </div>

      {/* Font picker button — visible on hover */}
      <div
        ref={fontPickerRef}
        className="relative opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          title="选择字体"
          onClick={(e) => { e.stopPropagation(); setShowFontPicker((v) => !v) }}
          className="w-6 h-6 flex items-center justify-center rounded bg-white/80 hover:bg-white text-gray-500 hover:text-indigo-600 text-xs font-bold shadow-sm border border-gray-200"
          style={{ fontFamily: headerFont ? fontFamily : 'inherit' }}
        >
          A
        </button>

        {showFontPicker && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[130px]">
            {FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => handleFontSelect(f.id)}
                className={[
                  'w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 transition-colors',
                  headerFont === f.id ? 'text-indigo-700 bg-indigo-50' : 'text-gray-700'
                ].join(' ')}
                style={{ fontFamily: f.family }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
