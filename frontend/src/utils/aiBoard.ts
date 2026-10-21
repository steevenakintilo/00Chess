// Niveaux de difficulté de l'IA sur le plateau (Facile / Normal / Difficile).
//  - Normal : l'IA historique (engine.ts) : elle simule chaque action possible et garde la meilleure position.
//  - Facile : mêmes idées, mais avec beaucoup de hasard et de coups « gentils » : une IA que les débutants battent.
//  - Difficile : regarde aussi la meilleure réponse de l'adversaire (recherche à deux coups) avant de choisir.
import {
  NORMAL_WEIGHTS,
  applyAction,
  actionBonus,
  chooseAction,
  evaluate,
  legalActions,
  other,
  type Action,
  type AiWeights,
  type GameState,
  type PlayerId,
} from './engine'
import type { Level } from './aiLevels'

// ------------------------------------------------------------------ Facile

// Réglé par simulation (scripts/aibench) : l'IA Facile bat à peine plus souvent qu'un joueur qui clique au hasard
// (~70 % des parties contre un joueur au hasard) et perd presque toujours contre l'IA Normal.
export const EASY_BOARD = {
  passChance: 0.2, // il lui arrive de ne rien faire
  randomChance: 0.5, // il lui arrive de jouer n'importe quoi
  noise: 200, // sinon il choisit la meilleure action... à ± ce bruit près
  kamikazeChance: 0.5, // il ne pense pas toujours à se sacrifier sur le roi adverse
}

const gauss = () => {
  let u = 0
  while (u === 0) u = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random())
}

// Le Facile ne se sert ni de la Tsar Bomba, ni de la reine, ni du swap : trois choses compliquées pour un débutant.
const isAdvanced = (a: Action) => a.kind === 'swap' || (a.kind === 'buy' && (a.item === 'Duck' || a.item === 'Berolina'))

function easyAction(s: GameState, me: PlayerId): Action {
  const actions = legalActions(s, me).filter(a => !isAdvanced(a))
  const r = Math.random()
  if (r < EASY_BOARD.passChance) return { kind: 'pass' }
  const pool = actions.filter(a => a.kind !== 'kamikaze' || Math.random() < EASY_BOARD.kamikazeChance)
  if (pool.length === 0) return { kind: 'pass' }
  if (r < EASY_BOARD.passChance + EASY_BOARD.randomChance) return pool[Math.floor(Math.random() * pool.length)]
  let best = pool[0]
  let bestScore = -Infinity
  for (const a of pool) {
    const v = evaluate(applyAction(s, me, a), me) + EASY_BOARD.noise * gauss()
    if (v > bestScore) {
      bestScore = v
      best = a
    }
  }
  return best
}

// ------------------------------------------------------------------ Difficile

export type HardBoardConfig = {
  weights: AiWeights // poids de l'évaluation (réglés par simulation, voir scripts/)
  lookahead: boolean // regarde aussi la meilleure réponse de l'adversaire (recherche à deux coups)
  topK: number // nombre d'actions candidates examinées en profondeur
  foeActsChance: number // chance que l'adversaire joue juste après moi (il doit gagner le duel 007)
}

// Réglages de l'IA Difficile, trouvés par simulation (scripts/aibench) : c'est surtout la valeur des snipes qui compte.
// Un snipe restant vaut 60 au lieu de 8 : l'IA ne gaspille plus ses 6 snipes sur des soldats à 10 $, elle les garde
// pour les généraux, les chefs et les récolteurs (en parties simulées contre l'IA Normal : ~77 % de victoires,
// contre ~50 % avec les poids de Normal).
export const HARD_BOARD: HardBoardConfig = {
  weights: { ...NORMAL_WEIGHTS, snipe: 60 },
  lookahead: true,
  topK: 8,
  foeActsChance: 0.5,
}

// Réponses de l'adversaire qui peuvent changer la partie tout de suite : manger, sniper, se sacrifier, bombe.
function dangerousReplies(s: GameState, foe: PlayerId): Action[] {
  const out: Action[] = [{ kind: 'pass' }]
  for (const a of legalActions(s, foe)) {
    if (a.kind === 'kamikaze' || a.kind === 'snipe') out.push(a)
    else if (a.kind === 'move' && s.board[a.to.r][a.to.c]) out.push(a)
    else if (a.kind === 'buy' && (a.item === 'Duck' || (a.to && s.board[a.to.r][a.to.c]))) out.push(a)
  }
  return out
}

export function hardActionWith(s: GameState, me: PlayerId, cfg: HardBoardConfig): Action {
  const w = cfg.weights
  if (!cfg.lookahead) return chooseAction(s, me, false, w)
  const foe = other(me)
  const scored = legalActions(s, me).map(a => {
    const after = applyAction(s, me, a)
    const raw = evaluate(after, me, w)
    const bonus = actionBonus(s, me, a, w)
    return { a, after, raw, bonus, v1: raw + bonus }
  })
  scored.sort((x, y) => y.v1 - x.v1)
  let best = scored[0]
  let bestValue = -Infinity
  for (const c of scored.slice(0, cfg.topK)) {
    let value = c.raw
    if (!c.after.result) {
      // pire réponse possible de l'adversaire
      let worst = Infinity
      for (const reply of dangerousReplies(c.after, foe)) {
        worst = Math.min(worst, evaluate(applyAction(c.after, foe, reply), me, w))
      }
      value = (1 - cfg.foeActsChance) * c.raw + cfg.foeActsChance * worst
    }
    value += c.bonus + Math.random() * 0.5
    if (value > bestValue) {
      bestValue = value
      best = c
    }
  }
  return best.a
}

// ------------------------------------------------------------------ point d'entrée

export function chooseActionLevel(s: GameState, me: PlayerId, level: Level): Action {
  if (level === 'easy') return easyAction(s, me)
  if (level === 'hard') return hardActionWith(s, me, HARD_BOARD)
  return chooseAction(s, me)
}

// Tour de l'IA : une seule action (acheter et poser, déplacer, sniper, swap, suicide, ou passer).
export function playTurnLevel(
  state: GameState,
  me: PlayerId,
  level: Level = 'normal'
): { state: GameState; actions: Action[] } {
  const a = chooseActionLevel(state, me, level)
  return { state: applyAction(state, me, a), actions: a.kind === 'pass' ? [] : [a] }
}
