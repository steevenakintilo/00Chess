# 00Chess

![00Chess](frontend/public/banner_00chess_1500x500.png)

Jeu de stratégie à deux joueurs qui mélange **échecs**, **tower defense** (Bloons) et **007** (le petit duel pierre-feuille-ciseaux à base de charges, tirs et boucliers). Jouable en solo contre l'IA, en IA contre IA, ou en ligne avec un ami. Site : [play00chess.com](https://www.play00chess.com).

## Le jeu

- Plateau 8×8, un roi par camp dans un coin. Le roi ne bouge pas : c'est une base à protéger.
- Chaque round commence par un **007** : les deux joueurs choisissent en secret *charger / tirer / bouclier* (et des coups spéciaux avec beaucoup de charges). Le duel rapporte de l'argent.
- Ensuite, **une seule action** par joueur (selon le mode) : acheter et placer une pièce, la déplacer, sniper, swap, se sacrifier ou passer.
- Les pièces se jouent en pierre-feuille-ciseaux inégal : soldat > chef, général > soldat, chef > général. S'y ajoutent le collecteur d'impôts (revenu), Bérolina (soigne le roi), le Gnou (−3 PV d'un coup) et le Canard (Tsar Bomba, détruit tout).
- Victoire : tuer le roi adverse, priver l'adversaire de pièces d'attaque, ou avoir fait le plus de dégâts / être le plus riche à la limite de rounds.

Modes : **winner** (le gagnant du duel joue), **turns** (tour par tour), **onehp** (rois à 1 PV), **classic** (sans 007). Rythmes : **blitz** (50 rounds max) ou **normal**.

Les règles complètes sont dans l'app (bouton *Règles*) et dans [frontend/src/i18n/](frontend/src/i18n/).

## Architecture

```
frontend/   React 19 + TypeScript + Vite (Bootstrap)    → Vercel
backend/    Django 5.2 + DRF + PostgreSQL (gunicorn)    → Railway
```

**Frontend**
- Moteur de jeu 100 % côté client ([engine.ts](frontend/src/utils/engine.ts), [game007.ts](frontend/src/utils/game007.ts)) : règles, IA et rendu partagés par tous les modes.
- **IA à 3 niveaux** : facile (hasard), normal (heuristique + apprentissage des habitudes au 007), difficile (stratégie d'équilibre du 007 précalculée dans [ai007.table.ts](frontend/src/utils/ai007.table.ts) + recherche à 1 coup sur le plateau). Benchmarks par simulation : `npm run bench:ai`. Détails dans [frontend/README.md](frontend/README.md).
- i18n FR/EN maison, replays, comptes, sons.

**Backend**
- API REST (DRF) : comptes (`accounts`), salles et parties en ligne (`lobby`).
- Le serveur est **arbitre** : il gère l'ordre des phases (lobby → duel → action → fin), **cache le coup de 007** de chacun tant que les deux n'ont pas joué, et diffuse un journal d'événements numérotés (`GameEvent`) que chaque client rejoue.
- **Anti-triche** : les règles sont rejouées chez chaque joueur et le serveur vérifie que les deux comptes rendus concordent avant de valider un résultat.
- Synchronisation par polling, détection de déconnexion (30 s) avec réclamation de victoire, salles supprimées après 1 h d'inactivité, parties terminées stockées pour le **replay** via un code partageable.

## Lancer en local

```bash
# Backend (Postgres requis)
cd backend
cp .env.example .env
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver        # http://localhost:8000

# Frontend
cd frontend
cp .env.example .env              # VITE_API_URL=http://localhost:8000
npm install
npm run dev                       # http://localhost:5173
```

Autres commandes front : `npm run build`, `npm run lint`, `npm run smoke` (rend toutes les pages FR/EN), `npm run gen:ai007` (à relancer si les règles du 007 changent).

## Licence

Voir [LICENSE](LICENSE).
