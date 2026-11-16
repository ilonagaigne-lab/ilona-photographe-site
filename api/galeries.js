// Galeries clients, côté Ilona (page /admin/galeries). Réservé aux personnes qui peuvent modifier le dépôt GitHub :
// le navigateur envoie le jeton de la connexion au back office dans l'en-tête Authorization.
//   GET             liste des galeries            GET ?id=…   une galerie complète
//   POST            crée (sans id) ou met à jour  DELETE ?id=…  supprime la galerie et tous ses fichiers
import {
  ID_VALIDE, nouvelId, verifierIlona, lireGalerie, ecrireGalerie,
  listerGaleries, supprimerGalerie, supprimerFichiers, prolongerGalerie, trierPhotos, priseValide, dateDuProjet, TRIS,
} from './_lib/galeries.js';

const ORIGINE = 'https://ilonagaigne.com';
const lienClient = (id) => `${ORIGINE}/photos/${id}`;
const MODES = ['telechargement', 'selection'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

class Refus extends Error {
  constructor(message, statut = 400) { super(message); this.statut = statut; }
}

const texte = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const entier = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
const dateValide = (v) => typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const aujourdhui = () => new Date().toISOString().slice(0, 10);

// Une photo n'est acceptée que si ses trois fichiers sont bien dans le dossier de cette galerie du magasin Blob.
function urlDeLaGalerie(url, id, dossier) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.blob.vercel-storage.com')) return null;
    return u.pathname.startsWith(`/galeries/${id}/${dossier}/`) && /^[A-Za-z0-9_-]{12}\/[^/]+$/.test(u.pathname.slice(`/galeries/${id}/${dossier}/`.length)) ? u.href : null;
  } catch {
    return null;
  }
}

function nettoyerPhotos(photos, id) {
  if (!Array.isArray(photos)) throw new Refus('La liste des photos est invalide.');
  if (photos.length > 1000) throw new Refus('Un projet ne peut pas dépasser 1 000 photos.');
  return photos.map((p, i) => {
    const original = urlDeLaGalerie(p?.original, id, 'originaux');
    const vue = urlDeLaGalerie(p?.vue, id, 'vues');
    const miniature = urlDeLaGalerie(p?.miniature, id, 'miniatures');
    const nom = texte(p?.nom, 200);
    if (!original || !vue || !miniature || !nom) throw new Refus(`La photo n° ${i + 1} est incomplète.`);
    return {
      nom,
      largeur: entier(p.largeur, 1, 100000) ?? 0,
      hauteur: entier(p.hauteur, 1, 100000) ?? 0,
      poids: entier(p.poids, 0, 2_000_000_000) ?? 0,
      prise: priseValide(p.prise), // date de prise de vue « AAAA-MM-JJTHH:MM:SS », ou null
      original, vue, miniature,
    };
  });
}

function lireChamps(corps) {
  const titre = texte(corps.titre, 120);
  if (!titre) throw new Refus('Donnez un nom au projet. Ex. : Léa et Caramel');
  if (!MODES.includes(corps.mode)) throw new Refus('Choisissez « Téléchargement » ou « Sélection ».');
  if (corps.date && !dateValide(corps.date)) throw new Refus('La date de la séance est invalide.');
  if (!dateValide(corps.expireLe)) throw new Refus('Indiquez la date jusqu’à laquelle le projet reste disponible.');
  if (corps.expireLe < aujourdhui()) throw new Refus('La date de fin doit être aujourd’hui ou plus tard.');
  const quota = entier(corps.quota, 0, 1000);
  const prixPhoto = entier(corps.prixPhoto, 0, 10000);
  if (quota === null || prixPhoto === null) throw new Refus('Le nombre de photos incluses et le prix d’une photo en plus doivent être des nombres entiers.');
  return { titre, seance: texte(corps.seance, 120), date: corps.date || '', mode: corps.mode, quota, prixPhoto, expireLe: corps.expireLe };
}

// Ordre choisi : absent ou inconnu dans une ancienne fiche = par date ; une valeur envoyée doit être « date » ou « nom ».
function lireTri(v) {
  if (v === undefined) return undefined;
  if (!TRIS.includes(v)) throw new Refus('Choisissez « Par date de prise de vue » ou « Par nom de fichier ».');
  return v;
}

// Les numéros de la sélection du client désignent des photos de la liste ; si l'ordre ou la liste change,
// on les recalcule pour qu'ils désignent les mêmes photos (repérées par l'adresse de l'original).
function recalculerSelection(selection, avant, apres) {
  if (!selection || !Array.isArray(selection.photos)) return selection ?? null;
  const place = new Map(apres.map((p, i) => [p.original, i]));
  const photos = selection.photos.map((n) => place.get(avant[n]?.original)).filter(Number.isInteger).sort((a, b) => a - b);
  return { ...selection, photos };
}

