import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, WorkspaceIndex, Board, AppData } from '../src/types'

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  selectStorageFolder: (): Promise<string | null> => ipcRenderer.invoke('select-storage-folder'),
  setStoragePath: (path: string): Promise<void> => ipcRenderer.invoke('set-storage-path', path),
  // Data
  readIndex: (): Promise<WorkspaceIndex> => ipcRenderer.invoke('read-index'),
  readBoard: (id: string): Promise<Board | null> => ipcRenderer.invoke('read-board', id),
  writeIndex: (data: WorkspaceIndex): Promise<void> => ipcRenderer.invoke('write-index', data),
  writeBoard: (board: Board): Promise<void> => ipcRenderer.invoke('write-board', board),
  deleteBoard: (id: string): Promise<void> => ipcRenderer.invoke('delete-board', id),
  // Images
  saveImage: (dataUrl: string): Promise<string> => ipcRenderer.invoke('save-image', dataUrl),
  resolveImagePath: (relativePath: string): Promise<string> => ipcRenderer.invoke('resolve-image-path', relativePath),
  openImageDialog: (): Promise<string | null> => ipcRenderer.invoke('open-image-dialog'),
  // Import
  importLegacyFile: (): Promise<AppData | null> => ipcRenderer.invoke('import-legacy-file'),
  importJsonFile: (): Promise<{ type: string; data: unknown; fileName: string } | null> => ipcRenderer.invoke('import-json-file')
})
