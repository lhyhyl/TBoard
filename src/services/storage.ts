import type { AppSettings, WorkspaceIndex, Board, AppData } from '../types'

// ── Settings ──────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  if (window.electronAPI) {
    return window.electronAPI.getSettings()
  }
  const raw = localStorage.getItem('writeboard-settings')
  return raw ? JSON.parse(raw) : { storagePath: null, recentPaths: [] }
}

export async function selectStorageFolder(): Promise<string | null> {
  if (window.electronAPI) {
    return window.electronAPI.selectStorageFolder()
  }
  return null
}

export async function setStoragePath(path: string): Promise<void> {
  if (window.electronAPI) {
    return window.electronAPI.setStoragePath(path)
  }
}

// ── Data ──────────────────────────────────────────────

export async function readIndex(): Promise<WorkspaceIndex> {
  if (window.electronAPI) {
    return window.electronAPI.readIndex()
  }
  const raw = localStorage.getItem('writeboard-index')
  return raw ? JSON.parse(raw) : { categories: [], boards: [] }
}

export async function readBoard(id: string): Promise<Board | null> {
  if (window.electronAPI) {
    return window.electronAPI.readBoard(id)
  }
  const raw = localStorage.getItem(`writeboard-board-${id}`)
  return raw ? JSON.parse(raw) : null
}

export async function writeIndex(data: WorkspaceIndex): Promise<void> {
  if (window.electronAPI) {
    return window.electronAPI.writeIndex(data)
  }
  localStorage.setItem('writeboard-index', JSON.stringify(data))
}

export async function writeBoard(board: Board): Promise<void> {
  if (window.electronAPI) {
    return window.electronAPI.writeBoard(board)
  }
  localStorage.setItem(`writeboard-board-${board.id}`, JSON.stringify(board))
}

export async function deleteBoardFile(id: string): Promise<void> {
  if (window.electronAPI) {
    return window.electronAPI.deleteBoard(id)
  }
  localStorage.removeItem(`writeboard-board-${id}`)
}

export async function patchBoardMeta(id: string, patch: Partial<import('../types').Board>): Promise<void> {
  if (window.electronAPI) {
    return window.electronAPI.patchBoardMeta(id, patch)
  }
  // localStorage fallback: read, patch, write
  const raw = localStorage.getItem(`writeboard-board-${id}`)
  if (!raw) return
  const board = JSON.parse(raw)
  localStorage.setItem(`writeboard-board-${id}`, JSON.stringify({ ...board, ...patch, updatedAt: Date.now() }))
}

// ── Images ────────────────────────────────────────────

export async function saveImage(dataUrl: string): Promise<string> {
  if (window.electronAPI) {
    return window.electronAPI.saveImage(dataUrl)
  }
  return dataUrl
}

export async function resolveImagePath(relativePath: string): Promise<string> {
  if (window.electronAPI) {
    return window.electronAPI.resolveImagePath(relativePath)
  }
  return relativePath
}

export async function openImageDialog(): Promise<string | null> {
  if (window.electronAPI) {
    return window.electronAPI.openImageDialog()
  }
  return null
}

// ── Import ────────────────────────────────────────────

export async function importLegacyFile(): Promise<AppData | null> {
  if (window.electronAPI) {
    return window.electronAPI.importLegacyFile()
  }
  return null
}

export async function importJsonFile(): Promise<{ type: string; data: unknown; fileName: string } | null> {
  if (window.electronAPI) {
    return window.electronAPI.importJsonFile()
  }
  return null
}
