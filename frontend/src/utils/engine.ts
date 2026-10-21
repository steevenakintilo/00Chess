// Moteur du 00Chess (mode classique) : état de partie, règles, actions légales, IA.
// Aucun import d'image ici : le fichier est pur et testable seul.
import { shopItems } from './shop'
import type { Msg } from './msg'

export type PlayerId = 'p1' | 'p2'
export type PieceType = 'King' | 'Soldier' | 'Sergeant' | 'Archbishop' | 'Dabbaba'
// Soldier = soldat, Sergeant = général, Archbishop = chef, Dabbaba = récolteur,
// Berolina = reine (instantanée), Duck = tsar bomba (instantanée)
export type ShopKey = 'Soldier' | 'Sergeant' | 'Archbishop' | 'Berolina' | 'Dabbaba' | 'Duck'

export type Pos = { r: number; c: number }
export type Piece = { type: PieceType; owner: PlayerId }
export type PlayerState = {
  money: number
  hp: number
  bought: Record<ShopKey, number>
  captured: number // valeur des pièces adverses mangées
  capturedPieces: PieceType[] // lesquelles (pour l'affichage)
  duelWins: number // duels 007 gagnés
  snipesLeft: { Sergeant: number; Archbishop: number } // snipes restants, tous généraux / tous chefs confondus
  swapsLeft: number // swaps restants, tous chefs confondus
}
export type Result = { winner: PlayerId | 'draw'; reason: Msg }
export type GameState = {
  board: (Piece | null)[][]
  players: Record<PlayerId, PlayerState>
  round: number
  maxRounds: number
  result: Result | null
  log: Msg[]
}

export type Action =
  | { kind: 'pass' }
  | { kind: 'buy'; item: ShopKey; to?: Pos }
  | { kind: 'move'; from: Pos; to: Pos }
  | { kind: 'kamikaze'; from: Pos }
  | { kind: 'snipe'; from: Pos; target: Pos }
  | { kind: 'swap'; from: Pos; target: Pos }

// ------------------------------------------------------------------ constantes

export const SIZE = 8
export const MAX_ROUNDS = 50 // "50 coups (à déterminer)"
export const KING_HP = 5
export const HP_VALUE = 30 // valeur d'un PV restant au décompte final
export const COLLECTOR_INCOME = [0, 25, 50, 100] // récolteurs en vie -> argent par round
export const TSAR_SELF_DAMAGE = 2 // PV perdus par ton roi quand tu lances la Tsar Bomba
const KAMIKAZE_DAMAGE: Partial<Record<PieceType, number>> = { Soldier: 1, Sergeant: 1, Archbishop: 2 }
// Snipes par joueur (tous généraux confondus / tous chefs confondus), débloqués à partir du round 15.
// Général : soldat ou récolteur. Chef : soldat, général ou récolteur.
const SNIPE_POOL = { Sergeant: 4, Archbishop: 2 }
export const SNIPE_UNLOCK_ROUND = 15
const SWAP_POOL = 2 // swaps par joueur, tous chefs confondus

const itemOf = (k: ShopKey) => shopItems.find(i => i.key === k)!
export const priceOf = (k: ShopKey) => itemOf(k).price
export const maxOf = (k: ShopKey) => itemOf(k).max
export const SHOP_KEYS = shopItems.map(i => i.key as ShopKey)
const pieceValue = (t: PieceType) => (t === 'King' ? 0 : priceOf(t as ShopKey))

// Qui peut manger qui en se déplaçant (le roi ne se mange pas : il se touche en suicide).
const CAPTURES: Record<PieceType, PieceType[]> = {
  King: [],
  Soldier: ['Archbishop', 'Dabbaba'],
  Sergeant: ['Soldier', 'Dabbaba'],
  Archbishop: ['Sergeant', 'Archbishop', 'Dabbaba'],
  Dabbaba: [],
}
const canCapture = (a: PieceType, t: PieceType) => CAPTURES[a].includes(t)

