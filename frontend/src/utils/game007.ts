import type { Msg } from './msg'

// Port TypeScript du 007 (voir simple007 en Python).
// p1 = le joueur, p2 = l'adversaire (IA pour l'instant).

export type Move = 'CHARGER' | 'BOUCLIER' | 'TIRER' | 'GROS TIR' | 'PLUS DE POINTS' | 'SWAP'

export const WIN_SCORE = 1 // un seul tour gagnant décide du duel (V4)
// Argent du vainqueur selon ses points (1 tir, 2 gros tir, 3 swap, 4 bonus) ; le perdant touche toujours LOSER_REWARD.
export const WIN_REWARDS = [0, 15, 30, 50, 80]
const LOSER_REWARD = 5
export const SHIELD_LIMIT = 3 // boucliers d'affilée : au 3e, on perd le match (les deux en même temps : -1 PV de roi chacun)
const IA_TEMPERATURE = 0.25 // plus bas = l'IA Normal choisit plus souvent son meilleur coup (0.3 avant : trop proche du Facile)
const CHARGE_VALUE = 0.15
const WIN_VALUE = 100

export type State = {
  s1: number
  s2: number
  c1: number // recharges p1
  c2: number // recharges p2
  bonus1: boolean // bonus "plus de points" déjà utilisé
  bonus2: boolean
  k1: number // boucliers d'affilée de p1
  k2: number
  pen1: number // PV de roi à retirer à p1 à la fin du duel (spam du bouclier)
  pen2: number
}

export type Outcome = 'p1' | 'p2' | 'draw' | null

export const newGame = (): State => ({
  s1: 0, s2: 0, c1: 0, c2: 0, bonus1: false, bonus2: false, k1: 0, k2: 0, pen1: 0, pen2: 0,
})

export function getOutcome(s: State): Outcome {
  if (s.s1 < WIN_SCORE && s.s2 < WIN_SCORE) return null
  if (s.s1 > s.s2) return 'p1'
  if (s.s2 > s.s1) return 'p2'
  return 'draw'
}

export function playerMoves(s: State): Move[] {
  const moves: Move[] = ['CHARGER', 'BOUCLIER']
  if (s.c1 > 0) moves.push('TIRER')
  if (s.c1 >= 5) moves.push('GROS TIR')
  if (s.c1 >= 10 && !s.bonus1) moves.push('PLUS DE POINTS')
  if (s.c2 >= 5) moves.push('SWAP')
  return moves
}

export function iaMoves(s: State): Move[] {
  const moves: Move[] = ['CHARGER', 'BOUCLIER']
  if (s.c2 > 0) moves.push('TIRER')
  if (s.c2 >= 5) moves.push('GROS TIR')
  if (s.c2 >= 10 && !s.bonus2) moves.push('PLUS DE POINTS')
  if (s.c1 >= 5) moves.push('SWAP')
  // ne jamais se faire pénaliser pour spam du bouclier
  if (s.k2 >= SHIELD_LIMIT - 1) return moves.filter(m => m !== 'BOUCLIER')
  return moves
}


// Points marqués selon la façon de gagner (V4 : le premier point décide du duel, d'où l'argent 15 / 30 / 50 / 80 $).
export const PTS = { shot: 1, big: 2, swap: 3, bonus: 4, swapFail: 2 }

