import { useEffect, useState } from 'react'
import { GameButton } from './GameButtons'
import { useI18n } from '../i18n'
import { DEFAULT_LEVEL, LEVELS, type Level } from '../utils/aiLevels'
import { warmUpHardAi } from '../utils/ai007'

// Niveau d'IA mémorisé dans le navigateur (une clé par réglage).
export function useStoredLevel(storageKey: string, fallback: Level = DEFAULT_LEVEL): [Level, (l: Level) => void] {
  const [level, setLevel] = useState<Level>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && (LEVELS as string[]).includes(saved)) return saved as Level
    } catch {
      /* stockage indisponible */
    }
    return fallback
  })
  // l'IA Difficile a un (petit) calcul de préparation : on le fait dès qu'elle est choisie, pas au premier coup
  useEffect(() => {
    if (level === 'hard') {
      const id = setTimeout(warmUpHardAi, 50)
      return () => clearTimeout(id)
    }
  }, [level])
  const update = (l: Level) => {
    setLevel(l)
    try {
      localStorage.setItem(storageKey, l)
    } catch {
      /* ignoré */
    }
  }
  return [level, update]
}

// Trois boutons Facile / Normal / Difficile (le niveau choisi est en noir) + une phrase qui décrit le niveau.
export default function LevelPicker({
  value,
  onChange,
  label,
  describe = true,
}: {
  value: Level
  onChange: (l: Level) => void
  label?: string
  describe?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="d-flex flex-column gap-1">
      <span className="small fw-bold">{label ?? t('ai.level')}</span>
      <div className="d-flex flex-wrap gap-2">
        {LEVELS.map(l => (
          <GameButton key={l} small active={value === l} onClick={() => onChange(l)}>
            {t(`ai.${l}`)}
          </GameButton>
        ))}
      </div>
      {describe && <span className="small text-secondary">{t(`ai.${value}.desc`)}</span>}
    </div>
  )
}