// Nom de pièce à traduire (clé "pl.*", minuscule) pour les messages du journal.
const typeName = (t: PieceType) => `@pl.${t}`
export const other = (p: PlayerId): PlayerId => (p === 'p1' ? 'p2' : 'p1')
export const whoKey = (p: PlayerId) => `@who.${p}`
const homeRow = (p: PlayerId) => (p === 'p1' ? SIZE - 1 : 0)
const forward = (p: PlayerId) => (p === 'p1' ? -1 : 1)
const inBounds = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE
export const posKey = (p: Pos) => `${p.r}-${p.c}`
export const samePos = (a: Pos, b: Pos) => a.r === b.r && a.c === b.c
export const cellName = (p: Pos) => `${'abcdefgh'[p.c]}${SIZE - p.r}`
const DIRS4: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const DIRS8: [number, number][] = [...DIRS4, [-1, -1], [-1, 1], [1, -1], [1, 1]]

export const at = (s: GameState, p: Pos) => s.board[p.r][p.c]

export function kingPos(s: GameState, p: PlayerId): Pos {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const x = s.board[r][c]
      if (x && x.type === 'King' && x.owner === p) return { r, c }
    }
  throw new Error('roi introuvable')
}

export function piecesOf(s: GameState, p: PlayerId): { pos: Pos; piece: Piece }[] {
  const out: { pos: Pos; piece: Piece }[] = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const x = s.board[r][c]
      if (x && x.owner === p) out.push({ pos: { r, c }, piece: x })
    }
  return out
}

const log = (s: GameState, k: string, p?: Msg['p']) => {
  s.log.push({ k, p })
  if (s.log.length > 40) s.log.shift()
}

