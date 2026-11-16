// Code partagé des galeries clients (le « _ » empêche Vercel d'en faire une adresse).
// Les photos des clients vivent dans Vercel Blob (jamais dans le dépôt GitHub, qui est public) :
//   fiches/<empreinte>.json                         la fiche de la galerie (chemin impossible à deviner sans la clé du serveur)
//   galeries/<id>/(originaux|vues|miniatures)/<12 caractères>/<nom>   les photos (le hasard est dans un dossier : le nom téléchargé reste propre)
// Clé du serveur (chemin des fiches et signature des accès) : GALERIES_CLE si elle existe, sinon GITHUB_CLIENT_SECRET,
// sinon BLOB_READ_WRITE_TOKEN (créée quand on relie un magasin Blob au projet). Les clés suivantes servent à retrouver
// les fiches écrites avec une ancienne règle (migration sans perte).
import { randomBytes, createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto';
import { put, get, head, list, del, setTtl } from '@vercel/blob';

import { trierProjets } from './tri.js';
export { trierPhotos, trierProjets, dateDuProjet, TRIS, priseValide } from './tri.js';

export const ID_VALIDE = /^[A-Za-z0-9_-]{22}$/;
export const DEPOT_GITHUB = 'ilonagaigne-lab/ilona-photographe-site';
export const DOSSIERS_PHOTOS = ['originaux', 'vues', 'miniatures'];
const JOUR = 86_400_000;

export const nouvelId = () => randomBytes(16).toString('base64url');
// Clés possibles, de la plus récente à la plus ancienne règle. La première sert à écrire ; toutes servent à retrouver une fiche.
export function clesGalerie() {
  const e = process.env;
  return [...new Set([e.GALERIES_CLE, e.GITHUB_CLIENT_SECRET, e.BLOB_READ_WRITE_TOKEN].filter((c) => typeof c === 'string' && c))];
}
const cleActuelle = () => {
  const [cle] = clesGalerie();
  if (!cle) throw new Error('Clé des galeries manquante (GALERIES_CLE, GITHUB_CLIENT_SECRET ou BLOB_READ_WRITE_TOKEN).');
  return cle;
};
// Chemin de la fiche : HMAC-SHA256 de l'id avec une clé du serveur (base64url, 32 caractères).
const cheminAvec = (id, cle) => `fiches/${createHmac('sha256', cle).update(id).digest('base64url').slice(0, 32)}.json`;
export const cheminGalerie = (id) => cheminAvec(id, cleActuelle());
// Tous les chemins possibles de la fiche (le nouveau d'abord, puis ceux des anciennes clés).
export const cheminsGalerie = (id) => {
  cleActuelle();
  return [...new Set(clesGalerie().map((c) => cheminAvec(id, c)))];
};

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
// Lecture : le chemin de la clé actuelle d'abord, puis ceux des anciennes clés (fiche pas encore déplacée).
export async function lireGalerie(id) {
  if (typeof id !== 'string' || !ID_VALIDE.test(id)) return null;
  // Toutes les clés possibles sont lues : la fiche la plus récente l'emporte (même règle que listerGaleries).
  const fiches = (await Promise.all(cheminsGalerie(id).map(lireFiche))).filter((f) => f && f.id === id);
  if (!fiches.length) return null;
  return fiches.reduce((a, b) => (String(b.majLe || '') > String(a.majLe || '') ? b : a));
}

// Lecture fraîche : pour un fichier public, le CDN de Vercel Blob garde une copie jusqu'à 60 s (useCache: false
// ne vaut que pour les fichiers privés). On demande d'abord l'adresse au service (head, jamais en cache), puis on lit
// cette adresse avec un paramètre unique : la copie lue est toujours la dernière enregistrée (mot de passe compris).
async function lireFiche(chemin) {
  let meta;
  try {
    meta = await head(chemin);
  } catch (e) {
    if (e?.name === 'BlobNotFoundError' || /not found|introuvable/i.test(String(e?.message))) return null;
    throw e;
  }
  if (!meta?.url) return null;
  const r = await get(`${meta.url}?frais=${Date.now()}-${randomBytes(4).toString('hex')}`, { access: 'public' });
  if (!r || r.statusCode !== 200) return null;
  try {
    return JSON.parse(await new Response(r.stream).text());
  } catch {
    return null;
  }
}

// Écriture : toujours au chemin de la clé actuelle ; l'ancien fichier (s'il existe) est supprimé.
export async function ecrireGalerie(galerie) {
  if (!galerie || !ID_VALIDE.test(galerie.id || '')) throw new Error('Identifiant de galerie invalide.');
  const complete = { ...galerie, majLe: new Date().toISOString() };
  const [nouveau, ...anciens] = cheminsGalerie(complete.id);
  await put(nouveau, JSON.stringify(complete), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    ttlDays: joursAvant(complete.expireLe),
  });
  // Un échec ici ne perd rien : la liste ne garde qu'une fois chaque galerie, la plus récente.
  if (anciens.length) await del(anciens).catch((e) => console.error('galeries : ancien chemin non supprimé :', e?.name));
  return complete;
}

// ---------- Mot de passe facultatif ----------
// Fiche : "protection": null (lien seul) ou { sel, empreinte, version }. Jamais le mot de passe en clair.
// Les fonctions ci-dessous ne renvoient rien d'autre à l'extérieur que « protegee » (voir sansSecrets).
export const MDP_MIN = 4;
export const MDP_MAX = 64;
export const DUREE_ACCES = 30 * JOUR;
const SCRYPT_LONGUEUR = 32;

