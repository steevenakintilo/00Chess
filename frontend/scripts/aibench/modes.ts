// Le meilleur joueur de 007 gagne-t-il plus souvent dans chaque mode de jeu ?
// Même IA sur le plateau des deux côtés (Normal) ; seul le niveau de 007 change : npx tsx scripts/aibench/modes.ts [parties]
import { Pool, pct } from './pool'
import type { BotSpec } from './games'

const games = Number(process.argv[2] ?? 600)
const pool = new Pool()
const duel = (d: 'easy' | 'normal' | 'hard'): BotSpec => ({ kind: 'split', board: 'normal', duel: d })
for (const gm of ['winner', 'turns'] as const) {
  console.log(`--- mode « ${gm} » (${games} parties, plateau Normal des deux côtés, vrais duels 007)`)
  for (const [na, a, nb, b] of [
    ['007 Difficile', duel('hard'), '007 Normal', duel('normal')],
    ['007 Normal', duel('normal'), '007 Facile', duel('easy')],
    ['007 Normal', duel('normal'), '007 Normal', duel('normal')],
  ] as const) {
    const r = await pool.match(a, b, games, 'real', 50, gm)
    console.log(`${na.padEnd(14)} vs ${nb.padEnd(11)} : ${pct(r.winA)} - ${pct(r.winB)} (nuls ${pct(r.draw)}) | écart de score ${r.diff.toFixed(0).padStart(5)}`)
  }
}
await pool.close()
