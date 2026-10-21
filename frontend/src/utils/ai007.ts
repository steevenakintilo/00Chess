// IA « Difficile » du 007 : stratégie d'équilibre (minimax) précalculée, plus une exploitation prudente
// des habitudes du joueur. La table vient de `npm run gen:ai007` (voir scripts/gen-ai007.ts).
//
// Idée : le 007 est un jeu à coups simultanés. Contre un adversaire qui joue au mieux, la meilleure défense
// est une stratégie MIXTE (tirer au sort selon des probabilités précises) ; on la calcule une fois pour toutes
// pour chaque situation (recharges, bonus, séries de boucliers), puis l'IA n'a plus qu'à tirer au sort.
import {
  SHIELD_LIMIT,
  getOutcome,
  mirror,
  newGame,
  playRound,
  playerMoves,
  rewardFor,
  type AiMemory,
  type Move,
  type State,
} from './game007'
import { AI007_DATA, AI007_PARAMS } from './ai007.table'

export const MOVES: Move[] = ['CHARGER', 'BOUCLIER', 'TIRER', 'GROS TIR', 'PLUS DE POINTS', 'SWAP']
export const CMAX = 12 // au-delà de 12 recharges, on raisonne comme à 12
export const GAMMA = 0.97 // léger goût pour les victoires rapides (assure la convergence du calcul)
export const ACT = 30 // valeur (en $) de « gagner le duel » : le gagnant joue une action sur le plateau
const NK = SHIELD_LIMIT // séries de boucliers possibles : 0 .. SHIELD_LIMIT-1
export const NSTATES = (CMAX + 1) * (CMAX + 1) * 2 * NK * NK
const STRIDE = 15 // 12 caractères de stratégie (6 coups x 2 chiffres) + 3 caractères de valeur (hexa)

// ----------------------------------------------------------------------------- abstraction de l'état

export function stateKey(s: State): number {
  const c1 = Math.min(s.c1, CMAX)
  const c2 = Math.min(s.c2, CMAX)
  const b = s.bonus1 && s.bonus2 ? 1 : 0 // dans un duel, les bonus ne sont dépensés que tous les deux (double bonus)
  const k1 = Math.min(s.k1, NK - 1)
  const k2 = Math.min(s.k2, NK - 1)
  return (((c1 * (CMAX + 1) + c2) * 2 + b) * NK + k1) * NK + k2
}

export function stateFromKey(key: number): State {
  let k = key
  const k2 = k % NK
  k = (k - k2) / NK
  const k1 = k % NK
  k = (k - k1) / NK
  const b = k % 2
  k = (k - b) / 2
  const c2 = k % (CMAX + 1)
  const c1 = (k - c2) / (CMAX + 1)
  return { ...newGame(), c1, c2, bonus1: b === 1, bonus2: b === 1, k1, k2 }
}

// Résultat d'un échange de coups : gain final (du point de vue de p1) ou état suivant.
export type Edge = { terminal: number } | { next: number }

export function edge(st: State, m1: Move, m2: Move): Edge {
  const r = playRound(st, m1, m2)
  if (r.draw) return { terminal: 0 } // les deux ont spammé le bouclier : -1 PV de roi chacun, symétrique
  const o = getOutcome(r.state)
  if (o === 'p1' || o === 'p2') {
    const money = rewardFor(r.state, o, 'p1') - rewardFor(r.state, o, 'p2')
    return { terminal: money + (o === 'p1' ? ACT : -ACT) }
  }
  if (o === 'draw') return { terminal: 0 }
  if (r.state.s1 !== 0 || r.state.s2 !== 0 || r.state.bonus1 !== r.state.bonus2) {
    throw new Error('IA 007 : les règles ont changé de façon incompatible avec le modèle (relis scripts/gen-ai007.ts)')
  }
  return { next: stateKey(r.state) }
}

// ----------------------------------------------------------------------------- signature des règles

function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

let signatureCache: string | null = null

// Empreinte des règles du 007 : si tu modifies les règles, elle change et la table doit être régénérée.
export function rulesSignature(): string {
  if (signatureCache) return signatureCache
  const parts: string[] = [`${CMAX}/${NK}/${GAMMA}/${ACT}`]
  for (let key = 0; key < NSTATES; key++) {
    const st = stateFromKey(key)
    for (const m1 of playerMoves(st)) {
      for (const m2 of playerMoves(mirror(st))) {
        const e = edge(st, m1, m2)
        parts.push(`${key}${m1[0]}${m1.length}${m2[0]}${m2.length}${'terminal' in e ? 't' + e.terminal : 'n' + e.next}`)
      }
    }
  }
  signatureCache = fnv1a(parts.join('|'))
  return signatureCache
}

// ----------------------------------------------------------------------------- lecture de la table

let usable: boolean | null = null

// La table est utilisable si elle existe ET correspond aux règles actuelles.
export function tableUsable(): boolean {
  if (usable !== null) return usable
  try {
    usable = AI007_DATA.length === NSTATES * STRIDE && AI007_PARAMS.signature === rulesSignature()
  } catch {
    usable = false // règles devenues incompatibles avec le modèle : on n'utilise pas la table
  }
  if (!usable && import.meta.env?.DEV) {
    console.warn('[IA 007] table « Difficile » absente ou périmée : lance `npm run gen:ai007`. En attendant, le niveau Difficile joue comme Normal.')
  }
  return usable
}

