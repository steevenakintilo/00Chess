// Calcule la stratégie d'équilibre du duel 007 et l'écrit dans src/utils/ai007.table.ts.
// Lancer avec : npm run gen:ai007   (à refaire dès que les règles du 007 changent)
//
// Méthode : jeu à somme nulle à coups simultanés. Pour chaque situation (recharges des deux joueurs, bonus dépensés,
// séries de boucliers) on construit la matrice des gains (terminaux ou valeur de la situation suivante), on la résout
// par programmation linéaire, et on itère jusqu'à ce que les valeurs ne bougent plus (itération de valeurs).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mirror, playerMoves } from '../src/utils/game007'
import { ACT, CMAX, GAMMA, MOVES, NSTATES, edge, rulesSignature, stateFromKey, stateKey, type Edge } from '../src/utils/ai007'
import { gameExploitability, solveMatrixGame } from './matrixGame'

type Cell = Edge
type Node = { rows: number[]; cols: number[]; cells: Cell[][] } // rows/cols : indices dans MOVES

const nodes: Node[] = []
for (let key = 0; key < NSTATES; key++) {
  const st = stateFromKey(key)
  const rowMoves = playerMoves(st)
  const colMoves = playerMoves(mirror(st))
  nodes.push({
    rows: rowMoves.map(m => MOVES.indexOf(m)),
    cols: colMoves.map(m => MOVES.indexOf(m)),
    cells: rowMoves.map(r => colMoves.map(c => edge(st, r, c))),
  })
}

const V = new Float64Array(NSTATES)
const matrix = (node: Node, values: Float64Array): number[][] =>
  node.cells.map(row => row.map(e => ('terminal' in e ? e.terminal : GAMMA * values[e.next])))

console.log(`états : ${NSTATES} | ACT=${ACT} | GAMMA=${GAMMA} | CMAX=${CMAX}`)
let iter = 0
for (; iter < 5000; iter++) {
  let delta = 0
  for (let key = 0; key < NSTATES; key++) {
    const sol = solveMatrixGame(matrix(nodes[key], V))
    delta = Math.max(delta, Math.abs(sol.value - V[key]))
    V[key] = sol.value // Gauss-Seidel : on réutilise tout de suite la nouvelle valeur
  }
  if (iter % 20 === 0) console.log(`itération ${iter} : variation max ${delta.toExponential(2)}`)
  if (delta < 1e-9) break
}
console.log(`convergence après ${iter} itérations`)

// stratégies finales (joueur « ligne » = p1) + contrôles
let worstExploit = 0
let worstSym = 0
const strategies: number[][] = []
for (let key = 0; key < NSTATES; key++) {
  const node = nodes[key]
  const A = matrix(node, V)
  const sol = solveMatrixGame(A)
  worstExploit = Math.max(worstExploit, gameExploitability(A, sol), Math.abs(sol.value - V[key]))
  const full = new Array<number>(MOVES.length).fill(0)
  node.rows.forEach((mi, i) => (full[mi] = sol.x[i]))
  strategies.push(full)
}
// symétrie : la valeur d'une situation vue par l'autre joueur est l'opposée
for (let key = 0; key < NSTATES; key++) {
  const st = stateFromKey(key)
  const mk = stateKey(mirror(st))
  worstSym = Math.max(worstSym, Math.abs(V[key] + V[mk]))
}
console.log(`écart d'optimalité max par matrice : ${worstExploit.toExponential(2)} | écart de symétrie max : ${worstSym.toExponential(2)}`)

// quantification : 2 chiffres par coup, valeur en dixièmes de $ (3 chiffres hexa)
let data = ''
for (let key = 0; key < NSTATES; key++) {
  const probs = strategies[key].map(p => Math.min(99, Math.round(p * 100)))
  data += probs.map(p => String(p).padStart(2, '0')).join('')
  data += (Math.round(V[key] * 10) + 2048).toString(16).padStart(3, '0')
}

const signature = rulesSignature()
const out = `// Fichier généré par \`npm run gen:ai007\` : ne pas modifier à la main.
// Stratégie d'équilibre du duel 007 (voir src/utils/ai007.ts).
export const AI007_PARAMS = { signature: '${signature}' }
export const AI007_DATA =
  '${data}'
`
writeFileSync(fileURLToPath(new URL('../src/utils/ai007.table.ts', import.meta.url)), out)
const start = stateFromKey(0)
console.log(`table écrite (${data.length} caractères), signature ${signature}, valeur du duel de départ : ${V[0].toFixed(3)} $`)
void start