export function newGameState(maxRounds = MAX_ROUNDS): GameState {
  const board: (Piece | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  board[SIZE - 1][0] = { type: 'King', owner: 'p1' }
  board[0][SIZE - 1] = { type: 'King', owner: 'p2' }
  const player = (): PlayerState => ({
    money: 0,
    hp: KING_HP,
    bought: { Soldier: 0, Sergeant: 0, Archbishop: 0, Berolina: 0, Dabbaba: 0, Duck: 0 },
    captured: 0,
    capturedPieces: [],
    duelWins: 0,
    snipesLeft: { ...SNIPE_POOL },
    swapsLeft: SWAP_POOL,
  })
  return {
    board,
    players: { p1: player(), p2: player() },
    round: 1,
    maxRounds,
    result: null,
    log: [],
  }
}

// ------------------------------------------------------------------ score / fin de partie

export function score(s: GameState, p: PlayerId): number {
  const me = s.players[p]
  const alive = piecesOf(s, p).reduce((acc, x) => acc + pieceValue(x.piece.type), 0)
  return me.money + alive + me.captured + HP_VALUE * Math.max(me.hp, 0)
}

export function scoreBreakdown(s: GameState, p: PlayerId) {
  const me = s.players[p]
  const pieces = piecesOf(s, p).reduce((acc, x) => acc + pieceValue(x.piece.type), 0)
  const hp = HP_VALUE * Math.max(me.hp, 0)
  return { money: me.money, pieces, eaten: me.captured, hp, total: me.money + pieces + me.captured + hp }
}

// Départage sans roi mort : 1) celui qui a fait le plus de dégâts au roi adverse (donc dont le roi a le plus de PV) ;
// 2) à égalité de dégâts, le plus riche (score) ; 3) sinon égalité.
function tiebreak(s: GameState, kind: 'limit' | 'nopieces'): Result {
  const hp1 = Math.max(s.players.p1.hp, 0)
  const hp2 = Math.max(s.players.p2.hp, 0)
  const dmg1 = KING_HP - hp2 // dégâts infligés par p1 au roi de p2
  const dmg2 = KING_HP - hp1
  if (dmg1 !== dmg2) {
    const winner = dmg1 > dmg2 ? 'p1' : 'p2'
    return { winner, reason: { k: `end.${kind}Hp`, p: { n: s.maxRounds, a: dmg1, b: dmg2, x: '@who.p1', y: '@who.p2' } } }
  }
  const a = score(s, 'p1')
  const b = score(s, 'p2')
  const winner = a > b ? 'p1' : b > a ? 'p2' : 'draw'
  const k = `end.${kind}${winner === 'draw' ? 'Draw' : ''}`
  return { winner, reason: { k, p: { n: s.maxRounds, a, b, x: '@who.p1', y: '@who.p2' } } }
}

function checkKings(s: GameState) {
  const d1 = s.players.p1.hp <= 0
  const d2 = s.players.p2.hp <= 0
  if (d1 && d2) s.result = { winner: 'draw', reason: { k: 'end.bothKings' } }
  else if (d1) s.result = { winner: 'p2', reason: { k: 'end.myKing' } }
  else if (d2) s.result = { winner: 'p1', reason: { k: 'end.foeKing' } }
}

const exhausted = (s: GameState, p: PlayerId) => SHOP_KEYS.every(k => s.players[p].bought[k] >= maxOf(k))
const hasPieces = (s: GameState, p: PlayerId) => piecesOf(s, p).some(x => x.piece.type !== 'King')

export const incomeOf = (s: GameState, p: PlayerId) =>
  COLLECTOR_INCOME[Math.min(piecesOf(s, p).filter(x => x.piece.type === 'Dabbaba').length, 3)]

// Fin de round : revenus des récolteurs, compteur de rounds, conditions d'arrêt.
export function finishRound(state: GameState): GameState {
  const s = structuredClone(state)
  if (s.result) return s
  for (const p of ['p1', 'p2'] as PlayerId[]) {
    const gain = incomeOf(s, p)
    if (gain > 0) {
      s.players[p].money += gain
      log(s, 'log.income', { who: whoKey(p), n: gain })
    }
  }
  const out1 = exhausted(s, 'p1') && !hasPieces(s, 'p1')
  const out2 = exhausted(s, 'p2') && !hasPieces(s, 'p2')
  if (out1 && out2) s.result = tiebreak(s, 'nopieces')
  else if (out1) s.result = { winner: 'p2', reason: { k: 'end.myPieces' } }
  else if (out2) s.result = { winner: 'p1', reason: { k: 'end.foePieces' } }
  else if (s.round >= s.maxRounds) s.result = tiebreak(s, 'limit')
  s.round += 1
  return s
}

// Résultat d'un duel 007 : argent des deux joueurs, PV de roi perdus à cause du spam de bouclier, duels gagnés.
export function applyDuelResult(
  state: GameState,
  rewards: { p1: number; p2: number },
  hpLoss: { p1: number; p2: number },
  winner: PlayerId | 'draw' | null = null
): GameState {
  const s = structuredClone(state)
  if (winner === 'p1' || winner === 'p2') s.players[winner].duelWins += 1
  s.players.p1.money += rewards.p1
  s.players.p2.money += rewards.p2
  log(s, 'log.duel', { x: '@who.p1', y: '@who.p2', a: rewards.p1, b: rewards.p2 })
  for (const p of ['p1', 'p2'] as PlayerId[]) {
    if (hpLoss[p] > 0) {
      s.players[p].hp = Math.max(s.players[p].hp - hpLoss[p], 0)
      log(s, 'log.shieldHp', { who: `@king.${p}`, n: hpLoss[p] })
    }
  }
  checkKings(s)
  return s
}

// ------------------------------------------------------------------ placement

// Une case est posable si elle est libre, ou si elle porte une pièce adverse sur ma dernière ligne
// (poser un soldat, un général ou un chef dessus la mange ; le récolteur, lui, ne mange pas).
export function placementCells(s: GameState, p: PlayerId, item: ShopKey): Pos[] {
  const out: Pos[] = []
  const ok = (r: number, c: number) => {
    if (!inBounds(r, c)) return false
    const x = s.board[r][c]
    if (!x) return true
    return item !== 'Dabbaba' && r === homeRow(p) && x.owner !== p && x.type !== 'King'
  }
  if (item === 'Soldier' || item === 'Sergeant' || item === 'Archbishop') { // n'importe où sur sa dernière rangée
    for (let c = 0; c < SIZE; c++) if (ok(homeRow(p), c)) out.push({ r: homeRow(p), c })
  } else if (item === 'Dabbaba') {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!s.board[r][c]) out.push({ r, c })
  }
  return out
}

