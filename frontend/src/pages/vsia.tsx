import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import RulesButton from '../components/Rules'
import Board from '../components/Board'
import { CapturedPieces, ScoreTable } from '../components/GameSummary'
import Duel007 from '../components/Duel007'
import Modal from '../components/Modal'
import { BuyButton, ContinueButton, GameButton, RoundButton, ShopButton } from '../components/GameButtons'
import { pieceImages } from '../utils/pieces'
import { shopItems } from '../utils/shop'
import LevelPicker, { useStoredLevel } from '../components/LevelPicker'
import ModePicker, { useStoredGameMode } from '../components/ModePicker'
import { actorsAfterDuel, GAME_MODES, hasDuel, type GameMode } from '../utils/rounds'
import { playTurnLevel } from '../utils/aiBoard'
import { newAiMemory, type AiMemory } from '../utils/game007'
import { useGameSounds } from '../utils/useGameSounds'
import { useI18n } from '../i18n'
import {
  applyAction,
  applyDuelResult,
  buyBlockReason,
  canBuy,
  canKamikaze,
  cellName,
  finishRound,
  kingPos,
  maxOf,
  moveDests,
  MAX_ROUNDS,
  newGameState,
  placementCells,
  posKey,
  TSAR_SELF_DAMAGE,
  SNIPE_UNLOCK_ROUND,
  snipeLocked,
  snipesLeftFor,
  snipeTargets,
  swapTargets,
  type Action,
  type GameState,
  type PlayerId,
  type Pos,
  type ShopKey,
} from '../utils/engine'
import type { Outcome } from '../utils/game007'
import type { Msg } from '../utils/msg'

// ROI R / REINE (pas à placer) / SOLDAT S / GENERAL G / CHEF C / RECOLTEUR D'IMPOTS R / TSAR BOMBA (pas à placer)

type Phase = 'setup' | 'duel' | 'action' | 'between' // « setup » : choix de la difficulté et du mode avant le premier 007
type Mode = 'move' | 'snipe' | 'swap'
type Highlight = { kind: 'place' | 'move' | 'capture' | 'snipe' | 'swap'; action: Action }

function formatTime(total: number) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="hud__stat">
      <span className="hud__label">{label}</span>
      <span className="hud__value">{value}</span>
    </span>
  )
}

