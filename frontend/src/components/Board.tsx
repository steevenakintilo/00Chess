import { useI18n } from '../i18n'
import { pieceImages } from '../utils/pieces'
import plateau from '../assets/game_asset/plateau_8x8.svg'
import { SIZE, posKey, type GameState, type Piece, type Pos } from '../utils/engine'

export type HighlightKind = 'place' | 'move' | 'capture' | 'snipe' | 'swap'

const COLORS: Record<HighlightKind, string> = {
  place: 'rgba(25, 135, 84, 0.5)',
  move: 'rgba(25, 135, 84, 0.5)',
  capture: 'rgba(220, 53, 69, 0.55)',
  snipe: 'rgba(253, 126, 20, 0.6)',
  swap: 'rgba(111, 66, 193, 0.55)',
}

function pieceImage(game: GameState, piece: Piece): string {
  const color = piece.owner === 'p1' ? 'Blue' : 'Red'
  if (piece.type === 'King') {
    const hp = Math.min(Math.max(game.players[piece.owner].hp, 1), 5)
    return pieceImages[`${color}_Chariot_${hp}hp`]
  }
  return pieceImages[`${color}_${piece.type}`]
}

type Props = {
  game: GameState
  highlights?: Map<string, { kind: HighlightKind }>
  selected?: Pos | null
  clickable?: boolean
  onCellClick?: (r: number, c: number) => void
}

export default function Board({ game, highlights, selected, clickable, onCellClick }: Props) {
  const { t } = useI18n()
  const gridSize = `${(360 / 390) * 100}%`
  return (
    <div className="position-relative" style={{ width: 'min(100%, 85vh, 600px)', aspectRatio: '1 / 1' }}>
      <img src={plateau} alt={t('board.alt')} className="w-100 h-100" />
      <div
        className="position-absolute"
        style={{
          left: `${(28 / 390) * 100}%`,
          top: `${(2 / 390) * 100}%`,
          width: gridSize,
          height: gridSize,
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${SIZE}, 1fr)`,
        }}
      >
        {game.board.flatMap((row, r) =>
          row.map((piece, c) => {
            const h = highlights?.get(posKey({ r, c }))
            const isSelected = selected && selected.r === r && selected.c === c
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => onCellClick?.(r, c)}
                style={{
                  cursor: clickable ? 'pointer' : 'default',
                  background: h ? COLORS[h.kind] : undefined,
                  outline: isSelected ? '3px solid #ffc107' : undefined,
                  outlineOffset: -3,
                }}
              >
                {piece && <img src={pieceImage(game, piece)} alt={t(`piece.${piece.type}`)} className="w-100 h-100" />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
