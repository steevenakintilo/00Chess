// Compare les niveaux de l'IA entre eux.
//   npx tsx scripts/aibench/cli.ts [parties par duel de niveaux] [coin|real|007]
//   - coin : parties complètes, le gagnant de chaque duel 007 est tiré à pile ou face (mesure la qualité du plateau seule)
//   - real : parties complètes avec de vrais duels 007 entre IA (mesure tout)
//   - 007  : duels 007 seuls (séries de 40 duels : l'IA Difficile apprend tes habitudes d'un duel à l'autre)
import { Pool, pct } from './pool'
import { hardWith, level, randomBot, rusherBot, type BotSpec } from './games'
import { simulateDuel, type Level } from '../../src/utils/aiLevels'
import { HARD_BOARD } from '../../src/utils/aiBoard'
import { newAiMemory } from '../../src/utils/game007'

const games = Number(process.argv[2] ?? 400)
const mode = (process.argv[3] ?? 'coin') as 'coin' | 'real' | '007'

if (mode === '007') {
  const names: Record<Level, string> = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' }
  const pairs: [Level, Level][] = [['normal', 'normal'], ['easy', 'normal'], ['hard', 'normal'], ['hard', 'easy'], ['hard', 'hard']]
  const SERIES = 40
  console.log(`007 seul : ${games} duels par couple de niveaux (séries de ${SERIES} duels, couleurs alternées)`)
  for (const [a, b] of pairs) {
    let winsA = 0
    let money = 0
    let n = 0
    for (let s = 0; s < Math.ceil(games / SERIES); s++) {
      const mem = { blue: newAiMemory(), red: newAiMemory() }
      for (let d = 0; d < SERIES; d++) {
        const swap = d % 2 === 1
        const r = swap ? simulateDuel(b, a, mem) : simulateDuel(a, b, mem)
        const aWon = (r.outcome === 'p1') !== swap
        if (r.outcome !== 'draw' && aWon) winsA++
        n++
      }
    }
    money += 0
    console.log(`${names[a].padEnd(10)} vs ${names[b].padEnd(10)} : ${pct(winsA / n)} - ${pct(1 - winsA / n)}`)
  }
  process.exit(0)
}

const pool = new Pool()
const hard: BotSpec = hardWith(HARD_BOARD)
const pairs: [string, BotSpec, string, BotSpec][] = [
  ['Normal', level('normal'), 'Normal', level('normal')],
  ['Facile', level('easy'), 'Normal', level('normal')],
  ['Difficile', hard, 'Normal', level('normal')],
  ['Difficile', hard, 'Facile', level('easy')],
  ['Normal', level('normal'), 'hasard', randomBot],
  ['hasard', randomBot, 'Facile', level('easy')],
  ['offensif', rusherBot, 'Facile', level('easy')],
  ['offensif', rusherBot, 'Normal', level('normal')],
  ['offensif', rusherBot, 'Difficile', hard],
]
console.log(`${games} parties par couple de niveaux, duels 007 : ${mode}, ${pool.size} workers`)
for (const [na, a, nb, b] of pairs) {
  const t0 = Date.now()
  const r = await pool.match(a, b, games, mode)
  console.log(
    `${na.padEnd(10)} vs ${nb.padEnd(10)} : ${pct(r.winA)} - ${pct(r.winB)} (nuls ${pct(r.draw)}) | écart de score ${r.diff.toFixed(0).padStart(5)} | rois tués ${pct(r.kingKills / r.n)} | ${((Date.now() - t0) / 1000).toFixed(0)} s`
  )
}
await pool.close()
