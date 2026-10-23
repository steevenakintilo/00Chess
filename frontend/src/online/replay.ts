// Rejoue les événements publics d'une partie en ligne pour reconstruire l'état du jeu.
// Les deux joueurs rejouent exactement les mêmes événements avec le même code : ils obtiennent le même état.
// Convention : l'hôte est « p1 » (bleu, en bas), l'invité est « p2 » (rouge, en haut).
import {
  applyAction,
  applyDuelResult,
  finishRound,
  MAX_ROUNDS,
  UNLIMITED_ROUNDS,
  type Action,
  type GameState,
  type PlayerId,
} from '../utils/engine'
import {
  getOutcome,
  mirror,
  newGame,
  playRound,
  rewardFor,
  type Move,
  type Outcome,
  type State as DuelState,
} from '../utils/game007'
import type { Msg } from '../utils/msg'
import { newGameFor, type GameMode } from '../utils/rounds'

export type Side = 'host' | 'guest'
export type NetEvent = { seq: number; kind: string; payload: Record<string, unknown> }

export const playerOf = (side: Side): PlayerId => (side === 'host' ? 'p1' : 'p2')
export const sideOf = (p: PlayerId): Side => (p === 'p1' ? 'host' : 'guest')
export const otherSide = (s: Side): Side => (s === 'host' ? 'guest' : 'host')

export type DuelVerdict = Side | 'draw'
export type Trophies = Record<Side, number> // variation de trophées de chaque camp en fin de partie

export type OnlineGame = {
  started: boolean
  names: { host: string; guest: string }
  eng: GameState // état du plateau (canonique : hôte = p1)
  duel: DuelState // état du 007 en cours (canonique : hôte = p1)
  duelSpamDraw: boolean // duel nul parce que les deux joueurs ont spammé le bouclier
  duelVerdict: DuelVerdict | null // issue du duel en cours, dès que le calcul local la connaît
  lastReveal: { host: Move; guest: Move; msgHost: Msg | null; msgGuest: Msg | null } | null
  mode: GameMode // « winner » : le gagnant du duel joue ; « turns » : les deux jouent à chaque round
  actor: Side | null // qui joue en ce moment sur le plateau
  queue: Side[] // ceux qui joueront ensuite, dans le même round (tour par tour)
  over: null | { kind: 'game_over' | 'forfeit' | 'desync'; winner?: DuelVerdict; side?: Side; trophies?: Trophies; ranked?: boolean; replay?: string }
}

export function initialGame(): OnlineGame {
  return {
    started: false,
    names: { host: '', guest: '' },
    eng: newGameFor('winner'),
    duel: newGame(),
    duelSpamDraw: false,
    duelVerdict: null,
    lastReveal: null,
    mode: 'winner',
    actor: null,
    queue: [],
    over: null,
  }
}

const verdictOf = (o: Outcome): DuelVerdict | null => (o === 'p1' ? 'host' : o === 'p2' ? 'guest' : o === 'draw' ? 'draw' : null)
const outcomeOf = (v: DuelVerdict): Outcome => (v === 'host' ? 'p1' : v === 'guest' ? 'p2' : 'draw')

export function applyEvent(g: OnlineGame, e: NetEvent): OnlineGame {
  const p = e.payload as Record<string, never>
  switch (e.kind) {
    case 'start': {
      const mode: GameMode = p.mode === 'turns' || p.mode === 'onehp' ? p.mode : 'winner'
      return {
        ...initialGame(),
        started: true,
        names: { host: String(p.host), guest: String(p.guest) },
        mode,
        // « normal » : pas de limite de rounds ; « blitz » (et les anciennes parties) : 50 rounds
        eng: newGameFor(mode, p.pace === 'normal' ? UNLIMITED_ROUNDS : MAX_ROUNDS),
      }
    }

    case 'reveal': {
      const host = p.host as unknown as Move
      const guest = p.guest as unknown as Move
      const before = g.duel
      const r = playRound(before, host, guest)
      // message vu par chaque joueur : l'hôte tel quel, l'invité depuis son point de vue (état « miroir »)
      const msgGuest = playRound(mirror(before), guest, host).message
      const verdict = r.draw ? 'draw' : verdictOf(getOutcome(r.state))
      return {
        ...g,
        duel: r.state,
        duelSpamDraw: r.draw,
        duelVerdict: verdict,
        lastReveal: { host, guest, msgHost: r.message, msgGuest },
      }
    }

    case 'duel_end': {
      const verdict = p.outcome as unknown as DuelVerdict
      const outcome = outcomeOf(verdict)
      const rewards = { p1: rewardFor(g.duel, outcome, 'p1'), p2: rewardFor(g.duel, outcome, 'p2') }
      const hpLoss = { p1: g.duel.pen1, p2: g.duel.pen2 }
      let eng = applyDuelResult(g.eng, rewards, hpLoss, outcome)
      // qui joue après ce duel, dans l'ordre : c'est le serveur qui décide (selon le mode), tous les clients rejouent la même liste
      const actors = (p.actors as unknown as Side[] | undefined) ?? (verdict === 'draw' ? [] : [verdict])
      let actor: Side | null = null
      let queue: Side[] = []
      if (!eng.result) {
        if (actors.length === 0) eng = finishRound(eng)
        else {
          actor = actors[0]
          queue = actors.slice(1)
        }
      }
      return { ...g, eng, actor, queue, duel: newGame(), duelSpamDraw: false, duelVerdict: null, lastReveal: null }
    }

    case 'action': {
      const side = p.side as unknown as Side
      let eng = applyAction(g.eng, playerOf(side), p.action as unknown as Action)
      const reset = { duel: newGame(), duelSpamDraw: false, duelVerdict: null, lastReveal: null }
      if (eng.result) return { ...g, eng, actor: null, queue: [], ...reset }
      if (g.queue.length > 0) return { ...g, eng, actor: g.queue[0], queue: g.queue.slice(1), ...reset } // au suivant, dans le même round
      eng = finishRound(eng)
      return { ...g, eng, actor: null, queue: [], ...reset }
    }

    case 'game_over':
      return { ...g, over: { kind: 'game_over', winner: p.winner as unknown as DuelVerdict, trophies: p.trophies as unknown as Trophies, ranked: p.ranked as unknown as boolean, replay: p.replay as unknown as string } }
    case 'forfeit':
      return { ...g, over: { kind: 'forfeit', side: p.side as unknown as Side, trophies: p.trophies as unknown as Trophies, ranked: p.ranked as unknown as boolean, replay: p.replay as unknown as string } }
    case 'desync':
      return { ...g, over: { kind: 'desync' } }
    default:
      return g
  }
}

export const replay = (events: NetEvent[]): OnlineGame => events.reduce(applyEvent, initialGame())

// Vainqueur de la partie d'après l'état rejoué (null tant que la partie n'est pas finie).
export function winnerOf(g: OnlineGame): DuelVerdict | null {
  if (g.over?.kind === 'forfeit') return otherSide(g.over.side!)
  if (g.over?.kind === 'game_over') return g.over.winner ?? null
  if (g.eng.result) return g.eng.result.winner === 'draw' ? 'draw' : sideOf(g.eng.result.winner)
  return null
}
