# 00Chess (front)

## IA : niveaux de difficulté

Trois niveaux, choisis avec les boutons **Facile / Normal / Difficile** (page « Moi contre l'IA », entraînement 007,
et un niveau par IA sur la page « IA contre IA »). Un niveau règle deux choses : le **007** et les **décisions sur le plateau**.

| Niveau | 007 (`src/utils/aiLevels.ts`, `ai007.ts`) | Plateau (`src/utils/aiBoard.ts`) |
|---|---|---|
| Facile | coups au hasard avec des goûts de débutant (1 coup sur 10 « intelligent ») | beaucoup de hasard et de coups « à côté », ne se sert pas de la Tsar Bomba, de la reine ni du swap |
| Normal | l'IA historique : elle apprend tes habitudes pendant chaque duel | l'IA historique (`chooseAction` dans `engine.ts`) |
| Difficile | stratégie d'**équilibre** précalculée (impossible à exploiter) + elle retient tes habitudes toute la partie | garde ses snipes pour des cibles de valeur (généraux, chefs, récolteurs) et regarde ta meilleure réponse avant de jouer |

Force mesurée par simulation (`npm run bench:ai`, couleurs alternées) :

| Duel | 007 seul | Partie complète, duels 007 à pile ou face (plateau seul) |
|---|---|---|
| Difficile contre Normal | ~74 % | ~75 % |
| Normal contre Facile | ~80 % | ~96 % |
| Normal contre Normal | ~50 % | ~50 % |

En vraie partie, c'est surtout le 007 qui décide : l'IA Difficile gagne ~73 % des duels contre l'IA Normal, donc elle joue bien plus souvent sur le plateau.

### Commandes

- `npm run gen:ai007` : recalcule `src/utils/ai007.table.ts` (la table d'équilibre du 007). **À relancer dès que tu changes les règles du 007**
  (points, argent, limite de boucliers, recharges...). Si la table est périmée, l'IA Difficile joue comme Normal et la console du navigateur
  (mode dev) te le dit.
- `npm run bench:ai [parties] [coin|real]` : fait jouer les niveaux les uns contre les autres et affiche les pourcentages de victoire
  (`coin` : le gagnant de chaque duel 007 est tiré à pile ou face, pour mesurer le plateau seul ; `real` : vrais duels 007 entre IA).
- `npm run smoke` : rend toutes les pages en français et en anglais et vérifie qu'il n'y a ni erreur ni texte non traduit.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
