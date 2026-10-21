// Mesure de la variété de l'IA : à quel point ses coups d'ouverture se ressemblent d'une partie à l'autre.
import { SIZE, at, cellName, type Action, type GameState, type PlayerId, type Pos } from './engine'

export type MoveRecord = {
  round: number
  step: number // numéro de l'action dans le tour (0 = première)
  type: string // coup sans les cases, ex. "move:Soldier" ou "buy:Dabbaba"
  exact: string // coup avec les cases, vu depuis le camp de celui qui joue (le rouge est pivoté de 180°)
}

// Le rouge est pivoté de 180° pour que "même coup" ait le même sens pour les deux camps.
const norm = (p: PlayerId, pos: Pos): Pos => (p === 'p1' ? pos : { r: SIZE - 1 - pos.r, c: SIZE - 1 - pos.c })
const cell = (p: PlayerId, pos: Pos) => cellName(norm(p, pos))

// Décrit une action (à appeler AVANT de la jouer, car on lit le plateau).
export function describeAction(s: GameState, who: PlayerId, a: Action): Pick<MoveRecord, 'type' | 'exact'> {
  switch (a.kind) {
    case 'pass':
      return { type: 'pass', exact: 'pass' }
    case 'buy': {
      const type = `buy:${a.item}`
      return { type, exact: a.to ? `${type}@${cell(who, a.to)}` : type }
    }
    case 'move': {
      const t = `move:${at(s, a.from)?.type}`
      return { type: t, exact: `${t} ${cell(who, a.from)}>${cell(who, a.to)}` }
    }
    case 'kamikaze': {
      const t = `kamikaze:${at(s, a.from)?.type}`
      return { type: t, exact: `${t} ${cell(who, a.from)}` }
    }
    case 'snipe': {
      const t = `snipe:${at(s, a.from)?.type}>${at(s, a.target)?.type}`
      return { type: t, exact: `${t} ${cell(who, a.from)}>${cell(who, a.target)}` }
    }
    case 'swap': {
      const t = `swap:${at(s, a.from)?.type}`
      return { type: t, exact: `${t} ${cell(who, a.from)}<>${cell(who, a.target)}` }
    }
  }
}

export type Similarity = {
  window: number // nombre de rounds d'ouverture analysés (total de rounds / 3)
  games: number
  sampledMoves: number // coups d'ouverture analysés, toutes parties confondues
  typePct: number // % de paires de coups identiques (type de coup)
  exactPct: number // % de paires de coups identiques (cases comprises)
  topMoves: { move: string; count: number }[]
}

export const openingWindow = (maxRounds: number) => Math.max(1, Math.floor(maxRounds / 3))

// Pour chaque round de l'ouverture, on compare les coups joués dans les différentes parties :
// pourcentage de paires de parties qui ont joué le même coup à ce round.
export function openingSimilarity(games: MoveRecord[][], maxRounds: number): Similarity {
  const window = openingWindow(maxRounds)
  const byRound = new Map<number, MoveRecord[]>()
  for (const g of games) for (const m of g) {
    if (m.round > window) continue
    const key = m.round * 1000 + m.step // on compare la même action du même round
    if (!byRound.has(key)) byRound.set(key, [])
    byRound.get(key)!.push(m)
  }
  let pairs = 0
  let sameType = 0
  let sameExact = 0
  let sampled = 0
  const total: Record<string, number> = {}
  for (const moves of byRound.values()) {
    sampled += moves.length
    const t: Record<string, number> = {}
    const e: Record<string, number> = {}
    for (const m of moves) {
      t[m.type] = (t[m.type] ?? 0) + 1
      e[m.exact] = (e[m.exact] ?? 0) + 1
      total[m.exact] = (total[m.exact] ?? 0) + 1
    }
    const n = moves.length
    pairs += (n * (n - 1)) / 2
    sameType += Object.values(t).reduce((a, k) => a + (k * (k - 1)) / 2, 0)
    sameExact += Object.values(e).reduce((a, k) => a + (k * (k - 1)) / 2, 0)
  }
  return {
    window,
    games: games.length,
    sampledMoves: sampled,
    typePct: pairs ? (100 * sameType) / pairs : 0,
    exactPct: pairs ? (100 * sameExact) / pairs : 0,
    topMoves: Object.entries(total)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([move, count]) => ({ move, count })),
  }
}
