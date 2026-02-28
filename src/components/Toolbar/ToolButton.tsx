interface ToolButtonProps {
  children: React.ReactNode
  active?: boolean
  danger?: boolean
  title?: string
  onClick?: () => void
}

export function ToolButton({ children, active, danger, title, onClick }: ToolButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700'
          : danger
            ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      ].join(' ')}
    >
      {children}
    </button>
  )
}
