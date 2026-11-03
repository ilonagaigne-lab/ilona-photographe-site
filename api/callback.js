// Retour de GitHub après la connexion : échange le code contre un jeton et le transmet au back office.
// L'adresse de rappel à déclarer dans l'application OAuth GitHub est https://ilonagaigne.com/api/callback
const ORIGINE = 'https://ilonagaigne.com';

function page(res, statut, contenu) {
  // Le jeton n'est remis qu'à la fenêtre du back office, sur l'adresse officielle du site.
  const message = `authorization:github:${statut}:${JSON.stringify(contenu)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', 'decap_etat=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.status(200).send(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Connexion</title><body><p>Connexion en cours…</p><script>
(function () {
  var origine = ${JSON.stringify(ORIGINE)};
  var message = ${JSON.stringify(message).replace(/</g, '\\u003c')};
  if (!window.opener) { document.body.textContent = 'Fenêtre de connexion ouverte sans le back office. Revenez sur ' + origine + '/admin'; return; }
  window.addEventListener('message', function recu(e) {
    if (e.origin !== origine) return;
    window.removeEventListener('message', recu);
    window.opener.postMessage(message, origine);
    window.close();
  });
  window.opener.postMessage('authorizing:github', origine);
})();
</script></body></html>`);
}

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
