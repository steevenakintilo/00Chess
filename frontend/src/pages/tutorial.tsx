import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Board from '../components/Board'
import RulesButton from '../components/Rules'
import { GameButton } from '../components/GameButtons'
import { CapturedPieces } from '../components/GameSummary'
import { pieceImages } from '../utils/pieces'
import {
  SNIPE_UNLOCK_ROUND,
  SHOP_KEYS,
  applyAction,
  buyBlockReason,
  canKamikaze,
  cellName,
  kingPos,
  other,
  moveDests,
  newGameState,
  placementCells,
  posKey,
  snipeTargets,
  snipesLeftFor,
  swapTargets,
  type Action,
  type GameState,
  type Piece,
  type PieceType,
  type PlayerId,
  type Pos,
  type ShopKey,
} from '../utils/engine'
import type { HighlightKind } from '../components/Board'
import { useI18n } from '../i18n'
import type { Msg } from '../utils/msg'

// ------------------------------------------------------------------ données de la leçon

const MOVABLE: ShopKey[] = ['Soldier', 'Sergeant', 'Archbishop']

type Step = { id: string; done: (tags: Set<string>) => boolean }
const STEPS: Step[] = [
  { id: 'soldier', done: t => t.has('buy:Soldier') },
  { id: 'move', done: t => t.has('move') },
  { id: 'foe', done: t => t.has('foe') },
  { id: 'capture', done: t => t.has('capture') },
  { id: 'general', done: t => t.has('buy:Sergeant') },
  { id: 'chef', done: t => t.has('buy:Archbishop') },
  { id: 'snipe', done: t => t.has('snipe') },
  { id: 'swap', done: t => t.has('swap') },
  { id: 'kamikaze', done: t => t.has('kamikaze') },
  { id: 'dabbaba', done: t => t.has('buy:Dabbaba') },
  { id: 'queen', done: t => t.has('buy:Berolina') },
  { id: 'tsar', done: t => t.has('buy:Duck') },
]

type Highlight = { kind: HighlightKind; action: Action; actor: PlayerId }

// Partie d'entraînement : argent illimité, snipes débloqués, roi à 4 PV pour pouvoir tester la reine.
function newTrainingState(): GameState {
  const s = newGameState()
  s.round = SNIPE_UNLOCK_ROUND
  for (const p of ['p1', 'p2'] as PlayerId[]) {
    s.players[p].money = 999999
    s.players[p].hp = 4
  }
  return s
}

