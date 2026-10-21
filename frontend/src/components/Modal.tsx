import type { ReactNode } from 'react'

// Fenêtre centrée au-dessus de la page. Sans onClose, on ne peut pas la fermer en cliquant à côté.
export default function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 20 }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4 p-4 w-100"
        style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', border: '2px solid #1a1a1a' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
