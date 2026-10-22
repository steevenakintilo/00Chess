import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type SiteStats } from '../api'
import Board from '../components/Board'
import {
  GameButton,
  MenuButton,
  PersonIcon,
  GlobeIcon,
  HelpIcon,
  InfoIcon,
  LearnIcon,
  PlayIcon,
  StatsIcon,
  RobotIcon,
  TargetIcon,
} from '../components/GameButtons'
import Modal from '../components/Modal'
import RulesButton from '../components/Rules'
import { newGameState } from '../utils/engine'
import { useI18n } from '../i18n'

const startBoard = newGameState()

// Menu en deux niveaux : « Jouer » (les modes de jeu) et « Comment jouer » (règles, bases, entraînement 007).
type View = 'main' | 'play' | 'howTo'

export default function Home() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [view, setView] = useState<View>('main')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [stats, setStats] = useState<SiteStats | null>(null)
  const [statsFailed, setStatsFailed] = useState(false)

  // Les chiffres sont rechargés à chaque ouverture de la fenêtre.
  useEffect(() => {
    if (!statsOpen) return
    setStatsFailed(false)
    api<SiteStats>('/api/stats/')
      .then(setStats)
      .catch(() => setStatsFailed(true))
  }, [statsOpen])
  return (
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-3 gap-4">
      <h1 className="m-0 fw-bold">00Chess</h1>
      <Board game={startBoard} />
      <div className="d-flex flex-wrap justify-content-center gap-3">
        {view === 'main' && (
          <>
            <MenuButton icon={PlayIcon} onClick={() => setView('play')}>
              {t('menu.play')}
            </MenuButton>
            <MenuButton icon={HelpIcon} onClick={() => setView('howTo')}>
              {t('menu.howTo')}
            </MenuButton>
            <MenuButton icon={StatsIcon} onClick={() => setStatsOpen(true)}>
              {t('menu.stats')}
            </MenuButton>
            <MenuButton icon={InfoIcon} onClick={() => setAboutOpen(true)}>
              {t('menu.about')}
            </MenuButton>
          </>
        )}
        {view === 'play' && (
          <>
            <MenuButton icon={PersonIcon} onClick={() => navigate('/vs-ia')}>
              {t('menu.vsIa')}
            </MenuButton>
            <MenuButton icon={RobotIcon} onClick={() => navigate('/ia-vs-ia')}>
              {t('menu.iaVsIa')}
            </MenuButton>
            <MenuButton icon={GlobeIcon} onClick={() => navigate('/online')}>
              {t('menu.online')}
            </MenuButton>
          </>
        )}
        {view === 'howTo' && (
          <>
            <RulesButton variant="menu" />
            <MenuButton icon={LearnIcon} onClick={() => navigate('/entrainement')}>
              {t('menu.learn')}
            </MenuButton>
            <MenuButton icon={TargetIcon} onClick={() => navigate('/007')}>
              {t('menu.train007')}
            </MenuButton>
          </>
        )}
      </div>
      {view !== 'main' && <GameButton onClick={() => setView('main')}>{t('menu.back')}</GameButton>}
      {statsOpen && (
        <Modal onClose={() => setStatsOpen(false)}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h4 m-0">{t('stats.title')}</h2>
            <button className="btn-game btn-game--sm" onClick={() => setStatsOpen(false)}>
              {t('common.close')}
            </button>
          </div>
          {statsFailed ? (
            <p className="mb-0">{t('stats.error')}</p>
          ) : stats ? (
            <ul className="list-unstyled mb-0 fs-5">
              <li>
                {t('stats.games')} : <strong>{stats.games_played}</strong>
              </li>
              <li>
                {t('stats.players')} : <strong>{stats.players}</strong>
              </li>
            </ul>
          ) : (
            <p className="mb-0">{t('stats.loading')}</p>
          )}
        </Modal>
      )}
      {aboutOpen && (
        <Modal onClose={() => setAboutOpen(false)}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h4 m-0">{t('about.title')}</h2>
            <button className="btn-game btn-game--sm" onClick={() => setAboutOpen(false)}>
              {t('common.close')}
            </button>
          </div>
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <p>
            {t('about.p3')}{' '}
            <a href="https://www.youtube.com/watch?v=qC3SO1s5L6Q" target="_blank" rel="noopener noreferrer">
              {t('about.video')}
            </a>
          </p>
          <p>
            {t('about.p4')}{' '}
            <a href="https://excalidraw.com/#json=Bup4OTnqOOlCvsJeMUYE9,BpO7alld1ab2rJGGzVPY3A" target="_blank" rel="noopener noreferrer">
              {t('about.draw')}
            </a>
          </p>
          <p>
            {t('about.discord')}{' '}
            <a href="https://discord.gg/sPMScFXuD" target="_blank" rel="noopener noreferrer">
              {t('about.discordLink')}
            </a>
          </p>
          <p className="fw-bold mb-1">{t('about.credits')}</p>
          <ul className="mb-0">
            <li>
              {t('about.logos')}{' '}
              <a href="https://chess-variants.fandom.com/wiki/Category:Pieces" target="_blank" rel="noopener noreferrer">
                {t('about.logosLink')}
              </a>
              .
            </li>
            <li>
              {t('about.music')}{' '}
              <a href="https://freesound.org/" target="_blank" rel="noopener noreferrer">
                Freesound
              </a>
              .
            </li>
          </ul>
        </Modal>
      )}
    </div>
  )
}
