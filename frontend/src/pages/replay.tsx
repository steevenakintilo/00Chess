import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api, type ApiReplay } from '../api'
import Board from '../components/Board'
import { GameButton } from '../components/GameButtons'
import { CapturedPieces, ScoreTable } from '../components/GameSummary'
import { useI18n } from '../i18n'
import { replay, winnerOf, type NetEvent } from '../online/replay'
import { UNLIMITED_ROUNDS } from '../utils/engine'

// Les étapes d'un replay : début, fin de chaque duel 007, chaque action, fin de partie.
// Le détail des coups du 007 n'est pas montré (seulement son résultat) : il ne sert qu'à rejouer les règles.
const STEP_KINDS = new Set(['start', 'duel_end', 'action', 'game_over', 'forfeit'])
const NO_HIGHLIGHTS = new Map()

export default function Replay() {
  const { t, msg, setNames } = useI18n()
  const { code = '' } = useParams()
  const [data, setData] = useState<ApiReplay | null>(null)
  const [missing, setMissing] = useState(false)
  const [offline, setOffline] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    let stop = false
    setData(null)
    setMissing(false)
    setOffline(false)
    api<ApiReplay>(`/api/replays/${code.toUpperCase()}/`)
      .then(res => {
        if (stop) return
        setData(res)
        setStep(0)
      })
      .catch(e => {
        if (stop) return
        if (e instanceof ApiError && e.status === 404) setMissing(true)
        else setOffline(true)
      })
    return () => {
      stop = true
    }
  }, [code])

  const events: NetEvent[] = data?.events ?? []
  const steps = useMemo(() => events.flatMap((e, i) => (STEP_KINDS.has(e.kind) ? [i] : [])), [events])
  const last = steps.length - 1
  const current = Math.min(step, Math.max(last, 0))

  const g = useMemo(() => replay(events.slice(0, (steps[current] ?? -1) + 1)), [events, steps, current])
  const before = useMemo(() => (current > 0 ? replay(events.slice(0, steps[current - 1] + 1)) : null), [events, steps, current])

  // Les messages affichent les pseudos à la place de « Toi » / « IA ».
  const host = data?.host ?? ''
  const guest = data?.guest ?? ''
  useEffect(() => {
    if (data) setNames({ p1: host, p2: guest })
    return () => setNames(null)
  }, [data, host, guest, setNames])

  // Navigation au clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, last))
      else if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last])

  const back = (
    <div className="d-flex gap-2 align-self-start">
      <Link to="/online" className="btn-game btn-game--sm text-decoration-none">
        {t('replay.back')}
      </Link>
    </div>
  )

  if (missing || offline || !data) {
    return (
      <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
        {back}
        {missing ? (
          <p>{t('err.replay_not_found')}</p>
        ) : offline ? (
          <p>{t('err.network')}</p>
        ) : (
          <p className="text-secondary">{t('auth.loading')}</p>
        )}
      </div>
    )
  }

  const game = g.eng
  const event = events[steps[current]]
  const winnerName = (v: unknown) => (v === 'host' ? host : guest)

  // Ce qui vient de se passer à cette étape.
  const lines: string[] = []
  if (event.kind === 'start') lines.push(t('replay.start'))
  else if (event.kind === 'duel_end') {
    const p = event.payload as { round: number; outcome: string }
    lines.push(p.outcome === 'draw' ? t('replay.duelDraw', { n: p.round }) : t('replay.duelWon', { n: p.round, who: winnerName(p.outcome) }))
  }
  for (const l of game.log.slice(before?.eng.log.length ?? 0)) lines.push(msg(l))

  const atEnd = current === last
  const winner = atEnd ? winnerOf(g) : null
  const fmt = (n: number) => `${n > 0 ? '+' : ''}${n}`

  return (
    <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
      {back}
      <h1 className="h4 m-0 fw-bold">{t('online.vs', { a: host, b: guest })}</h1>
      <p className="small text-secondary m-0">
        {t('replay.title')} {data.code}
      </p>

      <div className="hud" style={{ position: 'static', width: 'min(100%, 420px)' }}>
        {(['p1', 'p2'] as const).map((id, i) => (
          <div key={id} className={`hud__row${i === 1 ? ' hud__row--foe' : ''}`}>
            <span className="hud__name">{id === 'p1' ? host : guest}</span>
            <span className="hud__stat">
              <span className="hud__label">{t('hud.life')}</span>
              <span className="hud__value">{game.players[id].hp}</span>
            </span>
            <span className="hud__stat">
              <span className="hud__label">{t('hud.dollars')}</span>
              <span className="hud__value">{game.players[id].money} $</span>
            </span>
          </div>
        ))}
        <div className="hud__foot">
          <span>{t('hud.round', { n: Math.min(game.round, game.maxRounds), max: game.maxRounds >= UNLIMITED_ROUNDS ? '∞' : game.maxRounds })}</span>
          <span>{t('gm.current', { mode: t(`gm.${g.mode}`) })}</span>
        </div>
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-center align-items-lg-start justify-content-center gap-4 w-100">
        <div className="w-100" style={{ maxWidth: 600 }}>
          <div className="w-100 d-flex justify-content-center">
            <Board game={game} highlights={NO_HIGHLIGHTS} selected={null} clickable={false} />
          </div>
          <CapturedPieces game={game} />
        </div>

        <div className="d-flex flex-column gap-3" style={{ width: 'min(100%, 320px)' }}>
          <div className="d-flex justify-content-center gap-2">
            <GameButton small disabled={current === 0} onClick={() => setStep(0)}>
              ⏮
            </GameButton>
            <GameButton small disabled={current === 0} onClick={() => setStep(current - 1)}>
              ◀
            </GameButton>
            <GameButton small disabled={atEnd} onClick={() => setStep(current + 1)}>
              ▶
            </GameButton>
            <GameButton small disabled={atEnd} onClick={() => setStep(last)}>
              ⏭
            </GameButton>
          </div>
          <input
            type="range"
            className="form-range"
            min={0}
            max={Math.max(last, 0)}
            value={current}
            onChange={e => setStep(Number(e.target.value))}
          />
          <p className="small text-secondary text-center m-0">{t('replay.step', { i: current + 1, n: steps.length })}</p>

          <div className="text-center">
            {lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>

          {atEnd && (
            <div className="text-center">
              {winner && winner !== 'draw' && <h4>{t('replay.winner', { who: winnerName(winner) })}</h4>}
              {winner === 'draw' && <h4>{t('end.draw')}</h4>}
              {g.over?.kind === 'forfeit' && <p>{t('replay.left', { who: winnerName(g.over.side) })}</p>}
              <p className="fw-bold">
                {t('replay.trophies', { a: host, x: fmt(data.trophies.host), b: guest, y: fmt(data.trophies.guest) })}
              </p>
              {game.result && <ScoreTable game={game} names={[host, guest]} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
