import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Board, BoardMeta, Category } from '../types'
import {
  readIndex, readBoard as readBoardFile, writeIndex, writeBoard as writeBoardFile,
  deleteBoardFile, patchBoardMeta, importJsonFile
} from '../services/storage'
import type { AppData } from '../types'

interface BoardState {
  // Index data (lightweight)
  boardMetas: BoardMeta[]
  categories: Category[]
  activeBoardId: string | null
  loaded: boolean
  // Active board's full data (lazy loaded)
  activeBoard: Board | null
  // Actions
  loadAll: () => Promise<void>
  loadBoardCanvas: (id: string) => Promise<void>
  setActiveBoard: (id: string) => void
  createBoard: (categoryId?: string | null) => Board
  updateBoardMeta: (id: string, patch: Partial<BoardMeta>) => void
  updateBoardCanvas: (id: string, canvasJSON: string, thumbnail: string) => void
  deleteBoard: (id: string) => void
  createCategory: (name: string, color?: string) => Category
  updateCategory: (id: string, patch: Partial<Category>) => void
  deleteCategory: (id: string) => void
  importFromJson: () => Promise<number>
}

let indexSaveTimer: ReturnType<typeof setTimeout> | null = null
let boardSaveTimer: ReturnType<typeof setTimeout> | null = null

function saveIndexDebounced(state: () => BoardState) {
  if (indexSaveTimer) clearTimeout(indexSaveTimer)
  indexSaveTimer = setTimeout(() => {
    const { boardMetas, categories } = state()
    writeIndex({ categories, boards: boardMetas })
  }, 500)
}

