// Code partagé de la connexion au back office (le « _ » empêche Vercel d'en faire une adresse).
// Page qui remet le jeton au back office Decap, utilisée par api/callback.js (GitHub) et api/auth.js (mot de passe).
export const ORIGINE = 'https://ilonagaigne.com';

export function pageJeton(res, statut, contenu) {
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