// Pourquoi on ne peut pas acheter (null = achat possible).
export function buyBlockReason(s: GameState, p: PlayerId, item: ShopKey): string | null {
  const me = s.players[p]
  if (me.bought[item] >= maxOf(item)) return 'reason.max'
  if (me.money < priceOf(item)) return 'reason.money'
  if (item === 'Berolina') return me.hp < KING_HP ? null : 'reason.hp'
  if (item === 'Duck') return null
  return placementCells(s, p, item).length === 0 ? 'reason.cell' : null
}

export function canBuy(s: GameState, p: PlayerId, item: ShopKey): boolean {
  return buyBlockReason(s, p, item) === null
}

// ------------------------------------------------------------------ déplacements

export type Dest = { to: Pos; capture: boolean }

export function moveDests(s: GameState, from: Pos): Dest[] {
  const piece = at(s, from)
  if (!piece || piece.type === 'King' || piece.type === 'Dabbaba') return []
  const speed = 1 // une case par déplacement, même dans sa propre zone
  // personne ne recule, sauf le chef (qui va aussi en diagonale, dans les 8 directions). Le général va aussi en diagonale vers l'avant.
  const f = forward(piece.owner)
  const dirs: [number, number][] =
    piece.type === 'Archbishop'
      ? DIRS8
      : piece.type === 'Sergeant'
        ? [[f, 0], [0, -1], [0, 1], [f, -1], [f, 1]]
        : [[f, 0], [0, -1], [0, 1]]
  const dests = new Map<string, Dest>()
  const visited = new Set<string>([posKey(from)])
  const addCapture = (r: number, c: number) => {
    const t = s.board[r][c]
    if (t && t.owner !== piece.owner && t.type !== 'King' && canCapture(piece.type, t.type))
      dests.set(`${r}-${c}`, { to: { r, c }, capture: true })
  }

  // le soldat avance en ligne droite (jamais en "L" ni en diagonale)
  if (piece.type === 'Soldier') {
    for (const [dr, dc] of dirs) {
      for (let k = 1; k <= speed; k++) {
        const r = from.r + dr * k
        const c = from.c + dc * k
        if (!inBounds(r, c)) break
        if (s.board[r][c]) {
          addCapture(r, c)
          break
        }
        dests.set(`${r}-${c}`, { to: { r, c }, capture: false })
      }
    }
    return [...dests.values()]
  }

  let frontier: Pos[] = [from]
  for (let depth = 0; depth < speed; depth++) {
    const next: Pos[] = []
    for (const cur of frontier) {
      for (const [dr, dc] of dirs) {
        const r = cur.r + dr
        const c = cur.c + dc
        if (!inBounds(r, c)) continue
        const k = `${r}-${c}`
        if (!s.board[r][c]) {
          if (!visited.has(k)) {
            visited.add(k)
            dests.set(k, { to: { r, c }, capture: false })
            next.push({ r, c })
          }
        } else {
          addCapture(r, c)
          // le général saute par-dessus une pièce qui le bloque
          if (piece.type === 'Sergeant') {
            const jr = r + dr
            const jc = c + dc
            if (inBounds(jr, jc)) {
              const jk = `${jr}-${jc}`
              if (!s.board[jr][jc]) {
                if (!visited.has(jk)) {
                  visited.add(jk)
                  dests.set(jk, { to: { r: jr, c: jc }, capture: false })
                  next.push({ r: jr, c: jc })
                }
              } else addCapture(jr, jc)
            }
          }
        }
      }
    }
    frontier = next
  }
  return [...dests.values()]
}

// Un soldat, un général ou un chef se sacrifie si le roi adverse est collé à lui : devant, à gauche ou à droite.
export function canKamikaze(s: GameState, from: Pos): boolean {
  const piece = at(s, from)
  if (!piece || !KAMIKAZE_DAMAGE[piece.type]) return false
  const k = kingPos(s, other(piece.owner))
  const f = forward(piece.owner)
  return (k.r === from.r + f && k.c === from.c) || (k.r === from.r && Math.abs(k.c - from.c) === 1)
}

