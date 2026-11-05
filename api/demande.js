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
const DELAI = 8000; // ms : au-delà, on renonce et le visiteur passe par sa messagerie
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }
  const cle = process.env.RESEND_API_KEY;
  if (!cle) return res.status(503).json({ ok: false, erreur: 'Envoi indisponible pour le moment.' });

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch { corps = null; } }
  if (!corps || typeof corps !== 'object') return res.status(400).json({ ok: false, erreur: 'Demande illisible.' });

  // Champ piège invisible : rempli uniquement par les robots.
  if (corps.site_web) return res.status(200).json({ ok: true });

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
    await envoyer(cle, { from: expediteur, to: [destinataire], reply_to: email, subject: sujet, text: texte, html });
    // Accusé de réception au visiteur, seulement une fois le domaine vérifié chez Resend.
    if (process.env.RESEND_FROM) {
      await envoyer(cle, {
        from: expediteur, to: [email], reply_to: destinataire,
        subject: 'Votre demande est bien arrivée · Ilona Photographe',
        text: `Bonjour ${nom},\n\nMerci, votre demande est bien arrivée. Je reviens vers vous par e-mail pour confirmer la date et le prix final.\n\nRécapitulatif :\n${texte}\n\nIlona\nIlona Photographe`,
      }, 4000).catch(() => {});
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, erreur: 'L’envoi a échoué.' });
  }
}
