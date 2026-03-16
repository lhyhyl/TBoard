import { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } from 'electron'
import { join, basename, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import type { AppSettings, WorkspaceIndex, Board, AppData } from '../src/types'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Settings (persisted in userData) ──────────────────────────────────

function getSettingsPath() {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  const p = getSettingsPath()
  if (!existsSync(p)) return { storagePath: null, recentPaths: [], pdfExportPath: null }
  try {
    const s = JSON.parse(readFileSync(p, 'utf-8')) as AppSettings
    if (s.pdfExportPath === undefined) s.pdfExportPath = null
    return s
  } catch {
    return { storagePath: null, recentPaths: [], pdfExportPath: null }
  }
}

function saveSettings(settings: AppSettings) {
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

// ── Workspace helpers ─────────────────────────────────────────────────

function ensureWorkspaceDirs(storagePath: string) {
  const boardsDir = join(storagePath, 'boards')
  const imagesDir = join(storagePath, 'images')
  if (!existsSync(boardsDir)) mkdirSync(boardsDir, { recursive: true })
  if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })
}

function getIndexPath(storagePath: string) {
  return join(storagePath, 'index.json')
}

function readIndex(storagePath: string): WorkspaceIndex {
  // Read categories from index.json (categories are the only shared data)
  const p = getIndexPath(storagePath)
  let categories: WorkspaceIndex['categories'] = []
  if (existsSync(p)) {
    try {
      const raw = JSON.parse(readFileSync(p, 'utf-8'))
      categories = raw.categories ?? []
    } catch { /* use empty */ }
  }

  // Reconstruct board list by scanning boards/ — each person owns their own files
  const boardsDir = join(storagePath, 'boards')
  const boards: WorkspaceIndex['boards'] = []
  if (existsSync(boardsDir)) {
    for (const file of readdirSync(boardsDir)) {
      if (!file.endsWith('.json')) continue
      try {
        const board = JSON.parse(readFileSync(join(boardsDir, file), 'utf-8')) as Board
        // Extract meta fields only (omit canvasJSON to keep index lightweight)
        const { canvasJSON: _canvas, ...meta } = board
        boards.push(meta)
      } catch { /* skip corrupt files */ }
    }
  }
  // Preserve creation order
  boards.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))

  return { categories, boards }
}

function writeIndex(storagePath: string, data: WorkspaceIndex) {
  ensureWorkspaceDirs(storagePath)
  // Only persist categories — board list is always reconstructed from boards/ on startup
  writeFileSync(getIndexPath(storagePath), JSON.stringify({ categories: data.categories }, null, 2), 'utf-8')
}

function readBoard(storagePath: string, id: string): Board | null {
  const p = join(storagePath, 'boards', `${id}.json`)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Board
  } catch {
    return null
  }
}

function writeBoardFile(storagePath: string, board: Board) {
  ensureWorkspaceDirs(storagePath)
  const p = join(storagePath, 'boards', `${board.id}.json`)
  writeFileSync(p, JSON.stringify(board, null, 2), 'utf-8')
}

function deleteBoardFile(storagePath: string, id: string) {
  const p = join(storagePath, 'boards', `${id}.json`)
  if (existsSync(p)) unlinkSync(p)
}

// ── Window ────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#374151',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(join(__dirname, '../../out/renderer/index.html'))
  }

  return win
}

// ── IPC: Settings ─────────────────────────────────────────────────────

ipcMain.handle('get-settings', (): AppSettings => {
  return loadSettings()
})

ipcMain.handle('set-storage-path', (_event, newPath: string) => {
  const settings = loadSettings()
  settings.storagePath = newPath
  // Add to recent, dedup, max 10
  settings.recentPaths = [newPath, ...settings.recentPaths.filter((p) => p !== newPath)].slice(0, 10)
  saveSettings(settings)
  // Ensure workspace dirs exist
  ensureWorkspaceDirs(newPath)
  // Create index.json if not exists
  if (!existsSync(getIndexPath(newPath))) {
    writeIndex(newPath, { categories: [], boards: [] })
  }
})

ipcMain.handle('select-storage-folder', async (event): Promise<string | null> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win!, {
    title: '选择白板存储文件夹',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const folderPath = result.filePaths[0]
  // Set as current storage path
  const settings = loadSettings()
  settings.storagePath = folderPath
  settings.recentPaths = [folderPath, ...settings.recentPaths.filter((p) => p !== folderPath)].slice(0, 10)
  saveSettings(settings)
  // Init workspace
  ensureWorkspaceDirs(folderPath)
  if (!existsSync(getIndexPath(folderPath))) {
    writeIndex(folderPath, { categories: [], boards: [] })
  }
  return folderPath
})

// ── IPC: Data (multi-file) ────────────────────────────────────────────

ipcMain.handle('read-index', (): WorkspaceIndex => {
  const { storagePath } = loadSettings()
  if (!storagePath) return { categories: [], boards: [] }
  return readIndex(storagePath)
})

