// Résolution d'un jeu matriciel à somme nulle par programmation linéaire (simplexe).
// Le joueur "ligne" maximise ; A[i][j] = gain de la ligne quand la ligne joue i et la colonne joue j.
export type GameSolution = { value: number; x: number[]; y: number[] }

export function solveMatrixGame(A: number[][]): GameSolution {
  const m = A.length
  const n = A[0].length
  let min = Infinity
  for (const row of A) for (const v of row) min = Math.min(min, v)
  const shift = 1 - min // toutes les valeurs deviennent >= 1, donc la valeur du jeu est > 0

  // max sum(z) sous B z <= 1, z >= 0  (B = A + shift) ; la valeur de B vaut 1 / sum(z)
  const W = n + m + 1
  const T: number[][] = []
  for (let i = 0; i < m; i++) {
    const row = new Array<number>(W).fill(0)
    for (let j = 0; j < n; j++) row[j] = A[i][j] + shift
    row[n + i] = 1
    row[W - 1] = 1
    T.push(row)
  }
  const obj = new Array<number>(W).fill(0)
  for (let j = 0; j < n; j++) obj[j] = -1
  T.push(obj)
  const basis = Array.from({ length: m }, (_, i) => n + i)

  for (let iter = 0; iter < 500; iter++) {
    let e = -1
    for (let j = 0; j < W - 1; j++) {
      if (T[m][j] < -1e-10) {
        e = j // règle de Bland : on évite les cycles
        break
      }
    }
    if (e < 0) break
    let l = -1
    let best = Infinity
    for (let i = 0; i < m; i++) {
      if (T[i][e] > 1e-10) {
        const ratio = T[i][W - 1] / T[i][e]
        if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[l])) {
          best = ratio
          l = i
        }
      }
    }
    if (l < 0) throw new Error('simplexe non borné (impossible avec une matrice positive)')
    const p = T[l][e]
    for (let j = 0; j < W; j++) T[l][j] /= p
    for (let i = 0; i <= m; i++) {
      if (i === l) continue
      const f = T[i][e]
      if (Math.abs(f) < 1e-14) continue
      for (let j = 0; j < W; j++) T[i][j] -= f * T[l][j]
    }
    basis[l] = e
  }

  const total = T[m][W - 1]
  const vB = 1 / total
  const y = new Array<number>(n).fill(0)
  for (let i = 0; i < m; i++) if (basis[i] < n) y[basis[i]] = T[i][W - 1] * vB
  const x = new Array<number>(m)
  for (let i = 0; i < m; i++) x[i] = Math.max(0, T[m][n + i]) * vB
  // renormalisation (erreurs d'arrondi)
  const sx = x.reduce((a, b) => a + b, 0)
  const sy = y.reduce((a, b) => a + b, 0)
  return { value: vB - shift, x: x.map(v => v / sx), y: y.map(v => v / sy) }
}

// Vérifie l'optimalité : aucune ligne ne gagne plus que `value` contre y, aucune colonne ne fait perdre moins que `value` contre x.
export function gameExploitability(A: number[][], sol: GameSolution): number {
  const m = A.length
  const n = A[0].length
  let rowBest = -Infinity
  for (let i = 0; i < m; i++) {
    let v = 0
    for (let j = 0; j < n; j++) v += A[i][j] * sol.y[j]
    rowBest = Math.max(rowBest, v)
  }
  let colBest = Infinity
  for (let j = 0; j < n; j++) {
    let v = 0
    for (let i = 0; i < m; i++) v += A[i][j] * sol.x[i]
    colBest = Math.min(colBest, v)
  }
  return rowBest - colBest // 0 si (x, y) est un équilibre
}