export default function VsIA() {
  const { t, msg } = useI18n()
  const [maxRounds, setMaxRounds] = useState(MAX_ROUNDS) // choisi avant de commencer
  const [level, setLevel] = useStoredLevel('aiLevel')
  const [gameMode, setGameMode] = useStoredGameMode('gameMode', GAME_MODES)
  const classic = !hasDuel(gameMode) // mode « Classique » : ni 007 ni argent
  const [game, setGame] = useState<GameState>(() => newGameState(MAX_ROUNDS, classic))
  // joueurs qui doivent encore jouer ce round après le joueur (mode « tour par tour » : l'IA peut jouer après toi)
  const [pending, setPending] = useState<PlayerId[]>([])
  // l'IA Difficile se souvient de tes habitudes pendant toute la partie (les autres niveaux repartent de zéro à chaque duel)
  const aiMemory = useRef<AiMemory>(newAiMemory())
  const [phase, setPhase] = useState<Phase>('setup')
  const [selected, setSelected] = useState<Pos | null>(null)
  const [mode, setMode] = useState<Mode>('move')
  const [shopItem, setShopItem] = useState<ShopKey | null>(null)
  const [shopOpen, setShopOpen] = useState(false)
  const [aiLog, setAiLog] = useState<Msg[]>([]) // ce que l'IA vient de faire
  const [elapsed, setElapsed] = useState(0) // secondes écoulées depuis le début de la partie

  // chronomètre : tourne tant que la partie n'est pas finie
  useEffect(() => {
    if (game.result || phase === 'setup') return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [game.result, phase])

  useGameSounds(game)
  const me = game.players.p1
  const foe = game.players.p2
  const myTurn = phase === 'action' && !game.result

  function resetSelection() {
    setSelected(null)
    setMode('move')
    setShopItem(null)
    setShopOpen(false)
  }

  function changeLevel(l: typeof level) {
    aiMemory.current = newAiMemory()
    setLevel(l)
  }

  function newGame() {
    aiMemory.current = newAiMemory()
    setPending([])
    setElapsed(0)
    setGame(newGameState(maxRounds, classic))
    setPhase('setup')
    resetSelection()
  }

  // Le mode ne change pas en cours de partie entre « Classique » (sans argent) et les modes avec 007.
  function changeMode(m: GameMode) {
    const started = phase !== 'setup'
    if (started && !hasDuel(m) !== classic) return
    setGameMode(m)
    if (!started) setGame(newGameState(maxRounds, !hasDuel(m)))
  }

  // Fait jouer l'IA tant que c'est à elle ; s'arrête dès que c'est à toi (et rend ceux qui jouent après toi).
  function advance(g: GameState, actors: PlayerId[]): { state: GameState; waitingForYou: boolean; rest: PlayerId[] } {
    let cur = g
    for (let i = 0; i < actors.length; i++) {
      if (cur.result) break
      if (actors[i] === 'p1') return { state: cur, waitingForYou: true, rest: actors.slice(i + 1) }
      cur = playTurnLevel(cur, 'p2', level).state
    }
    return { state: cur, waitingForYou: false, rest: [] }
  }

  // Début d'un round : un duel 007, sauf en mode « Classique » où les joueurs jouent directement.
  function startRound(g: GameState) {
    if (classic) runActors(g, actorsAfterDuel(gameMode, 'draw', g.round))
    else setPhase('duel')
  }

  // Fin d'un duel 007 : argent, puis ceux qui doivent jouer ce round jouent (l'IA joue toute seule).
  function onDuelFinish(outcome: Outcome, rewards: { p1: number; p2: number }, hpLoss: { p1: number; p2: number }) {
    const g = applyDuelResult(game, rewards, hpLoss, outcome)
    runActors(g, actorsAfterDuel(gameMode, outcome ?? 'draw', g.round))
  }

  // Ceux qui doivent jouer ce round jouent : l'IA joue toute seule, on s'arrête quand c'est à toi.
  function runActors(g: GameState, actors: PlayerId[]) {
    const before = g.log.length
    if (!g.result) {
      const r = advance(g, actors)
      g = r.state
      if (!g.result && r.waitingForYou) {
        setAiLog(g.log.slice(Math.min(before, g.log.length)))
        setGame(g)
        setPending(r.rest)
        setPhase('action')
        setShopOpen(true) // le shop s'ouvre quand on y a accès
        return
      }
    }
    if (!g.result) g = finishRound(g)
    setAiLog(g.log.slice(Math.min(before, g.log.length)))
    setGame(g)
    setPhase('between')
  }

  // Ton action du round. Si l'IA joue après toi (tour par tour), elle joue ; puis revenus des récolteurs et prochain 007.
  function play(action: Action) {
    let g = applyAction(game, 'p1', action)
    const before = g.log.length
    const aiPlaysAfter = pending.length > 0
    if (!g.result && aiPlaysAfter) g = advance(g, pending).state
    if (!g.result) g = finishRound(g)
    setGame(g)
    setPending([])
    if (aiPlaysAfter) {
      setAiLog(g.log.slice(Math.min(before, g.log.length)))
      setPhase('between') // on laisse le temps de lire ce que l'IA vient de jouer
    } else startRound(g)
    resetSelection()
  }

  function buy(item: ShopKey) {
    if (!myTurn || !canBuy(game, 'p1', item)) return
    if (item === 'Duck') {
      if (window.confirm(t('shop.tsarConfirm', { n: TSAR_SELF_DAMAGE }))) {
        play({ kind: 'buy', item })
      }
    } else if (item === 'Berolina' || item === 'Wildebeest') {
      play({ kind: 'buy', item })
    } else {
      setShopItem(item)
        setSelected(null)
      setShopOpen(false) // on ferme pour choisir la case sur le plateau
    }
  }

  // Cases cliquables selon la sélection (achat à placer, ou pièce choisie).
  const highlights = useMemo(() => {
    const map = new Map<string, Highlight>()
    if (!myTurn) return map
    if (shopItem) {
      for (const to of placementCells(game, 'p1', shopItem)) {
        map.set(posKey(to), { kind: game.board[to.r][to.c] ? 'capture' : 'place', action: { kind: 'buy', item: shopItem, to } })
      }
    } else if (selected) {
      const piece = game.board[selected.r][selected.c]
      if (piece && piece.owner === 'p1') {
        if (mode === 'move') {
          for (const d of moveDests(game, selected)) {
            map.set(posKey(d.to), { kind: d.capture ? 'capture' : 'move', action: { kind: 'move', from: selected, to: d.to } })
          }
          if (canKamikaze(game, selected)) {
            map.set(posKey(kingPos(game, 'p2')), { kind: 'capture', action: { kind: 'kamikaze', from: selected } })
          }
        } else if (mode === 'snipe') {
          for (const target of snipeTargets(game, selected)) {
            map.set(posKey(target), { kind: 'snipe', action: { kind: 'snipe', from: selected, target } })
          }
        } else {
          for (const target of swapTargets(game, selected)) {
            map.set(posKey(target), { kind: 'swap', action: { kind: 'swap', from: selected, target } })
          }
        }
      }
    }
    return map
  }, [game, myTurn, shopItem, selected, mode])

  function onCellClick(r: number, c: number) {
    if (!myTurn) return
    const h = highlights.get(posKey({ r, c }))
    if (h) {
      play(h.action)
      return
    }
    const piece = game.board[r][c]
    setShopItem(null)
    if (piece && piece.owner === 'p1' && piece.type !== 'King') {
      setSelected({ r, c })
      setMode('move')
    } else setSelected(null)
  }

  const selectedPiece = selected ? game.board[selected.r][selected.c] : null

  return (
    <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
      <div className="d-flex gap-2 align-self-start">
        <Link to="/" className="btn-game btn-game--sm text-decoration-none">
          {t('common.menu')}
        </Link>
        <RulesButton />
      </div>
      <div className="hud">
        <div className="hud__row">
          <span className="hud__name">{t('hud.you')}</span>
          <Stat label={t('hud.life')} value={me.hp} />
          {!classic && <Stat label={t('hud.dollars')} value={`${me.money} $`} />}
        </div>
        <div className="hud__row hud__row--foe">
          <span className="hud__name">{t('hud.aiLevel', { level: t(`ai.${level}`) })}</span>
          <Stat label={t('hud.life')} value={foe.hp} />
          {!classic && <Stat label={t('hud.dollars')} value={`${foe.money} $`} />}
        </div>
        <div className="hud__foot">
          {!classic && <span>{t('hud.duels', { a: me.duelWins, b: foe.duelWins })}</span>}
          <span>{t('hud.round', { n: Math.min(game.round, game.maxRounds), max: game.maxRounds })}</span>
          <span>{t('hud.time', { time: formatTime(elapsed) })}</span>
        </div>
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-center align-items-lg-start justify-content-center gap-4 w-100 mt-5">
        <div className="w-100" style={{ maxWidth: 600 }}>
          <div className="w-100 d-flex justify-content-center">
            <Board game={game} highlights={highlights} selected={selected} clickable={myTurn} onCellClick={onCellClick} />
          </div>

          <CapturedPieces game={game} />
        </div>

        {/* Panneau de droite : phase en cours, actions, résultat et journal */}
        <div className="d-flex flex-column gap-3 pt-lg-5" style={{ width: 'min(100%, 320px)' }}>
          <ModePicker
            value={gameMode}
            onChange={changeMode}
            modes={GAME_MODES}
            disabledModes={phase === 'setup' ? [] : GAME_MODES.filter(m => !hasDuel(m) !== classic)}
          />
          <LevelPicker value={level} onChange={changeLevel} />

          {/* Fin de partie */}
          {game.result && (
            <div className="text-center">
              <h4>
                {game.result.winner === 'p1' ? t('end.youWon') : game.result.winner === 'p2' ? t('end.aiWon') : t('end.draw')}
              </h4>
              <p>{msg(game.result.reason)}</p>
              <ScoreTable game={game} names={[t('hud.you'), t('hud.ai')]} />
              <button className="btn btn-dark" onClick={newGame}>{t('btn.replay')}</button>
            </div>
          )}

          {!game.result && phase === 'setup' && (
            <div className="text-center d-flex flex-column align-items-center gap-3">
              <label className="d-flex align-items-center gap-2 mb-0 fw-bold">
                {t('setup.rounds')}
                <input
                  type="number"
                  min={1}
                  className="form-control"
                  style={{ width: 90 }}
                  value={maxRounds}
                  onChange={e => {
                    const n = Math.max(1, Math.floor(Number(e.target.value)) || 1)
                    setMaxRounds(n)
                    setGame(newGameState(n, classic)) // la partie n'a pas commencé : on repart d'un état neuf avec la nouvelle limite
                  }}
                />
              </label>
              <ContinueButton label={t('btn.start')} onClick={() => startRound(game)} />
            </div>
          )}

          {/* Phase en cours */}
          {!game.result && phase === 'duel' && (
            <Modal>
              <Duel007
                key={game.round}
                level={level}
                memory={level === 'hard' ? aiMemory.current : undefined}
                onFinish={onDuelFinish}
              />
            </Modal>
          )}

          {!game.result && phase === 'between' && (
            <div className="text-center order-first order-lg-0">
              {aiLog.slice(-6).map((l, i) => (
                <p key={i} className="mb-1">{msg(l)}</p>
              ))}
              <RoundButton onClick={() => startRound(game)} />
            </div>
          )}

          {myTurn && (
            <div className="text-center order-first order-lg-0"> {/* sur mobile : au-dessus des réglages (mode, niveau de l'IA) */}
              <p className="fw-bold mb-2">{t('turn.yourTurn')}</p>
              {selectedPiece && (
                <div className="d-flex justify-content-center gap-2 mb-3">
                  <GameButton active={mode === 'move'} onClick={() => setMode('move')}>
                    {t('mode.move')}
                  </GameButton>
                  {(selectedPiece.type === 'Sergeant' || selectedPiece.type === 'Archbishop') && (
                    <GameButton
                      active={mode === 'snipe'}
                      disabled={snipeLocked(game) || snipesLeftFor(game, selectedPiece) <= 0}
                      onClick={() => setMode('snipe')}
                    >
                      {t('mode.snipe', { n: snipesLeftFor(game, selectedPiece) })}
                      {snipeLocked(game) && t('mode.snipeFrom', { n: SNIPE_UNLOCK_ROUND })}
                    </GameButton>
                  )}
                  {selectedPiece.type === 'Archbishop' && me.swapsLeft > 0 && (
                    <GameButton active={mode === 'swap'} onClick={() => setMode('swap')}>
                      {t('mode.swap', { n: me.swapsLeft })}
                    </GameButton>
                  )}
                </div>
              )}
              {shopItem && <p className="mb-2">{t('turn.pickCell', { piece: `@pl.${shopItem}` })}</p>}
              <div className="d-flex justify-content-center gap-2">
                <ShopButton onClick={() => setShopOpen(true)} />
                <ContinueButton label={t('btn.pass')} onClick={() => play({ kind: 'pass' })} />
              </div>
            </div>
          )}

          {/* Journal */}
          <div className="small text-secondary">
            {game.log.slice(-8).reverse().map((l, i) => (
              <div key={game.log.length - i}>{msg(l)}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Shop (modal, ouvert quand on a accès au shop) */}
      {myTurn && shopOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ background: 'rgba(0,0,0,0.5)', zIndex: 20 }}
          onClick={() => setShopOpen(false)}
        >
          <div
            className="bg-white rounded-4 p-4 w-100"
            style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', border: '2px solid #1a1a1a' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h4 m-0">{t('shop.title')}</h2>
              {!classic && (
                <span className="d-flex align-items-center gap-1 fw-bold fs-4">
                  <span className="small text-secondary">{t('hud.dollars')}</span>
                  {me.money} $
                </span>
              )}
            </div>
        <div className="row row-cols-2 row-cols-md-3 g-3">
          {shopItems.filter(item => !classic || (item.key !== 'Berolina' && item.key !== 'Duck' && item.key !== 'Wildebeest')).map(item => {
            const key = item.key as ShopKey
            const ok = myTurn && canBuy(game, 'p1', key)
            return (
              <div key={item.key} className="col text-center">
                <img
                  src={pieceImages[`Blue_${item.key}`]}
                  alt={t(`piece.${item.key}`)}
                  className="w-100"
                  style={{ maxWidth: 60, opacity: ok || !myTurn ? 1 : 0.4 }}
                />
                <div className="small">{t(`piece.${item.key}`)}</div>
                <div className="small text-secondary">{me.bought[key]}/{maxOf(key)}</div>
                <BuyButton price={classic ? undefined : item.price}active={shopItem === key} disabled={!ok} onClick={() => buy(key)} />
                {!ok && <div className="small text-danger mt-1">{t(buyBlockReason(game, 'p1', key) ?? '')}</div>}
              </div>
            )
          })}
        </div>
            <div className="d-flex justify-content-center mt-4">
              <GameButton onClick={() => setShopOpen(false)}>{t('shop.skip')}</GameButton>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
