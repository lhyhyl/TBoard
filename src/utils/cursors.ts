function svgCursor(svg: string, x: number, y: number) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, auto`
}

export const CURSOR_PEN = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <g transform="rotate(-40 4 28)">
      <rect x="0" y="4" width="8" height="18" rx="2" fill="#f1f5f9"/>
      <rect x="4" y="4" width="4" height="18" rx="0" fill="#e2e8f0"/>
      <rect x="0" y="22" width="8" height="3" fill="#1e293b"/>
      <path d="M 1.5 25 L 6.5 25 L 4 28 Z" fill="#1e293b"/>
    </g>
  </svg>`, 4, 28)

export const CURSOR_HIGHLIGHTER = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <g transform="rotate(-40 4 28)">
      <rect x="0" y="4" width="8" height="17" rx="2" fill="#f1f5f9"/>
      <rect x="4" y="4" width="4" height="17" rx="0" fill="#e2e8f0"/>
      <rect x="-0.5" y="21" width="9" height="2" rx="1" fill="#cbd5e1"/>
      <path d="M 1 23 L 7 23 L 7 26 L 3 28 L 1 28 Z" fill="#ecc94b"/>
      <path d="M 4 23 L 7 23 L 7 26 L 4 28 Z" fill="#d69e2e" opacity="0.6"/>
    </g>
  </svg>`, 4, 28)

export const CURSOR_ERASER = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <g transform="rotate(-30 8 24)">
      <rect x="0" y="4" width="16" height="14" rx="2" fill="#f1f5f9"/>
      <rect x="8" y="4" width="8" height="14" rx="0" fill="#e2e8f0"/>
      <rect x="0" y="16" width="16" height="3" fill="#cbd5e1"/>
      <rect x="8" y="16" width="8" height="3" fill="#94a3b8"/>
      <path d="M 0 19 L 16 19 L 14 24 L 2 24 Z" fill="#fca5a5"/>
      <path d="M 8 19 L 16 19 L 14 24 L 8 24 Z" fill="#f87171" opacity="0.5"/>
    </g>
  </svg>`, 8, 24)

export const TOOL_CURSORS: Record<string, string> = {
  pen: CURSOR_PEN,
  highlighter: CURSOR_HIGHLIGHTER,
  eraser: CURSOR_ERASER,
  text: 'text',
  select: 'default',
  shape: 'crosshair',
  trail: 'crosshair',
  laser: 'none',
}
