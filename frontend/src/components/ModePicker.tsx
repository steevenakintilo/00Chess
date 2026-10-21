import { useState } from 'react'
import { GameButton } from './GameButtons'
import { useI18n } from '../i18n'
import { DEFAULT_GAME_MODE, GAME_MODES, type GameMode } from '../utils/rounds'

// Mode de jeu mémorisé dans le navigateur.
export function useStoredGameMode(storageKey = 'gameMode'): [GameMode, (m: GameMode) => void] {
  const [mode, setMode] = useState<GameMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && (GAME_MODES as string[]).includes(saved)) return saved as GameMode
    } catch {
      /* stockage indisponible */
    }
    return DEFAULT_GAME_MODE
  })
  const update = (m: GameMode) => {
    setMode(m)
    try {
      localStorage.setItem(storageKey, m)
    } catch {
      /* ignoré */
    }
  }
  return [mode, update]
}

// Deux boutons « Le gagnant joue » / « Tour par tour » + une phrase qui décrit le mode choisi.
export default function ModePicker({
  value,
  onChange,
  disabled,
}: {
  value: GameMode
  onChange: (m: GameMode) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="d-flex flex-column gap-1">
      <span className="small fw-bold">{t('gm.title')}</span>
      <div className="d-flex flex-wrap gap-2">
        {GAME_MODES.map(m => (
          <GameButton key={m} small active={value === m} disabled={disabled} onClick={() => onChange(m)}>
            {t(`gm.${m}`)}
          </GameButton>
        ))}
      </div>
      <span className="small text-secondary">{t(`gm.${value}.desc`)}</span>
    </div>
  )
}
