import { ReactNode } from 'react'
import './BottomSheet.css'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({ isOpen, onClose, children }: BottomSheetProps) {
  if (!isOpen) return null

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div 
        className={`bottom-sheet-content ${isOpen ? 'open' : ''}`}
        onClick={e => e.stopPropagation()} // 阻止冒泡，避免点击内容关闭
      >
        <div className="bottom-sheet-handle-wrap" onClick={onClose}>
          <div className="bottom-sheet-handle" />
        </div>
        <div className="bottom-sheet-body">
          {children}
        </div>
      </div>
    </div>
  )
}