export const snipeLocked = (s: GameState) => s.round < SNIPE_UNLOCK_ROUND

export const snipesLeftFor = (s: GameState, piece: Piece) =>
  piece.type === 'Sergeant' || piece.type === 'Archbishop' ? s.players[piece.owner].snipesLeft[piece.type] : 0

export function snipeTargets(s: GameState, from: Pos): Pos[] {
  const piece = at(s, from)
  if (!piece || snipeLocked(s) || snipesLeftFor(s, piece) <= 0) return []
  const kinds: PieceType[] =
    piece.type === 'Sergeant' ? ['Soldier', 'Dabbaba'] : ['Soldier', 'Sergeant', 'Dabbaba']
  return piecesOf(s, other(piece.owner))
    .filter(x => kinds.includes(x.piece.type))
    .map(x => x.pos)
}

export function swapTargets(s: GameState, from: Pos): Pos[] {
  const piece = at(s, from)
  if (!piece || piece.type !== 'Archbishop' || s.players[piece.owner].swapsLeft <= 0) return []
  return piecesOf(s, piece.owner)
    .filter(x => x.piece.type !== 'King' && !samePos(x.pos, from)) // n'importe laquelle de mes pièces, sans limite de rangée
    .map(x => x.pos)
}

// ------------------------------------------------------------------ actions

export function legalActions(s: GameState, p: PlayerId): Action[] {
  const out: Action[] = [{ kind: 'pass' }]
  for (const item of SHOP_KEYS) {
    if (!canBuy(s, p, item)) continue
    if (item === 'Berolina' || item === 'Duck') out.push({ kind: 'buy', item })
    else for (const to of placementCells(s, p, item)) out.push({ kind: 'buy', item, to })
  }
  for (const { pos } of piecesOf(s, p)) {
    for (const d of moveDests(s, pos)) out.push({ kind: 'move', from: pos, to: d.to })
    if (canKamikaze(s, pos)) out.push({ kind: 'kamikaze', from: pos })
    for (const target of snipeTargets(s, pos)) out.push({ kind: 'snipe', from: pos, target })
    for (const target of swapTargets(s, pos)) out.push({ kind: 'swap', from: pos, target })
  }
  return out
}

function eat(player: PlayerState, type: PieceType) {
  player.captured += pieceValue(type)
  player.capturedPieces.push(type)
}

function removeAt(s: GameState, p: Pos) {
  s.board[p.r][p.c] = null
}

