import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { join, basename } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import type { AppSettings, WorkspaceIndex, Board, AppData } from '../src/types'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Settings (persisted in userData) ──────────────────────────────────

function getSettingsPath() {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  const p = getSettingsPath()
  if (!existsSync(p)) return { storagePath: null, recentPaths: [] }
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as AppSettings
  } catch {
    return { storagePath: null, recentPaths: [] }
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
  const p = getIndexPath(storagePath)
  if (!existsSync(p)) return { categories: [], boards: [] }
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as WorkspaceIndex
  } catch {
    return { categories: [], boards: [] }
  }
}

function writeIndex(storagePath: string, data: WorkspaceIndex) {
  ensureWorkspaceDirs(storagePath)
  writeFileSync(getIndexPath(storagePath), JSON.stringify(data, null, 2), 'utf-8')
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
