import { useToolStore } from '../../store/toolStore'

const PRESET_COLORS = [
  '#1a1a1a', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'
]

const WIDTHS = [2, 4, 8, 14]

export function PenOptions() {
  const { penOptions, setPenColor, setPenWidth } = useToolStore()

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
    </div>
  )
}
