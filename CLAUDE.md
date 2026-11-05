# Ilona Photographe · règles du projet

Site d'Ilona, photographe et vidéaste équestre près de Toulouse : https://ilonagaigne.com. Objectif : un site ultra rapide qu'Ilona modifie seule depuis `/admin`. Joris (le père, product designer) pilote le projet ; il n'est pas développeur : réponses en français simple, décisions techniques prises pour lui, tout est testé avant d'être annoncé fini.

Équipe d'agents : `/ilona <demande>` (carte : `~/.claude/docs/ilona-agents.md`), contrôle final `/ilona-valider`.

## Commandes

```bash
npm run dev      # site en local
npm run build    # obligatoire avant de dire « c'est prêt »
npx decap-server # back office en local (local_backend: true)
```

Pas de tests automatiques ni de TypeScript strict : le build est le contrôle de base.

## Architecture

- **Astro 5 statique**, CSS maison (`src/styles/global.css`), aucune librairie d'interface. Polices locales `@fontsource` (Anton, Poppins).
- **Pages** : `src/pages/*.astro` (accueil, séances, concours, marques, galerie, réservation, trouver-ma-seance (quiz), étude de cas GaloPlan, académie, journal, 404). `sitemap.xml.ts` et `llms.txt.ts` sont générés.
- **Contenus** : `src/contenu/*.json` (réglages communs : prestations, contact, agenda, témoignages, FAQ, galoplan) et `src/contenu/pages/*.json` (un fichier par page). Mis en forme par `src/data.ts` et `src/lib/contenu.ts` :
  - `photo(chemin)` : chemin saisi dans le back office → image optimisée ; les photos vivent dans `src/assets/photos/`.
  - `surligne()` / `lignes()` : `*mot*` = mot surligné en rose, retour à la ligne = nouvelle ligne.
  - `cadrage()` : cadrage choisi dans le back office → `object-position`.
- **Back office** : Decap CMS, `public/admin/config.yml` (un seul fichier, une entrée par page sous « Pages du site », ancres YAML `&champs-photo`, `&champs-video` réutilisées), habillage `public/admin/admin.css`, connexion GitHub via `api/auth.js` + `api/callback.js`. Chaque enregistrement = un commit sur `main` = mise en ligne.
- **Fonctions Vercel** : `api/demande.js` envoie les demandes par e-mail (Resend), avec repli vers la messagerie du visiteur (`src/scripts/mail.js`).
- **Scripts navigateur** : `src/scripts/site.js` (animations, curseur, obturateur), `distance.js` (distance par la route, API Géoplateforme IGN), `soleil.js` (heure dorée).
- **Composants** : `Photo.astro` (toute photo passe par lui), `Reel.astro` (vidéo), `Prix.astro`, `Coeur.astro` (favori), `Instagram.astro` (flux Behold réglé dans le back office).
- Vidéos dans `public/videos/`, cache 7 jours ; `_astro/` en cache immuable (`vercel.json`).

## Maquettes de référence

- Canevas Claude Design : https://claude.ai/artifact/Kb1yEwkLx6JpCSkUgZzBfe (planche de style + 10 écrans, ordinateur 1440 px et téléphone 390 px).
- Export lisible sur le Mac de Joris : `~/iCloud Drive (archives)/Documents/Pro/Coding/ilona-photographe-design/` : `index.html` (sommaire), `ecrans/<Écran>-Desktop.html` et `-Mobile.html` (Accueil, Seances, Concours, Marques, EtudeDeCas, Galerie, Reservation, Lecon, Article, Menu, 404), `ecrans/Main.html` (planche de style), `sources/*.dc.html`.
- Le site en ligne est allé plus loin que les maquettes (parcours de conversion, quiz, back office) : **quand les deux diffèrent, le code actuel fait foi**. Les maquettes servent de référence pour la charte, les animations et tout écran pas encore codé.

## Charte « Surligner l'instant »

- Variables de `global.css`, jamais de couleur en dur : `--gres` #ECEBE7 → `--gres-chaud` #E9DCC6 au fil du scroll, `--encre` #222222, `--rose` #E79CC2 (surlignage, prix sur fond sombre), `--rose-profond` #9E3A6C (tout texte rose sur fond clair), `--or` #E8BE3C (vidéo uniquement), `--pervenche` #A8ABF5 (réseaux sociaux uniquement).
- **Le rose #E79CC2 n'est jamais une couleur de texte sur fond clair.**
- Titres Anton en capitales, géants ; texte Poppins ; listes en Poppins Light italique ; cartes encre rayon 16 px, ombre `--ombre` ; prix en Anton rose.
- Mise en page éditoriale, photos plein cadre, beaucoup d'air. Le surlignage est le seul geste : titres, favoris, lien actif.
- Galerie et galerie client : photos **entières**, jamais recadrées.

## Animations