// Joue une action (sans fin de round). Retourne un nouvel état ; le résultat peut être posé si un roi tombe.
export function applyAction(state: GameState, p: PlayerId, a: Action): GameState {
  const s = structuredClone(state)
  if (s.result) return s
  const me = s.players[p]
  const foe = s.players[other(p)]
  const who = whoKey(p)

  switch (a.kind) {
    case 'pass':
      log(s, 'log.pass', { who })
      break
    case 'buy': {
      me.money -= priceOf(a.item)
      me.bought[a.item] += 1
      if (a.item === 'Berolina') {
        // la reine donne son coeur au roi : +1 PV
        me.hp = Math.min(me.hp + 1, KING_HP)
        log(s, 'log.queen', { who })
      } else if (a.item === 'Duck') {
        // supprime toutes les pièces ennemies (le roi reste), mais coûte des PV à ton roi
        const gone = piecesOf(s, other(p)).filter(x => x.piece.type !== 'King')
        for (const x of gone) removeAt(s, x.pos)
        me.hp -= TSAR_SELF_DAMAGE
        log(s, 'log.tsar', { who, n: gone.length, dmg: TSAR_SELF_DAMAGE })
      } else if (a.to) {
        const intruder = at(s, a.to)
        if (intruder) {
          eat(me, intruder.type)
          log(s, 'log.placeEat', { who, piece: `@pl.${a.item}`, cell: cellName(a.to), eaten: typeName(intruder.type) })
        }
        s.board[a.to.r][a.to.c] = {
          type: a.item as PieceType,
          owner: p,
        }
        if (!intruder) log(s, 'log.place', { who, piece: `@pl.${a.item}`, cell: cellName(a.to) })
      }
      break
    }
    case 'move': {
      const piece = at(s, a.from)!
      const target = at(s, a.to)
      removeAt(s, a.from)
      if (target) {
        eat(me, target.type)
        log(s, 'log.moveEat', { who, piece: typeName(piece.type), from: cellName(a.from), eaten: typeName(target.type), to: cellName(a.to) })
      } else {
        log(s, 'log.move', { who, piece: typeName(piece.type), from: cellName(a.from), to: cellName(a.to) })
      }
      s.board[a.to.r][a.to.c] = piece
      break
    }
    case 'kamikaze': {
      const piece = at(s, a.from)!
      const dmg = KAMIKAZE_DAMAGE[piece.type]!
      removeAt(s, a.from)
      foe.hp -= dmg
      log(s, 'log.kamikaze', { who, piece: typeName(piece.type), dmg })
      break
    }
    case 'snipe': {
      const piece = at(s, a.from)!
      const target = at(s, a.target)!
      s.players[p].snipesLeft[piece.type as 'Sergeant' | 'Archbishop'] -= 1
      removeAt(s, a.target)
      eat(me, target.type)
      log(s, 'log.snipe', { who, piece: typeName(piece.type), target: typeName(target.type), cell: cellName(a.target) })
      break
    }
    case 'swap': {
      const piece = at(s, a.from)!
      const target = at(s, a.target)!
      me.swapsLeft -= 1
      s.board[a.from.r][a.from.c] = target
      s.board[a.target.r][a.target.c] = piece
      log(s, 'log.swap', { who, target: typeName(target.type), from: cellName(a.from), to: cellName(a.target) })
      break
    }
  }
  me.hp = Math.max(me.hp, 0)
  foe.hp = Math.max(foe.hp, 0)
  checkKings(s)
  return s
}

// ------------------------------------------------------------------ IA

// Poids de la fonction d'évaluation de l'IA. Les valeurs de NORMAL_WEIGHTS sont celles de l'IA « Normal » :
// ne les change pas sans raison. L'IA « Difficile » (aiBoard.ts) utilise d'autres poids, réglés par simulation.
export type AiWeights = {
  piece: number // multiplicateur du prix des pièces en vie
  hp: number // valeur d'un PV de roi
  snipe: number // valeur d'un snipe qu'il reste
  collector: number // bonus fixe par récolteur (revenus futurs)
  collectorRate: number // bonus par récolteur et par round restant (revenus futurs)
  captured: number // multiplicateur de la valeur des pièces mangées
  position: number // récompense de la proximité avec le roi adverse
  adjacent: number // récompense d'une pièce collée au roi adverse (par PV qu'elle peut retirer)
  threatFoe: number // pièces adverses que je peux manger
  threatMe: number // pièces à moi que l'adversaire peut manger
  kamikaze: number // priorité donnée au suicide près du roi adverse
  queenSave: number // valeur de l'argent mis de côté pour la reine quand le roi est abîmé (par PV manquant)
  queen: number // bonus d'achat de la reine, par PV de roi manquant (elle rend 1 PV mais coûte cher : sans bonus l'IA ne l'achèterait jamais)
}
export const NORMAL_WEIGHTS: AiWeights = {
  piece: 1.5,
  hp: 100,
  snipe: 8,
  collector: 40,
  collectorRate: 0,
  captured: 1,
  position: 2,
  adjacent: 40,
  threatFoe: 0.5,
  threatMe: 0.8,
  kamikaze: 1000,
  queen: 120,
  queenSave: 100,
}
export const KAMIKAZE_PRIORITY = NORMAL_WEIGHTS.kamikaze

