import { useState } from 'react'
import type { AppSettings } from '../types'

interface StoragePickerProps {
  settings: AppSettings
  onSelect: (path: string) => void
}

export function StoragePicker({ settings, onSelect }: StoragePickerProps) {
  const [loading, setLoading] = useState(false)

  async function handleSelectFolder() {
    if (!window.electronAPI) return
    setLoading(true)
    try {
      const path = await window.electronAPI.selectStorageFolder()
      if (path) onSelect(path)
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenRecent(path: string) {
    if (!window.electronAPI) return
    setLoading(true)
    try {
      await window.electronAPI.setStoragePath(path)
      onSelect(path)
    } finally {
      setLoading(false)
    }
  }

  async function handleImportLegacy() {
    if (!window.electronAPI) return
    setLoading(true)
    try {
      const data = await window.electronAPI.importLegacyFile()
      if (!data) return
      // First select a folder to store into
      const path = await window.electronAPI.selectStorageFolder()
      if (!path) return
      // Write index
      const index = {
        categories: data.categories,
        boards: data.boards.map(({ canvasJSON, ...meta }) => meta)
      }
      await window.electronAPI.writeIndex(index)
      // Write each board
      for (const board of data.boards) {
        await window.electronAPI.writeBoard(board)
      }
      onSelect(path)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Title bar */}
      <div className="h-10 drag-region bg-white border-b border-gray-200 flex items-center px-4">
        <span className="text-sm font-medium text-gray-700 no-drag select-none">writeBoard</span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full px-8">
          {/* Logo / title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">欢迎使用 writeBoard</h1>
            <p className="text-sm text-gray-500">
              选择一个文件夹来存储白板数据，该文件夹可以通过 Git 管理并与团队共享。
            </p>
          </div>

          {/* Main action */}
          <button
            onClick={handleSelectFolder}
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            选择存储文件夹
          </button>

          {/* Import legacy */}
          <button
            onClick={handleImportLegacy}
            disabled={loading}
            className="w-full mt-3 py-2.5 px-4 border border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            导入旧版数据文件
          </button>

          {/* Recent paths */}
          {settings.recentPaths.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">最近使用</h3>
              <div className="space-y-1">
                {settings.recentPaths.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleOpenRecent(p)}
                    disabled={loading}
                    className="w-full text-left py-2 px-3 text-sm text-gray-600 hover:bg-gray-100 rounded-lg truncate transition-colors"
                    title={p}
                  >
                    <span className="text-indigo-500 mr-2">📁</span>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
