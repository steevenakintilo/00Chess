// Niveaux de difficulté de l'IA (Facile / Normal / Difficile) : 007 d'abord, plateau ensuite.
import {
  getOutcome,
  iaMoves,
  mirror,
  newAiMemory,
  newGame,
  normalPlay,
  playRound,
  type AiMemory,
  type Move,
  type Outcome,
  type State,
} from './game007'
import { hardMove } from './ai007'

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Level[] = ['easy', 'normal', 'hard']
export const DEFAULT_LEVEL: Level = 'normal'

// ------------------------------------------------------------------ Facile (007)
// Joue « à peu près bien » seulement une fois sur quelques-unes, le reste du temps il choisit un coup au hasard
// avec des goûts de débutant (il charge beaucoup, tire dès qu'il peut, utilise rarement le swap).
export const EASY_CONFIG = {
  smart: 0.1, // probabilité de jouer le coup que choisirait l'IA Normal (sans mémoire des habitudes du joueur)
  weights: { CHARGER: 5, BOUCLIER: 3, TIRER: 2, 'GROS TIR': 3, 'PLUS DE POINTS': 4, SWAP: 1 } as Record<Move, number>,
}

function easyPlay(s: State): Move {
  const moves = iaMoves(s) // l'IA Facile évite aussi le 3e bouclier d'affilée
  if (Math.random() < EASY_CONFIG.smart) {
    const pick = normalPlay(s, newAiMemory(), null)
    if (moves.includes(pick)) return pick
  }
  const weights = moves.map(m => EASY_CONFIG.weights[m])
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i]
    if (r <= 0) return moves[i]
  }
  return moves[moves.length - 1]
}

// ------------------------------------------------------------------ choix du coup selon le niveau

// `s` : le joueur est p1, l'IA est p2 ; `mem` : mémoire de l'IA (habitudes du joueur) ; `last` : dernier coup du joueur.
export function aiPlay(s: State, mem: AiMemory, last: Move | null, level: Level = DEFAULT_LEVEL): Move {
  if (level === 'easy') return easyPlay(s)
  if (level === 'hard') return hardMove(s, mem, last) ?? normalPlay(s, mem, last) // table absente/périmée : on joue Normal
  return normalPlay(s, mem, last)
}

// ------------------------------------------------------------------ IA contre IA

// Joue un duel entier entre deux IA (chacune apprend les habitudes de l'autre) ; `blue` = p1, `red` = p2.
// Deux IA de même niveau se neutralisent parfois sans fin : au-delà de MAX_DUEL_ROUNDS tours,
// celle qui mène gagne, et en cas d'égalité le vainqueur est tiré au hasard (+1 point).
const MAX_DUEL_ROUNDS = 60
export function simulateDuel(
  blue: Level = DEFAULT_LEVEL,
  red: Level = DEFAULT_LEVEL,
  memories?: { blue: AiMemory; red: AiMemory } // mémoires qui durent toute la partie (sinon neuves à chaque duel)
): { state: State; outcome: Outcome; hpLoss: { p1: number; p2: number }; rounds: number } {
  let state = newGame()
  // seule l'IA Difficile garde la mémoire des duels précédents de la partie (elle apprend les habitudes de l'adversaire)
  const mem1 = blue === 'hard' && memories ? memories.blue : newAiMemory()
  const mem2 = red === 'hard' && memories ? memories.red : newAiMemory()
  let last1: Move | null = null
  let last2: Move | null = null
  for (let rounds = 1; rounds <= MAX_DUEL_ROUNDS; rounds++) {
    const m1 = aiPlay(mirror(state), mem1, last2, blue)
    const m2 = aiPlay(state, mem2, last1, red)
    last1 = m1
    last2 = m2
    const r = playRound(state, m1, m2)
    state = r.state
    if (r.draw) return { state, outcome: 'draw', hpLoss: { p1: state.pen1, p2: state.pen2 }, rounds }
    const outcome = getOutcome(state)
    if (outcome) return { state, outcome, hpLoss: { p1: state.pen1, p2: state.pen2 }, rounds }
  }
  if (state.s1 === state.s2) {
    if (Math.random() < 0.5) state = { ...state, s1: state.s1 + 1 }
    else state = { ...state, s2: state.s2 + 1 }
  }
  return { state, outcome: state.s1 > state.s2 ? 'p1' : 'p2', hpLoss: { p1: state.pen1, p2: state.pen2 }, rounds: MAX_DUEL_ROUNDS }
}