// Cases (des pièces de `owner`) que l'adversaire peut manger au prochain coup.
function threatened(s: GameState, owner: PlayerId): number {
  const foe = other(owner)
  const hit = new Set<string>()
  for (const { pos } of piecesOf(s, foe)) for (const d of moveDests(s, pos)) if (d.capture) hit.add(posKey(d.to))
  let total = 0
  for (const { pos, piece } of piecesOf(s, owner)) if (hit.has(posKey(pos))) total += pieceValue(piece.type)
  return total
}

function material(s: GameState, p: PlayerId, w: AiWeights): number {
  const me = s.players[p]
  const left = Math.max(0, s.maxRounds - s.round)
  let v = me.money + w.captured * me.captured + w.hp * me.hp + w.snipe * (me.snipesLeft.Sergeant + me.snipesLeft.Archbishop)
  // roi abîmé et reine pas encore achetée : l'IA garde son argent au lieu de tout dépenser en soldats
  if (me.hp < KING_HP && me.bought.Berolina === 0) v += (w.queenSave * (KING_HP - me.hp) * Math.min(me.money, priceOf('Berolina'))) / priceOf('Berolina')
  for (const { piece } of piecesOf(s, p)) {
    v += pieceValue(piece.type) * w.piece
    if (piece.type === 'Dabbaba') v += w.collector + w.collectorRate * left // revenus futurs
  }
  return v
}

// Pression sur le roi adverse : pièces proches (et kamikazes possibles) - pièces adverses proches de mon roi.
function pressure(s: GameState, p: PlayerId, w: AiWeights): number {
  const target = kingPos(s, other(p))
  let v = 0
  for (const { pos, piece } of piecesOf(s, p)) {
    const dmg = KAMIKAZE_DAMAGE[piece.type]
    if (!dmg) continue
    const dist = Math.abs(target.r - pos.r) + Math.abs(target.c - pos.c)
    v += w.position * (2 * SIZE - dist)
    if (dist === 1) v += w.adjacent * dmg
  }
  return v
}

export function evaluate(s: GameState, me: PlayerId, w: AiWeights = NORMAL_WEIGHTS): number {
  if (s.result) return s.result.winner === me ? 1e6 : s.result.winner === 'draw' ? 0 : -1e6
  const foe = other(me)
  return (
    material(s, me, w) - material(s, foe, w) +
    pressure(s, me, w) - pressure(s, foe, w) +
    w.threatFoe * threatened(s, foe) - w.threatMe * threatened(s, me)
  )
}

// Bonus ajouté à l'évaluation d'une action : le suicide près du roi adverse est presque toujours le meilleur coup,
// et la reine vaut d'autant plus que mon roi est abîmé (à 250 $ pour 1 PV elle ne vaut le coup que s'il manque au moins 2 PV).
export function actionBonus(s: GameState, me: PlayerId, a: Action, w: AiWeights): number {
  if (a.kind === 'kamikaze') return w.kamikaze
  if (a.kind === 'buy' && a.item === 'Berolina') return w.queen * (KING_HP - s.players[me].hp)
  return 0
}

// Choix « logique » : on simule chaque action légale et on garde la meilleure position (un peu de hasard entre égales).
export function chooseAction(s: GameState, me: PlayerId, buysOnly = false, w: AiWeights = NORMAL_WEIGHTS): Action {
  let best: Action = { kind: 'pass' }
  let bestScore = -Infinity
  for (const a of legalActions(s, me)) {
    if (buysOnly && a.kind !== 'buy' && a.kind !== 'pass') continue
    // (les coups gagnants valent 1e6 et passent quand même devant les bonus)
    const bonus = actionBonus(s, me, a, w)
    const v = evaluate(applyAction(s, me, a), me, w) + bonus + Math.random() * 0.5
    if (v > bestScore) {
      bestScore = v
      best = a
    }
  }
  return best
}

// Tour de l'IA : une seule action (acheter et poser, déplacer, sniper, swap, suicide, ou passer).
export function playTurn(state: GameState, me: PlayerId): { state: GameState; actions: Action[] } {
  const a = chooseAction(state, me)
  return { state: applyAction(state, me, a), actions: a.kind === 'pass' ? [] : [a] }
}
