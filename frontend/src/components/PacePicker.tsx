import { useState } from 'react'
import { GameButton } from './GameButtons'
import { useI18n } from '../i18n'

// Durée d'une partie en ligne : « blitz » (50 rounds) ou « normal » (pas de limite, le premier qui gagne gagne).
export type Pace = 'blitz' | 'normal'
export const PACES: Pace[] = ['blitz', 'normal']

export function useStoredPace(storageKey = 'onlinePace'): [Pace, (p: Pace) => void] {
  const [pace, setPace] = useState<Pace>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && (PACES as string[]).includes(saved)) return saved as Pace
    } catch {
      /* stockage indisponible */
    }
    return 'blitz'
  })
  const update = (p: Pace) => {
    setPace(p)
    try {
      localStorage.setItem(storageKey, p)
    } catch {
      /* ignoré */
    }
  }
  return [pace, update]
}

export default function PacePicker({ value, onChange }: { value: Pace; onChange: (p: Pace) => void }) {
  const { t } = useI18n()
  return (
    <div className="d-flex flex-column gap-1">
      <span className="small fw-bold">{t('pace.title')}</span>
      <div className="d-flex flex-wrap gap-2">
        {PACES.map(p => (
          <GameButton key={p} small active={value === p} onClick={() => onChange(p)}>
            {t(`pace.${p}`)}
          </GameButton>
        ))}
      </div>
      <span className="small text-secondary">{t(`pace.${value}.desc`)}</span>
    </div>
  )
}
