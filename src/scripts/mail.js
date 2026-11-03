// Pas de serveur : la demande s'ouvre dans la messagerie du visiteur, déjà rédigée, adressée à Ilona.
export function ouvrirMail(destinataire, sujet, lignes) {
  const corps = lignes.filter(Boolean).join('\n');
  location.href = `mailto:${destinataire}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

// Envoie la demande au serveur (Resend). Renvoie true si elle est bien partie.
export async function envoyerDemande(donnees) {
  try {
    const r = await fetch('/api/demande', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(donnees) });
    return r.ok && (await r.json()).ok === true;
  } catch {
    return false;
  }
}

// Transforme les champs nommés d'un formulaire en lignes « Libellé : valeur ».
export function lignesDuFormulaire(form) {
  const lignes = [];
  for (const champ of form.querySelectorAll('[name]')) {
    if ((champ.type === 'checkbox' || champ.type === 'radio') && !champ.checked) continue;
    const valeur = champ.type === 'checkbox' ? 'oui' : champ.value.trim();
    if (!valeur) continue;
    lignes.push(`${champ.dataset.libelle || champ.name} : ${valeur}`);
  }
  return lignes;
}
