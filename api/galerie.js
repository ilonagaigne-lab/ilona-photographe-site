// Renvoie à la page client (/photos/<id>) le contenu de SA galerie, et rien d'autre.
// Public : le secret, c'est l'identifiant de 22 caractères dans le lien. On ne liste jamais les autres galeries,
// et le message que le client écrit à Ilona (selection.message) ne repart jamais vers le navigateur.
// Galerie protégée par un mot de passe (facultatif) :
//   GET  sans accès valide (en-tête X-Galerie-Acces) -> 401 { ok:false, protegee:true, titre } : ni photos, ni adresses.
//   POST { id, motDePasse } -> bon : { ok:true, galerie, acces } ; mauvais : 401 après une pause d'une seconde ;
//   5 échecs par adresse IP et par galerie sur un quart d'heure -> 429 (en mémoire, comme api/auth.js).
import { ID_VALIDE, lireGalerie, trierPhotos, estProtegee, verifierMotDePasse, creerAcces, accesValide } from './_lib/galeries.js';

const ECHECS_MAX = 5;
const FENETRE_ECHECS = 15 * 60 * 1000;
const PAUSE_ECHEC = 1000; // ms : ralentit les essais en série
const echecs = new Map(); // « ip|id » -> { debut, n }

function nbEchecs(cle) {
  const maintenant = Date.now();
  for (const [k, v] of echecs) if (maintenant - v.debut > FENETRE_ECHECS) echecs.delete(k);
  return echecs.get(cle)?.n ?? 0;
}
function noterEchec(cle) {
  const v = echecs.get(cle) ?? { debut: Date.now(), n: 0 };
  v.n += 1;
  echecs.set(cle, v);
}

// Mêmes règles d'origine que api/galerie-selection.js : la requête vient de ce site, ou d'un outil sans en-tête Origin.
function origineRefusee(req) {
  const origine = req.headers.origin;
  if (origine) {
    let hote = '';
    try { hote = new URL(origine).host.toLowerCase(); } catch { /* origine illisible : refusée */ }
    return !hote || hote !== String(req.headers.host || '').toLowerCase();
  }
  return req.headers['sec-fetch-site'] === 'cross-site';
}
const enTete = (req, nom) => {
  const v = req.headers?.[nom];
  return typeof v === 'string' ? v : '';
};

const MODES = ['telechargement', 'selection'];

// Une adresse de photo doit être en https : on ne renvoie jamais autre chose au navigateur.
function adresseSure(u) {
  try { return new URL(u).protocol === 'https:' ? u : null; } catch { return null; }
}
const entier = (n) => (Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);

function publique(g) {
  const photos = trierPhotos(g.photos, g.tri) // ordre choisi par Ilona (date de prise de vue ou nom)
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
  const ecriture = req.method === 'POST';
  if (req.method !== 'GET' && req.method !== 'HEAD' && !ecriture) {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return res.status(405).json({ ok: false, erreur: 'Méthode non autorisée.' });
  }
  let corps = null;
  if (ecriture) {
    if (origineRefusee(req)) return res.status(403).json({ ok: false, erreur: 'Demande refusée.' });
    corps = req.body;
    if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch { corps = null; } }
    if (!corps || typeof corps !== 'object') return res.status(400).json({ ok: false, erreur: 'Demande illisible.' });
  }
  const id = ecriture ? (typeof corps.id === 'string' ? corps.id : '') : (typeof req.query?.id === 'string' ? req.query.id : '');
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


  if (ecriture) {
    // Saisie du mot de passe. Une galerie sans mot de passe répond comme le GET (sans jeton d'accès).
    if (!estProtegee(galerie)) return res.status(200).json({ ok: true, galerie: publique(galerie), acces: null });
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnue';
    const cle = `${ip}|${id}`;
    if (nbEchecs(cle) >= ECHECS_MAX) {
      res.setHeader('Retry-After', String(Math.ceil(FENETRE_ECHECS / 1000)));
      return res.status(429).json({ ok: false, protegee: true, titre: String(galerie.titre ?? ''), erreur: 'Trop d’essais, réessayez dans quelques minutes.' });
    }
    // L'essai est compté tout de suite, avant le calcul (qui prend du temps) : des essais envoyés en même temps
    // ne peuvent pas tous passer le contrôle. Un bon mot de passe efface ensuite le compteur.
    noterEchec(cle);
    const bon = typeof corps.motDePasse === 'string' && corps.motDePasse.length <= 200 && await verifierMotDePasse(galerie, corps.motDePasse);
    if (!bon) {
      await new Promise((ok) => setTimeout(ok, PAUSE_ECHEC));
      return res.status(401).json({ ok: false, protegee: true, titre: String(galerie.titre ?? ''), erreur: 'Mot de passe incorrect.' });
    }
    echecs.delete(cle);
    return res.status(200).json({ ok: true, galerie: publique(galerie), acces: creerAcces(galerie) });
  }

  // Lecture : une galerie protégée n'est rendue qu'avec un accès valide. Sinon, seulement son titre.
  if (estProtegee(galerie) && !accesValide(galerie, enTete(req, 'x-galerie-acces'))) {
    return res.status(401).json({ ok: false, protegee: true, titre: String(galerie.titre ?? '') });
  }
  return res.status(200).json({ ok: true, galerie: publique(galerie) });
}
