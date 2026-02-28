// Global TypeScript types

export interface Category {
  id: string
  name: string
  color: string
  createdAt: number
}

/** Lightweight board metadata stored in index.json (no canvasJSON). */
export interface BoardMeta {
  id: string
  title: string
  categoryId: string | null
  tags: string[]
  thumbnail: string
  createdAt: number
  updatedAt: number
  headerText: string
  background: BackgroundType
}

/** Full board data stored in boards/{id}.json. */
export interface Board extends BoardMeta {
  canvasJSON: string
}

/** Shape of index.json in the workspace folder. */
export interface WorkspaceIndex {
  categories: Category[]
  boards: BoardMeta[]
}

/** Legacy format: single-file AppData (for import). */
export interface AppData {
  categories: Category[]
  boards: Board[]
}

/** App-level settings stored in userData. */
export interface AppSettings {
  storagePath: string | null
  recentPaths: string[]
}

export type ToolType = 'select' | 'pen' | 'eraser' | 'text' | 'laser' | 'highlighter' | 'shape' | 'trail'

export type ShapeType = 'line' | 'arrow' | 'rect' | 'ellipse'

export type BackgroundType = 'blank' | 'grid' | 'lines' | 'dots'

export interface PenOptions {
  color: string
  width: number
}

// Augment window with electron API
declare global {
  interface Window {
    electronAPI: {
      // Settings
      getSettings: () => Promise<AppSettings>
      selectStorageFolder: () => Promise<string | null>
      setStoragePath: (path: string) => Promise<void>
      // Data
      readIndex: () => Promise<WorkspaceIndex>
      readBoard: (id: string) => Promise<Board | null>
      writeIndex: (data: WorkspaceIndex) => Promise<void>
      writeBoard: (board: Board) => Promise<void>
      deleteBoard: (id: string) => Promise<void>
      // Images
      saveImage: (dataUrl: string) => Promise<string>
      resolveImagePath: (relativePath: string) => Promise<string>
      openImageDialog: () => Promise<string | null>
      // Import
      importLegacyFile: () => Promise<AppData | null>
      importJsonFile: () => Promise<{ type: string; data: unknown; fileName: string } | null>
    }
  }
}