function saveBoardDebounced(board: Board) {
  if (boardSaveTimer) clearTimeout(boardSaveTimer)
  boardSaveTimer = setTimeout(() => {
    writeBoardFile(board)
  }, 1000)
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardMetas: [],
  categories: [],
  activeBoardId: null,
  loaded: false,
  activeBoard: null,

  loadAll: async () => {
    const data = await readIndex()
    let activeBoardId = data.boards[0]?.id ?? null

    if (data.boards.length === 0) {
      const id = uuidv4()
      const now = Date.now()
      const meta: BoardMeta = {
        id, title: '我的白板', categoryId: null, tags: [],
        thumbnail: '', createdAt: now, updatedAt: now,
        headerText: '', background: 'blank'
      }
      const board: Board = { ...meta, canvasJSON: '' }
      data.boards.push(meta)
      activeBoardId = id
      writeIndex(data)
      writeBoardFile(board)
    }

    // Compat: fill in defaults for old boards missing new fields
    for (const b of data.boards) {
      if (b.headerText === undefined) b.headerText = ''
      if (b.background === undefined) (b as any).background = 'blank'
    }

    set({ boardMetas: data.boards, categories: data.categories, activeBoardId, loaded: true })

    // Lazy-load active board canvas
    if (activeBoardId) {
      const board = await readBoardFile(activeBoardId)
      if (board) {
        if (board.headerText === undefined) board.headerText = ''
        if (board.background === undefined) (board as any).background = 'blank'
        set({ activeBoard: board })
      }
    }
  },

  loadBoardCanvas: async (id: string) => {
    const board = await readBoardFile(id)
    if (board) {
      if (board.headerText === undefined) board.headerText = ''
      if (board.background === undefined) (board as any).background = 'blank'
      set({ activeBoard: board })
    }
  },

  setActiveBoard: (id) => {
    set({ activeBoardId: id, activeBoard: null })
    get().loadBoardCanvas(id)
  },

  createBoard: (categoryId = null) => {
    const now = Date.now()
    const meta: BoardMeta = {
      id: uuidv4(), title: '新白板', categoryId, tags: [],
      thumbnail: '', createdAt: now, updatedAt: now,
      headerText: '', background: 'blank'
    }
    const board: Board = { ...meta, canvasJSON: '' }
    set((s) => ({
      boardMetas: [...s.boardMetas, meta],
      activeBoardId: board.id,
      activeBoard: board
    }))
    // Board file creation is enough — boards/ scan discovers it on next startup
    writeBoardFile(board)
    return board
  },

  updateBoardMeta: (id, patch) => {
    set((s) => ({
      boardMetas: s.boardMetas.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m
      )
    }))
    // Write to the board's own file — no shared index needed
    const { activeBoard } = get()
    if (activeBoard && activeBoard.id === id) {
      const updated = { ...activeBoard, ...patch, updatedAt: Date.now() }
      set({ activeBoard: updated })
      saveBoardDebounced(updated)
    } else {
      // Non-active board: patch without loading canvasJSON
      patchBoardMeta(id, patch)
    }
  },

  updateBoardCanvas: (id, canvasJSON, thumbnail) => {
    // Update meta thumbnail (in-memory only; persisted via the board file below)
    set((s) => ({
      boardMetas: s.boardMetas.map((m) =>
        m.id === id ? { ...m, thumbnail, updatedAt: Date.now() } : m
      )
    }))
    // Update full board
    const { activeBoard } = get()
    if (activeBoard && activeBoard.id === id) {
      const updated = { ...activeBoard, canvasJSON, thumbnail, updatedAt: Date.now() }
      set({ activeBoard: updated })
      saveBoardDebounced(updated)
    } else {
      // Board not active — read, update, write
      readBoardFile(id).then((board) => {
        if (board) {
          writeBoardFile({ ...board, canvasJSON, thumbnail, updatedAt: Date.now() })
        }
      })
    }
  },

  deleteBoard: (id) => {
    set((s) => {
      const boardMetas = s.boardMetas.filter((m) => m.id !== id)
      const activeBoardId =
        s.activeBoardId === id ? (boardMetas[0]?.id ?? null) : s.activeBoardId
      return { boardMetas, activeBoardId, activeBoard: s.activeBoard?.id === id ? null : s.activeBoard }
    })
    // Deleting the board file is enough — no index update needed
    deleteBoardFile(id)
    // Load new active board if changed
    const { activeBoardId, activeBoard } = get()
    if (activeBoardId && !activeBoard) {
      get().loadBoardCanvas(activeBoardId)
    }
  },

  importFromJson: async () => {
    const result = await importJsonFile()
    if (!result) return 0

    const now = Date.now()

    if (result.type === 'canvas') {
      // Single canvasJSON — create a new board
      const id = uuidv4()
      const meta: BoardMeta = {
        id, title: result.fileName || '导入的白板', categoryId: null, tags: [],
        thumbnail: '', createdAt: now, updatedAt: now
      }
      const board: Board = { ...meta, canvasJSON: result.data as string }
      set((s) => ({
        boardMetas: [...s.boardMetas, meta],
        activeBoardId: id,
        activeBoard: board
      }))
      saveIndexDebounced(get)
      writeBoardFile(board)
      return 1
    }

    // Workspace format — merge boards and categories
    const workspace = result.data as AppData
    if (!workspace.boards?.length) return 0

    const { categories: existingCats } = get()
    const existingCatNames = new Set(existingCats.map((c) => c.name))

    // Map old category IDs to new ones (or existing ones)
    const catIdMap = new Map<string, string>()
    const newCats: Category[] = []
    for (const cat of workspace.categories ?? []) {
      if (existingCatNames.has(cat.name)) {
        const existing = existingCats.find((c) => c.name === cat.name)!
        catIdMap.set(cat.id, existing.id)
      } else {
        const newId = uuidv4()
        catIdMap.set(cat.id, newId)
        newCats.push({ ...cat, id: newId, createdAt: now })
        existingCatNames.add(cat.name)
      }
    }

    // Create new boards with fresh IDs
    const newMetas: BoardMeta[] = []
    const newBoards: Board[] = []
    for (const b of workspace.boards) {
      const newId = uuidv4()
      const catId = b.categoryId ? (catIdMap.get(b.categoryId) ?? null) : null
      const meta: BoardMeta = {
        id: newId, title: b.title, categoryId: catId, tags: b.tags ?? [],
        thumbnail: b.thumbnail ?? '', createdAt: now, updatedAt: now
      }
      newMetas.push(meta)
      newBoards.push({ ...meta, canvasJSON: b.canvasJSON ?? '' })
    }

    set((s) => ({
      boardMetas: [...s.boardMetas, ...newMetas],
      categories: [...s.categories, ...newCats],
      activeBoardId: newMetas[0].id,
      activeBoard: newBoards[0]
    }))
    saveIndexDebounced(get)
    for (const board of newBoards) {
      writeBoardFile(board)
    }
    return newBoards.length
  },

  createCategory: (name, color = '#6366f1') => {
    const category: Category = { id: uuidv4(), name, color, createdAt: Date.now() }
    set((s) => ({ categories: [...s.categories, category] }))
    saveIndexDebounced(get)
    return category
  },

  updateCategory: (id, patch) => {
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c))
    }))
    saveIndexDebounced(get)
  },

  deleteCategory: (id) => {
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      boardMetas: s.boardMetas.map((m) => (m.categoryId === id ? { ...m, categoryId: null } : m))
    }))
    saveIndexDebounced(get)
  }
}))