- Seulement `transform` et `opacity` (jamais `width`, `top`, `filter` animés).
- Toujours une version `prefers-reduced-motion: reduce` (voir fin de `global.css` et `calme` dans `site.js`).
- Courbes `--declic` et `--lumiere` ; transition « obturateur » : 200 ms de fermeture puis 200 ms d'ouverture ; curseur contextuel (Voir / Lecture / Choisir).

## Qualité exigée

- PageSpeed mobile **95 minimum** (mesuré 98 à 100), accessibilité 100, bonnes pratiques 100, SEO 100.
- Contrastes AA, navigation clavier complète, focus visible, `alt` utile sur chaque photo (saisi dans le back office).
- Pas de saut de mise en page : ratio fixé sur chaque photo (`ratio` de `Photo.astro`), photo du haut en `prioritaire`.
- Aucune nouvelle dépendance sans raison forte ; jamais de librairie d'animation lourde.
- Audit UX de référence : `docs/audit-ux-nielsen.md`.

## Back office : tout est modifiable par Ilona

- Tout texte, photo, vidéo, prix, adresse ou lien visible sur le site vient d'un JSON de `src/contenu/` **et** a son champ dans `config.yml`. Rien en dur dans les pages.
- Un prix n'existe qu'à un endroit (`prestations.json`) et se propage partout : pages, réservation, quiz, FAQ, données structurées, `llms.txt`.
- Chaque champ a un libellé et une aide (`hint`) en français simple, avec un exemple « Ex. : … ».
- Bloc vide dans le back office = bloc masqué sur le site (jamais de case d'exemple affichée).

## Textes

- Français, vouvoiement. Guillemets « », espace avant `: ; ! ?`, apostrophe typographique ’.
- **Aucune fausse information, aucun chiffre ni avis inventé.** Ce qui manque est demandé à Ilona, pas imaginé.
- Aucune tournure d'IA : pas de « ce n'est pas X, c'est Y », pas de tiret long « — », pas de superlatifs (« le meilleur », « unique »), pas de listes de trois adjectifs, pas de formules creuses.
- Vocabulaire cavalier juste (pré, paddock, robe, frontal, concours, DP).
- Adresse e-mail affichée au public : uniquement `ilonagaigne@gmail.com` (l'expéditeur technique `RESEND_FROM`, ex. contact@ilonagaigne.com, n'est jamais affiché). Instagram : @ilona_photographe_.
- « TTC » (présent aujourd'hui sur Séances et dans `llms.txt`) : à confirmer selon le statut TVA d'Ilona. En micro-entreprise sans TVA, on écrit « TVA non applicable, art. 293 B du CGI ». Ne pas en ajouter de nouveaux d'ici là.

## SEO et GEO

- Cible : séances photo équestres à Toulouse, Haute-Garonne et alentours.
- Chaque page : `title` et `description` uniques, canonique sans barre finale, image de partage, fil d'Ariane sur les pages profondes.
- Nouvelle page publique → ajoutée à `sitemap.xml.ts` et à `llms.txt.ts` ; page privée → `noindex` et absente des deux.
- Données structurées (activité, personne, FAQ, articles, fil d'Ariane) cohérentes avec les vrais prix et contenus.

## Sécurité

- **Le dépôt GitHub est public** (il doit le rester, sinon Vercel bloque les commits de Joris). Aucune clé, aucun jeton, aucun mot de passe dans le code ni dans les docs.
- Secrets uniquement dans les variables Vercel : `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `RESEND_API_KEY` (`RESEND_FROM` à créer une fois le domaine vérifié chez Resend ; `DEMANDES_TO` facultative : adresse qui reçoit les demandes, `ilonagaigne@gmail.com` par défaut).
- Aucun vrai e-mail envoyé pour tester sans l'accord de Joris.

## Mise en ligne

- `git push` sur `main` = déploiement automatique sur Vercel (compte d'Ilona, équipe « iloetroc »). Vercel uniquement, jamais d'autre hébergeur.
- Relancer un déploiement : commit vide puis push ; état : `gh api repos/ilonagaigne-lab/ilona-photographe-site/commits/HEAD/statuses`.
- **Jamais de commit ni de push sans l'accord de Joris.** Messages de commit courts, en français, sans ligne « Co-Authored-By ».
- Conductor : chaque chantier a son propre workspace (installation automatique, boutons « dev » et « preview » sur `$CONDUCTOR_PORT`, voir `.conductor/settings.toml`). Captures d'écran et fichiers de travail dans le `.context/` du workspace, jamais dans le dossier iCloud.

## Reste à faire connu

- Mentions légales (obligatoires, absentes).
- Domaine vérifié chez Resend, puis `RESEND_FROM` (accusé de réception au visiteur).
- Redirection `www` → domaine nu.
- À fournir par Ilona : témoignages, contenu détaillé des formules, agenda des concours, chiffres de l'étude de cas GaloPlan, statut TVA.
