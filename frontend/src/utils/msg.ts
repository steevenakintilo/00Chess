// Message traduisible : une clé de dictionnaire + des paramètres.
// Un paramètre qui commence par "@" est lui-même une clé à traduire (ex. "@pl.Soldier").
export type Msg = { k: string; p?: Record<string, string | number> }
