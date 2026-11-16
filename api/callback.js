// Retour de GitHub après la connexion : échange le code contre un jeton et le transmet au back office.
// L'adresse de rappel à déclarer dans l'application OAuth GitHub est https://ilonagaigne.com/api/callback
import { pageJeton as page } from './_lib/connexion.js';

export default async function handler(req, res) {
  const { code, state } = req.query;
  const cookie = /(?:^|;\s*)decap_etat=([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (!code || !state || !cookie || cookie[1] !== state) {
    return page(res, 'error', { message: 'Connexion expirée ou invalide. Réessayez depuis /admin.' });
  }
  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
    });
    const donnees = await r.json();
    if (!donnees.access_token) throw new Error(donnees.error_description || 'pas de jeton');
    return page(res, 'success', { token: donnees.access_token, provider: 'github' });
  } catch (e) {
    console.error(e);
    return page(res, 'error', { message: 'GitHub a refusé la connexion. Réessayez.' });
  }
}