const calculerScrypt = (motDePasse, sel) => new Promise((resolve, reject) => {
  scrypt(motDePasse, sel, SCRYPT_LONGUEUR, (erreur, cle) => (erreur ? reject(erreur) : resolve(cle)));
});

// Forme NFC et sans espace au début ni à la fin (un espace collé par erreur ne doit pas bloquer le client). null si la longueur est invalide.
export function normaliserMotDePasse(v) {
  if (typeof v !== 'string') return null;
  const mdp = v.normalize('NFC').trim();
  const longueur = [...mdp].length;
  return longueur >= MDP_MIN && longueur <= MDP_MAX ? mdp : null;
}

export const estProtegee = (galerie) => {
  const p = galerie?.protection;
  return Boolean(p && typeof p === 'object' && typeof p.sel === 'string' && p.sel && typeof p.empreinte === 'string' && p.empreinte);
};

// Renvoie une copie de la galerie avec un nouveau mot de passe (version +1). Lève une erreur si le mot de passe est invalide.
export async function definirProtection(galerie, motDePasse) {
  const mdp = normaliserMotDePasse(motDePasse);
  if (!mdp) throw new Error(`Le mot de passe doit contenir entre ${MDP_MIN} et ${MDP_MAX} caractères.`);
  const sel = randomBytes(16);
  const empreinte = await calculerScrypt(mdp, sel);
  const version = (Number.isInteger(galerie?.protection?.version) ? galerie.protection.version : 0) + 1;
  return { ...galerie, protection: { sel: sel.toString('base64url'), empreinte: empreinte.toString('base64url'), version } };
}

// Renvoie une copie de la galerie sans mot de passe.
export const retirerProtection = (galerie) => ({ ...galerie, protection: null });

// Vrai si le mot de passe est le bon. Faux aussi pour une galerie sans mot de passe (utiliser estProtegee avant). Comparaison à temps constant.
export async function verifierMotDePasse(galerie, motDePasse) {
  const mdp = normaliserMotDePasse(motDePasse);
  if (!mdp || !estProtegee(galerie)) return false;
  try {
    const attendue = Buffer.from(galerie.protection.empreinte, 'base64url');
    const calculee = await calculerScrypt(mdp, Buffer.from(galerie.protection.sel, 'base64url'));
    return attendue.length === calculee.length && timingSafeEqual(attendue, calculee);
  } catch {
    return false;
  }
}

// Accès signé : « expiration.version.signature ». La signature couvre l'id, la version ET le sel : retirer puis remettre
// un mot de passe (la version repart de 1) invalide aussi les anciens accès.
function signerAcces(galerie, expiration) {
  const cle = createHmac('sha256', cleActuelle()).update('acces-galerie-v1').digest();
  const { version, sel } = galerie.protection;
  return createHmac('sha256', cle).update(`${galerie.id}|${version}|${sel}|${expiration}`).digest('base64url');
}

// Jeton d'accès (30 jours) à donner au navigateur après un bon mot de passe ; null si la galerie n'est pas protégée.
export function creerAcces(galerie, maintenant = Date.now()) {
  if (!estProtegee(galerie)) return null;
  const expiration = maintenant + DUREE_ACCES;
  return `${expiration}.${galerie.protection.version}.${signerAcces(galerie, expiration)}`;
}

// Vrai si la galerie n'est pas protégée, ou si le jeton est signé, non expiré et de la version actuelle.
export function accesValide(galerie, jeton, maintenant = Date.now()) {
  if (!estProtegee(galerie)) return true;
  const m = /^(\d{10,16})\.(\d{1,9})\.([A-Za-z0-9_-]{43})$/.exec(typeof jeton === 'string' ? jeton : '');
  if (!m) return false;
  const expiration = Number(m[1]);
  if (expiration <= maintenant || Number(m[2]) !== galerie.protection.version) return false;
  try {
    const attendu = Buffer.from(signerAcces(galerie, expiration));
    const recu = Buffer.from(m[3]);
    return attendu.length === recu.length && timingSafeEqual(attendu, recu);
  } catch {
    return false;
  }
}

// Fiche prête à être renvoyée à Ilona : ni sel ni empreinte, seulement « protegee ».
export function sansSecrets(galerie) {
  const { protection, ...reste } = galerie || {};
  return { ...reste, protegee: estProtegee(galerie) };
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
  // Une galerie encore présente à l'ancien ET au nouveau chemin n'apparaît qu'une fois : la plus récente (majLe).
  const parId = new Map();
  for (const g of galeries) {
    const deja = parId.get(g.id);
    if (!deja || String(g.majLe || '') > String(deja.majLe || '')) parId.set(g.id, g);
  }
  return trierProjets([...parId.values()]);
}

// Supprime les photos puis, en dernier, la fiche (si un envoi échoue, on peut réessayer).
export async function supprimerGalerie(id) {
  if (!ID_VALIDE.test(id || '')) throw new Error('Identifiant de galerie invalide.');
  const urls = (await blobsDe(`galeries/${id}/`)).map((b) => b.url);
  for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100));
  await del(cheminsGalerie(id)); // la fiche, à son chemin actuel et à ceux des anciennes clés
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
