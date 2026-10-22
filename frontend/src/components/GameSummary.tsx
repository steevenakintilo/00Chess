import { pieceImages } from '../utils/pieces'
import { HP_VALUE, scoreBreakdown, type GameState, type PlayerId } from '../utils/engine'
import { useI18n } from '../i18n'

// Pièces mangées par chaque camp, comme aux échecs (affichées sous le plateau).
export function CapturedPieces({ game }: { game: GameState }) {
  const { t } = useI18n()
  const row = (p: PlayerId, title: string) => {
    const prefix = p === 'p1' ? 'Red' : 'Blue' // un camp mange les pièces de l'autre couleur
    const list = game.players[p].capturedPieces
    return (
      <div className="d-flex align-items-center gap-2" style={{ minHeight: 36 }}>
        <span className="small fw-bold text-nowrap">{title}</span>
        <div className="d-flex flex-wrap">
          {list.map((type, i) => (
            <img key={i} src={pieceImages[`${prefix}_${type}`]} alt={t(`piece.${type}`)} height={32} style={{ marginRight: -8 }} />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="container" style={{ maxWidth: 600 }}>
      {row('p1', t('cap.byBlue'))}
      {row('p2', t('cap.byRed'))}
    </div>
  )
}

// Détail du décompte final.
export function ScoreTable({ game, names }: { game: GameState; names: [string, string] }) {
  const { t } = useI18n()
  const a = scoreBreakdown(game, 'p1')
  const b = scoreBreakdown(game, 'p2')
  const line = (label: string, x: number, y: number, bold?: boolean) => (
    <tr className={bold ? 'fw-bold' : undefined}>
      <td className="text-start">{label}</td>
      <td>{x} $</td>
      <td>{y} $</td>
    </tr>
  )
  return (
    <table className="table table-sm mx-auto" style={{ maxWidth: 420 }}>
      <thead>
        <tr>
          <th></th>
          <th>{names[0]}</th>
          <th>{names[1]}</th>
        </tr>
      </thead>
      <tbody>
        {!game.infinite && line(t('score.money'), a.money, b.money)}
        {line(t('score.pieces'), a.pieces, b.pieces)}
        {line(t('score.eaten'), a.eaten, b.eaten)}
        {line(t('score.hp', { n: HP_VALUE }), a.hp, b.hp)}
        {line(t('score.total'), a.total, b.total, true)}
      </tbody>
    </table>
  )
}
