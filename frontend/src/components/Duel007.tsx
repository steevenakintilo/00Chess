import { useRef, useState } from 'react'
import { ContinueButton, GameButton } from './GameButtons'
import { useI18n } from '../i18n'
import { aiPlay, type Level } from '../utils/aiLevels'
import type { Msg } from '../utils/msg'
import {
  SHIELD_LIMIT,
  PTS,
  WIN_REWARDS,
  getOutcome,
  newAiMemory,
  type AiMemory,
  newGame,
  playRound,
  playerMoves,
  rewardFor,
  type Move,
  type Outcome,
} from '../utils/game007'

type Props = {
  // appelé quand le duel est terminé et que le joueur clique sur "Continuer"
  // hpLoss = PV de roi perdus à cause du spam de bouclier pendant ce duel
  onFinish: (outcome: Outcome, rewards: { p1: number; p2: number }, hpLoss: { p1: number; p2: number }) => void
  // mode entraînement : pas d'argent, pas de PV de roi, pas de boutons d'abandon
  training?: boolean
  // niveau de l'IA adverse (Normal par défaut)
  level?: Level
  // mémoire de l'IA qui dure toute la partie (utile à l'IA Difficile pour apprendre tes habitudes d'un duel à l'autre)
  memory?: AiMemory
}

type LogLine = { move?: Move; ia?: Move; msg?: Msg | null; text?: string }

export default function Duel007({ onFinish, training = false, level = 'normal', memory: sharedMemory }: Props) {
  const { t, msg } = useI18n()
  const [game, setGame] = useState(newGame)
  const [log, setLog] = useState<LogLine | null>(null)
  const [lastDraw, setLastDraw] = useState(false)
  const memory = useRef(sharedMemory ?? newAiMemory())
  const lastPlayerMove = useRef<Move | null>(null)

  const outcome: Outcome = lastDraw ? 'draw' : getOutcome(game)
  const money = rewardFor(game, outcome, 'p1')

  function play(move: Move) {
    if (outcome) return
    const iaMove = aiPlay(game, memory.current, lastPlayerMove.current, level)
    lastPlayerMove.current = move
    const r = playRound(game, move, iaMove)
    setGame(r.state)
    setLastDraw(r.draw)
    setLog({ move, ia: iaMove, msg: r.message })
  }

  // Boutons de test : fait gagner/perdre le duel directement (score 3-0).
  function forfeit(winner: 'p1' | 'p2') {
    setLastDraw(false)
    setGame(g => ({ ...g, s1: winner === 'p1' ? PTS.swap : 0, s2: winner === 'p2' ? PTS.swap : 0 }))
    setLog({ text: winner === 'p1' ? t('duel.foeForfeits') : t('duel.youForfeit') })
  }

  const resultText = {
    p1: t('duel.won'),
    p2: t('duel.lost'),
    draw: lastDraw ? (training ? t('duel.spamDrawTraining') : t('duel.spamDraw')) : t('duel.tie'),
  }

  const gain = (n: number) => (training ? '' : ` (${WIN_REWARDS[n]} $)`)

  return (
    <div className="container text-center" style={{ maxWidth: 600 }}>
      <h4>007</h4>
      <p className="small text-secondary">
        {t('duel.intro', {
          shot: PTS.shot,
          big: PTS.big,
          swap: PTS.swap,
          bonus: PTS.bonus,
          gShot: gain(PTS.shot),
          gBig: gain(PTS.big),
          gSwap: gain(PTS.swap),
          gBonus: gain(PTS.bonus),
        })}
      </p>
      <div className="row mb-3">
        <div className="col" style={{ color: '#0d6efd' }}>
          <div className="fw-bold">{t('duel.you')}</div>
          <div>{t('duel.points', { n: game.s1 })}</div>
          <div>{t('duel.charges', { n: game.c1 })}</div>
        </div>
        <div className="col" style={{ color: '#dc3545' }}>
          <div className="fw-bold">{t('duel.foe')}</div>
          <div>{t('duel.points', { n: game.s2 })}</div>
          <div>{t('duel.charges', { n: game.c2 })}</div>
        </div>
      </div>

      {outcome === null && game.k1 === SHIELD_LIMIT - 1 && (
        <div className="alert alert-warning py-2">{t('duel.warnMe', { n: game.k1 })}</div>
      )}
      {outcome === null && game.k2 === SHIELD_LIMIT - 1 && (
        <div className="alert alert-info py-2">{t('duel.warnFoe', { n: game.k2 })}</div>
      )}

      {outcome === null ? (
        <div className="d-flex flex-wrap justify-content-center gap-2">
          {playerMoves(game).map(move => (
            <GameButton key={move} onClick={() => play(move)}>
              {t(`move.${move}`)}
            </GameButton>
          ))}
        </div>
      ) : (
        <div>
          <p className="fw-bold fs-5">{resultText[outcome]}</p>
          {!training && <p>{t('duel.moneyWon', { n: money })}</p>}
          {!training && (game.pen1 > 0 || game.pen2 > 0) && (
            <p>{t('duel.spamHp', { a: game.pen1, b: game.pen2 })}</p>
          )}
          <ContinueButton
            label={training ? t('duel.newDuel') : undefined}
            onClick={() =>
              onFinish(outcome, { p1: money, p2: rewardFor(game, outcome, 'p2') }, { p1: game.pen1, p2: game.pen2 })
            }
          />
        </div>
      )}

      {outcome === null && !training && (
        <div className="d-flex justify-content-center gap-2 mt-3">
          <GameButton tone="danger" onClick={() => forfeit('p2')}>
            {t('duel.forfeit')}
          </GameButton>
          <GameButton tone="success" onClick={() => forfeit('p1')}>
            {t('duel.foeForfeit')}
          </GameButton>
        </div>
      )}

      {log && (
        <p className="mt-3 small text-secondary">
          {log.text ??
            t('duel.log', {
              you: `@move.${log.move}`,
              foe: `@move.${log.ia}`,
              msg: msg(log.msg),
            })}
        </p>
      )}
    </div>
  )
}