export default function Tutorial() {
  const { t, tr, msg } = useI18n()
  const [game, setGame] = useState<GameState>(newTrainingState)
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Pos | null>(null)
  const [mode, setMode] = useState<'move' | 'snipe' | 'swap'>('move')
  const [placing, setPlacing] = useState<{ item: ShopKey; actor: PlayerId } | null>(null)
  const [foeSide, setFoeSide] = useState(false) // true = c'est l'ennemi qui achète et pose
  const [info, setInfo] = useState<ShopKey>('Soldier')
  const [hint, setHint] = useState<Msg>({ k: 'tut.hint.start' })

  const addTag = (...t: string[]) => setTags(prev => new Set([...prev, ...t]))

  function reset() {
    setGame(newTrainingState())
    setTags(new Set())
    setSelected(null)
    setPlacing(null)
    setMode('move')
    setHint({ k: 'tut.hint.reset' })
  }

  // On joue une action pour `actor` (toi ou l'ennemi) en gardant l'argent illimité.
  function perform(action: Action, actor: PlayerId) {
    const tag: string[] = []
    if (action.kind === 'buy') {
      tag.push(`buy:${action.item}`)
      if (actor === 'p2') tag.push('foe')
    }
    if (action.kind === 'move') {
      tag.push('move')
      if (game.board[action.to.r][action.to.c]) tag.push('capture')
    }
    if (action.kind === 'snipe') tag.push('snipe')
    if (action.kind === 'swap') tag.push('swap')
    if (action.kind === 'kamikaze') tag.push('kamikaze')
    const g = applyAction(game, actor, action)
    g.players.p1.money = 999999
    g.players.p2.money = 999999
    setGame(g)
    addTag(...tag)
    setPlacing(null)
    // après un déplacement, on garde la pièce sélectionnée pour enchaîner
    if (action.kind === 'move' && !g.result) setSelected(action.to)
    else setSelected(null)
    setHint(g.log[g.log.length - 1] ?? { k: 'tut.hint.start' })
  }

  function pickItem(item: ShopKey) {
    setInfo(item)
    setSelected(null)
    const actor: PlayerId = foeSide ? 'p2' : 'p1'
    const reason = buyBlockReason(game, actor, item)
    if (reason) {
      setHint({ k: 'tut.hint.cant', p: { reason: `@${reason}` } })
      setPlacing(null)
      return
    }
    if (item === 'Berolina' || item === 'Duck') {
      perform({ kind: 'buy', item }, actor)
      return
    }
    setPlacing({ item, actor })
    setHint({ k: foeSide ? 'tut.hint.clickFoe' : 'tut.hint.click' })
  }

  // Montre les déplacements d'une pièce : on en pose une au milieu du plateau si besoin.
  function showMoves(item: ShopKey) {
    setInfo(item)
    if (!MOVABLE.includes(item)) {
      setHint({ k: `tut.info.${item}.moves` })
      return
    }
    // la démo respecte aussi les maximums : elle compte comme un achat
    const reason = buyBlockReason(game, 'p1', item)
    if (reason) {
      const existing = game.board.flatMap((row, r) => row.map((p, c) => (p && p.owner === 'p1' && p.type === item ? { r, c } : null))).find(Boolean)
      if (existing) {
        setSelected(existing)
        setMode('move')
        setHint({ k: 'tut.hint.already', p: { piece: `@piece.${item}` } })
      } else {
        setHint({ k: 'tut.hint.demoCant', p: { reason: `@${reason}` } })
      }
      return
    }
    // la pièce est posée là où le jeu le permet (soldat, général et chef sur la dernière rangée)
    const cells = placementCells(game, 'p1', item).filter(c => !game.board[c.r][c.c])
    if (cells.length === 0) {
      setHint({ k: 'tut.hint.noCell', p: { piece: `@pl.${item}` } })
      return
    }
    const pos = cells[0]
    const g = applyAction(game, 'p1', { kind: 'buy', item, to: pos })
    g.players.p1.money = 999999
    setGame(g)
    addTag(`buy:${item}`)
    setSelected(pos)
    setMode('move')
    setPlacing(null)
    setHint({ k: 'tut.hint.demoPlaced', p: { piece: `@piece.${item}`, cell: cellName(pos) } })
  }

  const highlights = useMemo(() => {
    const map = new Map<string, Highlight>()
    if (game.result) return map
    if (placing) {
      for (const to of placementCells(game, placing.actor, placing.item)) {
        map.set(posKey(to), {
          kind: game.board[to.r][to.c] ? 'capture' : 'place',
          action: { kind: 'buy', item: placing.item, to },
          actor: placing.actor,
        })
      }
    } else if (selected) {
      const piece = game.board[selected.r][selected.c]
      if (piece && piece.type !== 'King') {
        const actor = piece.owner
        if (mode === 'move') {
          for (const d of moveDests(game, selected)) {
            map.set(posKey(d.to), {
              kind: d.capture ? 'capture' : 'move',
              action: { kind: 'move', from: selected, to: d.to },
              actor,
            })
          }
          if (canKamikaze(game, selected)) {
            map.set(posKey(kingPos(game, other(actor))), { kind: 'capture', action: { kind: 'kamikaze', from: selected }, actor })
          }
        } else if (mode === 'snipe') {
          for (const target of snipeTargets(game, selected))
            map.set(posKey(target), { kind: 'snipe', action: { kind: 'snipe', from: selected, target }, actor })
        } else {
          for (const target of swapTargets(game, selected))
            map.set(posKey(target), { kind: 'swap', action: { kind: 'swap', from: selected, target }, actor })
        }
      }
    }
    return map
  }, [game, placing, selected, mode])

  function onCellClick(r: number, c: number) {
    if (game.result) return
    const h = highlights.get(posKey({ r, c }))
    if (h) {
      perform(h.action, h.actor)
      return
    }
    const piece = game.board[r][c]
    setPlacing(null)
    if (piece && piece.type !== 'King') {
      setSelected({ r, c })
      setMode('move')
      setInfo(piece.type as ShopKey)
      setHint({ k: piece.owner === 'p1' ? 'tut.hint.mine' : 'tut.hint.foe', p: { text: `@tut.info.${piece.type}.moves` } })
    } else {
      setSelected(null)
    }
  }

  const selectedPiece: Piece | null = selected ? game.board[selected.r][selected.c] : null
  const done = STEPS.filter(s => s.done(tags)).length

  return (
    <div className="d-flex flex-column align-items-center min-vh-100 p-3 gap-3">
      <div className="d-flex gap-2 align-self-start">
        <Link to="/" className="btn-game btn-game--sm text-decoration-none">
          {t('common.menu')}
        </Link>
        <RulesButton />
      </div>

      <h1 className="h3 m-0 fw-bold">{t('tut.title')}</h1>
      <p className="text-secondary text-center m-0" style={{ maxWidth: 620 }}>
        {tr('tut.intro')}
      </p>

      <div className="d-flex flex-column flex-lg-row align-items-center align-items-lg-start justify-content-center gap-4 w-100">
        <div className="w-100" style={{ maxWidth: 600 }}>
          <Board game={game} highlights={highlights} selected={selected} clickable onCellClick={onCellClick} />
          <CapturedPieces game={game} />
          <div className="small mt-2 d-flex flex-wrap gap-3">
            <span><b style={{ color: '#198754' }}>■</b> {t('tut.legend.move')}</span>
            <span><b style={{ color: '#dc3545' }}>■</b> {t('tut.legend.capture')}</span>
            <span><b style={{ color: '#fd7e14' }}>■</b> {t('tut.legend.snipe')}</span>
            <span><b style={{ color: '#6f42c1' }}>■</b> {t('tut.legend.swap')}</span>
          </div>
        </div>

        <div className="d-flex flex-column gap-3" style={{ width: 'min(100%, 360px)' }}>
          <div className="alert alert-secondary py-2 mb-0">{msg(hint)}</div>

          {game.result && (
            <div className="alert alert-warning py-2 mb-0">
              {t('tut.kingFell', { reason: msg(game.result.reason) })} <br />
              <GameButton onClick={reset}>{t('tut.reset')}</GameButton>
            </div>
          )}

          <div>
            <div className="d-flex gap-2 mb-2">
              <GameButton onClick={() => setFoeSide(false)} tone={foeSide ? undefined : 'success'}>
                {t('tut.mySide')}
              </GameButton>
              <GameButton onClick={() => setFoeSide(true)} tone={foeSide ? 'danger' : undefined}>
                {t('tut.foeSide')}
              </GameButton>
            </div>
            <div className="row row-cols-3 g-2">
              {SHOP_KEYS.map(k => (
                <div key={k} className="col text-center">
                  <button
                    className={`btn btn-sm w-100 ${placing?.item === k || info === k ? 'btn-dark' : 'btn-outline-dark'}`}
                    onClick={() => pickItem(k)}
                  >
                    <img
                      src={pieceImages[`${foeSide ? 'Red' : 'Blue'}_${k}`]}
                      alt={t(`piece.${k}`)}
                      style={{ height: 38 }}
                    />
                    <div className="small">{t(`piece.${k}`)}</div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-2 border-dark rounded-3 p-3">
            <h2 className="h6 fw-bold">{t(`piece.${info}`)}</h2>
            <p className="small mb-1">
              <b>{t('tut.moves')}</b> {t(`tut.info.${info}.moves`)}
            </p>
            <p className="small mb-2">
              <b>{t('tut.rules')}</b> {t(`tut.info.${info}.rules`)}
            </p>
            {MOVABLE.includes(info) && (
              <GameButton onClick={() => showMoves(info)}>{t('tut.showMoves')}</GameButton>
            )}
          </div>

          {selectedPiece && (
            <div className="d-flex flex-wrap gap-2">
              <GameButton active={mode === 'move'} onClick={() => setMode('move')}>
                {t('mode.move')}
              </GameButton>
              {(selectedPiece.type === 'Sergeant' || selectedPiece.type === 'Archbishop') && (
                <GameButton active={mode === 'snipe'} onClick={() => setMode('snipe')}>
                  {t('mode.snipe', { n: snipesLeftFor(game, selectedPiece) })}
                </GameButton>
              )}
              {selectedPiece.type === 'Archbishop' && (
                <GameButton active={mode === 'swap'} onClick={() => setMode('swap')}>
                  {t('mode.swap', { n: game.players[selectedPiece.owner].swapsLeft })}
                </GameButton>
              )}
            </div>
          )}

          <div>
            <h2 className="h6 fw-bold">
              {t('tut.objectives', { done, total: STEPS.length })}
            </h2>
            <ul className="list-unstyled small mb-2">
              {STEPS.map(s => (
                <li key={s.id} className={s.done(tags) ? 'text-success' : ''}>
                  {s.done(tags) ? '✓' : '○'} {t(`tut.step.${s.id}`)}
                </li>
              ))}
            </ul>
            <GameButton onClick={reset}>{t('tut.reset')}</GameButton>
          </div>
        </div>
      </div>
    </div>
  )
}
