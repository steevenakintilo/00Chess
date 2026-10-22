import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

type BtnProps = { onClick?: () => void; disabled?: boolean; active?: boolean }

export function RoundButton({ onClick, disabled, children }: BtnProps & { children?: ReactNode }) {
  const { t } = useI18n()
  return (
    <button className="btn-round" onClick={onClick} disabled={disabled}>
      <span className="btn-round__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20 3v5h-5" />
        </svg>
      </span>
      {children ?? (
        <>
          {t('btn.newRound')} <span className="btn-round__tag">(007)</span>
        </>
      )}
    </button>
  )
}

// Même style que le bouton de round, avec une flèche.
export function ContinueButton({ onClick, disabled, label }: BtnProps & { label?: string }) {
  const { t } = useI18n()
  return (
    <button className="btn-round" onClick={onClick} disabled={disabled}>
      <span className="btn-round__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </span>
      {label ?? t('btn.continue')}
    </button>
  )
}

export function BuyButton({ price, onClick, disabled, active }: BtnProps & { price?: number }) { // price absent : achat gratuit
  const { t } = useI18n()
  return (
    <button className={`btn-buy${active ? ' btn-buy--active' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="btn-buy__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h2.5l2.2 10.5h10l2-7.5H6.6" />
          <circle cx="9.5" cy="19" r="1.6" fill="#1a1a1a" />
          <circle cx="16.5" cy="19" r="1.6" fill="#1a1a1a" />
        </svg>
      </span>
      {t('btn.buy')} {price !== undefined && <span className="btn-buy__price">{price} $</span>}
    </button>
  )
}

// Bouton de menu : même style que le bouton de round, avec une icône au choix.
export function MenuButton({ onClick, icon, children }: { onClick?: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button className="btn-round" onClick={onClick}>
      <span className="btn-round__icon">{icon}</span>
      {children}
    </button>
  )
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: '#1a1a1a',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const PersonIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-4 3-6 7-6s7 2 7 6" />
  </svg>
)

export const RobotIcon = (
  <svg {...iconProps}>
    <rect x="5" y="8" width="14" height="11" rx="2.5" />
    <path d="M12 8V4" />
    <circle cx="9.5" cy="13" r="0.8" fill="#1a1a1a" />
    <circle cx="14.5" cy="13" r="0.8" fill="#1a1a1a" />
  </svg>
)

// Bouton de jeu simple : même style que les autres, sans icône (coups du 007, abandon...).
export function GameButton({
  onClick,
  disabled,
  active,
  tone,
  small,
  children,
}: BtnProps & { tone?: 'danger' | 'success'; small?: boolean; children: ReactNode }) {
  const cls = ['btn-game', tone ? `btn-game--${tone}` : '', active ? 'btn-game--active' : '', small ? 'btn-game--sm' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

// Ouvre le shop : même style que le bouton d'achat (icône de panier), sans prix.
export function ShopButton({ onClick, disabled }: BtnProps) {
  const { t } = useI18n()
  return (
    <button className="btn-buy" onClick={onClick} disabled={disabled}>
      <span className="btn-buy__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h2.5l2.2 10.5h10l2-7.5H6.6" />
          <circle cx="9.5" cy="19" r="1.6" fill="#1a1a1a" />
          <circle cx="16.5" cy="19" r="1.6" fill="#1a1a1a" />
        </svg>
      </span>
      {t('btn.openShop')}
    </button>
  )
}

export const TargetIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const LearnIcon = (
  <svg {...iconProps}>
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </svg>
)

export const PlayIcon = (
  <svg {...iconProps}>
    <path d="M8 5l11 7-11 7z" />
  </svg>
)

export const HelpIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8" />
    <circle cx="12" cy="17" r="0.8" fill="#1a1a1a" />
  </svg>
)

export const GlobeIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c3 3 3 15 0 18" />
    <path d="M12 3c-3 3-3 15 0 18" />
  </svg>
)