ipcMain.handle('read-board', (_event, id: string): Board | null => {
  const { storagePath } = loadSettings()
  if (!storagePath) return null
  return readBoard(storagePath, id)
})

ipcMain.handle('write-index', (_event, data: WorkspaceIndex) => {
  const { storagePath } = loadSettings()
  if (!storagePath) return
  writeIndex(storagePath, data)
})

// Patch board meta fields without transferring canvasJSON over IPC
ipcMain.handle('patch-board-meta', (_event, id: string, patch: Partial<Board>) => {
  const { storagePath } = loadSettings()
  if (!storagePath) return
  const board = readBoard(storagePath, id)
  if (!board) return
  const { canvasJSON: _c, ...rest } = patch as Board
  writeBoardFile(storagePath, { ...board, ...rest, updatedAt: Date.now() })
})

ipcMain.handle('write-board', (_event, board: Board) => {
  const { storagePath } = loadSettings()
  if (!storagePath) return
  writeBoardFile(storagePath, board)
})

ipcMain.handle('delete-board', (_event, id: string) => {
  const { storagePath } = loadSettings()
  if (!storagePath) return
  deleteBoardFile(storagePath, id)
})

// ── IPC: Images ───────────────────────────────────────────────────────

ipcMain.handle('save-image', (_event, dataUrl: string): string => {
  const { storagePath } = loadSettings()
  if (!storagePath) throw new Error('No storage path configured')
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) throw new Error('Invalid dataURL')
  const [, ext, data] = matches
  const fileName = `img_${Date.now()}.${ext}`
  const imagesDir = join(storagePath, 'images')
  if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true })
  writeFileSync(join(imagesDir, fileName), Buffer.from(data, 'base64'))
  // Return relative path for portability
  return `images/${fileName}`
})

ipcMain.handle('resolve-image-path', (_event, relativePath: string): string => {
  const { storagePath } = loadSettings()
  if (!storagePath) return relativePath
  const absPath = join(storagePath, relativePath)
  return `file://${absPath.replace(/\\/g, '/')}`
})

ipcMain.handle('open-image-dialog', async (event): Promise<string | null> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win!, {
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return `file://${result.filePaths[0].replace(/\\/g, '/')}`
})

// ── IPC: Import legacy single-file data ───────────────────────────────

ipcMain.handle('import-legacy-file', async (event): Promise<AppData | null> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win!, {
    title: '导入旧版白板数据',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  try {
    const raw = readFileSync(result.filePaths[0], 'utf-8')
    const data = JSON.parse(raw) as AppData
    if (!Array.isArray(data.categories) || !Array.isArray(data.boards)) {
      throw new Error('Invalid format')
    }
    return data
  } catch {
    return null
  }
})

// ── IPC: Import any JSON file (auto-detect format) ────────────────────

ipcMain.handle('import-json-file', async (event): Promise<{ type: string; data: unknown; fileName: string } | null> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win!, {
    title: '导入 JSON 文件',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  try {
    const filePath = result.filePaths[0]
    const fileName = basename(filePath, '.json')
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    // Auto-detect: if has boards[] + categories[] → workspace format
    if (parsed && Array.isArray(parsed.boards) && Array.isArray(parsed.categories)) {
      return { type: 'workspace', data: parsed as AppData, fileName }
    }
    // Otherwise treat as raw fabric.js canvasJSON
    return { type: 'canvas', data: raw, fileName }
  } catch {
    return null
  }
})

// ── IPC: Export PDF ───────────────────────────────────────────────────

async function writePdf(pdfPath: string, dataUrl: string): Promise<void> {
  const tmpPath = join(app.getPath('temp'), `tboard-export-${Date.now()}.html`)
  const html = `<!DOCTYPE html><html>
<head><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; background: white; }
img { width: 100%; height: auto; display: block; }
</style></head>
<body><img src="${dataUrl}" /></body>
</html>`
  writeFileSync(tmpPath, html, 'utf-8')
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false, contextIsolation: false } })
  try {
    await win.loadFile(tmpPath)
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true, landscape: true, pageSize: 'A4'
    })
    writeFileSync(pdfPath, pdfBuffer)
  } finally {
    win.destroy()
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}

