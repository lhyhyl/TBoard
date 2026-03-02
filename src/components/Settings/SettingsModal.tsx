import { useState, useEffect, useCallback } from 'react'
import {
  useShortcutStore,
  ACTION_LABELS,
  DEFAULT_SHORTCUTS,
  eventToShortcut,
  type ShortcutAction,
} from '../../store/shortcutStore'
import { getSettings } from '../../services/storage'

const ALL_ACTIONS: ShortcutAction[] = [
  'tool:select', 'tool:pen', 'tool:highlighter', 'tool:eraser',
  'tool:text', 'tool:shape', 'tool:laser', 'tool:trail',
  'action:undo', 'action:redo', 'action:delete',
  'action:presentation', 'action:escape',
]

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const { shortcuts, setShortcut, resetShortcuts } = useShortcutStore()
  const [recording, setRecording] = useState<ShortcutAction | null>(null)
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'export'>('shortcuts')
  const [pdfPath, setPdfPath] = useState<string>('')
  const [pdfPathSaved, setPdfPathSaved] = useState(false)

  // Load current pdf export path on open
  useEffect(() => {
    if (!open) return
    getSettings().then((s) => {
      setPdfPath(s.pdfExportPath ?? '')
      setPdfPathSaved(false)
    })
  }, [open])

  const handleSelectPdfDir = useCallback(async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.selectPdfExportFolder()
    if (result) setPdfPath(result)
  }, [])

  const handleSavePdfPath = useCallback(async () => {
    if (!window.electronAPI) return
    await window.electronAPI.setPdfExportPath(pdfPath.trim() || null)
    setPdfPathSaved(true)
    setTimeout(() => setPdfPathSaved(false), 2000)
  }, [pdfPath])

  const handleClearPdfPath = useCallback(async () => {
    if (!window.electronAPI) return
    await window.electronAPI.setPdfExportPath(null)
    setPdfPath('')
    setPdfPathSaved(true)
    setTimeout(() => setPdfPathSaved(false), 2000)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()
    const desc = eventToShortcut(e)
    if (!desc) return
    setShortcut(recording, desc)
    setRecording(null)
  }, [recording, setShortcut])

  useEffect(() => {
    if (!recording) return
    globalThis.addEventListener('keydown', handleKeyDown, true)
    return () => globalThis.removeEventListener('keydown', handleKeyDown, true)
  }, [recording, handleKeyDown])

  // Close on Escape when not recording
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !recording) {
        onClose()
      }
    }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [open, recording, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={() => { if (!recording) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5">
          {([['shortcuts', '快捷键'], ['export', '导出']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Shortcuts tab ── */}
        {activeTab === 'shortcuts' && (<>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase">
                  <th className="text-left py-2 font-medium">功能</th>
                  <th className="text-right py-2 font-medium">快捷键</th>
                </tr>
              </thead>
              <tbody>
                {ALL_ACTIONS.map((action) => {
                  const isRecording = recording === action
                  const isDefault = shortcuts[action] === DEFAULT_SHORTCUTS[action]
                  return (
                    <tr key={action} className="border-t border-gray-100">
                      <td className="py-2.5 text-gray-700">{ACTION_LABELS[action]}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setRecording(isRecording ? null : action)}
                          className={[
                            'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono transition-colors min-w-[80px] justify-center',
                            isRecording
                              ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400 animate-pulse'
                              : isDefault
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
                          ].join(' ')}
                        >
                          {isRecording ? '按下按键...' : shortcuts[action]}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <span className="text-xs text-gray-400">点击快捷键后按新按键来修改</span>
            <button
              onClick={() => { resetShortcuts(); setRecording(null) }}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
            >
              恢复默认
            </button>
          </div>
        </>)}

        {/* ── Export tab ── */}
        {activeTab === 'export' && (
          <div className="flex-1 px-5 py-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">PDF 默认导出路径</p>
              <p className="text-xs text-gray-400 mb-3">
                设置后，点击「导出 PDF」将直接保存到该目录，不再弹出文件选择框。留空则每次导出时手动选择路径。
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pdfPath}
                  onChange={(e) => setPdfPath(e.target.value)}
                  placeholder="例如: C:\Users\你的名字\Documents\PDF导出"
                  className="flex-1 text-xs border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-indigo-400 text-gray-700 font-mono"
                />
                <button
                  onClick={handleSelectPdfDir}
                  title="浏览文件夹"
                  className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-gray-600 whitespace-nowrap"
                >
                  浏览…
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSavePdfPath}
                  className={[
                    'px-3 py-1.5 text-xs rounded-md transition-colors font-medium',
                    pdfPathSaved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  ].join(' ')}
                >
                  {pdfPathSaved ? '✓ 已保存' : '保存'}
                </button>
                {pdfPath && (
                  <button
                    onClick={handleClearPdfPath}
                    className="px-3 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    清除（每次手动选择）
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
