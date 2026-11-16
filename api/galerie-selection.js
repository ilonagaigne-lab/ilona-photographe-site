// Enregistre la sélection d'un client (mode « sélection ») dans sa galerie et prévient Ilona par e-mail (Resend).
// Mêmes réglages que api/demande.js : RESEND_API_KEY, DEMANDES_TO, RESEND_FROM (jamais dans le code).
// La sélection est enregistrée d'abord : si l'e-mail échoue, Ilona la retrouve dans /admin/galeries et le client
// reçoit tout de même la confirmation.
import { ID_VALIDE, lireGalerie, ecrireGalerie, estProtegee, accesValide } from './_lib/galeries.js';
import { estExpiree } from './galerie.js';

const BUDGET = 8500; // ms depuis l'arrivée de la demande : la réponse est partie avant la coupure de Vercel (10 s)
const DELAI = 6000; // ms maximum pour l'e-mail
const RESTE_MIN = 1200; // ms : sous ce temps restant, on n'envoie pas l'e-mail
const ESSAIS = 10; // envois par adresse IP et par fenêtre
const FENETRE = 10 * 60 * 1000;
const LIMITE_MESSAGE = 1000;

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
const une_ligne = (t) => String(t ?? '').replace(/[\r\n\t]+/g, ' ').trim();
const num = (i) => String(i + 1).padStart(2, '0');

async function envoyer(cle, message, delai) {
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
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }
  // Même règle d'origine que api/demande.js : la requête vient de ce site, ou d'un outil sans en-tête Origin.
  const origine = req.headers.origin;
  if (origine) {
    let hote = '';
    try { hote = new URL(origine).host.toLowerCase(); } catch { /* origine illisible : refusée */ }
    if (!hote || hote !== String(req.headers.host || '').toLowerCase()) return res.status(403).json({ ok: false, erreur: 'Demande refusée.' });
  } else if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).json({ ok: false, erreur: 'Demande refusée.' });
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
  if (tropDeDemandes(ip)) return res.status(429).json({ ok: false, erreur: 'Trop d’envois, réessayez dans quelques minutes.' });

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch { corps = null; } }
  if (!corps || typeof corps !== 'object') return res.status(400).json({ ok: false, erreur: 'Demande illisible.' });

  const id = typeof corps.id === 'string' ? corps.id : '';
  if (!ID_VALIDE.test(id)) return res.status(404).json({ ok: false, erreur: 'Galerie introuvable.' });

  let galerie;
  try {
    galerie = await lireGalerie(id);
  } catch (e) {
    console.error('Lecture de la galerie impossible', e);
    return res.status(503).json({ ok: false, erreur: 'Envoi indisponible pour le moment, réessayez dans un instant.' });
  }
  if (!galerie || galerie.id !== id) return res.status(404).json({ ok: false, erreur: 'Galerie introuvable.' });
  if (estExpiree(galerie.expireLe)) return res.status(410).json({ ok: false, erreur: 'Cette galerie a expiré.' });
  // Galerie protégée : sans accès valide (en-tête X-Galerie-Acces), aucune sélection n'est enregistrée.
  const acces = req.headers['x-galerie-acces'];
  if (estProtegee(galerie) && !accesValide(galerie, typeof acces === 'string' ? acces : '')) {
    return res.status(401).json({ ok: false, protegee: true, titre: String(galerie.titre ?? '') });
  }
  if (galerie.mode !== 'selection') return res.status(409).json({ ok: false, erreur: 'Cette galerie ne demande pas de sélection.' });

  const total = Array.isArray(galerie.photos) ? galerie.photos.length : 0;
  const brut = Array.isArray(corps.photos) ? corps.photos : null;
  if (!brut || brut.length > total || !brut.every((i) => Number.isInteger(i) && i >= 0 && i < total)) {
    return res.status(400).json({ ok: false, erreur: 'Sélection invalide, rechargez la page puis réessayez.' });
  }
  const photos = [...new Set(brut)].sort((a, b) => a - b);
  if (!photos.length) return res.status(400).json({ ok: false, erreur: 'Choisissez au moins une photo.' });
  // Texte brut seulement, caractères de contrôle retirés.
  const message = String(corps.message ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, LIMITE_MESSAGE);

  const envoyeeLe = new Date().toISOString();
  try {
    await ecrireGalerie({ ...galerie, selection: { photos, message, envoyeeLe } });
  } catch (e) {
    console.error('Enregistrement de la sélection impossible', e);
    return res.status(502).json({ ok: false, erreur: 'La sélection n’a pas pu être enregistrée, réessayez dans un instant.' });
  }

  // Sélection enregistrée : à partir d'ici la réponse est « ok », quoi qu'il arrive à l'e-mail.
  const cle = process.env.RESEND_API_KEY;
  const reste = BUDGET - (Date.now() - debut);
  if (cle && reste >= RESTE_MIN) {
    const quota = Number.isFinite(galerie.quota) ? galerie.quota : null;
    const prix = Number.isFinite(galerie.prixPhoto) ? galerie.prixPhoto : null;
    const extra = quota === null ? 0 : Math.max(0, photos.length - quota);
    const titre = une_ligne(galerie.titre).slice(0, 120) || 'Galerie';
    const sujet = `Sélection reçue · ${titre}`;
    const lignes = [
      `Galerie : ${titre}${galerie.seance ? ` (${une_ligne(galerie.seance).slice(0, 120)})` : ''}`,
      `${photos.length} photo${photos.length > 1 ? 's' : ''} choisie${photos.length > 1 ? 's' : ''}${quota === null ? '' : ` sur ${quota} incluses`}`,
      ...(extra && prix !== null ? [`Supplément : ${extra} × ${prix} € = ${extra * prix} €`] : []),
      ...(message ? [`Message du client : ${message}`] : []),
    ];
    const fichiers = photos.map((i) => `N° ${num(i)} · ${une_ligne(galerie.photos[i]?.nom).slice(0, 200)}`);
    const texte = `${lignes.join('\n')}\n\nPhotos choisies :\n${fichiers.join('\n')}`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">
    <h2 style="margin:0 0 12px">${echapper(sujet)}</h2>
    <ul style="padding-left:18px">${lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>
    <p style="margin:16px 0 4px"><strong>Photos choisies</strong></p>
    <ul style="padding-left:18px">${fichiers.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul></div>`;
    try {
      await envoyer(cle, {
        from: process.env.RESEND_FROM || 'Ilona Photographe <onboarding@resend.dev>',
        to: [process.env.DEMANDES_TO || 'ilonagaigne@gmail.com'],
        subject: sujet, text: texte, html,
      }, Math.min(DELAI, reste - 300));
    } catch (e) {
      console.error('E-mail de sélection non envoyé', e);
    }
  }
  return res.status(200).json({ ok: true, envoyeeLe, nombre: photos.length });
}
