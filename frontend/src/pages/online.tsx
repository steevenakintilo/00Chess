import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, api, type ApiRoom } from '../api'
import { useAuth } from '../auth/AuthContext'
import RulesButton from '../components/Rules'
import { ContinueButton, GameButton } from '../components/GameButtons'
import { useI18n } from '../i18n'
import ModePicker, { useStoredGameMode } from '../components/ModePicker'
import PacePicker, { useStoredPace } from '../components/PacePicker'

const ERROR_CODES = [
  'invalid_credentials', 'taken', 'invalid', 'password_too_short', 'blank', 'required', 'max_length', 'throttled', 'network',
  'room_not_found', 'own_room', 'room_full',
]

// Message d'erreur traduit à partir du code renvoyé par l'API.
export function useErrorText() {
  const { t } = useI18n()
  return (e: unknown) => {
    const code = e instanceof ApiError ? e.code : 'unknown'
    return t(`err.${ERROR_CODES.includes(code) ? code : 'unknown'}`)
  }
}

function AuthForm() {
  const { t } = useI18n()
  const { login, register } = useAuth()
  const errorText = useErrorText()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await (mode === 'login' ? login : register)(username.trim(), password)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="d-flex flex-column gap-3 w-100" style={{ maxWidth: 360 }}>
      <h2 className="h4 text-center m-0">{mode === 'login' ? t('auth.login') : t('auth.register')}</h2>
      <input
        className="form-control"
        placeholder={t('auth.username')}
        autoComplete="username"
        maxLength={20}
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
      />
      <input
        className="form-control"
        type="password"
        placeholder={t('auth.password')}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      {mode === 'register' && <p className="small text-secondary m-0">{t('auth.hint')}</p>}
      {error && <div className="alert alert-danger py-2 m-0">{error}</div>}
      <div className="d-flex justify-content-center">
        <button className="btn-game" type="submit" disabled={busy}>
          {mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')}
        </button>
      </div>
      <button
        type="button"
        className="btn btn-link btn-sm"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setError('')
        }}
      >
        {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
      </button>
    </form>
  )
}

function Lobby() {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const [code, setCode] = useState('')
  const [gameMode, setGameMode] = useStoredGameMode()
  const [pace, setPace] = useStoredPace()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user) return null

  async function createRoom() {
    setError('')
    setBusy(true)
    try {
      const room = await api<ApiRoom>('/api/rooms/', { method: 'POST', body: { mode: gameMode, pace } })
      navigate(`/online/room/${room.code}`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function joinRoom(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const room = await api<ApiRoom>('/api/rooms/join/', { method: 'POST', body: { code: code.trim() } })
      navigate(`/online/room/${room.code}`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="d-flex flex-column align-items-center gap-4 w-100" style={{ maxWidth: 420 }}>
      <div className="hud" style={{ position: 'static', width: '100%' }}>
        <div className="hud__row">
          <span className="hud__name">{user.username}</span>
          <span className="hud__stat">
            <span className="hud__label">{t('online.trophies')}</span>
            <span className="hud__value">{user.trophies}</span>
          </span>
          <span className="hud__stat">
            <span className="hud__label">{t('online.wins')}</span>
            <span className="hud__value">{user.wins}</span>
          </span>
          <span className="hud__stat">
            <span className="hud__label">{t('online.draws')}</span>
            <span className="hud__value">{user.draws}</span>
          </span>
        </div>
      </div>

      <div className="w-100">
        <ModePicker value={gameMode} onChange={setGameMode} />
      </div>
      <div className="w-100">
        <PacePicker value={pace} onChange={setPace} />
      </div>
      <ContinueButton label={t('online.playFriend')} disabled={busy} onClick={createRoom} />

      <form onSubmit={joinRoom} className="d-flex flex-column gap-2 w-100 align-items-center">
        <p className="m-0 fw-bold">{t('online.joinTitle')}</p>
        <div className="d-flex gap-2">
          <input
            className="form-control text-center text-uppercase fw-bold"
            style={{ width: 150, letterSpacing: '0.2em' }}
            placeholder={t('online.codePlaceholder')}
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value)}
            required
          />
          <button className="btn-game" type="submit" disabled={busy || code.trim().length < 6}>
            {t('online.join')}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger py-2 m-0 w-100">{error}</div>}

      <GameButton onClick={logout}>{t('auth.logout')}</GameButton>
    </div>
  )
}

export default function Online() {
  const { t } = useI18n()
  const { user, ready } = useAuth()
  return (
    <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
      <div className="d-flex gap-2 align-self-start">
        <Link to="/" className="btn-game btn-game--sm text-decoration-none">
          {t('common.menu')}
        </Link>
        <RulesButton />
      </div>
      <h1 className="h3 m-0 fw-bold">{t('online.title')}</h1>
      {!ready ? <p className="text-secondary">{t('auth.loading')}</p> : user ? <Lobby /> : <AuthForm />}
    </div>
  )
}
