# Portfolio – Ousmane Barry

[![Tests du portfolio](https://github.com/barryo224/portfolio/actions/workflows/tests.yml/badge.svg)](https://github.com/barryo224/portfolio/actions/workflows/tests.yml)

Site personnel d'Ousmane Barry, étudiant en L3 MIASHS orienté **data engineering**.
En ligne : <https://ousmanebarry.alwaysdata.net/Portfolio/>

Site statique (HTML, CSS, JavaScript, Bootstrap 5.3) testé automatiquement :
**27 tests unitaires** (Node.js) et **22 tests d'intégration** exécutés dans de vrais
navigateurs (Playwright) : Chromium et WebKit (le moteur de Safari), sur ordinateur et sur mobile.

## Structure

```
site/                       ← le site, c'est ce dossier qu'on met en ligne
├── index.html              page du portfolio
├── portfolio_ousmane.html  ancienne adresse → redirige vers index.html
├── css/portfolio.css
├── js/portfolio.js         comportements (typewriter, apparition, menu)
└── ressources/             images, CV en PDF, image d'aperçu (og-image)
tests/
├── unit/                   tests unitaires des fonctions de portfolio.js
├── integration/            tests Playwright de la page complète
└── static-server.js        mini serveur local sans dépendance
playwright.config.js
.github/workflows/tests.yml  intégration continue (GitHub Actions)
```

## Lancer en local

```bash
npm install
npx playwright install chromium   # une seule fois
npm run serve                      # http://localhost:8080
```

## Tests

```bash
npm run test:unit          # fonctions JS isolées (node:test, sans navigateur)
npm run test:integration   # page complète dans Chromium, ordinateur + mobile
npm run test:safari        # même chose dans WebKit (Safari Mac + iPhone)
npm run test:all           # tous les navigateurs
npm test                   # unitaires + Chromium

# voir le navigateur pendant les tests :
npx playwright test --project=desktop --headed
# interface interactive (pas à pas, rejouer un test) :
npx playwright test --ui
```

Sur Mac, la première fois : `npx playwright install chromium webkit`.

Ce que vérifient les tests d'intégration :

- la page se charge sans erreur JavaScript ni fichier manquant ;
- toutes les images s'affichent et ont un texte alternatif ;
- le CV se télécharge bien en PDF, le lien e-mail est correct ;
- les liens externes s'ouvrent dans un nouvel onglet (`rel="noopener"`) ;
- les bibliothèques externes ont une version figée (jamais `@latest`) ;
- la navigation, le lien d'évitement et le menu mobile fonctionnent (le défilement
  attend que le menu mobile soit refermé, sinon il pouvait être annulé) ;
- aucun débordement horizontal, même sur un écran de 320 px ;
- l'option système « réduire les animations » est respectée ;
- **robustesse** : si un CDN tombe ou si le JavaScript ne charge pas,
  le contenu reste entièrement lisible ;
- l'ancienne adresse `portfolio_ousmane.html` redirige vers la nouvelle page.

> Hors connexion, `OFFLINE_CDN=1` remplace les CDN par des copies locales
> (`BOOTSTRAP_JS`, `BOOTSTRAP_CSS`) pour que les tests restent fiables.

## Mise en ligne sur alwaysdata

1. Mettre le CV à jour : remplacer `site/ressources/CV_Ousmane.pdf`
   par le dernier export PDF depuis Canva (garder exactement ce nom).
2. Se connecter à l'administration alwaysdata et ouvrir le dossier `www/Portfolio/`
   (gestionnaire de fichiers ou FTP avec FileZilla : `ftp-ousmanebarry.alwaysdata.net`).
3. Supprimer l'ancien contenu de `Portfolio/` (ancien `portfolio.css`,
   `portfolio.js`, anciennes images).
4. Envoyer **le contenu** du dossier `site/` dans `Portfolio/`.
5. Vérifier <https://ousmanebarry.alwaysdata.net/Portfolio/> et l'ancienne adresse
   <https://ousmanebarry.alwaysdata.net/Portfolio/portfolio_ousmane.html>.

## Choix techniques

- **Pas d'étape de compilation** : une seule page, déposée telle quelle sur alwaysdata.
- **Moins de dépendances** : AOS et `typewriter-effect@latest` ont été remplacés par
  ~60 lignes de JavaScript maison, testées. Seul Bootstrap reste sur CDN, en version figée.
- **JavaScript isolé par fonctionnalité** : une erreur dans une partie ne casse pas les autres.
- **Accessibilité** : lien d'évitement, focus visible, libellés ARIA, textes alternatifs,
  respect de « réduire les animations ».
- **Images optimisées** : 3,4 Mo → 0,6 Mo (redimensionnées et recompressées).
