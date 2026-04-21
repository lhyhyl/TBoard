import { useToolStore } from '../../store/toolStore'
import { useShallow } from 'zustand/react/shallow'

const PRESET_COLORS = [
  '#000000', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#2563eb', '#7c3aed', '#db2777'
]

const WIDTHS = [2, 4, 8, 14]

export function PenOptions() {
  const { 
    activeTool, penOptions, setPenColor, setPenWidth, 
    smoothStroke, setSmoothStroke, 
    calligraphyMode, setCalligraphyMode,
    hwrMode, setHwrMode
  } = useToolStore(
    useShallow((s) => ({
      activeTool: s.activeTool,
      penOptions: s.penOptions,
      setPenColor: s.setPenColor,
      setPenWidth: s.setPenWidth,
      smoothStroke: s.smoothStroke,
      setSmoothStroke: s.setSmoothStroke,
      calligraphyMode: s.calligraphyMode,
      setCalligraphyMode: s.setCalligraphyMode,
      hwrMode: s.hwrMode,
      setHwrMode: s.setHwrMode
    }))
  )

  // ── Eraser mode ───────────────────────────────────────────────────────
  if (activeTool === 'eraser') {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-500 font-medium">
        整段擦除模式：拖动并触碰对象即可将其删除
      </div>
    )
  }

  // ── Lasso mode ───────────────────────────────────────────────────────
  if (activeTool === 'lasso') {
    return (
      <div className="flex items-center gap-1 text-sm text-gray-500 font-medium">
        套选工具：画一个闭合圈，选中被圈中或碰到的内容并可拖动
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

      {/* Smooth stroke & Calligraphy & HWR toggles */}
      <div className="flex border-l border-gray-200 pl-2 gap-1">
        <button
          title={hwrMode ? '智能识别转书法体：开启（点击关闭）' : '智能识别转书法体：关闭（点击开启）'}
          onClick={() => setHwrMode(!hwrMode)}
          className={[
            'flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium transition-colors select-none',
            hwrMode
              ? 'bg-amber-100 text-amber-700'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          ].join(' ')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h8M2 6h8M2 9h5" strokeLinecap="round" />
            <path d="M10 9l-1.5-1.5L10 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          智能识别
        </button>
        <button
          title={smoothStroke ? '基础平滑：开启（点击关闭）' : '基础平滑：关闭（点击开启）'}
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
        {(activeTool === 'pen' || activeTool === 'highlighter') && (
          <button
            title={calligraphyMode ? '笔迹美化(书法模式)：开启（点击关闭）' : '笔迹美化(书法模式)：关闭（点击开启）'}
            onClick={() => setCalligraphyMode(!calligraphyMode)}
            className={[
              'flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium transition-colors select-none',
              calligraphyMode
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            ].join(' ')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2.5 9.5l3-3m0 0l4-4a1.5 1.5 0 012 2l-4 4m-5 1H2v-1.5L8.5 2.5a2.121 2.121 0 013 3L3.5 9.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            美化
          </button>
        )}
      </div>
    </div>
  )
}
