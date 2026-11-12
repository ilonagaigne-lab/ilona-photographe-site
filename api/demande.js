// Reçoit une demande (réservation ou projet de marque) et l'envoie à Ilona par e-mail avec Resend.
// Réglages dans Vercel (Settings → Environment Variables), jamais dans le code :
//   RESEND_API_KEY  clé Resend (obligatoire)
//   DEMANDES_TO     adresse qui reçoit les demandes (par défaut ilonagaigne@gmail.com)
//   RESEND_FROM     expéditeur sur le domaine vérifié, ex. « Ilona Photographe <contact@ilonagaigne.com> ».
//                   Tant qu'il n'est pas défini, Resend n'autorise que son adresse de test et aucun
//                   accusé de réception n'est envoyé au visiteur.

const TYPES = { reservation: 'Réservation', marque: 'Projet de marque' };
const LIMITE = 4000; // caractères pour toute la demande
const LIMITE_LIGNE = 1500;
// Une fonction Vercel s'arrête à 10 s. Tout le traitement tient dans BUDGET : si elle était coupée après l'envoi
// à Ilona, le visiteur basculerait sur sa messagerie et Ilona recevrait la demande en double.
const BUDGET = 8500; // ms depuis l'arrivée de la demande : la réponse est partie avant
const DELAI = 6000; // ms maximum pour l'envoi principal : au-delà, on renonce et le visiteur passe par sa messagerie
const DELAI_ACCUSE = 3000; // ms maximum pour l'accusé de réception
const RESTE_ACCUSE = 1200; // ms : sous ce temps restant, on n'envoie pas l'accusé
const DELAI_MIN = 2500; // ms : une réservation remplie plus vite que ça par un humain n'existe pas
const ESSAIS = 5; // demandes par adresse IP et par fenêtre
const FENETRE = 10 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Limite par IP, en mémoire : freine un robot sur une même instance. La vraie limite globale se règle dans
// le pare-feu Vercel (Firewall > Rate limiting sur /api/demande).
const passages = new Map();
function tropDeDemandes(ip) {
  const maintenant = Date.now();
  for (const [cle, t] of passages) if (maintenant - t.debut > FENETRE) passages.delete(cle);
  const t = passages.get(ip) ?? { debut: maintenant, n: 0 };
  t.n += 1;
  passages.set(ip, t);
  return t.n > ESSAIS;
}

const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function envoyer(cle, message, delai = DELAI) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(delai),
  });
  if (!r.ok) throw new Error(`Resend ${r.status} : ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

export default async function handler(req, res) {
  const debut = Date.now();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  // Une demande légitime vient toujours de ce site (domaine, www ou aperçu Vercel) : l'origine doit être l'hôte
  // même qui reçoit la requête, ce qui refuse tout autre site sans liste à entretenir.
  // Sans en-tête Origin, on accepte : un navigateur l'envoie toujours sur un POST, donc son absence vient d'un
  // outil en ligne de commande ou d'un robot, que la limite par IP, le délai minimum et le champ piège arrêtent.
  // Si le navigateur annonce lui-même une requête d'un autre site, on refuse même sans Origin.
  const origine = req.headers.origin;
  if (origine) {
    let hote = '';
    try { hote = new URL(origine).host.toLowerCase(); } catch { /* origine illisible : refusée plus bas */ }
    if (!hote || hote !== String(req.headers.host || '').toLowerCase()) return res.status(403).json({ ok: false, erreur: 'Demande refusée.' });
  } else if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).json({ ok: false, erreur: 'Demande refusée.' });
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
  if (tropDeDemandes(ip)) return res.status(429).json({ ok: false, erreur: 'Trop de demandes, réessayez dans quelques minutes.' });
  const cle = process.env.RESEND_API_KEY;
  if (!cle) return res.status(503).json({ ok: false, erreur: 'Envoi indisponible pour le moment.' });

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch { corps = null; } }
  if (!corps || typeof corps !== 'object') return res.status(400).json({ ok: false, erreur: 'Demande illisible.' });

  // Champ piège invisible : rempli uniquement par les robots.
  if (corps.site_web) return res.status(200).json({ ok: true });
  // Réservation envoyée moins de 2,5 s après l'ouverture de la page : c'est un robot (réponse neutre).
  // Champ absent (page ouverte avant une mise à jour) : on refuse proprement, le visiteur passe par sa messagerie.
  if (corps.type === 'reservation') {
    if (typeof corps.ecoule !== 'number') return res.status(400).json({ ok: false, erreur: 'Rechargez la page puis réessayez.' });
    if (corps.ecoule < DELAI_MIN) return res.status(200).json({ ok: true });
  }

  const type = typeof corps.type === 'string' && Object.hasOwn(TYPES, corps.type) ? corps.type : null;
  const email = String(corps.email || '').trim();
  // Pas de retour à la ligne dans le nom : il sert de sujet à l'e-mail.
  const nom = String(corps.nom || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  const lignes = Array.isArray(corps.lignes) ? corps.lignes.map((l) => String(l).trim().slice(0, LIMITE_LIGNE)).filter(Boolean).slice(0, 30) : [];
  if (!type || !nom || email.length > 254 || !EMAIL.test(email)) {
    return res.status(400).json({ ok: false, erreur: 'Merci de vérifier votre nom et votre e-mail.' });
  }
  if (!lignes.length || lignes.join('\n').length > LIMITE) {
    return res.status(400).json({ ok: false, erreur: 'Complétez votre demande ou raccourcissez-la, puis réessayez.' });
  }

  const destinataire = process.env.DEMANDES_TO || 'ilonagaigne@gmail.com';
  const expediteur = process.env.RESEND_FROM || 'Ilona Photographe <onboarding@resend.dev>';
  const sujet = `${TYPES[type]} · ${nom}`;
  const texte = lignes.join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">
    <h2 style="margin:0 0 12px">${echapper(sujet)}</h2>
    <ul style="padding-left:18px">${lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>
    <p style="color:#666;font-size:13px">Répondez directement à cet e-mail pour écrire à ${echapper(nom)}.</p></div>`;

  try {
    await envoyer(cle, { from: expediteur, to: [destinataire], reply_to: email, subject: sujet, text: texte, html }, Math.min(DELAI, BUDGET));
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, erreur: 'L’envoi a échoué.' });
  }

  // Ilona a la demande : à partir d'ici la réponse est « ok », quoi qu'il arrive.
  // Accusé de réception au visiteur, seulement une fois le domaine vérifié chez Resend et s'il reste assez de temps.
  const reste = BUDGET - (Date.now() - debut);
  if (process.env.RESEND_FROM && reste >= RESTE_ACCUSE) {
    try {
      await envoyer(cle, {
        from: expediteur, to: [email], reply_to: destinataire,
        subject: 'Votre demande est bien arrivée · Ilona Photographe',
        // Texte fixe : rien de ce que le visiteur a saisi n'y figure, pour qu'on ne puisse pas s'en servir
        // afin d'envoyer un message de son choix à une tierce personne.
        text: 'Bonjour,\n\nMerci, votre demande est bien arrivée. Je reviens vers vous par e-mail pour confirmer la date, l’heure et le prix final.\n\nIlona\nIlona Photographe',
      }, Math.min(DELAI_ACCUSE, reste - 300));
    } catch (e) {
      console.error('Accusé de réception non envoyé', e);
    }
  }
  return res.status(200).json({ ok: true });
}
