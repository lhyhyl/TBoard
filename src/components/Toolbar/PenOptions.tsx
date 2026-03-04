import { useToolStore } from '../../store/toolStore'
import { useShallow } from 'zustand/react/shallow'

const PRESET_COLORS = [
  '#000000', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#2563eb', '#7c3aed', '#db2777'
]

const WIDTHS = [2, 4, 8, 14]
const ERASER_SIZES = [10, 20, 40, 80]

export function PenOptions() {
  const { activeTool, penOptions, setPenColor, setPenWidth, smoothStroke, setSmoothStroke, eraserWidth, setEraserWidth } = useToolStore(
    useShallow((s) => ({
      activeTool: s.activeTool,
      penOptions: s.penOptions,
      setPenColor: s.setPenColor,
      setPenWidth: s.setPenWidth,
      smoothStroke: s.smoothStroke,
      setSmoothStroke: s.setSmoothStroke,
      eraserWidth: s.eraserWidth,
      setEraserWidth: s.setEraserWidth
    }))
  )

  // ── Eraser mode ───────────────────────────────────────────────────────
  if (activeTool === 'eraser') {
    return (
      <div className="flex items-center gap-1">
        {ERASER_SIZES.map((s) => (
          <button
            key={s}
            title={`橡皮大小 ${s}px`}
            onClick={() => setEraserWidth(s)}
            className={[
              'flex items-center justify-center w-8 h-7 rounded-md transition-colors',
              eraserWidth === s ? 'bg-indigo-100' : 'hover:bg-gray-100'
            ].join(' ')}
          >
            <div
              className="rounded-full bg-gray-400 border border-gray-300"
              style={{ width: Math.min(s * 0.5, 26), height: Math.min(s * 0.5, 26) }}
            />
          </button>
        ))}
        {/* Custom size slider */}
        <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
          <span className="text-xs text-gray-400 w-6 text-right">{eraserWidth}</span>
          <input
            type="range"
            min={4}
            max={200}
            value={eraserWidth}
            onChange={(e) => setEraserWidth(Number(e.target.value))}
            className="w-20 accent-indigo-500"
            title="自定义橡皮大小"
          />
        </div>
      </div>
    )
  }

  // ── Pen / Highlighter / Shape mode ────────────────────────────────────
  return (
    <div className="flex items-center gap-2">
      {/* Color swatches */}
      <div className="flex gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setPenColor(c)}
            className={[
              'w-5 h-5 rounded-full border-2 transition-transform',
              penOptions.color === c
                ? 'border-indigo-500 scale-110'
                : 'border-transparent hover:scale-105'
            ].join(' ')}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Custom color input */}
        <input
          type="color"
          value={penOptions.color}
          onChange={(e) => setPenColor(e.target.value)}
          className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent"
          title="自定义颜色"
        />
      </div>

      {/* Width presets */}
      <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
        {WIDTHS.map((w) => (
          <button
            key={w}
            title={`粗细 ${w}px`}
            onClick={() => setPenWidth(w)}
            className={[
              'flex items-center justify-center w-7 h-7 rounded-md transition-colors',
              penOptions.width === w ? 'bg-indigo-100' : 'hover:bg-gray-100'
            ].join(' ')}
          >
            <div
              className="rounded-full bg-gray-700"
              style={{ width: Math.min(w * 2, 20), height: Math.min(w * 2, 20) }}
            />
          </button>
        ))}
      </div>

      {/* Smooth stroke toggle */}
      <div className="border-l border-gray-200 pl-2">
        <button
          title={smoothStroke ? '笔画平滑：开启（点击关闭）' : '笔画平滑：关闭（点击开启）'}
          onClick={() => setSmoothStroke(!smoothStroke)}
          className={[
            'flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium transition-colors select-none',
            smoothStroke
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          ].join(' ')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 9 C3 9 3 3 6 3 C9 3 9 9 11 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
          平滑
        </button>
      </div>
    </div>
  )
}
