import React from 'react'

interface WhiteBoardProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  width: number
  height: number
  onDrop?: (e: React.DragEvent) => void
}

/** Pure presentation component — just renders the Fabric.js canvas element. */
export function WhiteBoard({ canvasRef, width, height, onDrop }: WhiteBoardProps) {
  return (
    <div
      className="w-full h-full overflow-hidden bg-transparent"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  )
}