const resume = (g) => ({
  id: g.id, titre: g.titre, seance: g.seance, date: g.date, mode: g.mode,
  nbPhotos: g.photos?.length ?? 0,
  tri: TRIS.includes(g.tri) ? g.tri : 'date',
  vignette: trierPhotos(g.photos, g.tri)[0]?.miniature ?? null,
  poids: (g.photos || []).reduce((t, p) => t + (p.poids || 0), 0),
  dateProjet: dateDuProjet(g),
  expireLe: g.expireLe, expiree: g.expireLe < aujourdhui(),
  creeLe: g.creeLe, majLe: g.majLe, lien: lienClient(g.id),
  selectionRecue: Boolean(g.selection), selectionLe: g.selection?.envoyeeLe ?? null,
});

async function creerOuMettreAJour(corps) {
  const champs = lireChamps(corps);
  if (corps.id === undefined || corps.id === null || corps.id === '') {
    const maintenant = new Date().toISOString();
    return ecrireGalerie({ id: nouvelId(), ...champs, tri: lireTri(corps.tri) ?? 'date', creeLe: maintenant, majLe: maintenant, photos: [], selection: null });
  }
  if (!ID_VALIDE.test(corps.id)) throw new Refus('Projet introuvable.', 404);
  const ancienne = await lireGalerie(corps.id);
  if (!ancienne) throw new Refus('Projet introuvable.', 404);
  const tri = lireTri(corps.tri) ?? (TRIS.includes(ancienne.tri) ? ancienne.tri : 'date');
  // La fiche est enregistrée déjà triée : les numéros « N° 01… » du client sont des places dans cette liste.
  const photos = trierPhotos(corps.photos === undefined ? ancienne.photos : nettoyerPhotos(corps.photos, corps.id), tri);
  const vuParLeClient = trierPhotos(ancienne.photos, ancienne.tri); // l'ordre que le client voyait quand il a choisi
  const galerie = await ecrireGalerie({
    ...ancienne, ...champs, id: ancienne.id, creeLe: ancienne.creeLe, tri, photos,
    selection: recalculerSelection(ancienne.selection, vuParLeClient, photos), // une sélection reçue entre-temps n'est jamais écrasée
  });
  // Photos retirées : leurs trois fichiers sont supprimés.
  const gardees = new Set(photos.flatMap((p) => [p.original, p.vue, p.miniature]));
  const retirees = (ancienne.photos || []).flatMap((p) => [p.original, p.vue, p.miniature]).filter((u) => !gardees.has(u));
  if (retirees.length) await supprimerFichiers(galerie.id, retirees);
  if (ancienne.expireLe !== galerie.expireLe) await prolongerGalerie(galerie.id, galerie.expireLe);
  return galerie;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const repondre = (statut, corps) => res.status(statut).json(corps);
  try {
    if (!(await verifierIlona(req))) {
      return repondre(401, { ok: false, erreur: 'Connexion requise. Connectez-vous d’abord au back office.' });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return repondre(503, { ok: false, erreur: 'Le stockage des photos n’est pas encore relié au site.' });
    }
    const id = typeof req.query?.id === 'string' ? req.query.id : '';

    if (req.method === 'GET' && !id) {
      const galeries = await listerGaleries();
      return repondre(200, { ok: true, galeries: galeries.map(resume) });
    }
    if (req.method === 'GET') {
      const galerie = ID_VALIDE.test(id) ? await lireGalerie(id) : null;
      if (!galerie) return repondre(404, { ok: false, erreur: 'Projet introuvable.' });
      return repondre(200, { ok: true, galerie, lien: lienClient(id) });
    }
    if (req.method === 'POST') {
      const corps = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!corps || typeof corps !== 'object') throw new Refus('Demande illisible.');
      const galerie = await creerOuMettreAJour(corps);
      return repondre(200, { ok: true, galerie, lien: lienClient(galerie.id) });
    }
    if (req.method === 'DELETE') {
      if (!ID_VALIDE.test(id) || !(await lireGalerie(id))) return repondre(404, { ok: false, erreur: 'Projet introuvable.' });
      await supprimerGalerie(id);
      return repondre(200, { ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return repondre(405, { ok: false, erreur: 'Action non prévue.' });
  } catch (e) {
    if (e instanceof Refus) return repondre(e.statut, { ok: false, erreur: e.message });
    if (e instanceof SyntaxError) return repondre(400, { ok: false, erreur: 'Demande illisible.' });
    console.error('galeries :', e?.name, e?.message);
    return repondre(500, { ok: false, erreur: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
