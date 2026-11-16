// Galerie privée d'un client : charge /api/galerie, construit la grille, la visionneuse plein écran,
// le téléchargement (photo par photo ou zip complet) et le choix des favoris.
// Tous les textes viennent de src/contenu/pages/galerie-privee.json (passés par la page dans data-textes).
// Les données de la galerie (nom, noms de fichiers) ne sont jamais insérées en HTML : textContent uniquement.

const zone = document.getElementById('galerie');
const T = JSON.parse(zone.dataset.textes);
const ID_VALIDE = /^[A-Za-z0-9_-]{22}$/;
const $ = (s, racine = document) => racine.querySelector(s);
const $$ = (s, racine = document) => [...racine.querySelectorAll(s)];
const g = (texte, valeurs = {}) => texte.replace(/\{(\w+)\}/g, (_, k) => String(valeurs[k] ?? ''));
const nombre = (n, max = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: max }).format(n);

// Identifiant : /photos/<id> en ligne, ?id=<id> en local.
const id = (location.pathname.match(/^\/photos\/([^/]+)\/?$/) || [])[1] || new URLSearchParams(location.search).get('id') || '';
const demo = import.meta.env.DEV && id === 'demo';

let galerie = null;
let photos = [];
let mode = 'telechargement';
let quota = Number(zone.dataset.quota) || 0;
let prix = Number(zone.dataset.prix) || 0;
let favoris = new Set();
let envoye = null;
let filtre = 'toutes';
let zipEnCours = null;

const ICONE_COEUR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>';
const ICONE_TELECHARGER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>';

// ---------- États de la page ----------
function montrer(etat) {
  $$('[data-etat]').forEach((e) => { e.hidden = e.dataset.etat !== etat; });
  $('[data-contenu]').hidden = etat !== 'contenu' && etat !== 'chargement';
  $$('[data-barre]').forEach((b) => { b.hidden = etat !== 'contenu' || b.dataset.barre !== mode; });
  if (etat !== 'chargement' && etat !== 'contenu') $(`[data-etat="${etat}"] h1`).focus?.();
}

