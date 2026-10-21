// Parties complètes IA contre IA, pour mesurer la force des niveaux (utilisé par bench.ts et ses workers).
import {
  applyAction,
  applyDuelResult,
  finishRound,
  kingPos,
  legalActions,
  piecesOf,
  newGameState,
  type Pos,
  score,
  type Action,
  type GameState,
  type PlayerId,
} from '../../src/utils/engine'
import { EASY_BOARD, HARD_BOARD, hardActionWith, chooseActionLevel, type HardBoardConfig } from '../../src/utils/aiBoard'
import { simulateDuel, type Level } from '../../src/utils/aiLevels'
import { newAiMemory, rewardFor } from '../../src/utils/game007'
import { actorsAfterDuel, type GameMode } from '../../src/utils/rounds'

// Un joueur de test : un niveau d'IA, une IA « Difficile » avec réglages personnalisés, ou un joueur au hasard.
export type BotSpec =
  | { kind: 'level'; level: Level }
  | { kind: 'hard'; config: HardBoardConfig }
  | { kind: 'random' }
  | { kind: 'easy'; config: Partial<typeof EASY_BOARD> } // IA Facile avec réglages personnalisés (essais)
  | { kind: 'split'; board: Level; duel: Level } // niveau de plateau et niveau de 007 différents (mesure l'effet du 007 seul)
  | { kind: 'rusher' } // joueur offensif : envoie des soldats sur le roi adverse pour le tuer (suicides)
export type DuelMode = 'coin' | 'real' // coin : le gagnant du duel est tiré à pile ou face (mesure la qualité du plateau seule)

export const level = (l: Level): BotSpec => ({ kind: 'level', level: l })
export const hardWith = (config: HardBoardConfig): BotSpec => ({ kind: 'hard', config })
export const randomBot: BotSpec = { kind: 'random' }
export const rusherBot: BotSpec = { kind: 'rusher' }

// Joueur « rush » : se sacrifie sur le roi dès qu'il le peut, sinon avance ses soldats vers le roi adverse, sinon en achète.
function rusherAction(g: GameState, who: PlayerId): Action {
  const acts = legalActions(g, who)
  const kami = acts.find(a => a.kind === 'kamikaze')
  if (kami) return kami
  const target = kingPos(g, who === 'p1' ? 'p2' : 'p1')
  let best: Action | null = null
  let bestD = Infinity
  for (const a of acts) {
    if (a.kind !== 'move') continue
    const piece = g.board[a.from.r][a.from.c]
    if (!piece || piece.type !== 'Soldier') continue
    const d = dist(a.to, target)
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  // on avance un soldat si possible ; sinon on en achète un ; sinon on passe
  const buy = acts.find(a => a.kind === 'buy' && a.item === 'Soldier')
  const nearest = piecesOf(g, who).filter(x => x.piece.type === 'Soldier').length
  if (buy && (!best || nearest < 3)) return buy
  return best ?? buy ?? { kind: 'pass' }
}

function chooseBoard(g: GameState, who: PlayerId, bot: BotSpec): Action {
  if (bot.kind === 'rusher') return rusherAction(g, who)
  if (bot.kind === 'easy') {
    Object.assign(EASY_BOARD, bot.config)
    return chooseActionLevel(g, who, 'easy')
  }
  if (bot.kind === 'random') {
    const acts = legalActions(g, who)
    return acts[Math.floor(Math.random() * acts.length)]
  }
  if (bot.kind === 'hard') return hardActionWith(g, who, bot.config)
  if (bot.kind === 'split') return chooseActionLevel(g, who, bot.board)
  return chooseActionLevel(g, who, bot.level)
}

const level007 = (bot: BotSpec): Level =>
  bot.kind === 'level' ? bot.level : bot.kind === 'hard' ? 'hard' : bot.kind === 'easy' ? 'easy' : bot.kind === 'split' ? bot.duel : 'normal'
const dist = (a: Pos, b: Pos) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c)

export function playGame(blue: BotSpec, red: BotSpec, mode: DuelMode, maxRounds = 50, gameMode: GameMode = 'winner') {
  let g = newGameState(maxRounds)
  const memories = { blue: newAiMemory(), red: newAiMemory() }
  while (!g.result) {
    let outcome: 'p1' | 'p2' | 'draw'
    let rewards: { p1: number; p2: number }
    let hpLoss = { p1: 0, p2: 0 }
    if (mode === 'coin') {
      outcome = Math.random() < 0.5 ? 'p1' : 'p2'
      rewards = { p1: outcome === 'p1' ? 30 : 5, p2: outcome === 'p2' ? 30 : 5 }
    } else {
      const d = simulateDuel(level007(blue), level007(red), memories)
      outcome = d.outcome as 'p1' | 'p2' | 'draw'
      rewards = { p1: rewardFor(d.state, d.outcome, 'p1'), p2: rewardFor(d.state, d.outcome, 'p2') }
      hpLoss = d.hpLoss
    }
    g = applyDuelResult(g, rewards, hpLoss, outcome)
    if (!g.result) {
      for (const who of actorsAfterDuel(gameMode, outcome, g.round)) {
        if (g.result) break
        g = applyAction(g, who, chooseBoard(g, who, who === 'p1' ? blue : red))
      }
    }
    if (!g.result) g = finishRound(g)
  }
  const reason = g.result.reason.k
  return { winner: g.result.winner, diff: score(g, 'p1') - score(g, 'p2'), queens: g.players.p1.bought.Berolina + g.players.p2.bought.Berolina, kingKill: reason === 'end.myKing' || reason === 'end.foeKing' }
}

export type MatchResult = { winsA: number; winsB: number; draws: number; diff: number; kingKills: number; n: number }

// n parties entre A et B, en alternant les couleurs ; `firstSwap` décale l'alternance quand on répartit les parties entre workers.
export function playMatch(
  a: BotSpec,
  b: BotSpec,
  n: number,
  mode: DuelMode,
  maxRounds = 50,
  firstSwap = false,
  gameMode: GameMode = 'winner'
): MatchResult {
  const r: MatchResult = { winsA: 0, winsB: 0, draws: 0, diff: 0, kingKills: 0, n }
  for (let i = 0; i < n; i++) {
    const swap = (i % 2 === 1) !== firstSwap
    const res = swap ? playGame(b, a, mode, maxRounds, gameMode) : playGame(a, b, mode, maxRounds, gameMode)
    if (res.winner === 'draw') r.draws++
    else if ((res.winner === 'p1') !== swap) r.winsA++
    else r.winsB++
    r.diff += swap ? -res.diff : res.diff
    if (res.kingKill) r.kingKills++
  }
  return r
}

export const defaultHard = () => HARD_BOARD
