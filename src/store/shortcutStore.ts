import { create } from 'zustand'

export type ShortcutAction =
  | 'tool:select' | 'tool:pen' | 'tool:highlighter' | 'tool:eraser' | 'tool:lasso'
  | 'tool:text' | 'tool:shape' | 'tool:laser' | 'tool:trail'
  | 'action:undo' | 'action:redo' | 'action:delete'
  | 'action:presentation' | 'action:escape'

export type ShortcutMap = Record<ShortcutAction, string>

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  'tool:select': '1',
  'tool:pen': '2',
  'tool:highlighter': '3',
  'tool:eraser': '4',
  'tool:lasso': '5',
  'tool:text': '6',
  'tool:shape': '7',
  'tool:laser': '8',
  'tool:trail': '9',
  'action:undo': 'Ctrl+Z',
  'action:redo': 'Ctrl+Y',
  'action:delete': 'Delete',
  'action:presentation': 'F11',
  'action:escape': 'Escape',
}

export const ACTION_LABELS: Record<ShortcutAction, string> = {
  'tool:select': '选择',
  'tool:pen': '画笔',
  'tool:highlighter': '荧光笔',
  'tool:eraser': '橡皮擦',
  'tool:lasso': '圈选删除',
  'tool:text': '文字',
  'tool:shape': '形状',
  'tool:laser': '激光笔',
  'tool:trail': '轨迹笔',
  'action:undo': '撤销',
  'action:redo': '重做',
  'action:delete': '删除',
  'action:presentation': '演示模式',
  'action:escape': '退出演示',
}

const STORAGE_KEY = 'writeboard-shortcuts'

function loadShortcuts(): ShortcutMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      // Merge with defaults to pick up new actions
      return { ...DEFAULT_SHORTCUTS, ...saved }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SHORTCUTS }
}

function saveShortcuts(map: ShortcutMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

interface ShortcutState {
  shortcuts: ShortcutMap
  setShortcut: (action: ShortcutAction, key: string) => void
  resetShortcuts: () => void
}

export const useShortcutStore = create<ShortcutState>((set) => ({
  shortcuts: loadShortcuts(),
  setShortcut: (action, key) =>
    set((s) => {
      const next = { ...s.shortcuts, [action]: key }
      saveShortcuts(next)
      return { shortcuts: next }
    }),
  resetShortcuts: () => {
    const defaults = { ...DEFAULT_SHORTCUTS }
    saveShortcuts(defaults)
    return set({ shortcuts: defaults })
  },
}))

/** Parse a shortcut descriptor like "Ctrl+Shift+Z" into parts */
export function parseShortcut(desc: string) {
  const parts = desc.split('+')
  const key = parts.pop()!
  const ctrl = parts.some((p) => p.toLowerCase() === 'ctrl')
  const shift = parts.some((p) => p.toLowerCase() === 'shift')
  const alt = parts.some((p) => p.toLowerCase() === 'alt')
  return { key, ctrl, shift, alt }
}

/** Check if a KeyboardEvent matches a shortcut descriptor */
export function matchesShortcut(e: KeyboardEvent, desc: string): boolean {
  const { key, ctrl, shift, alt } = parseShortcut(desc)
  if (ctrl !== (e.ctrlKey || e.metaKey)) return false
  if (shift !== e.shiftKey) return false
  if (alt !== e.altKey) return false
  // Compare key case-insensitively
  return e.key.toLowerCase() === key.toLowerCase()
}

/** Format a KeyboardEvent into a shortcut descriptor string */
export function eventToShortcut(e: KeyboardEvent): string | null {
  // Ignore lone modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  // Normalize key display
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  parts.push(key)
  return parts.join('+')
}

/** Get display label for a shortcut key. E.g. "Ctrl+Z" stays, "1" stays */
export function shortcutLabel(action: ShortcutAction): string {
  const shortcuts = useShortcutStore.getState().shortcuts
  return shortcuts[action] ?? ''
}
