export type ShopItem = {
  key: string // clé dans pieceImages (sans la couleur)
  price: number
  max: number
}

export const shopItems: ShopItem[] = [
  { key: 'Soldier', price: 10, max: 12 },
  { key: 'Sergeant', price: 50, max: 4 },
  { key: 'Archbishop', price: 150, max: 2 },
  { key: 'Berolina', price: 250, max: 1 },
  { key: 'Dabbaba', price: 200, max: 3 },
  { key: 'Duck', price: 500, max: 1 },
  { key: 'Wildebeest', price: 1000, max: 1 }, // Genkidama : 3 PV au roi adverse
]
