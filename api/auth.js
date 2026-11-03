// Connexion au back office (/admin) : envoie vers GitHub pour s'identifier.
// Réglages dans Vercel (Settings → Environment Variables), jamais dans le code :
//   GITHUB_CLIENT_ID      identifiant de l'application OAuth GitHub
//   GITHUB_CLIENT_SECRET  secret de cette application (utilisé par api/callback.js)
import { randomBytes } from 'node:crypto';

export default function handler(req, res) {
  const id = process.env.GITHUB_CLIENT_ID;
  if (!id) return res.status(503).send('Connexion indisponible : GITHUB_CLIENT_ID manquant.');

  // Jeton à usage unique, vérifié au retour de GitHub (protège contre les connexions forcées).
  const etat = randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `decap_etat=${etat}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

  const params = new URLSearchParams({ client_id: id, scope: 'repo,user', state: etat });
  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
