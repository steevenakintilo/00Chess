import { useI18n } from '../i18n'
import { hasMusic, setMusicOn, useMusicOn } from '../utils/music'

const iconProps = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: '#1a1a1a',
  strokeWidth: 2.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// Bouton « musique activée / coupée », en bas à gauche de toutes les pages (caché s'il n'y a pas de musique).
export default function MusicToggle() {
  const { t } = useI18n()
  const on = useMusicOn()
  if (!hasMusic) return null
  return (
    <button
      className="btn-game btn-game--sm music-toggle"
      onClick={() => setMusicOn(!on)}
      aria-pressed={!on}
      aria-label={t(on ? 'music.mute' : 'music.unmute')}
      title={t(on ? 'music.mute' : 'music.unmute')}
    >
      <svg {...iconProps}>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#1a1a1a" />
        {on ? (
          <>
            <path d="M15.5 9a4.5 4.5 0 0 1 0 6" />
            <path d="M18 6.5a8 8 0 0 1 0 11" />
          </>
        ) : (
          <>
            <path d="M16 9.5l5 5" />
            <path d="M21 9.5l-5 5" />
          </>
        )}
      </svg>
    </button>
  )
}
