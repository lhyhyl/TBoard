import { useEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  children?: MenuItem[]
  onClick?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

function itemClassName(item: MenuItem) {
  if (item.disabled) return 'text-gray-300 cursor-default'
  if (item.danger) return 'text-red-600 hover:bg-red-50'
  return 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [subMenu, setSubMenu] = useState<{ index: number; rect: DOMRect } | null>(null)

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Clamp position so menu stays within viewport
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > globalThis.innerWidth) el.style.left = `${x - rect.width}px`
    if (rect.bottom > globalThis.innerHeight) el.style.top = `${y - rect.height}px`
  }, [x, y])

  return (
    <div ref={menuRef} className="fixed z-[9999]" style={{ left: x, top: y }}>
      <ul role="menu" className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] text-xs">
        {items.map((item) => (
          <li
            key={item.label}
            role="menuitem"
            tabIndex={-1}
            className={[
              'relative px-3 py-1.5 flex items-center gap-2 cursor-pointer select-none',
              itemClassName(item)
            ].join(' ')}
            onClick={() => {
              if (item.disabled) return
              if (item.children) return
              item.onClick?.()
              onClose()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (item.disabled || item.children) return
                item.onClick?.()
                onClose()
              }
            }}
            onMouseEnter={(e) => {
              if (item.children) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setSubMenu({ index: items.indexOf(item), rect })
              } else {
                setSubMenu(null)
              }
            }}
          >
            {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.children && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 ml-2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            {subMenu?.index === items.indexOf(item) && item.children && (
              <SubMenu
                items={item.children}
                parentRect={subMenu.rect}
                onClose={onClose}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SubMenu({
  items,
  parentRect,
  onClose
}: {
  items: MenuItem[]
  parentRect: DOMRect
  onClose: () => void
}) {
  const ref = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState({ left: parentRect.width, top: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = parentRect.width
    let top = 0
    if (parentRect.right + rect.width > globalThis.innerWidth) {
      left = -rect.width
    }
    if (parentRect.top + rect.height > globalThis.innerHeight) {
      top = -(rect.height - parentRect.height)
    }
    setPos({ left, top })
  }, [parentRect])

  return (
    <ul
      ref={ref}
      role="menu"
      className="absolute bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] text-xs"
      style={{ left: pos.left, top: pos.top }}
    >
      {items.map((item) => (
        <li
          key={item.label}
          role="menuitem"
          tabIndex={-1}
          className={[
            'px-3 py-1.5 flex items-center gap-2 cursor-pointer select-none',
            item.disabled
              ? 'text-gray-300 cursor-default'
              : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
          ].join(' ')}
          onClick={(e) => {
            e.stopPropagation()
            if (item.disabled) return
            item.onClick?.()
            onClose()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              if (item.disabled) return
              item.onClick?.()
              onClose()
            }
          }}
        >
          {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
