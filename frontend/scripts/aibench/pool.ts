import { fork, type ChildProcess } from 'node:child_process'
import os from 'node:os'
import type { BotSpec, DuelMode, MatchResult } from './games'
import type { GameMode } from '../../src/utils/rounds'

// Répartit des parties sur tous les cœurs : chaque worker joue un morceau du match.
export class Pool {
  private workers: ChildProcess[]
  constructor(size = Math.max(1, os.cpus().length - 2)) {
    this.workers = Array.from(
      { length: size },
      () => fork(new URL('./worker.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), [], { execArgv: ['--import', 'tsx'] })
    )
  }

  get size() {
    return this.workers.length
  }

  async match(a: BotSpec, b: BotSpec, games: number, mode: DuelMode, maxRounds = 50, gameMode: GameMode = 'winner'): Promise<MatchResult & { winA: number; winB: number; draw: number }> {
    const per = Math.ceil(games / this.workers.length)
    const jobs = this.workers.map(
      (w, i) =>
        new Promise<MatchResult>((resolve, reject) => {
          const onError = (e: Error) => reject(e)
          w.once('error', onError)
          w.once('message', m => {
            w.off('error', onError)
            resolve(m as MatchResult)
          })
          w.send({ a, b, n: per, mode, maxRounds, firstSwap: i % 2 === 1, gameMode })
        })
    )
    const parts = await Promise.all(jobs)
    const total: MatchResult = { winsA: 0, winsB: 0, draws: 0, diff: 0, kingKills: 0, n: 0 }
    for (const p of parts) {
      total.winsA += p.winsA
      total.winsB += p.winsB
      total.draws += p.draws
      total.diff += p.diff
      total.kingKills += p.kingKills
      total.n += p.n
    }
    return { ...total, diff: total.diff / total.n, winA: total.winsA / total.n, winB: total.winsB / total.n, draw: total.draws / total.n }
  }

  async close() {
    for (const w of this.workers) w.kill()
  }
}

export const pct = (x: number) => (100 * x).toFixed(1).padStart(5) + '%'