// Résolution d'un tour (équivalent de resolve_round). Retourne le nouvel état et un message traduisible.
export function resolveRound(state: State, p: Move, ia: Move): { state: State; message: Msg | null } {
  const s = { ...state }
  let message: Msg | null = null
  const reset = () => { s.c1 = 0; s.c2 = 0 }
  const me = (n: number, k: string) => { s.s1 += n; message = { k, p: { n } }; reset() }
  const foe = (n: number, k: string) => { s.s2 += n; message = { k, p: { n } }; reset() }

  if (p === 'PLUS DE POINTS' && ia === 'PLUS DE POINTS' && !s.bonus1 && !s.bonus2) {
    // double bonus : personne ne marque, tout retombe à 0 (les deux bonus sont dépensés)
    message = { k: 'm.bothBonus' }; reset(); s.bonus1 = true; s.bonus2 = true
  } else if (p === 'PLUS DE POINTS' && !s.bonus1) {
    // « plus de points » rapporte toujours 4 points, quoi que fasse l'adversaire
    me(PTS.bonus, 'm.meBonus'); s.bonus1 = true
  } else if (ia === 'PLUS DE POINTS' && !s.bonus2) {
    foe(PTS.bonus, 'm.foeBonus'); s.bonus2 = true
  } else if (p === 'SWAP' && ia === 'SWAP') {
    // double swap : personne ne marque, les recharges retombent à 0 (symétrique pour les deux joueurs)
    message = { k: 'm.bothSwap' }; reset()
  } else if (p === 'SWAP' && ia === 'GROS TIR') {
    me(PTS.swap, 'm.meSwap')
  } else if (p === 'SWAP' && ia !== 'GROS TIR') {
    foe(PTS.swapFail, 'm.foeSwapGain')
  } else if (p === 'GROS TIR' && ia === 'SWAP') {
    foe(PTS.swap, 'm.foeSwap')
  } else if (p !== 'GROS TIR' && ia === 'SWAP') {
    me(PTS.swapFail, 'm.meSwapGain')
  } else if (p === 'TIRER' && ia === 'BOUCLIER' && s.c1 > 0) {
    s.c1 -= 1
  } else if (p === 'TIRER' && ia === 'TIRER') {
    s.c1 -= 1; s.c2 -= 1
  } else if (p === 'TIRER' && ia === 'CHARGER') {
    me(PTS.shot, 'm.meShot')
  } else if (ia === 'GROS TIR' && p !== 'GROS TIR') {
    foe(PTS.big, 'm.foeBig')
  } else if (p === 'GROS TIR' && ia !== 'GROS TIR') {
    me(PTS.big, 'm.meBig')
  } else if (p === 'BOUCLIER' && ia === 'TIRER') {
    s.c2 -= 1
  } else if (p === 'BOUCLIER' && ia === 'CHARGER') {
    s.c2 += 1
  } else if (p === 'CHARGER' && ia === 'BOUCLIER') {
    s.c1 += 1
  } else if (p === 'CHARGER' && ia === 'TIRER') {
    foe(PTS.shot, 'm.foeShot')
  } else if (p === 'CHARGER' && ia === 'CHARGER') {
    s.c1 += 1; s.c2 += 1
  } else if (p === 'GROS TIR' && ia === 'GROS TIR') {
    reset()
  }
  return { state: s, message }
}

// Un tour complet : série de boucliers, règle anti-spam (3 d'affilée = match perdu), puis résolution.
export function playRound(
  state: State,
  p: Move,
  ia: Move
): { state: State; message: Msg | null; draw: boolean } {
  const s: State = {
    ...state,
    k1: p === 'BOUCLIER' ? state.k1 + 1 : 0,
    k2: ia === 'BOUCLIER' ? state.k2 + 1 : 0,
  }
  if (s.k1 >= SHIELD_LIMIT && s.k2 >= SHIELD_LIMIT) {
    s.pen1 += 1; s.pen2 += 1; s.k1 = 0; s.k2 = 0
    return { state: s, message: { k: 'm.spamBoth' }, draw: true }
  }
  // spam de bouclier d'un seul joueur : l'adversaire gagne directement le match (3 points)
  if (s.k1 >= SHIELD_LIMIT) {
    s.s2 += PTS.swap
    return { state: s, message: { k: 'm.spamMe', p: { n: SHIELD_LIMIT } }, draw: false }
  }
  if (s.k2 >= SHIELD_LIMIT) {
    s.s1 += PTS.swap
    return { state: s, message: { k: 'm.spamFoe', p: { n: SHIELD_LIMIT } }, draw: false }
  }
  const r = resolveRound(s, p, ia)
  return { state: r.state, message: r.message, draw: false }
}

// Argent gagné par un joueur (système V3, best of 5) selon l'écart de points du vainqueur.
export function rewardFor(state: State, outcome: Outcome, who: 'p1' | 'p2'): number {
  if (outcome === null || outcome === 'draw') return 0
  if (outcome !== who) return LOSER_REWARD
  const margin = Math.abs(state.s1 - state.s2)
  return WIN_REWARDS[Math.min(margin, WIN_REWARDS.length - 1)]
}

