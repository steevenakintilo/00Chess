import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import RulesButton from '../components/Rules'
import { useI18n } from '../i18n'
import Board from '../components/Board'
import { CapturedPieces, ScoreTable } from '../components/GameSummary'
import { MAX_ROUNDS, applyAction, applyDuelResult, finishRound, newGameState, type GameState } from '../utils/engine'
import { playTurnLevel } from '../utils/aiBoard'
import LevelPicker, { useStoredLevel } from '../components/LevelPicker'
import ModePicker, { useStoredGameMode } from '../components/ModePicker'
import { actorsAfterDuel, type GameMode } from '../utils/rounds'
import { newAiMemory, rewardFor, type AiMemory } from '../utils/game007'
import { simulateDuel, type Level } from '../utils/aiLevels'
import { describeAction, openingSimilarity, type MoveRecord, type Similarity } from '../utils/similarity'

// Un round complet entre deux IA : duel 007, puis le gagnant joue, puis fin de round.
type Levels = { blue: Level; red: Level }
type Memories = { blue: AiMemory; red: AiMemory }
const freshMemories = (): Memories => ({ blue: newAiMemory(), red: newAiMemory() })

function playOneRound(
  game: GameState,
  levels: Levels,
  memories: Memories,
  mode: GameMode,
  onMove?: (m: MoveRecord) => void
): GameState {
  const duel = simulateDuel(levels.blue, levels.red, memories)
  const rewards = { p1: rewardFor(duel.state, duel.outcome, 'p1'), p2: rewardFor(duel.state, duel.outcome, 'p2') }
  let g = applyDuelResult(game, rewards, duel.hpLoss, duel.outcome)
  if (!g.result) {
    // selon le mode : le gagnant seul, ou les deux joueurs l'un après l'autre
    actorsAfterDuel(mode, duel.outcome ?? 'draw', g.round).forEach((who, step) => {
      if (g.result) return
      const turn = playTurnLevel(g, who, who === 'p1' ? levels.blue : levels.red)
      // on enregistre chaque action du tour (achats compris) pour mesurer la variété de l'IA
      let replay = g
      turn.actions.forEach(action => {
        onMove?.({ round: g.round, step, ...describeAction(replay, who, action) })
        replay = applyAction(replay, who, action)
      })
      g = turn.state
    })
  }
  if (!g.result) g = finishRound(g)
  return g
}

type Stats = { mode: GameMode; levels: Levels; games: number; p1: number; p2: number; draw: number; reasons: Record<string, number>; avgRounds: number; similarity: Similarity }