ipcMain.handle('export-board-pdf', async (event, title: string, categoryName: string, dataUrl: string): Promise<string | null> => {
  const settings = loadSettings()
  if (!settings.storagePath) throw new Error('No storage path configured')

  const safeName = (title || 'board').replace(/[\\/:*?"<>|]/g, '_').trim() || 'board'
  const safeCat = (categoryName || '').replace(/[\\/:*?"<>|]/g, '_').trim()

  // Determine export directory
  let exportDir: string | null = settings.pdfExportPath ?? null

  if (!exportDir) {
    // No default path — show save dialog, pre-fill to desktop/{category}/{name}.pdf
    const win = BrowserWindow.fromWebContents(event.sender)
    const defaultPath = safeCat
      ? join(app.getPath('desktop'), safeCat, `${safeName}.pdf`)
      : join(app.getPath('desktop'), `${safeName}.pdf`)
    const result = await dialog.showSaveDialog(win!, {
      title: '导出 PDF',
      defaultPath,
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    const pdfPath = result.filePath
    mkdirSync(dirname(pdfPath), { recursive: true })
    await writePdf(pdfPath, dataUrl)
    shell.showItemInFolder(pdfPath)
    return pdfPath
  }

  // Has default dir — auto-save to {exportDir}/{category}/{name}.pdf
  const pdfDir = safeCat ? join(exportDir, safeCat) : exportDir
  mkdirSync(pdfDir, { recursive: true })
  const pdfPath = join(pdfDir, `${safeName}.pdf`)
  await writePdf(pdfPath, dataUrl)
  shell.showItemInFolder(pdfPath)
  return pdfPath
})

ipcMain.handle('set-pdf-export-path', (_event, path: string | null) => {
  const settings = loadSettings()
  settings.pdfExportPath = path
  saveSettings(settings)
})

ipcMain.handle('select-pdf-export-folder', async (event): Promise<string | null> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win!, {
    title: '选择 PDF 默认导出文件夹',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('export-category-pdf', async (
  event,
  categoryName: string,
  boards: { title: string; dataUrl: string }[]
): Promise<string | null> => {
  const settings = loadSettings()
  const safeCat = (categoryName || 'export').replace(/[\\/:*?"<>|]/g, '_').trim() || 'export'

  let exportDir: string | null = settings.pdfExportPath ?? null
  if (!exportDir) {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      title: `导出「${categoryName}」全部白板到文件夹`,
      defaultPath: app.getPath('desktop'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    exportDir = result.filePaths[0]
  }

  const pdfDir = join(exportDir, safeCat)
  mkdirSync(pdfDir, { recursive: true })

  for (const { title, dataUrl } of boards) {
    if (!dataUrl) continue
    const safeName = (title || 'board').replace(/[\\/:*?"<>|]/g, '_').trim() || 'board'
    await writePdf(join(pdfDir, `${safeName}.pdf`), dataUrl)
  }

  shell.showItemInFolder(pdfDir)
  return pdfDir
})

// ── IPC: Import folder ────────────────────────────────────────────────

ipcMain.handle('import-workspace-folder', async (event): Promise<{ success: boolean; count: number }> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const settings = loadSettings()
  if (!settings.storagePath) return { success: false, count: 0 }

  const result = await dialog.showOpenDialog(win!, {
    title: '选择包含 index.json 和 boards/ 的导入文件夹',
    properties: ['openDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return { success: false, count: 0 }

  const sourceDir = result.filePaths[0]
  const currentDir = settings.storagePath

  try {
    const sourceIndexFile = getIndexPath(sourceDir)
    const sourceBoardsDir = join(sourceDir, 'boards')
    const sourceImagesDir = join(sourceDir, 'images')

    // Read source data
    let sourceIndex: WorkspaceIndex = { categories: [], boards: [] }
    if (existsSync(sourceIndexFile)) {
      const raw = JSON.parse(readFileSync(sourceIndexFile, 'utf-8'))
      sourceIndex.categories = raw.categories ?? []
    }

    // Read current data to merge
    const currentIndex = readIndex(currentDir)
    const currentCategoryIds = new Set(currentIndex.categories.map(c => c.id))

    // 1. Merge categories
    for (const cat of sourceIndex.categories) {
      if (!currentCategoryIds.has(cat.id)) {
        currentIndex.categories.push(cat)
      }
    }
    writeIndex(currentDir, currentIndex)

    // 2. Import boards and images
    let importCount = 0
    if (existsSync(sourceBoardsDir)) {
      ensureWorkspaceDirs(currentDir)
      const currentBoardsDir = join(currentDir, 'boards')
      const currentImagesDir = join(currentDir, 'images')

      for (const file of readdirSync(sourceBoardsDir)) {
        if (!file.endsWith('.json')) continue
        const srcBoardPath = join(sourceBoardsDir, file)
        const destBoardPath = join(currentBoardsDir, file)
        
        // Always copy board files (overwrite if same ID, as we treat this as a fresh import)
        const boardData = readFileSync(srcBoardPath, 'utf-8')
        writeFileSync(destBoardPath, boardData, 'utf-8')
        importCount++
      }

      // 3. Copy images
      if (existsSync(sourceImagesDir)) {
        for (const file of readdirSync(sourceImagesDir)) {
          const srcImgPath = join(sourceImagesDir, file)
          const destImgPath = join(currentImagesDir, file)
          if (!existsSync(destImgPath)) {
             writeFileSync(destImgPath, readFileSync(srcImgPath))
          }
        }
      }
    }

    return { success: true, count: importCount }
  } catch (err) {
    console.error('Import failed:', err)
    return { success: false, count: 0 }
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
