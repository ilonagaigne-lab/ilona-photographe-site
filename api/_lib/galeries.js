// Code partagé des galeries clients (le « _ » empêche Vercel d'en faire une adresse).
// Les photos des clients vivent dans Vercel Blob (jamais dans le dépôt GitHub, qui est public) :
//   fiches/<empreinte>.json                         la fiche de la galerie (chemin impossible à deviner sans le secret du serveur)
//   galeries/<id>/(originaux|vues|miniatures)/<12 caractères>/<nom>   les photos (le hasard est dans un dossier : le nom téléchargé reste propre)
// Variable Vercel : BLOB_READ_WRITE_TOKEN (créée quand on relie un magasin Blob au projet).
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { put, get, list, del, setTtl } from '@vercel/blob';

import { trierProjets } from './tri.js';
export { trierPhotos, trierProjets, dateDuProjet, TRIS, priseValide } from './tri.js';

export const ID_VALIDE = /^[A-Za-z0-9_-]{22}$/;
export const DEPOT_GITHUB = 'ilonagaigne-lab/ilona-photographe-site';
export const DOSSIERS_PHOTOS = ['originaux', 'vues', 'miniatures'];
const JOUR = 86_400_000;

export const nouvelId = () => randomBytes(16).toString('base64url');
// Chemin de la fiche : HMAC-SHA256 de l'id avec le jeton du magasin Blob (base64url, 32 caractères).
export function cheminGalerie(id) {
  const secret = process.env.BLOB_READ_WRITE_TOKEN;
  if (!secret) throw new Error('BLOB_READ_WRITE_TOKEN manquant.');
  return `fiches/${createHmac('sha256', secret).update(id).digest('base64url').slice(0, 32)}.json`;
}

// Nombre de jours (1 à 730) entre maintenant et la fin de la date d'expiration (AAAA-MM-JJ).
export function joursAvant(expireLe, depuis = Date.now()) {
  const fin = Date.parse(`${expireLe}T23:59:59Z`);
  if (!Number.isFinite(fin)) return 100;
  return Math.min(730, Math.max(1, Math.ceil((fin - depuis) / JOUR)));
}

// ---------- Connexion d'Ilona : son jeton GitHub, valable si elle peut modifier le dépôt ----------
const memoire = new Map(); // empreinte du jeton → { ok, jusqua } (60 s, évite d'interroger GitHub à chaque photo)

export function jetonDe(req) {
  const h = req?.headers;
  const brut = (h && (typeof h.get === 'function' ? h.get('authorization') : h.authorization)) || '';
  const m = /^Bearer\s+([\w.\-]{10,400})$/.exec(String(brut).trim());
  return m ? m[1] : null;
}

export async function verifierIlona(req) {
  const jeton = jetonDe(req);
  if (!jeton) return false;
  const cle = createHash('sha256').update(jeton).digest('hex');
  const connu = memoire.get(cle);
  if (connu && connu.jusqua > Date.now()) return connu.ok;
  let ok = false;
  try {
    const r = await fetch(`https://api.github.com/repos/${DEPOT_GITHUB}`, {
      headers: { Authorization: `Bearer ${jeton}`, 'User-Agent': 'ilona-photographe-galeries', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) ok = (await r.json())?.permissions?.push === true;
  } catch {
    ok = false;
  }
  if (memoire.size > 50) memoire.clear();
  memoire.set(cle, { ok, jusqua: Date.now() + 60_000 });
  return ok;
}

// ---------- Lecture et écriture de galerie.json ----------
export async function lireGalerie(id) {
  if (typeof id !== 'string' || !ID_VALIDE.test(id)) return null;
  return lireFiche(cheminGalerie(id));
}

async function lireFiche(chemin) {
  const r = await get(chemin, { access: 'public', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  try {
    return JSON.parse(await new Response(r.stream).text());
  } catch {
    return null;
  }
}

export async function ecrireGalerie(galerie) {
  if (!galerie || !ID_VALIDE.test(galerie.id || '')) throw new Error('Identifiant de galerie invalide.');
  const complete = { ...galerie, majLe: new Date().toISOString() };
  await put(cheminGalerie(complete.id), JSON.stringify(complete), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    ttlDays: joursAvant(complete.expireLe),
  });
  return complete;
}

// ---------- Liste, suppression, prolongation ----------
async function blobsDe(prefixe) {
  const tous = [];
  let cursor;
  do {
    const page = await list({ prefix: prefixe, limit: 1000, cursor });
    tous.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return tous;
}

export async function listerGaleries() {
  const fiches = (await blobsDe('fiches/')).map((b) => b.pathname).filter((c) => /^fiches\/[A-Za-z0-9_-]{32}\.json$/.test(c));
  const galeries = [];
  for (let i = 0; i < fiches.length; i += 6) {
    const lot = await Promise.all(fiches.slice(i, i + 6).map((c) => lireFiche(c).catch(() => null)));
    galeries.push(...lot.filter(Boolean));
  }
  return trierProjets(galeries);
}

// Supprime les photos puis, en dernier, la fiche (si un envoi échoue, on peut réessayer).
export async function supprimerGalerie(id) {
  if (!ID_VALIDE.test(id || '')) throw new Error('Identifiant de galerie invalide.');
  const urls = (await blobsDe(`galeries/${id}/`)).map((b) => b.url);
  for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100));
  await del(cheminGalerie(id));
}

// Supprime des fichiers précis (photos retirées d'une galerie), sans toucher aux autres galeries.
export async function supprimerFichiers(id, urls) {
  const sures = (urls || []).filter((u) => {
    try { return new URL(u).pathname.startsWith(`/galeries/${id}/`); } catch { return false; }
  });
  for (let i = 0; i < sures.length; i += 100) await del(sures.slice(i, i + 100));
}

// Aligne l'expiration de tous les fichiers sur `expireLe`. Vercel compte les jours depuis l'envoi de chaque fichier.
export async function prolongerGalerie(id, expireLe) {
  const fichiers = await blobsDe(`galeries/${id}/`);
  const parJours = new Map();
  for (const f of fichiers) {
    const jours = joursAvant(expireLe, new Date(f.uploadedAt).getTime());
    parJours.set(jours, [...(parJours.get(jours) || []), f.url]);
  }
  for (const [ttlDays, urls] of parJours) {
    for (let i = 0; i < urls.length; i += 1000) await setTtl(urls.slice(i, i + 1000), { ttlDays });
  }
}
