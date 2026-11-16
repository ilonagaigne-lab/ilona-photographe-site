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
- **Back office** : Decap CMS, `public/admin/config.yml` (un seul fichier, une entrée par page sous « Pages du site », ancres YAML `&champs-photo`, `&champs-video` réutilisées), habillage `public/admin/admin.css`, connexion par `api/auth.js` : **compte d'Ilona par mot de passe** (`ADMIN_MOT_DE_PASSE`, 12 caractères au moins ; le bon mot de passe remet au back office le jeton GitHub limité au dépôt `ADMIN_JETON_GITHUB`, limite de 5 essais par adresse et par quart d'heure) ou le lien « Accès de Joris (GitHub) » (`api/callback.js`, OAuth) ; sans ces deux réglages, la page envoie directement vers GitHub. Le bouton de Decap affiche « Se connecter » grâce à un petit script de `public/admin/index.html` (et son icône est masquée dans `admin.css`) : il dépend des noms de classes de Decap 3.17.1, à revérifier si Decap change de version. Page de transmission du jeton partagée : `api/_lib/connexion.js`. Chaque enregistrement = un commit sur `main` = mise en ligne.
- **Fonctions Vercel** : `api/demande.js` envoie les demandes par e-mail (Resend), avec repli vers la messagerie du visiteur (`src/scripts/mail.js`).
- **Galeries clients privées** (« projets » dans l'espace d'Ilona : un dossier par client) : une galerie par client, lien secret `https://ilonagaigne.com/photos/<id>` (id de 22 caractères aléatoires, page `src/pages/galerie-privee.astro`). Les photos vivent dans **Vercel Blob** sous `galeries/<id>/(originaux|vues|miniatures)/<12 caractères aléatoires>/<nom>` (le hasard est dans un dossier pour que le fichier téléchargé garde son vrai nom ; `vues` 2048 px et `miniatures` 800 px sont fabriquées dans le navigateur d'Ilona), jamais dans le dépôt. La fiche (titre, mode, `tri`, photos, sélection et message du client) est rangée à part, à un chemin impossible à deviner sans le secret du serveur : `fiches/<HMAC-SHA256 de l'id avec la clé des galeries, 32 caractères>.json`. Code partagé : `api/_lib/galeries.js` (lecture/écriture de la fiche, liste, suppression, expiration, mot de passe). Fonctions d'Ilona : `api/galeries.js` (liste, création, modification, suppression) et `api/galeries-envoi.js` (autorisation d'envoi direct vers Blob, limitée à `galeries/<id>/(originaux|vues|miniatures)/<12 caractères>/<nom>`), toutes deux réservées aux personnes qui peuvent écrire dans le dépôt (jeton GitHub du back office vérifié auprès de GitHub, `permissions.push`). Page d'Ilona : `/admin/galeries` (`src/pages/admin/galeries.astro`, `noindex`, bouton « Projets clients » dans le back office). Fonctions publiques : `api/galerie.js` et `api/galerie-selection.js`. Textes communs de la page client : « Galerie privée (textes) » dans `/admin` (`src/contenu/pages/galerie-privee.json`). Les galeries expirent toutes seules à la date choisie (`ttlDays`). Les fiches sont toujours relues fraîches (`head` puis lecture avec un paramètre unique, car le CDN garde 60 s les fichiers publics). Les adresses des photos restent publiques (impossibles à deviner) : quelqu'un qui a déjà vu une galerie garde ces adresses même après l'ajout d'un mot de passe, d'où le conseil de mettre le mot de passe avant d'envoyer le lien.
  **Clé des galeries** : le chemin des fiches et la signature des accès utilisent `GALERIES_CLE` si elle existe, sinon `GITHUB_CLIENT_SECRET`, sinon `BLOB_READ_WRITE_TOKEN` (`clesGalerie()`, `api/_lib/galeries.js`). Quiconque calculerait le chemin d'une fiche contournerait le mot de passe, d'où une clé qui ne sert qu'à cela. Migration sans perte : `lireGalerie` cherche la fiche au chemin de la clé actuelle puis à ceux des autres clés ; `ecrireGalerie` écrit toujours au chemin actuel et supprime les anciens ; `supprimerGalerie` les supprime tous ; `listerGaleries` ne renvoie qu'une fois chaque galerie (la plus récente, `majLe`). **Ne jamais régénérer ni changer `GITHUB_CLIENT_SECRET` (ni `GALERIES_CLE`) sans avoir d'abord créé `GALERIES_CLE` avec l'ancienne valeur** : sinon les fiches sont introuvables et les accès donnés aux clients sont refusés. Changer la clé invalide aussi tous les accès (les clients ressaisissent le mot de passe).
  **Mot de passe facultatif** : la fiche porte `"protection": null` (lien seul, défaut) ou `{ "sel": "<16 octets base64url>", "empreinte": "<scrypt(mot de passe NFC sans espaces aux bords, sel, 32 octets) base64url>", "version": <entier> }`, jamais le mot de passe en clair. Il fait de 4 à 64 caractères. Fonctions partagées : `estProtegee(galerie)`, `definirProtection(galerie, motDePasse)` et `verifierMotDePasse(galerie, motDePasse)` (asynchrones : `await`), `retirerProtection(galerie)`, `creerAcces(galerie)`, `accesValide(galerie, jeton)`, `sansSecrets(galerie)`. `api/galeries.js` (POST) : `motDePasse` définit ou change (400 si invalide), `retirerMotDePasse: true` retire, sans l'un ni l'autre la protection est conservée ; ses réponses ne contiennent jamais `sel`, `empreinte` ni `protection`, seulement `protegee: true|false` (aussi dans la liste). Accès du client : jeton `expiration.version.signature` (HMAC avec la clé, couvre l'id, la version et le sel ; 30 jours), envoyé dans l'en-tête `X-Galerie-Acces` ; changer ou retirer le mot de passe l'invalide. Côté client (`api/galerie.js`) : galerie protégée sans accès = 401 `{ ok: false, protegee: true, titre }` ; `POST { id, motDePasse }` = galerie + `acces` ; mauvais mot de passe = 401 après une seconde, 5 échecs par adresse et par galerie par quart d'heure = 429 ; `api/galerie-selection.js` refuse (401) sans accès. Dans `/admin/galeries` : bloc « Accès à la galerie » (lien seul ou lien + mot de passe ; changer ou retirer enregistre tout de suite) et pastille « Mot de passe » dans la liste. Textes de l'écran client : groupe `protection` de `galerie-privee.json`. Tests hors dépôt (`.context/tests/` du workspace Conductor du chantier) : `galeries-protection.test.mjs` (clé, migration, liste sans doublon, mot de passe, réponses sans secret) ; le serveur de test `serveur-galerie.mjs` simule la galerie `TestProtegee0000000001` (mot de passe : voir le fichier de test) avec ces mêmes fonctions.
  **Ordre des photos** : champ `tri` de la fiche, `"date"` (défaut, y compris pour les anciennes fiches) ou `"nom"` ; chaque photo porte `prise` (`"AAAA-MM-JJTHH:MM:SS"`, heure de l'appareil sans fuseau, ou `null`), lue dans le navigateur d'Ilona (DateTimeOriginal 0x9003, puis DateTime 0x0132, puis date de modification du fichier ; lecteur maison `src/scripts/projets-photos.js`, début du fichier seulement). Une seule règle de tri, `trierPhotos` (`api/_lib/tri.js`, exportée par `api/_lib/galeries.js`) : par date croissante, à égalité ou sans date par nom, sans date à la fin ; par nom en ordre naturel (`IMG_2` avant `IMG_10`). `api/galeries.js` enregistre la fiche **déjà triée** et recalcule les numéros de `selection.photos` (repérés par l'adresse `original`) quand l'ordre ou la liste change ; `api/galerie.js` trie aussi à la lecture. `tri` invalide = 400, `prise` invalide = `null`. La page d'Ilona garde une copie de la règle dans `src/scripts/projets-photos.js` : toute modification se fait aux deux endroits (un test hors dépôt, `.context/tests/exif-prise.test.mjs` du workspace Conductor du chantier, les compare).
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
- Secrets uniquement dans les variables Vercel : `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_MOT_DE_PASSE` (mot de passe d'Ilona), `ADMIN_JETON_GITHUB` (jeton GitHub « fine-grained » créé depuis le compte propriétaire du dépôt, limité à ce dépôt, « Contents » en lecture et écriture ; à renouveler avant sa date d'expiration), `BLOB_READ_WRITE_TOKEN` (créée toute seule quand on relie un magasin Blob au projet ; lue par `@vercel/blob`), `GALERIES_CLE` (facultative : clé des galeries, voir plus haut ; à créer avec la valeur actuelle de `GITHUB_CLIENT_SECRET` avant tout changement de celle-ci), `RESEND_API_KEY` (`RESEND_FROM` à créer une fois le domaine vérifié chez Resend ; `DEMANDES_TO` facultative : adresse qui reçoit les demandes, `ilonagaigne@gmail.com` par défaut).
- **Les photos des clients ne vont jamais dans le dépôt** (ni dans `src/assets/photos/`, ni dans `public/`, ni dans un JSON) : uniquement dans Vercel Blob, par `/admin/galeries`. Aucun nom de client ni lien de galerie dans le code ou les docs.
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
