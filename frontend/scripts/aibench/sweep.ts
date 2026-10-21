// Essaie plusieurs réglages d'un coup : npx tsx scripts/aibench/sweep.ts '<base json>' '<liste json de modifs>' [lookahead] [parties] [coin|real]
import { Pool, pct } from './pool'
import { hardWith, level } from './games'
import { NORMAL_WEIGHTS } from '../../src/utils/engine'

const base = JSON.parse(process.argv[2] ?? '{}')
const list: Record<string, unknown>[] = JSON.parse(process.argv[3] ?? '[{}]')
const lookahead = (process.argv[4] ?? 'false') === 'true'
const games = Number(process.argv[5] ?? 960)
const mode = (process.argv[6] ?? 'coin') as 'coin' | 'real'
const pool = new Pool(Number(process.env.WORKERS ?? 22))
console.log(`base ${JSON.stringify(base)} | lookahead=${lookahead} | ${games} parties (${mode}) contre Normal`)
for (const patch of list) {
  const { _cfg, ...w } = patch as { _cfg?: object } & Record<string, unknown>
  const cfg = { weights: { ...NORMAL_WEIGHTS, ...base, ...w }, lookahead, topK: 8, foeActsChance: 0.5, ...(_cfg ?? {}) }
  const r = await pool.match(hardWith(cfg as never), level('normal'), games, mode)
  console.log(`${JSON.stringify(patch).padEnd(44)} => ${pct(r.winA)} - ${pct(r.winB)} | écart de score ${r.diff.toFixed(0).padStart(5)}`)
}
await pool.close()
