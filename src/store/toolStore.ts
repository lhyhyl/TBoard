import { create } from 'zustand'
import type { ToolType, ShapeType, PenOptions } from '../types'

interface ToolState {
  activeTool: ToolType
  activeShape: ShapeType
  penOptions: PenOptions
  presentationMode: boolean
  smoothStroke: boolean
  eraserWidth: number
  setTool: (tool: ToolType) => void
  setShape: (shape: ShapeType) => void
  setPenColor: (color: string) => void
  setPenWidth: (width: number) => void
  togglePresentation: () => void
  setSmoothStroke: (v: boolean) => void
  setEraserWidth: (w: number) => void
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'pen',
  activeShape: 'rect',
  penOptions: { color: '#000000', width: 3 },
  presentationMode: false,
  smoothStroke: true,
  eraserWidth: 20,
  setTool: (tool) => set({ activeTool: tool }),
  setShape: (shape) => set({ activeShape: shape }),
  setPenColor: (color) => set((s) => ({ penOptions: { ...s.penOptions, color } })),
  setPenWidth: (width) => set((s) => ({ penOptions: { ...s.penOptions, width } })),
  togglePresentation: () => set((s) => ({ presentationMode: !s.presentationMode })),
  setSmoothStroke: (v) => set({ smoothStroke: v }),
  setEraserWidth: (w) => set({ eraserWidth: w })
}))