// Prépare l'IA Difficile en avance (le calcul de la signature prend ~0,1 s : autant le faire avant le premier coup).
export function warmUpHardAi(): void {
  tableUsable()
}

// Probabilité de chaque coup (ordre de MOVES) dans l'équilibre, pour p1 dans l'état `key`.
export function strategyAt(key: number): number[] {
  const base = key * STRIDE
  return MOVES.map((_, i) => parseInt(AI007_DATA.slice(base + 2 * i, base + 2 * i + 2), 10) / 100)
}

// Valeur de l'état pour p1 (gain attendu en $ avec un jeu optimal des deux côtés).
export function valueAt(key: number): number {
  const base = key * STRIDE + 12
  return (parseInt(AI007_DATA.slice(base, base + 3), 16) - 2048) / 10
}

// ----------------------------------------------------------------------------- choix d'un coup

const weightedPick = (moves: Move[], weights: number[]): Move => {
  const total = weights.reduce((a, b) => a + b, 0)
  if (!(total > 0)) return moves[Math.floor(Math.random() * moves.length)]
  let r = Math.random() * total
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i]
    if (r <= 0) return moves[i]
  }
  return moves[moves.length - 1]
}

// Habitudes du joueur : combien de fois il a joué chaque coup dans une situation donnée (avec oubli progressif).
// Deux niveaux de précision : situation exacte (peu de données) et situation approximative (plus de données).
const bucket = (c: number) => (c <= 2 ? c : c <= 4 ? 3 : c <= 9 ? 4 : 5)
const fineKey = (view: State) => `${Math.min(view.c2, 7)}|${Math.min(view.c1, 7)}|${view.k2}`
const coarseKey = (view: State) => `${bucket(view.c2)}|${bucket(view.c1)}`
export const HARD_CONFIG = {
  forget: 0.92, // les coups anciens comptent un peu moins que les récents
  priorWeight: 4, // « poids » de l'équilibre face à ce qu'on a observé
  coarseWeight: 3, // « poids » des habitudes approximatives face à celles de la situation exacte
  exploitMax: 0.5, // part maximale de coups choisis pour exploiter le joueur (le reste suit l'équilibre)
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

// Retourne le coup de l'IA « Difficile », ou null si la table est inutilisable (l'appelant joue alors Normal).
// `s` est vu comme dans aiPlay : l'IA est p2, le joueur est p1.
export function hardMove(s: State, mem: AiMemory, lastPlayerMove: Move | null): Move | null {
  if (!tableUsable()) return null
  const view = mirror(s) // l'IA devient p1 dans la table
  const hard = (mem.hard ??= { counts: {}, coarse: {}, lastKey: null, lastCoarse: null })

  // apprentissage : on note ce que le joueur vient de jouer dans la situation précédente
  if (hard.lastKey !== null && hard.lastCoarse !== null && lastPlayerMove !== null) {
    const idx = MOVES.indexOf(lastPlayerMove)
    for (const [map, k] of [[hard.counts, hard.lastKey], [hard.coarse, hard.lastCoarse]] as const) {
      const arr = (map[k] ??= [0, 0, 0, 0, 0, 0])
      for (let i = 0; i < arr.length; i++) arr[i] *= HARD_CONFIG.forget
      arr[idx] += 1
    }
  }
  const fk = fineKey(view)
  const ck = coarseKey(view)
  hard.lastKey = fk
  hard.lastCoarse = ck

  const key = stateKey(view)
  const myMoves = playerMoves(view)
  const eq = strategyAt(key)
  const base = myMoves.map(m => eq[MOVES.indexOf(m)])
  if (HARD_CONFIG.exploitMax <= 0) return weightedPick(myMoves, base)

  // exploitation : meilleure réponse à ce que le joueur a l'habitude de jouer ici
  const fine = hard.counts[fk]
  const coarse = hard.coarse[ck]
  const nF = fine ? sum(fine) : 0
  const nC = coarse ? sum(coarse) : 0
  const nEff = nF + 0.5 * nC
  if (nEff < 0.5) return weightedPick(myMoves, base)

  const oppMoves = playerMoves(s) // coups du joueur (s : joueur = p1)
  const oppEq = strategyAt(stateKey(s)) // ce que ferait le joueur s'il jouait l'équilibre
  const q = oppMoves.map(m => {
    const i = MOVES.indexOf(m)
    const approx = ((coarse?.[i] ?? 0) + HARD_CONFIG.priorWeight * oppEq[i]) / (nC + HARD_CONFIG.priorWeight)
    return ((fine?.[i] ?? 0) + HARD_CONFIG.coarseWeight * approx) / (nF + HARD_CONFIG.coarseWeight)
  })
  const qSum = sum(q)
  // gain attendu de chacun de mes coups contre cette distribution
  const gains = myMoves.map(mine => {
    let g = 0
    oppMoves.forEach((theirs, j) => {
      const e = edge(view, mine, theirs)
      g += (q[j] / qSum) * ('terminal' in e ? e.terminal : GAMMA * valueAt(e.next))
    })
    return g
  })
  const best = gains.indexOf(Math.max(...gains))
  const lambda = HARD_CONFIG.exploitMax * (nEff / (nEff + HARD_CONFIG.priorWeight))
  return weightedPick(myMoves, base.map((p, i) => (1 - lambda) * p + (i === best ? lambda : 0)))
}
