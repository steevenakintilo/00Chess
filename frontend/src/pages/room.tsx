import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import OnlineGame from '../components/OnlineGame'
import { GameButton } from '../components/GameButtons'
import { useI18n } from '../i18n'
import { useRoomSync } from '../online/useRoomSync'

export default function Room() {
  const { t } = useI18n()
  const { code = '' } = useParams()
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const { events, meta, closed, offline, refresh } = useRoomSync(code, ready && !!user)
  const [copied, setCopied] = useState(false)

  // Quitter : salle d'attente ou partie finie => la salle est fermée ; partie en cours => c'est un abandon.
  async function leave() {
    try {
      await api(`/api/rooms/${code}/`, { method: 'DELETE' })
    } catch {
      /* la salle est peut-être déjà fermée */
    }
    navigate('/online')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* presse-papiers indisponible : le code reste affiché */
    }
  }

  const back = (
    <div className="d-flex gap-2 align-self-start">
      <Link to="/online" className="btn-game btn-game--sm text-decoration-none">
        {t('room.back')}
      </Link>
    </div>
  )

  if (ready && !user) {
    return (
      <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
        {back}
        <p>{t('room.loginNeeded')}</p>
        <Link to="/online" className="btn-game text-decoration-none">
          {t('online.title')}
        </Link>
      </div>
    )
  }

  if (closed) {
    return (
      <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
        {back}
        <p>{t('room.closed')}</p>
        <Link to="/online" className="btn-game text-decoration-none">
          {t('room.back')}
        </Link>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
        {back}
        <p className="text-secondary">{t('auth.loading')}</p>
      </div>
    )
  }

  // Partie lancée : on affiche le jeu en ligne.
  if (meta.room.phase !== 'lobby') {
    return (
      <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
        {back}
        <OnlineGame code={code} events={events} meta={meta} offline={offline} refresh={refresh} onLeave={leave} />
      </div>
    )
  }

  // Salle d'attente : l'hôte attend son ami.
  return (
    <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
      {back}
      <div className="d-flex flex-column align-items-center gap-4 w-100" style={{ maxWidth: 420 }}>
        <h1 className="h3 m-0 fw-bold">{t('room.title')}</h1>

        <div className="text-center">
          <p className="mb-1 text-secondary">{t('room.share')}</p>
          <div className="display-4 fw-bold" style={{ letterSpacing: '0.25em' }}>
            {code.toUpperCase()}
          </div>
          <GameButton onClick={copy}>{copied ? t('room.copied') : t('room.copy')}</GameButton>
        </div>

        <div className="hud" style={{ position: 'static', width: '100%' }}>
          <div className="hud__row">
            <span className="hud__name">{t('room.host')}</span>
            <span className="fw-bold fs-5">{meta.room.host.username}</span>
          </div>
        </div>

        <p className="m-0 fw-bold">{t('gm.current', { mode: t(`gm.${meta.room.mode}`) })}</p>
        <div className="alert alert-secondary py-2 m-0 w-100 text-center">{t('room.waiting')}</div>
        {offline && <div className="alert alert-warning py-2 m-0 w-100 text-center">{t('online.offline')}</div>}

        <GameButton tone="danger" onClick={leave}>
          {t('room.leave')}
        </GameButton>
      </div>
    </div>
  )
}
