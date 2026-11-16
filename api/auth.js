// Connexion au back office (/admin). Deux façons d'entrer :
//   1. le compte d'Ilona : un mot de passe, sans compte GitHub à gérer de son côté ;
//   2. « Accès de Joris (GitHub) », comme avant.
// Le bouton de Decap dit « Se connecter » (renommé par un script de public/admin/index.html).
// Réglages dans Vercel (Settings → Environment Variables), jamais dans le code :
//   ADMIN_MOT_DE_PASSE    mot de passe d'Ilona (12 caractères au moins, sinon la connexion par mot de passe reste fermée)
//   ADMIN_JETON_GITHUB    jeton GitHub « fine-grained » limité au dépôt du site (Contents : lecture et écriture),
//                         remis au back office quand le mot de passe est bon
//   GITHUB_CLIENT_ID      identifiant de l'application OAuth GitHub (connexion GitHub)
//   GITHUB_CLIENT_SECRET  secret de cette application (utilisé par api/callback.js)
// Sans ADMIN_MOT_DE_PASSE ni ADMIN_JETON_GITHUB, la page envoie directement vers GitHub, comme avant.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { pageJeton } from './_lib/connexion.js';

const LONGUEUR_MIN = 12;
const ESSAIS = 5; // mots de passe faux par adresse IP et par fenêtre
const FENETRE = 15 * 60 * 1000;
const PAUSE_ECHEC = 1000; // ms d'attente après un mauvais mot de passe

// Limite par IP, en mémoire : freine un robot sur une même instance. La vraie limite globale se règle dans
// le pare-feu Vercel (Firewall > Rate limiting sur /api/auth).
const echecs = new Map();
function bloquee(ip) {
  const maintenant = Date.now();
  for (const [cle, t] of echecs) if (maintenant - t.debut > FENETRE) echecs.delete(cle);
  const t = echecs.get(ip);
  return Boolean(t && t.n >= ESSAIS);
}
function noterEchec(ip) {
  const t = echecs.get(ip) ?? { debut: Date.now(), n: 0 };
  t.n += 1;
  echecs.set(ip, t);
}

const empreinte = (t) => createHash('sha256').update(String(t).normalize('NFC')).digest();
const memeMotDePasse = (saisi, attendu) => timingSafeEqual(empreinte(saisi), empreinte(attendu));
const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function compteActif() {
  const mdp = process.env.ADMIN_MOT_DE_PASSE || '';
  return mdp.length >= LONGUEUR_MIN && Boolean(process.env.ADMIN_JETON_GITHUB);
}

function versGitHub(res) {
  const id = process.env.GITHUB_CLIENT_ID;
  if (!id) return res.status(503).send('Connexion indisponible : GITHUB_CLIENT_ID manquant.');
  // Jeton à usage unique, vérifié au retour de GitHub (protège contre les connexions forcées).
  const etat = randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `decap_etat=${etat}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const params = new URLSearchParams({ client_id: id, scope: 'repo,user', state: etat });
  return res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}

function formulaire(res, statut, erreur = '') {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(statut).send(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Connexion · Ilona Photographe</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">
<style>
  /* Mêmes couleurs et police que le back office (public/admin/admin.css ; --danger comme dans /admin/galeries). */
  :root { --fond: #f6f6f8; --surface: #fff; --texte: #17171c; --doux: #6b6b76; --accent: #9e3a6c; --accent-fonce: #842f5a; --accent-pale: #fbeef4; --danger: #a12a2a; --ombre-haute: 0 8px 24px rgba(16, 16, 24, .08), 0 2px 6px rgba(16, 16, 24, .05); }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(1200px 600px at 50% -10%, var(--accent-pale) 0%, var(--fond) 60%); color: var(--texte); font: 16px/1.5 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }
  main { width: 100%; max-width: 380px; background: var(--surface); border-radius: 20px; padding: 32px 28px; box-shadow: var(--ombre-haute); }
  h1 { margin: 0 0 4px; font-size: 24px; }
  p { margin: 0 0 20px; }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  input { width: 100%; font: inherit; padding: 12px 14px; border: 1px solid var(--doux); border-radius: 10px; }
  .cache { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  button { width: 100%; margin-top: 16px; font: inherit; font-weight: 600; padding: 12px 14px; border: 0; border-radius: 10px; background: var(--accent); color: var(--surface); cursor: pointer; }
  button:hover { background: var(--accent-fonce); }
  input:focus-visible, button:focus-visible, a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .erreur { color: var(--danger); font-weight: 600; margin: 12px 0 0; }
  .autre { margin: 24px 0 0; font-size: 14px; text-align: center; color: var(--doux); }
  .autre a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>Bonjour Ilona</h1>
  <p>Entrez votre mot de passe pour ouvrir votre espace.</p>
  <form method="post" action="/api/auth">
    <input class="cache" name="identifiant" type="text" autocomplete="username" value="ilona" tabindex="-1" aria-hidden="true" readonly>
    <label for="mdp">Mot de passe</label>
    <input id="mdp" name="mot_de_passe" type="password" autocomplete="current-password" required autofocus${erreur ? ' aria-describedby="erreur" aria-invalid="true"' : ''}>
    ${erreur ? `<p class="erreur" id="erreur" role="alert">${echapper(erreur)}</p>` : ''}
    <button type="submit">Se connecter</button>
  </form>
  <p class="autre"><a href="/api/auth?github=1">Accès de Joris (GitHub)</a></p>
</main>
</body>
</html>`);
}

function lireMotDePasse(req) {
  const b = req.body;
  if (b && typeof b === 'object') return String(b.mot_de_passe ?? '');
  if (typeof b === 'string') return new URLSearchParams(b).get('mot_de_passe') ?? '';
  return '';
}

export default async function handler(req, res) {
  if (!compteActif() || req.query?.github) return versGitHub(res);

  if (req.method === 'GET') return formulaire(res, 200);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Méthode non autorisée.');
  }

  // Le formulaire vient toujours de cette page : un envoi annoncé par un autre site est refusé.
  const origine = req.headers.origin;
  if (origine && origine !== `https://${req.headers.host}`) return formulaire(res, 403, 'Connexion refusée. Rouvrez le back office et réessayez.');

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
  // Adresse tronquée dans les journaux : 3 premiers nombres en IPv4, 3 premiers blocs en IPv6.
  const ipCourte = ip.includes(':') ? `${ip.split(':').slice(0, 3).join(':')}:…` : ip.replace(/\.[^.]*$/, '.x');
  if (bloquee(ip)) {
    console.warn(`Connexion admin bloquée (trop d'essais) : ${ipCourte}`);
    return formulaire(res, 429, 'Trop d’essais. Attendez un quart d’heure avant de réessayer.');
  }

  const saisi = lireMotDePasse(req).slice(0, 200);
  if (!saisi || !memeMotDePasse(saisi, process.env.ADMIN_MOT_DE_PASSE)) {
    noterEchec(ip);
    console.warn(`Connexion admin : mot de passe incorrect (${ipCourte})`);
    await new Promise((ok) => setTimeout(ok, PAUSE_ECHEC));
    return formulaire(res, 401, 'Mot de passe incorrect. Vérifiez les majuscules et réessayez.');
  }

  return pageJeton(res, 'success', { token: process.env.ADMIN_JETON_GITHUB, provider: 'github' });
}