// ------------------------------------------------------------------ IA

export type AiMemory = {
  stats: Record<string, Record<string, number>>
  lastContext: string | null
  // mémoire de l'IA « Difficile » (voir ai007.ts) : habitudes du joueur par situation
  hard?: { counts: Record<string, number[]>; coarse: Record<string, number[]>; lastKey: string | null; lastCoarse: string | null }
}

export const newAiMemory = (): AiMemory => ({ stats: {}, lastContext: null })

const chargeBucket = (n: number) => (n === 0 ? 0 : n < 5 ? 1 : n < 10 ? 2 : 3)
const context = (s: State) => `${chargeBucket(s.c1)}-${s.c2 >= 5}`

const simulate = (s: State, p: Move, ia: Move): State => resolveRound(s, p, ia).state

function evaluate(s: State): number {
  // plus le vainqueur marque de points, plus il gagne d'argent : l'IA cherche aussi la meilleure façon de gagner
  if (s.s2 >= WIN_SCORE && s.s2 > s.s1) return WIN_VALUE + 10 * (s.s2 - s.s1)
  if (s.s1 >= WIN_SCORE && s.s1 > s.s2) return -WIN_VALUE - 10 * (s.s1 - s.s2)
  return s.s2 - s.s1 + CHARGE_VALUE * (Math.min(s.c2, 10) - Math.min(s.c1, 10))
}

function predictPlayer(s: State, mem: AiMemory, pMoves: Move[], iMoves: Move[]): Map<Move, number> {
  const ev = new Map<Move, number>()
  for (const p of pMoves) {
    const total = iMoves.reduce((acc, ia) => acc + evaluate(simulate(s, p, ia)), 0)
    ev.set(p, -total / iMoves.length)
  }
  const best = Math.max(...ev.values())
  const prior = new Map<Move, number>()
  pMoves.forEach(m => prior.set(m, Math.exp((ev.get(m)! - best) / 0.5)))
  const priorTotal = [...prior.values()].reduce((a, b) => a + b, 0)

  const stats = mem.stats[context(s)] ?? {}
  const weights = new Map<Move, number>()
  pMoves.forEach(m => weights.set(m, (3 * prior.get(m)!) / priorTotal + (stats[m] ?? 0)))
  const total = [...weights.values()].reduce((a, b) => a + b, 0)
  weights.forEach((w, m) => weights.set(m, w / total))
  return weights
}

// Coup de l'IA « Normal ». Mute `mem` : elle apprend les habitudes du joueur.
// (`s` : le joueur est p1, l'IA est p2. Les autres niveaux sont dans aiLevels.ts.)
export function normalPlay(s: State, mem: AiMemory, lastPlayerMove: Move | null): Move {
  if (mem.lastContext !== null && lastPlayerMove !== null) {
    const stats = (mem.stats[mem.lastContext] ??= {})
    stats[lastPlayerMove] = (stats[lastPlayerMove] ?? 0) + 1
  }
  mem.lastContext = context(s)

  const iMoves = iaMoves(s)
  const proba = predictPlayer(s, mem, playerMoves(s), iMoves)

  const expected = new Map<Move, number>()
  for (const ia of iMoves) {
    let e = 0
    proba.forEach((pr, p) => { e += pr * evaluate(simulate(s, p, ia)) })
    expected.set(ia, e)
  }
  const best = Math.max(...expected.values())
  const weights = iMoves.map(m => Math.exp((expected.get(m)! - best) / IA_TEMPERATURE))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < iMoves.length; i++) {
    r -= weights[i]
    if (r <= 0) return iMoves[i]
  }
  return iMoves[iMoves.length - 1]
}

// ------------------------------------------------------------------ outils

// Vue de la partie du point de vue de l'autre joueur.
export const mirror = (s: State): State => ({
  s1: s.s2, s2: s.s1, c1: s.c2, c2: s.c1, bonus1: s.bonus2, bonus2: s.bonus1, k1: s.k2, k2: s.k1, pen1: s.pen2, pen2: s.pen1,
})