async function charger() {
  montrer('chargement');
  let donnees = null;
  try {
    if (demo) {
      const etat = new URLSearchParams(location.search).get('etat');
      if (etat) return montrer(etat);
      donnees = JSON.parse(document.getElementById('galerie-demo').textContent);
      const q = new URLSearchParams(location.search);
      if (q.get('mode') === 'selection') donnees.mode = 'selection';
      const total = (Number(q.get('poids')) || 312) * 1e6;
      donnees.photos.forEach((p) => { p.poids = Math.round(total / donnees.photos.length); });
    } else {
      if (!ID_VALIDE.test(id)) return montrer('introuvable');
      // L'appel part dès le <head> (script en ligne de la page) ; un « Réessayer » refait un appel neuf.
      const deja = window.__galeriePre;
      window.__galeriePre = null;
      const r = await (deja || fetch(`/api/galerie?id=${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } }));
      if (r.status === 404) return montrer('introuvable');
      if (r.status === 410) return montrer('expiree');
      if (!r.ok) return montrer('erreur');
      donnees = (await r.json()).galerie;
    }
  } catch {
    return montrer('erreur');
  }
  if (!donnees || !Array.isArray(donnees.photos)) return montrer('erreur');
  demarrer(donnees);
}

const sure = (u) => { try { return /^https?:$/.test(new URL(u, location.href).protocol); } catch { return false; } };

function demarrer(donnees) {
  galerie = donnees;
  photos = donnees.photos.filter((p) => sure(p.original) && sure(p.vue) && sure(p.miniature));
  if (!photos.length) return montrer('vide');
  mode = donnees.mode === 'selection' ? 'selection' : 'telechargement';
  if (Number.isFinite(donnees.quota)) quota = donnees.quota;
  if (Number.isFinite(donnees.prixPhoto)) prix = donnees.prixPhoto;
  restaurer();
  construire();
  montrer('contenu');
  $$('[data-bloc]').forEach((b) => { b.hidden = b.dataset.bloc !== mode; });
  if (mode === 'selection') majSelection(); else majBarreTelechargement();
}

// ---------- Grille ----------
function construire() {
  const infos = $('[data-infos]');
  infos.replaceChildren();
  const nom = document.createElement('strong');
  nom.style.fontWeight = '600';
  nom.textContent = galerie.titre || '';
  const reste = [galerie.seance, photos.length === 1 ? T.entete.unePhoto : g(T.entete.nombrePhotos, { n: photos.length })].filter(Boolean).join(' · ');
  infos.append(...(galerie.titre ? [nom, ' · '] : []), reste);

  const grille = $('[data-grille]');
  grille.replaceChildren();
  photos.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = `tuile${favoris.has(i) ? ' choisie' : ''}`;
    li.dataset.i = i;
    li.dataset.curseur = 'voir';

    const ouvrir = document.createElement('button');
    ouvrir.type = 'button';
    ouvrir.className = 'ouvrir';
    ouvrir.setAttribute('aria-label', g(T.visionneuse.ouvrirPhoto, { n: i + 1 }));
    const img = document.createElement('img');
    img.src = p.miniature;
    img.alt = '';
    if (p.largeur > 0 && p.hauteur > 0) { img.width = p.largeur; img.height = p.hauteur; }
    img.loading = i < 4 ? 'eager' : 'lazy';
    if (i < 2) img.fetchPriority = 'high';
    img.decoding = 'async';
    ouvrir.append(img);

    const flash = document.createElement('span'); flash.className = 'flash'; flash.setAttribute('aria-hidden', 'true');
    const cadre = document.createElement('span'); cadre.className = 'cadre'; cadre.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span'); num.className = 'num'; num.textContent = g(T.entete.numero, { n: String(i + 1).padStart(2, '0') });
    li.append(ouvrir, flash, cadre, num);

    if (mode === 'selection') {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'coeur';
      c.setAttribute('aria-pressed', String(favoris.has(i)));
      c.setAttribute('aria-label', g(T.selection.favoriPhoto, { n: i + 1 }));
      c.innerHTML = ICONE_COEUR;
      li.append(c);
    } else {
      const a = document.createElement('a');
      a.className = 'dl'; a.href = urlTelechargement(p.original); a.download = p.nom || '';
      a.setAttribute('aria-label', g(T.telechargement.telechargerPhoto, { n: i + 1 }));
      a.innerHTML = ICONE_TELECHARGER;
      const t = document.createElement('span'); t.textContent = T.telechargement.telecharger;
      a.append(t);
      li.append(a);
    }
    grille.append(li);
  });
}

// Le paramètre ?download=1 fait télécharger le fichier chez Vercel Blob au lieu de l'ouvrir.
function urlTelechargement(u) {
  const x = new URL(u, location.href);
  x.searchParams.set('download', '1');
  return x.href;
}

$('[data-grille]').addEventListener('click', (e) => {
  const cible = e.target;
  const tuile = cible.closest('.tuile');
  if (!tuile) return;
  const i = Number(tuile.dataset.i);
  if (cible.closest('.coeur')) {
    const on = !favoris.has(i);
    basculer(i, on);
    // Dans « Favoris », une photo retirée disparaît : le focus passe au filtre pour ne pas se perdre.
    if (!on && filtre === 'favoris') $('[data-filtre="favoris"]').focus();
  } else if (cible.closest('.ouvrir')) {
    ouvrirVue(i);
  }
});

// ---------- Sélection (mode sélection) ----------
const cleStockage = `galerie-privee:${id}`;
function restaurer() {
  favoris = new Set();
  envoye = null;
  let stock = null;
  try { stock = JSON.parse(localStorage.getItem(cleStockage) || 'null'); } catch { /* stockage indisponible */ }
  // Les favoris du navigateur sont gardés par adresse de photo (« original »), jamais par place : si Ilona change l'ordre
  // de la galerie, ce sont toujours les mêmes photos qui ont leur cœur. L'ancien format (numéros de place) est ignoré,
  // car on ne peut pas savoir à quel ordre il se rapportait : on repart alors de la sélection connue du serveur.
  if (stock && Array.isArray(stock.originaux)) {
    const place = new Map(photos.map((p, i) => [p.original, i]));
    stock.originaux.forEach((u) => { if (place.has(u)) favoris.add(place.get(u)); });
  } else if (galerie.selection && Array.isArray(galerie.selection.photos)) {
    galerie.selection.photos.forEach((i) => { if (Number.isInteger(i) && i >= 0 && i < photos.length) favoris.add(i); });
  }
  envoye = (stock && stock.envoye) || (galerie.selection && galerie.selection.envoyeeLe) || null;
}
function sauver() {
  try {
    const originaux = [...favoris].sort((a, b) => a - b).map((i) => photos[i].original);
    localStorage.setItem(cleStockage, JSON.stringify({ originaux, envoye }));
  } catch { /* ignoré */ }
}

function basculer(i, on) {
  if (on) favoris.add(i); else favoris.delete(i);
  const tuile = $(`.tuile[data-i="${i}"]`);
  tuile.classList.toggle('choisie', on);
  $('.coeur', tuile).setAttribute('aria-pressed', String(on));
  if (on) clignoter(tuile, 'flashe');
  if (vueOuverte() && courant === i) majCoeurVue(on);
  sauver();
  majSelection();
}
function clignoter(el, classe) {
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
}

function majSelection() {
  const n = favoris.size;
  const extra = Math.max(0, n - quota);
  $('[data-consigne]').textContent = g(T.selection.consigne, { quota, prix });
  $('[data-filtre="toutes"]').textContent = g(T.selection.toutes, { n: photos.length });
  $('[data-filtre="favoris"]').textContent = g(T.selection.favoris, { n });
  $('[data-inclus]').textContent = String(Math.min(n, quota));
  $('[data-quota-texte]').textContent = String(quota);
  $('[data-jauge]').style.transform = `scaleX(${quota ? Math.min(n / quota, 1) : (n ? 1 : 0)})`;
  const sup = $('[data-supplement]');
  sup.hidden = extra === 0;
  sup.textContent = g(T.selection.supplement, { extra, prix, total: extra * prix });
  $('[data-valider]').textContent = envoye ? T.selection.renvoyer : T.selection.valider;
  const recue = $('[data-recue]');
  recue.hidden = !envoye;
  if (envoye) recue.textContent = g(T.selection.recue, { date: new Date(envoye).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) });
  for (const tuile of $$('.tuile')) tuile.hidden = filtre === 'favoris' && !favoris.has(Number(tuile.dataset.i));
  $('[data-sans-favori]').hidden = !(filtre === 'favoris' && n === 0);
}

zone.addEventListener('click', (e) => {
  const f = e.target.closest('[data-filtre]');
  if (!f) return;
  filtre = f.dataset.filtre;
  $$('[data-filtre]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
  majSelection();
});
$('[data-reessayer]').addEventListener('click', charger);

// Envoi de la sélection
const dlgEnvoi = $('[data-envoi]', document);
const formEnvoi = $('[data-envoi-form]', document);
const erreurEnvoi = $('[data-envoi-erreur]', document);
const boutonEnvoyer = $('[data-envoyer]', document);

document.querySelector('[data-valider]').addEventListener('click', () => {
  const n = favoris.size;
  const extra = Math.max(0, n - quota);
  $('[data-resume]', document).textContent = extra
    ? g(T.selection.dialogueResume, { n, extra, total: extra * prix })
    : g(T.selection.dialogueResumeSansSupplement || T.selection.dialogueResume, { n, extra, total: 0 });
  $('[data-reglement]', document).hidden = extra === 0;
  formEnvoi.hidden = false;
  $('[data-envoi-ok]', document).hidden = true;
  erreurEnvoi.hidden = !n;
  erreurEnvoi.textContent = n ? '' : T.selection.aucune;
  boutonEnvoyer.disabled = !n;
  boutonEnvoyer.textContent = T.selection.envoyer;
  dlgEnvoi.showModal();
});
$('[data-envoi-retour]', document).addEventListener('click', () => dlgEnvoi.close());
$('[data-envoi-fermer]', document).addEventListener('click', () => dlgEnvoi.close());
dlgEnvoi.addEventListener('close', () => document.querySelector('[data-valider]').focus());

formEnvoi.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!favoris.size) return;
  boutonEnvoyer.disabled = true;
  boutonEnvoyer.textContent = T.selection.envoi;
  erreurEnvoi.hidden = true;
  const charge = { id, photos: [...favoris].sort((a, b) => a - b), message: $('#message-ilona', document).value.trim() };
  try {
    let envoyeeLe;
    if (demo) {
      // En démonstration rien n'est envoyé : la charge utile reste lisible pour les tests.
      window.__selectionDemo = charge;
      document.documentElement.dataset.selectionDemo = JSON.stringify(charge);
      envoyeeLe = new Date().toISOString();
    } else {
      const r = await fetch('/api/galerie-selection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(charge),
      });
      const rep = await r.json().catch(() => ({}));
      if (!r.ok || !rep.ok) throw new Error('envoi');
      envoyeeLe = rep.envoyeeLe || new Date().toISOString();
    }
    envoye = envoyeeLe;
    sauver();
    majSelection();
    formEnvoi.hidden = true;
    $('[data-confirmation]', document).textContent = g(T.selection.confirmation, { n: charge.photos.length });
    $('[data-envoi-ok]', document).hidden = false;
    $('[data-envoi-fermer]', document).focus();
  } catch {
    erreurEnvoi.textContent = T.selection.erreur;
    erreurEnvoi.hidden = false;
    boutonEnvoyer.disabled = false;
    boutonEnvoyer.textContent = T.selection.envoyer;
  }
});

// ---------- Visionneuse plein écran ----------
const dlg = document.querySelector('[data-visionneuse]');
const vimg = $('[data-vimg]', dlg);
const cadreVue = $('[data-cadre]', dlg);
const vdl = $('[data-vtelecharger]', dlg);
const vcoeur = $('[data-vcoeur]', dlg);
const vprec = $('[data-vprec]', dlg);
const vsuiv = $('[data-vsuiv]', dlg);
const bPlein = $('[data-plein-ecran]', dlg);
const conteneurPlein = $('[data-plein]', dlg);
let liste = [];
let pos = 0;
let courant = 0;
let jeton = 0;

const vueOuverte = () => dlg.open;

function ouvrirVue(i) {
  liste = $$('.tuile').filter((t) => !t.hidden).map((t) => Number(t.dataset.i));
  const p = liste.indexOf(i);
  pos = p < 0 ? 0 : p;
  vdl.hidden = mode !== 'telechargement';
  vcoeur.hidden = mode !== 'selection';
  vprec.hidden = vsuiv.hidden = liste.length < 2;
  dlg.showModal();
  afficherVue(pos);
  $('[data-vfermer]', dlg).focus();
}

function afficherVue(nouvelle) {
  pos = (nouvelle + liste.length) % liste.length;
  courant = liste[pos];
  const p = photos[courant];
  const mon = ++jeton;
  // La nouvelle photo remplace l'ancienne seulement une fois chargée : pas de page blanche entre deux.
  const suivante = new Image();
  suivante.src = p.vue;
  const poser = () => {
    if (mon !== jeton) return;
    vimg.src = p.vue;
    vimg.alt = g(T.visionneuse.photoAlt, { n: pos + 1, total: liste.length });
  };
  (suivante.decode ? suivante.decode().then(poser, poser) : poser());
  $('[data-compteur]', dlg).textContent = g(T.visionneuse.compteur, { n: pos + 1, total: liste.length });
  vdl.href = urlTelechargement(p.original);
  vdl.download = p.nom || '';
  vdl.setAttribute('aria-label', g(T.telechargement.telechargerPhoto, { n: courant + 1 }));
  if (mode === 'selection') {
    vcoeur.setAttribute('aria-label', g(T.selection.favoriPhoto, { n: courant + 1 }));
    majCoeurVue(favoris.has(courant), false);
  }
  // Préchargement de la suivante (et de la précédente).
  for (const k of [pos + 1, pos - 1]) if (liste.length > 1) new Image().src = photos[liste[(k + liste.length) % liste.length]].vue;
}

function majCoeurVue(on, flash = true) {
  vcoeur.setAttribute('aria-pressed', String(on));
  cadreVue.classList.toggle('choisie', on);
  if (on && flash) clignoter(cadreVue, 'flashe');
}

vcoeur.addEventListener('click', () => basculer(courant, !favoris.has(courant)));
vprec.addEventListener('click', () => afficherVue(pos - 1));
vsuiv.addEventListener('click', () => afficherVue(pos + 1));
$('[data-vfermer]', dlg).addEventListener('click', () => dlg.close());
dlg.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' && liste.length > 1) { e.preventDefault(); afficherVue(pos - 1); }
  if (e.key === 'ArrowRight' && liste.length > 1) { e.preventDefault(); afficherVue(pos + 1); }
});
// Clic sur le fond noir : fermer.
$('[data-scene]', dlg).addEventListener('click', (e) => { if (e.target === e.currentTarget) dlg.close(); });
// Glissement du doigt.
let toucheX = 0, toucheY = 0;
$('[data-scene]', dlg).addEventListener('touchstart', (e) => { toucheX = e.changedTouches[0].clientX; toucheY = e.changedTouches[0].clientY; }, { passive: true });
$('[data-scene]', dlg).addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - toucheX;
  const dy = e.changedTouches[0].clientY - toucheY;
  if (liste.length > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) afficherVue(pos + (dx < 0 ? 1 : -1));
}, { passive: true });

// Échap en plein écran : on quitte d'abord le plein écran, la visionneuse reste ouverte (un second Échap la ferme).
dlg.addEventListener('cancel', (e) => {
  if (document.fullscreenElement) { e.preventDefault(); document.exitFullscreen().catch(() => {}); }
});

// Retour du focus sur la tuile de la photo affichée en dernier.
dlg.addEventListener('close', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  const tuile = $(`.tuile[data-i="${courant}"] .ouvrir`);
  (tuile && !tuile.closest(".tuile").hidden ? tuile : $("[data-filtre=\"favoris\"]"))?.focus();
});

// Plein écran : masqué quand le navigateur ne le permet pas (ex. iPhone).
if (document.fullscreenEnabled && conteneurPlein.requestFullscreen) {
  bPlein.hidden = false;
  bPlein.addEventListener('click', () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    // Le plein écran se demande sur le conteneur intérieur : Chrome le refuse sur un <dialog>.
    // Si le navigateur refuse malgré tout, le bouton disparaît au lieu de rester sans effet.
    conteneurPlein.requestFullscreen().catch((err) => {
      console.warn('Plein écran refusé', err);
      bPlein.hidden = true;
      $('[data-vfermer]', dlg).focus();
    });
  });
  document.addEventListener('fullscreenchange', () => {
    const plein = !!document.fullscreenElement;
    $('[data-plein-texte]', dlg).textContent = plein ? T.visionneuse.quitterPleinEcran : T.visionneuse.pleinEcran;
    bPlein.setAttribute('aria-pressed', String(plein));
  });
}

// ---------- Téléchargement complet (mode téléchargement) ----------
function formaterPoids(octets) {
  return octets >= 1e9 ? `${nombre(octets / 1e9, 1)} ${T.telechargement.uniteGo}` : `${nombre(Math.max(1, octets / 1e6))} ${T.telechargement.uniteMo}`;
}
const poidsTotal = () => photos.reduce((s, p) => s + (p.poids || 0), 0);

function majBarreTelechargement() {
  const poids = formaterPoids(poidsTotal());
  { const l = $("[data-poids]"); l.hidden = photos.length < 2; l.textContent = g(T.telechargement.poidsTotal, { n: photos.length, poids }); }
  $('[data-tout]', document).textContent = g(photos.length === 1 ? T.telechargement.toutTelechargerUne : T.telechargement.toutTelecharger, { n: photos.length, poids });
  const conseil = $('[data-conseil]', document);
  // Téléphone : conseil au-delà de 500 Mo. Ordinateur sans enregistrement en flux (Safari, Firefox) : le zip se construit
  // entièrement en mémoire, conseil au-delà de 1 Go.
  const tactile = matchMedia('(pointer: coarse)').matches;
  const enMemoire = !window.showSaveFilePicker;
  conseil.hidden = !((tactile && poidsTotal() > 500e6) || (enMemoire && poidsTotal() > 1e9));
  conseil.textContent = g(tactile ? T.telechargement.conseilTelephone : (T.telechargement.conseilMemoire || T.telechargement.conseilTelephone), { poids });
}

const retirerAccents = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const nomZip = () => {
  const base = retirerAccents(galerie.titre || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // La date de la séance en premier (2026-11-12-…) : les fichiers se classent seuls par date chez le client.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(galerie.date || '') ? `${galerie.date}-` : '';
  return `${date}${base ? `${base}-` : ''}${T.telechargement.suffixeFichier}.zip`;
};
// Deux photos de même nom : le second reçoit -2, -3… pour ne pas s'écraser dans le zip.
function nomsUniques() {
  const vus = new Map();
  return photos.map((p, i) => {
    const brut = (p.nom || `photo-${i + 1}.jpg`).replace(/[\\/]/g, '-');
    const n = (vus.get(brut) || 0) + 1;
    vus.set(brut, n);
    if (n === 1) return brut;
    const point = brut.lastIndexOf('.');
    return point > 0 ? `${brut.slice(0, point)}-${n}${brut.slice(point)}` : `${brut}-${n}`;
  });
}

function statut(texte, progression) {
  const s = $('[data-statut]', document);
  s.hidden = !texte;
  s.textContent = texte || '';
  const jauge = $('[data-jauge-zip]', document);
  jauge.hidden = progression === undefined;
  if (progression !== undefined) $('span', jauge).style.transform = `scaleX(${progression})`;
}
function boutonsZip(enCours) {
  $('[data-tout]', document).hidden = enCours;
  $('[data-annuler]', document).hidden = !enCours;
}

async function toutTelecharger() {
  if (zipEnCours) return;
  const fichier = nomZip();
  // Enregistrement en flux quand le navigateur le permet (pas de zip entier en mémoire) ; à demander avant tout le reste.
  let sortie = null;
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: fichier, types: [{ description: 'Zip', accept: { 'application/zip': ['.zip'] } }] });
      sortie = await h.createWritable();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      sortie = null;
    }
  }
  const ctrl = new AbortController();
  zipEnCours = ctrl;
  boutonsZip(true);
  statut(T.telechargement.preparation, 0);
  // « Tout télécharger » vient d'être caché : le focus passe sur « Annuler » pour ne pas tomber sur la page.
  $('[data-annuler]', document).focus();
  const noms = nomsUniques();
  try {
    const { downloadZip } = await import('client-zip');
    async function* fichiers() {
      for (let i = 0; i < photos.length; i++) {
        statut(g(T.telechargement.progression, { fait: i, total: photos.length }), i / photos.length);
        const r = await fetch(photos[i].original, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`photo ${i + 1}`);
        yield { name: noms[i], lastModified: new Date(), input: r };
      }
    }
    const reponse = downloadZip(fichiers());
    if (sortie) {
      await reponse.body.pipeTo(sortie, { signal: ctrl.signal });
    } else {
      const blob = await reponse.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fichier;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    }
    statut(g(T.telechargement.termine, { nom: fichier }));
  } catch (e) {
    if (sortie) { try { await sortie.abort(); } catch { /* déjà fermé */ } }
    statut(ctrl.signal.aborted ? T.telechargement.annule : T.telechargement.echec);
  } finally {
    zipEnCours = null;
    // Le bouton est réaffiché avant de recevoir le focus (un élément caché ne peut pas le prendre).
    const avait = document.activeElement === document.body || document.querySelector('[data-barre="telechargement"]').contains(document.activeElement);
    boutonsZip(false);
    if (avait) $('[data-tout]', document).focus();
  }
}

document.querySelector('[data-tout]').addEventListener('click', toutTelecharger);
document.querySelector('[data-annuler]').addEventListener('click', () => {
  // Le focus est rendu à « Tout télécharger » une fois qu'il est de nouveau affiché (fin du téléchargement annulé).
  if (zipEnCours) zipEnCours.abort();
});

charger();
