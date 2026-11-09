# Transmission familiale

Simulateur de succession et de donation pour une famille : ventes immobilières, dons d'argent, démembrement, assurance-vie, protection du couple. Pour chaque scénario, l'outil chiffre les impôts (maintenant et aux successions) et donne la marche à suivre, étape par étape.

Droit français, France métropolitaine. Site statique, sans serveur ni dépendance : les données saisies restent dans le navigateur de l'utilisateur.

> Outil d'information. Les montants sont des estimations qui ne remplacent pas le conseil d'un notaire ou d'un avocat.

## Mettre en ligne sur GitHub Pages

Le déploiement est automatique à chaque envoi sur la branche, via `.github/workflows/pages.yml` (les tests tournent d'abord).

1. Dans le dépôt : **Settings → Pages → Source** : « GitHub Actions ».
2. **Settings → Environments → github-pages → Deployment branches and tags** : autoriser la branche qui porte le site (ou choisir « No restriction »).
3. Le site est à l'adresse `https://<compte>.github.io/fiscplanning/`.

GitHub Pages gratuit demande un dépôt public.

## Utiliser en local

Ouvrir `index.html` dans un navigateur suffit. Ou, pour servir le dossier :

```
python3 -m http.server 8000
```

## Organisation

| Fichier | Rôle |
| --- | --- |
| `js/loi.js` | Tous les chiffres de la loi (barèmes, abattements, taux). Seul fichier à modifier quand la loi change. |
| `js/calcul.js` | Moteur de calcul : plus-values, donations, successions, optimisation, conseils. |
| `js/guides.js` | Marches à suivre personnalisées et fiches explicatives. |
| `js/app.js` | Interface : questionnaire, scénarios, résultats. |
| `js/exemple.js` | Famille fictive pour la démonstration. |
| `tests/calcul.test.js` | Tests du moteur sur des cas calculés à la main. |

## Tests

```
node tests/calcul.test.js
```

## Mettre à jour après une loi de finances

Modifier les valeurs dans `js/loi.js` (et la date `dateMaj`), relancer les tests, puis relire les textes de `js/guides.js` qui citent des dates ou des dispositifs temporaires.

État du droit intégré : loi de finances pour 2026 et loi de financement de la sécurité sociale pour 2026.

## Ce que l'outil ne traite pas

Enfants d'unions différentes, pacte Dutreil, biens à l'étranger, donations graduelles ou résiduelles, exonération de plus-value des retraités modestes. Le détail des hypothèses figure dans l'onglet « Comprendre ».
