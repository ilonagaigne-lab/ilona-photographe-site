// Renvoie à la page client (/photos/<id>) le contenu de SA galerie, et rien d'autre.
// Public : le secret, c'est l'identifiant de 22 caractères dans le lien. On ne liste jamais les autres galeries,
// et le message que le client écrit à Ilona (selection.message) ne repart jamais vers le navigateur.
import { ID_VALIDE, lireGalerie } from './_lib/galeries.js';

const MODES = ['telechargement', 'selection'];

// Une adresse de photo doit être en https : on ne renvoie jamais autre chose au navigateur.
function adresseSure(u) {
  try { return new URL(u).protocol === 'https:' ? u : null; } catch { return null; }
}
const entier = (n) => (Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);

function publique(g) {
  const photos = (Array.isArray(g.photos) ? g.photos : [])
    .map((p) => ({
      nom: String(p?.nom ?? '').slice(0, 200),
      largeur: entier(p?.largeur),
      hauteur: entier(p?.hauteur),
      poids: entier(p?.poids),
      original: adresseSure(p?.original),
      vue: adresseSure(p?.vue),
      miniature: adresseSure(p?.miniature),
    }))
    .filter((p) => p.original && p.vue && p.miniature);
  const s = g.selection && typeof g.selection === 'object' ? g.selection : null;
  return {
    id: g.id,
    titre: String(g.titre ?? ''),
    seance: String(g.seance ?? ''),
    date: g.date ?? null,
    mode: MODES.includes(g.mode) ? g.mode : 'telechargement',
    quota: Number.isFinite(g.quota) ? g.quota : null,
    prixPhoto: Number.isFinite(g.prixPhoto) ? g.prixPhoto : null,
    expireLe: g.expireLe ?? null,
    photos,
    // Les numéros et la date d'envoi seulement : jamais le message.
    selection: s ? { photos: Array.isArray(s.photos) ? s.photos.filter(Number.isInteger) : [], envoyeeLe: s.envoyeeLe ?? null } : null,
  };
}

// Une galerie est valable jusqu'à la fin du jour d'expiration (même règle que le code partagé).
export const estExpiree = (expireLe, maintenant = Date.now()) => {
  if (!expireLe) return false;
  const fin = Date.parse(`${expireLe}T23:59:59Z`);
  return Number.isFinite(fin) && fin < maintenant;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }
  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!ID_VALIDE.test(id)) return res.status(404).json({ ok: false, erreur: 'Galerie introuvable.' });

  let galerie;
  try {
    galerie = await lireGalerie(id);
  } catch (e) {
    console.error('Lecture de la galerie impossible', e);
    return res.status(503).json({ ok: false, erreur: 'Galerie momentanément indisponible, réessayez dans un instant.' });
  }
  if (!galerie || galerie.id !== id) return res.status(404).json({ ok: false, erreur: 'Galerie introuvable.' });
  if (estExpiree(galerie.expireLe)) return res.status(410).json({ ok: false, erreur: 'Cette galerie a expiré.' });

  return res.status(200).json({ ok: true, galerie: publique(galerie) });
}
