import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api, type ApiRoomState } from '../api'
import { useAuth } from '../auth/AuthContext'
import Board from './Board'
import { CapturedPieces, ScoreTable } from './GameSummary'
import Modal from './Modal'
import { BuyButton, ContinueButton, GameButton, ShopButton } from './GameButtons'
import { useI18n } from '../i18n'
import { pieceImages } from '../utils/pieces'
import { shopItems } from '../utils/shop'
import {
  SNIPE_UNLOCK_ROUND,
  TSAR_SELF_DAMAGE,
  buyBlockReason,
  canBuy,
  canKamikaze,
  kingPos,
  maxOf,
  moveDests,
  other,
  placementCells,
  UNLIMITED_ROUNDS,
  KING_HP,
  posKey,
  snipeLocked,
  snipeTargets,
  snipesLeftFor,
  swapTargets,
  type Action,
  type Pos,
  type ShopKey,
} from '../utils/engine'
import { SHIELD_LIMIT, WIN_REWARDS, PTS, mirror, playerMoves, rewardFor, type Move, type Outcome } from '../utils/game007'
import type { Msg } from '../utils/msg'
import { playerOf, replay, winnerOf, type NetEvent } from '../online/replay'
import { useGameSounds } from '../utils/useGameSounds'

const MIN_ROUNDS_FOR_TROPHIES = 20 // comme MIN_ROUNDS_FOR_TROPHIES du backend (lobby/views.py)

type Mode = 'move' | 'snipe' | 'swap'
type Highlight = { kind: 'place' | 'move' | 'capture' | 'snipe' | 'swap'; action: Action }

type Props = {
  code: string
  events: NetEvent[]
  meta: ApiRoomState
  offline: boolean
  refresh: () => Promise<void>
  onLeave: () => void
}

// L'état « mon camp / son camp » d'une raison de fin devient neutre (pseudos) en ligne.
function neutralReason(m: Msg): Msg {
  switch (m.k) {
    case 'end.myKing':
      return { k: 'end.kingOf', p: { who: '@who.p1' } }
    case 'end.foeKing':
      return { k: 'end.kingOf', p: { who: '@who.p2' } }
    case 'end.myPieces':
      return { k: 'end.piecesOf', p: { who: '@who.p1' } }
    case 'end.foePieces':
      return { k: 'end.piecesOf', p: { who: '@who.p2' } }
    default:
      return m
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="hud__stat">
      <span className="hud__label">{label}</span>
      <span className="hud__value">{value}</span>
    </span>
  )
}

