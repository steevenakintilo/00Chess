import { useState } from 'react'
import { GameButton } from './GameButtons'
import { useI18n } from '../i18n'
import { DEFAULT_GAME_MODE, DUEL_MODES, type GameMode } from '../utils/rounds'

// Mode de jeu mémorisé dans le navigateur. `modes` : les modes que la page sait jouer (un mode mémorisé ailleurs est ignoré).
export function useStoredGameMode(storageKey = 'gameMode', modes: GameMode[] = DUEL_MODES): [GameMode, (m: GameMode) => void] {
  const [mode, setMode] = useState<GameMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && (modes as string[]).includes(saved)) return saved as GameMode
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

// Un bouton par mode (« Le gagnant joue », « Tour par tour », …) + une phrase qui décrit le mode choisi.
export default function ModePicker({
  value,
  onChange,
  disabled,
  modes = DUEL_MODES,
  disabledModes = [],
}: {
  value: GameMode
  onChange: (m: GameMode) => void
  disabled?: boolean
  modes?: GameMode[]
  disabledModes?: GameMode[]
}) {
  const { t } = useI18n()
  return (
    <div className="d-flex flex-column gap-1">
      <span className="small fw-bold">{t('gm.title')}</span>
      <div className="d-flex flex-wrap gap-2">
        {modes.map(m => (
          <GameButton key={m} small active={value === m} disabled={disabled || disabledModes.includes(m)} onClick={() => onChange(m)}>
            {t(`gm.${m}`)}
          </GameButton>
        ))}
      </div>
      <span className="small text-secondary">{t(`gm.${value}.desc`)}</span>
    </div>
  )
}
