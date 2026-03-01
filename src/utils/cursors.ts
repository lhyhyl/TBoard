function svgCursor(svg: string, x: number, y: number) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, auto`
}

export const CURSOR_PEN = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <path d="M2 20 L4 22 L15 9 L13 7 Z" fill="#1a1a1a" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M2 20 L4 22 L2 22 Z" fill="#888"/>
    <path d="M13 7 L15 9 L18 4 L16 2 Z" fill="#ccc" stroke="white" stroke-width="0.8" stroke-linejoin="round"/>
  </svg>`, 2, 20)

export const CURSOR_HIGHLIGHTER = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <path d="M3 18 L7 21 L17 8 L13 5 Z" fill="#fde047" stroke="#555" stroke-width="1" stroke-linejoin="round"/>
    <path d="M3 18 L5 23 L7 21 Z" fill="#555"/>
    <path d="M13 5 L17 8 L19 4 L15 2 Z" fill="#d4d4d4" stroke="#777" stroke-width="0.8" stroke-linejoin="round"/>
  </svg>`, 3, 22)

export const CURSOR_ERASER = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="22">
    <rect x="1" y="1" width="22" height="16" rx="2" fill="white" stroke="#999" stroke-width="1.5"/>
    <rect x="1" y="1" width="9" height="16" rx="2" fill="#fca5a5" stroke="#999" stroke-width="1.5"/>
    <rect x="5" y="18" width="14" height="3" rx="1" fill="#ccc"/>
  </svg>`, 11, 16)

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