export default function OnlineGame({ code, events, meta, offline, refresh, onLeave }: Props) {
  const { t, msg, setNames } = useI18n()
  const { refresh: refreshUser } = useAuth()
  const side = meta.side
  const meId = playerOf(side)
  const foeId = other(meId)
  const g = useMemo(() => replay(events), [events])
  const game = g.eng
  useGameSounds(game) // mêmes événements rejoués chez les deux joueurs : chacun entend le même son (à la seconde près)
  const myName = side === 'host' ? g.names.host : g.names.guest
  const foeName = side === 'host' ? g.names.guest : g.names.host

  const [selected, setSelected] = useState<Pos | null>(null)
  const [mode, setMode] = useState<Mode>('move')
  const [shopItem, setShopItem] = useState<ShopKey | null>(null)
  const [shopOpen, setShopOpen] = useState(false)
  const [error, setError] = useState('')
  const reported = useRef(new Set<string>())
  const [reportedTick, setReportedTick] = useState(0) // force un rendu quand on vient d'envoyer un compte rendu

  // Les journaux et messages affichent les pseudos à la place de « Toi » / « IA ».
  useEffect(() => {
    if (g.started) setNames({ p1: g.names.host, p2: g.names.guest })
    return () => setNames(null)
  }, [g.started, g.names.host, g.names.guest, setNames])

  const winner = winnerOf(g)
  const finished = g.over !== null || game.result !== null
  const inDuel = g.started && !finished && g.actor === null
  const myTurn = g.started && !finished && g.actor === side
  const foeTurn = g.started && !finished && g.actor !== null && g.actor !== side

  // Appel d'API avec message d'erreur ; rafraîchit ensuite l'état tout de suite (sans attendre le prochain sondage).
  async function send(path: string, body?: unknown) {
    setError('')
    try {
      await api(`/api/rooms/${code}/${path}/`, { method: 'POST', body: body ?? {} })
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) setError(t('err.network'))
    }
    await refresh()
  }

  // Résultat final : chaque joueur l'annonce, le serveur vérifie qu'ils sont d'accord.
  useEffect(() => {
    if (game.result && !g.over && !reported.current.has('over')) {
      reported.current.add('over')
      const w = game.result.winner === 'draw' ? 'draw' : game.result.winner === 'p1' ? 'host' : 'guest'
      const hp = (p: 'p1' | 'p2') => Math.min(Math.max(game.players[p].hp, 0), KING_HP)
      send('game-over', { winner: w, hp_host: hp('p1'), hp_guest: hp('p2') })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.result, g.over])

  // Les trophées viennent d'être mis à jour par le serveur : on recharge le profil.
  const gameEnded = g.over?.trophies !== undefined
  useEffect(() => {
    if (gameEnded) refreshUser()
  }, [gameEnded, refreshUser])

  // Quand c'est à moi de jouer, le shop s'ouvre tout seul.
  const wasMyTurn = useRef(false)
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) {
      setShopOpen(true)
      setSelected(null)
      setShopItem(null)
    }
    wasMyTurn.current = myTurn
  }, [myTurn])

  // ----------------------------------------------------------------------------- duel 007
  const view = side === 'host' ? g.duel : mirror(g.duel)
  const verdictRel: Outcome =
    g.duelVerdict === null ? null : g.duelVerdict === 'draw' ? 'draw' : g.duelVerdict === side ? 'p1' : 'p2'
  const myReveal = g.lastReveal
    ? { mine: side === 'host' ? g.lastReveal.host : g.lastReveal.guest, theirs: side === 'host' ? g.lastReveal.guest : g.lastReveal.host,
        msg: side === 'host' ? g.lastReveal.msgHost : g.lastReveal.msgGuest }
    : null
  const duelReportKey = `duel${meta.room.round}`
  const duelReported = reported.current.has(duelReportKey)
  void reportedTick

  function playMove(move: Move) {
    send('move', { move })
  }

  function reportDuel() {
    if (g.duelVerdict === null) return
    reported.current.add(duelReportKey)
    setReportedTick(n => n + 1)
    send('duel-result', { round: meta.room.round, outcome: g.duelVerdict })
  }

  // ----------------------------------------------------------------------------- actions sur le plateau
  function act(action: Action) {
    setSelected(null)
    setShopItem(null)
    setShopOpen(false)
    send('action', { action })
  }

  function buy(item: ShopKey) {
    if (!myTurn || !canBuy(game, meId, item)) return
    if (item === 'Duck') {
      if (window.confirm(t('shop.tsarConfirm', { n: TSAR_SELF_DAMAGE }))) act({ kind: 'buy', item })
    } else if (item === 'Berolina' || item === 'Wildebeest') {
      act({ kind: 'buy', item })
    } else {
      setShopItem(item)
      setSelected(null)
      setShopOpen(false)
    }
  }

  const highlights = useMemo(() => {
    const map = new Map<string, Highlight>()
    if (!myTurn) return map
    if (shopItem) {
      for (const to of placementCells(game, meId, shopItem)) {
        map.set(posKey(to), { kind: game.board[to.r][to.c] ? 'capture' : 'place', action: { kind: 'buy', item: shopItem, to } })
      }
    } else if (selected) {
      const piece = game.board[selected.r][selected.c]
      if (piece && piece.owner === meId) {
        if (mode === 'move') {
          for (const d of moveDests(game, selected)) {
            map.set(posKey(d.to), { kind: d.capture ? 'capture' : 'move', action: { kind: 'move', from: selected, to: d.to } })
          }
          if (canKamikaze(game, selected)) {
            map.set(posKey(kingPos(game, foeId)), { kind: 'capture', action: { kind: 'kamikaze', from: selected } })
          }
        } else if (mode === 'snipe') {
          for (const target of snipeTargets(game, selected))
            map.set(posKey(target), { kind: 'snipe', action: { kind: 'snipe', from: selected, target } })
        } else {
          for (const target of swapTargets(game, selected))
            map.set(posKey(target), { kind: 'swap', action: { kind: 'swap', from: selected, target } })
        }
      }
    }
    return map
  }, [game, myTurn, shopItem, selected, mode, meId, foeId])

  function onCellClick(r: number, c: number) {
    if (!myTurn) return
    const h = highlights.get(posKey({ r, c }))
    if (h) {
      act(h.action)
      return
    }
    const piece = game.board[r][c]
    setShopItem(null)
    if (piece && piece.owner === meId && piece.type !== 'King') {
      setSelected({ r, c })
      setMode('move')
    } else setSelected(null)
  }

  const selectedPiece = selected ? game.board[selected.r][selected.c] : null
  const me = game.players[meId]
  const foe = game.players[foeId]

  // ----------------------------------------------------------------------------- abandon / déconnexion
  const foeGone = !finished && meta.opponent_seen_ago !== null && meta.opponent_seen_ago >= 30
  async function forfeit() {
    if (window.confirm(t('online.forfeitConfirm'))) await send('forfeit')
  }

  const resultTitle =
    winner === 'draw' ? t('end.draw') : winner === side ? t('end.youWon') : winner ? t('end.foeWon', { who: foeName }) : ''
  const overNote =
    g.over?.kind === 'forfeit'
      ? g.over.side === side
        ? t('online.youLeft')
        : t('online.foeLeft', { name: foeName })
      : g.over?.kind === 'desync'
        ? t('online.desync')
        : game.result
          ? msg(neutralReason(game.result.reason))
          : ''

  return (
    <div className="d-flex flex-column align-items-center gap-3 w-100">
      <h1 className="h4 m-0 fw-bold">{t('online.vs', { a: myName, b: foeName })}</h1>
      <p className="small text-secondary m-0">
        {t('online.youAre', { color: side === 'host' ? t('color.blue') : t('color.red') })}
      </p>

      <div className="hud" style={{ position: 'static', width: 'min(100%, 420px)' }}>
        {[
          { id: meId, name: myName },
          { id: foeId, name: foeName },
        ].map(({ id, name }, i) => (
          <div key={id} className={`hud__row${i === 1 ? ' hud__row--foe' : ''}`}>
            <span className="hud__name">{name}</span>
            <Stat label={t('hud.life')} value={game.players[id].hp} />
            <Stat label={t('hud.dollars')} value={`${game.players[id].money} $`} />
          </div>
        ))}
        <div className="hud__foot">
          <span>
            {t('hud.duelsNamed', {
              x: myName,
              a: me.duelWins,
              y: foeName,
              b: foe.duelWins,
            })}
          </span>
          <span>{t('hud.round', { n: Math.min(game.round, game.maxRounds), max: game.maxRounds >= UNLIMITED_ROUNDS ? '∞' : game.maxRounds })}</span>
          <span>{t('gm.current', { mode: t(`gm.${g.mode}`) })}</span>
        </div>
      </div>

      {offline && <div className="alert alert-warning py-2 m-0">{t('online.offline')}</div>}
      {error && <div className="alert alert-danger py-2 m-0">{error}</div>}

      <div className="d-flex flex-column flex-lg-row align-items-center align-items-lg-start justify-content-center gap-4 w-100">
        <div className="w-100" style={{ maxWidth: 600 }}>
          <div className="w-100 d-flex justify-content-center">
            <Board game={game} highlights={highlights} selected={selected} clickable={myTurn} onCellClick={onCellClick} />
          </div>
          <CapturedPieces game={game} />
        </div>

        <div className="d-flex flex-column gap-3" style={{ width: 'min(100%, 320px)' }}>
          {finished && (
            <div className="text-center">
              <h4>{resultTitle}</h4>
              {overNote && <p>{overNote}</p>}
              {g.over?.trophies && (
                <p className="fw-bold">
                  {g.over.ranked === false
                    ? g.mode === 'onehp'
                      ? t('online.noTrophiesMode')
                      : t('online.tooShort', { n: MIN_ROUNDS_FOR_TROPHIES })
                    : t('online.trophiesDelta', { n: `${g.over.trophies[side] > 0 ? '+' : ''}${g.over.trophies[side]}` })}
                </p>
              )}
              {game.result && <ScoreTable game={game} names={[g.names.host, g.names.guest]} />}
              {g.over?.replay && (
                <div className="mb-2">
                  <p className="small text-secondary mb-1">{t('online.replayCode', { code: g.over.replay })}</p>
                  <Link to={`/replay/${g.over.replay}`} className="btn-game btn-game--sm text-decoration-none">
                    {t('replay.watch')}
                  </Link>
                </div>
              )}
              <ContinueButton label={t('online.leave')} onClick={onLeave} />
            </div>
          )}

          {foeTurn && <p className="text-center fw-bold m-0">{t('online.foeTurn', { name: foeName })}</p>}

          {myTurn && (
            <div className="text-center">
              <p className="fw-bold mb-2">{t('turn.yourTurn')}</p>
              {selectedPiece && (
                <div className="d-flex justify-content-center flex-wrap gap-2 mb-2">
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
                <ContinueButton label={t('btn.pass')} onClick={() => act({ kind: 'pass' })} />
              </div>
            </div>
          )}

          {foeGone && (
            <div className="alert alert-warning py-2 m-0 text-center">
              <div className="mb-2">{t('online.foeGone', { name: foeName })}</div>
              <GameButton tone="success" onClick={() => send('claim')}>
                {t('online.claim')}
              </GameButton>
            </div>
          )}

          <div className="small text-secondary">
            {game.log.slice(-8).reverse().map((l, i) => (
              <div key={game.log.length - i}>{msg(l)}</div>
            ))}
          </div>

          {!finished && (
            <div className="d-flex justify-content-center">
              <GameButton tone="danger" onClick={forfeit}>
                {t('online.forfeit')}
              </GameButton>
            </div>
          )}
        </div>
      </div>

      {/* Duel 007 */}
      {inDuel && (
        <Modal>
          <div className="container text-center" style={{ maxWidth: 600 }}>
            <h4>007</h4>
            <p className="small text-secondary">
              {t('duel.intro', {
                shot: PTS.shot,
                big: PTS.big,
                swap: PTS.swap,
                bonus: PTS.bonus,
                gShot: ` (${WIN_REWARDS[PTS.shot]} $)`,
                gBig: ` (${WIN_REWARDS[PTS.big]} $)`,
                gSwap: ` (${WIN_REWARDS[PTS.swap]} $)`,
                gBonus: ` (${WIN_REWARDS[PTS.bonus]} $)`,
              })}
            </p>
            <div className="row mb-3">
              <div className="col" style={{ color: '#0d6efd' }}>
                <div className="fw-bold">{myName}</div>
                <div>{t('duel.points', { n: view.s1 })}</div>
                <div>{t('duel.charges', { n: view.c1 })}</div>
              </div>
              <div className="col" style={{ color: '#dc3545' }}>
                <div className="fw-bold">{foeName}</div>
                <div>{t('duel.points', { n: view.s2 })}</div>
                <div>{t('duel.charges', { n: view.c2 })}</div>
              </div>
            </div>

            {verdictRel === null && view.k1 === SHIELD_LIMIT - 1 && (
              <div className="alert alert-warning py-2">{t('duel.warnMe', { n: view.k1 })}</div>
            )}
            {verdictRel === null && view.k2 === SHIELD_LIMIT - 1 && (
              <div className="alert alert-info py-2">{t('duel.warnFoe', { n: view.k2 })}</div>
            )}

            {verdictRel === null ? (
              <>
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  {playerMoves(view).map(move => (
                    <GameButton key={move} disabled={meta.my_move_sent} onClick={() => playMove(move)}>
                      {t(`move.${move}`)}
                    </GameButton>
                  ))}
                </div>
                <p className="mt-3 mb-0 fw-bold">
                  {meta.my_move_sent
                    ? t('online.waitFoeMove')
                    : meta.opponent_move_sent
                      ? t('online.foePlayed', { name: foeName })
                      : t('online.chooseMove')}
                </p>
              </>
            ) : (
              <div>
                <p className="fw-bold fs-5">
                  {verdictRel === 'p1'
                    ? t('duel.won')
                    : verdictRel === 'p2'
                      ? t('online.duelLost', { name: foeName })
                      : g.duelSpamDraw
                        ? t('duel.spamDraw')
                        : t('duel.tie')}
                </p>
                <p>{t('duel.moneyWon', { n: rewardFor(view, verdictRel, 'p1') })}</p>
                {duelReported ? (
                  <p className="fw-bold">{t('online.waitOther')}</p>
                ) : (
                  <ContinueButton onClick={reportDuel} />
                )}
              </div>
            )}

            {myReveal && (
              <p className="mt-3 small text-secondary">
                {t('duel.log', { you: `@move.${myReveal.mine}`, foe: `@move.${myReveal.theirs}`, msg: msg(myReveal.msg) })}
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Shop */}
      {myTurn && shopOpen && (
        <Modal onClose={() => setShopOpen(false)}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h4 m-0">{t('shop.title')}</h2>
            <span className="d-flex align-items-center gap-1 fw-bold fs-4">
              <span className="small text-secondary">{t('hud.dollars')}</span>
              {me.money} $
            </span>
          </div>
          <div className="row row-cols-2 row-cols-md-3 g-3">
            {shopItems.filter(item => !game.banned?.includes(item.key as ShopKey)).map(item => {
              const key = item.key as ShopKey
              const ok = canBuy(game, meId, key)
              return (
                <div key={item.key} className="col text-center">
                  <img
                    src={pieceImages[`${side === 'host' ? 'Blue' : 'Red'}_${item.key}`]}
                    alt={t(`piece.${item.key}`)}
                    className="w-100"
                    style={{ maxWidth: 60, opacity: ok ? 1 : 0.4 }}
                  />
                  <div className="small">{t(`piece.${item.key}`)}</div>
                  <div className="small text-secondary">
                    {me.bought[key]}/{maxOf(key)}
                  </div>
                  <BuyButton price={item.price} active={shopItem === key} disabled={!ok} onClick={() => buy(key)} />
                  {!ok && <div className="small text-danger mt-1">{t(buyBlockReason(game, meId, key) ?? '')}</div>}
                </div>
              )
            })}
          </div>
          <div className="d-flex justify-content-center mt-4">
            <GameButton onClick={() => setShopOpen(false)}>{t('shop.skip')}</GameButton>
          </div>
        </Modal>
      )}
    </div>
  )
}
