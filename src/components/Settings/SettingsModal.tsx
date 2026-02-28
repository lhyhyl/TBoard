import { useState, useEffect, useCallback } from 'react'
import {
  useShortcutStore,
  ACTION_LABELS,
  DEFAULT_SHORTCUTS,
  eventToShortcut,
  type ShortcutAction,
} from '../../store/shortcutStore'

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
          <h2 className="text-base font-semibold text-gray-800">设置 — 快捷键</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcut list */}
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

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400">点击快捷键后按新按键来修改</span>
          <button
            onClick={() => { resetShortcuts(); setRecording(null) }}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
          >
            恢复默认
          </button>
        </div>
      </div>
    </div>
  )
}
