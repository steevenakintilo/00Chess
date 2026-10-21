import { playMatch, type BotSpec, type DuelMode } from './games'
import type { GameMode } from '../../src/utils/rounds'

export type Task = { a: BotSpec; b: BotSpec; n: number; mode: DuelMode; maxRounds: number; firstSwap: boolean; gameMode: GameMode }

process.on('message', (t: Task) => {
  process.send!(playMatch(t.a, t.b, t.n, t.mode, t.maxRounds, t.firstSwap, t.gameMode))
})
