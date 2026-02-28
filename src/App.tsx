import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoardStore } from './store/boardStore'
import { useToolStore } from './store/toolStore'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toolbar } from './components/Toolbar/Toolbar'
import { WhiteBoard } from './components/Canvas/WhiteBoard'
import { useCanvas } from './components/Canvas/useCanvas'
import { ContextMenu } from './components/ContextMenu'
import { StoragePicker } from './components/StoragePicker'
import { BoardHeader } from './components/Canvas/BoardHeader'
import { SettingsModal } from './components/Settings/SettingsModal'
import { getSettings, setStoragePath as setStoragePathApi } from './services/storage'
import type { AppSettings } from './types'

function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const { undo, redo, clearCanvas, insertImage, insertText, toggleLockSelected } = useCanvas(canvasRef, size.width, size.height)
  const { importFromJson } = useBoardStore()
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width: Math.floor(width), height: Math.floor(height) })
      }
    })
    ro.observe(el)
    // Initial size
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  /* ---------- Drag-and-drop image ---------- */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (!file || !file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) insertImage(ev.target.result as string)
      }
      reader.readAsDataURL(file)
    },
    [insertImage]
  )

  /* ---------- Clipboard paste (image + text) ---------- */
  const handlePaste = useCallback((e?: ClipboardEvent) => {
    const items = e?.clipboardData?.items
    if (items) {
      // Priority: image first
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = (ev) => {
            if (ev.target?.result) insertImage(ev.target.result as string)
          }
          reader.readAsDataURL(file)
          return
        }
      }
      // Fallback: text
      for (const item of items) {
        if (item.type === 'text/plain') {
          item.getAsString((text) => {
            if (text.trim()) insertText(text.trim())
          })
          return
        }
      }
    }
  }, [insertImage, insertText])

  useEffect(() => {
    const handler = (e: ClipboardEvent) => handlePaste(e)
    globalThis.addEventListener('paste', handler)
    return () => globalThis.removeEventListener('paste', handler)
  }, [handlePaste])

  /* ---------- Right-click paste from clipboard API ---------- */
  const handleContextPaste = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        // Check for image
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const reader = new FileReader()
          reader.onload = (ev) => {
            if (ev.target?.result) insertImage(ev.target.result as string)
          }
          reader.readAsDataURL(blob)
          return
        }
        // Check for text
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          const text = await blob.text()
          if (text.trim()) insertText(text.trim())
          return
        }
      }
    } catch {
      // Fallback: try readText
      try {
        const text = await navigator.clipboard.readText()
        if (text.trim()) insertText(text.trim())
      } catch { /* clipboard not available */ }
    }
  }, [insertImage, insertText])

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Toolbar
        onUndo={undo}
        onRedo={redo}
        onClear={clearCanvas}
        onInsertImage={insertImage}
        onImportJson={importFromJson}
        onToggleLock={toggleLockSelected}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div ref={containerRef} className="flex-1 overflow-hidden relative" onContextMenu={handleCanvasContextMenu}>
        <BoardHeader />
        <WhiteBoard
          width={size.width}
          height={size.height}
          canvasRef={canvasRef}
          onDrop={handleDrop}
        />
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={[
              { label: '粘贴', onClick: handleContextPaste },
              { label: '锁定/解锁', onClick: toggleLockSelected },
            ]}
            onClose={() => setCtxMenu(null)}
          />
        )}
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </div>
  )
}

export default function App() {
  const { loaded, loadAll } = useBoardStore()
  const presentationMode = useToolStore((s) => s.presentationMode)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [storagePath, setStoragePath] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      if (s.storagePath) {
        setStoragePath(s.storagePath)
      }
    })
  }, [])

  // Load boards when storage path is set
  useEffect(() => {
    if (storagePath) loadAll()
  }, [storagePath, loadAll])

  // Waiting for settings
  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        加载中...
      </div>
    )
  }

  // No storage path yet — show picker
  if (!storagePath) {
    return (
      <StoragePicker
        settings={settings}
        onSelect={async (path) => {
          await setStoragePathApi(path)
          setSettings({ ...settings, storagePath: path, recentPaths: [path, ...settings.recentPaths.filter((p) => p !== path)] })
          setStoragePath(path)
        }}
      />
    )
  }

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        加载中...
      </div>
    )
  }

  // Extract folder name for title bar
  const folderName = storagePath.split(/[\\/]/).pop() || 'writeBoard'

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Custom title bar for frameless window */}
      {!presentationMode && (
        <div className="h-10 drag-region bg-white border-b border-gray-200 flex items-center px-4">
          <span className="text-sm font-medium text-gray-700 no-drag select-none">writeBoard — {folderName}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {!presentationMode && <Sidebar />}
        <CanvasArea />
      </div>
    </div>
  )
}