export default function IAvsIA() {
  const { t, msg } = useI18n()
  const [maxRounds, setMaxRounds] = useState(MAX_ROUNDS)
  const [simRounds, setSimRounds] = useState(MAX_ROUNDS) // rounds des parties de la simulation
  const [game, setGame] = useState<GameState>(() => newGameState(MAX_ROUNDS))
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(600)
  const [stats, setStats] = useState<Stats | null>(null)
  const [levelBlue, setLevelBlue] = useStoredLevel('aiLevelBlue')
  const [gameMode, setGameMode] = useStoredGameMode()
  const [levelRed, setLevelRed] = useStoredLevel('aiLevelRed')
  const memories = useRef<Memories>(freshMemories()) // l'IA Difficile se souvient des duels précédents de la partie
  const levels: Levels = { blue: levelBlue, red: levelRed }

  useEffect(() => {
    if (!running || game.result) return
    const timer = setTimeout(() => setGame(playOneRound(game, levels, memories.current, gameMode)), delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, game, delay, levelBlue, levelRed, gameMode])

  function runMany(n: number) {
    const s: Stats = { mode: gameMode, levels: { ...levels }, games: n, p1: 0, p2: 0, draw: 0, reasons: {}, avgRounds: 0, similarity: openingSimilarity([], simRounds) }
    const records: MoveRecord[][] = []
    for (let i = 0; i < n; i++) {
      let g = newGameState(simRounds)
      const moves: MoveRecord[] = []
      const mem = freshMemories()
      while (!g.result) g = playOneRound(g, levels, mem, gameMode, m => moves.push(m))
      records.push(moves)
      s[g.result.winner]++
      const reason = g.result.reason.k
      s.reasons[reason] = (s.reasons[reason] ?? 0) + 1
      s.avgRounds += g.round / n
    }
    s.similarity = openingSimilarity(records, simRounds)
    setStats(s)
  }

  const reset = () => {
    setRunning(false)
    memories.current = freshMemories()
    setGame(newGameState(maxRounds))
  }
  const changeLevel = (side: 'blue' | 'red', l: Level) => {
    memories.current = freshMemories()
    if (side === 'blue') setLevelBlue(l)
    else setLevelRed(l)
  }

  const p1 = game.players.p1
  const p2 = game.players.p2

  return (
    <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
      <div className="d-flex gap-2 align-self-start">
        <Link to="/" className="btn-game btn-game--sm text-decoration-none">
          {t('common.menu')}
        </Link>
        <RulesButton />
      </div>
      <h1 className="h4 m-0">{t('ia.title')}</h1>

      <div className="d-flex gap-4 fw-bold">
        <span style={{ color: '#0d6efd' }}>{t('ia.blue', { level: t(`ai.${levelBlue}`), hp: p1.hp, money: p1.money, wins: p1.duelWins })}</span>
        <span style={{ color: '#dc3545' }}>{t('ia.red', { level: t(`ai.${levelRed}`), hp: p2.hp, money: p2.money, wins: p2.duelWins })}</span>
        <span className="text-secondary">{t('hud.round', { n: Math.min(game.round, game.maxRounds), max: game.maxRounds })}</span>
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-center align-items-lg-start justify-content-center gap-4 w-100">
        <div className="w-100" style={{ maxWidth: 600 }}>
          <Board game={game} />
          <CapturedPieces game={game} />
        </div>

        {/* Panneau de lecture à droite du plateau */}
        <div className="d-flex flex-column gap-3" style={{ width: 'min(100%, 320px)' }}>
          <ModePicker value={gameMode} onChange={setGameMode} />
          <LevelPicker label={t('ai.blue')} value={levelBlue} onChange={l => changeLevel('blue', l)} />
          <LevelPicker label={t('ai.red')} value={levelRed} onChange={l => changeLevel('red', l)} />
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button className="btn btn-dark" disabled={!!game.result} onClick={() => setRunning(r => !r)}>
              {running ? t('ia.pause') : t('ia.play')}
            </button>
            <button className="btn btn-outline-dark" disabled={!!game.result || running} onClick={() => setGame(playOneRound(game, levels, memories.current, gameMode))}>
              {t('ia.step')}
            </button>
            <select className="form-select w-auto" value={delay} onChange={e => setDelay(Number(e.target.value))}>
              <option value={1500}>{t('ia.slow')}</option>
              <option value={600}>{t('ia.normal')}</option>
              <option value={150}>{t('ia.fast')}</option>
              <option value={0}>{t('ia.veryFast')}</option>
            </select>
            <label className="d-flex align-items-center gap-2 mb-0">
              {t('ia.roundsGame')}
              <input
                type="number"
                min={1}
                className="form-control"
                style={{ width: 90 }}
                value={maxRounds}
                onChange={e => setMaxRounds(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              />
            </label>
            <button className="btn btn-outline-secondary" onClick={reset}>{t('ia.newGame')}</button>
            <div className="d-flex flex-wrap align-items-center gap-2 border-top pt-3 w-100">
              <label className="d-flex align-items-center gap-2 mb-0">
                {t('ia.roundsSim')}
                <input
                  type="number"
                  min={1}
                  className="form-control"
                  style={{ width: 90 }}
                  value={simRounds}
                  onChange={e => setSimRounds(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                />
              </label>
              <button className="btn btn-outline-secondary" onClick={() => runMany(30)}>
                {t('ia.simulate', { n: 30 })}
              </button>
            </div>
          </div>

          {game.result && (
            <div className="text-center">
              <h5>
                {game.result.winner === 'p1' ? t('ia.blueWins') : game.result.winner === 'p2' ? t('ia.redWins') : t('end.draw')}
              </h5>
              <p>{msg(game.result.reason)}</p>
              <ScoreTable game={game} names={[t('ia.blueName'), t('ia.redName')]} />
            </div>
          )}

          {stats && (
            <div className="small">
              <strong>{t('ia.statsGames', { n: stats.games, blue: t(`ai.${stats.levels.blue}`), red: t(`ai.${stats.levels.red}`) })}</strong>{' '}
              <div>{t('gm.current', { mode: t(`gm.${stats.mode}`) })}</div>
              {t('ia.statsScore', { a: stats.p1, b: stats.p2, c: stats.draw, avg: stats.avgRounds.toFixed(1) })}
              {Object.entries(stats.reasons).map(([r, n]) => (
                <div key={r}>
                  {n} × {t(`stats.reason.${r}`)}
                </div>
              ))}
              <div className="mt-2">
                <strong>{t('ia.openingTitle', { n: stats.similarity.window })}</strong>
                <div>{t('ia.similarType', { pct: stats.similarity.typePct.toFixed(0) })}</div>
                <div>{t('ia.similarExact', { pct: stats.similarity.exactPct.toFixed(0), n: stats.similarity.sampledMoves })}</div>
                {stats.similarity.topMoves.map(tm => (
                  <div key={tm.move} className="text-secondary">
                    {tm.count} × {tm.move}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="small text-secondary">
            {game.log.slice(-12).reverse().map((l, i) => (
              <div key={game.log.length - i}>{msg(l)}</div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
