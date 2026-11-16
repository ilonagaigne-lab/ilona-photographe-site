// Outils de la page /admin/galeries (projets clients) : date de prise de vue d'une photo et ordre des photos.
// Aucune dépendance : le lecteur ne lit que le début du fichier, dans le navigateur d'Ilona.

// ---------- Date de prise de vue ----------
const SANS_DATE = { original: null, modifiee: null };
const DATE_EXIF = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

// « 2026:11:14 16:24:31 » (écriture des appareils photo) → « 2026-11-14T16:24:31 », ou null si la date est absurde.
export function dateEnIso(brut) {
  const m = DATE_EXIF.exec(String(brut ?? ''));
  if (!m) return null;
  const [a, mo, j, h, mi, s] = m.slice(1).map(Number);
  const jourOk = a >= 1900 && mo >= 1 && mo <= 12 && j >= 1 && j <= new Date(Date.UTC(a, mo, 0)).getUTCDate();
  if (!jourOk || h > 23 || mi > 59 || s > 59) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

// Lit les balises de date d'un JPEG : DateTimeOriginal (0x9003, sous-IFD Exif) et DateTime (0x0132, IFD principal).
// `tampon` = début du fichier (ArrayBuffer). Jamais d'erreur : fichier sans données ou abîmé = aucune date.
export function lireDatesExif(tampon) {
  const res = { ...SANS_DATE };
  try {
    const v = new DataView(tampon);
    if (v.byteLength < 12 || v.getUint16(0) !== 0xffd8) return res;
    let pos = 2;
    while (pos + 4 <= v.byteLength && v.getUint8(pos) === 0xff) {
      const marqueur = v.getUint8(pos + 1);
      if (marqueur === 0xff) { pos += 1; continue; }
      if (marqueur === 0xda || marqueur === 0xd9) break; // début des pixels : plus de métadonnées
      if (marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) { pos += 2; continue; }
      const longueur = v.getUint16(pos + 2);
      if (marqueur === 0xe1 && longueur >= 8 && v.getUint32(pos + 4) === 0x45786966 && v.getUint16(pos + 8) === 0) {
        lireTiff(v, pos + 10, res);
        if (res.original || res.modifiee) break;
      }
      pos += 2 + longueur;
    }
  } catch {
    // fichier tronqué ou illisible : on garde ce qui a été trouvé
  }
  return res;
}

function lireTiff(v, debut, res) {
  const petit = v.getUint16(debut) === 0x4949; // « II » = petit-boutiste, « MM » = gros-boutiste
  if (!petit && v.getUint16(debut) !== 0x4d4d) return;
  const u16 = (o) => v.getUint16(o, petit);
  const u32 = (o) => v.getUint32(o, petit);
  const texte = (entree) => {
    const n = u32(entree + 4);
    if (u16(entree + 2) !== 2 || n < 19 || n > 64) return null; // type texte, « AAAA:MM:JJ HH:MM:SS »
    const o = n <= 4 ? entree + 8 : debut + u32(entree + 8);
    let t = '';
    for (let i = 0; i < n - 1; i++) t += String.fromCharCode(v.getUint8(o + i));
    return t;
  };
  const parcourir = (ifd, quand) => {
    const n = u16(ifd);
    for (let i = 0; i < n && i < 500; i++) quand(u16(ifd + 2 + 12 * i), ifd + 2 + 12 * i);
  };
  let exif = 0;
  try {
    parcourir(debut + u32(debut + 4), (tag, entree) => {
      if (tag === 0x0132 && !res.modifiee) res.modifiee = dateEnIso(texte(entree));
      if (tag === 0x8769) exif = debut + u32(entree + 8);
    });
  } catch { /* on tente quand même la sous-IFD si on l'a trouvée */ }
  if (!exif) return;
  try {
    parcourir(exif, (tag, entree) => {
      if (tag === 0x9003 && !res.original) res.original = dateEnIso(texte(entree));
    });
  } catch { /* fin de fichier atteinte */ }
}

const deuxChiffres = (n) => String(n).padStart(2, '0');
function dateLocale(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}T${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}:${deuxChiffres(d.getSeconds())}`;
}

// Date de prise de vue d'un fichier : DateTimeOriginal, sinon DateTime, sinon date de dernière modification du fichier.
export async function lirePrise(fichier) {
  try {
    const dates = lireDatesExif(await fichier.slice(0, 256 * 1024).arrayBuffer());
    if (dates.original) return dates.original;
    if (dates.modifiee) return dates.modifiee;
  } catch {
    // on passe au repli
  }
  return dateLocale(fichier?.lastModified);
}

// « 2026-11-14T16:24:31 » → « 14 nov. 2026, 16:24 »
export function formaterPrise(prise) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(prise ?? ''));
  if (!m) return 'Date inconnue';
  const jour = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${Number(m[3]) === 1 ? jour.replace(/^1(?=\s)/, '1er') : jour}, ${m[4]}:${m[5]}`;
}

// ---------- Ordre des photos ----------
// Même règle que trierPhotos de api/_lib/tri.js (le test vérifie que les deux donnent le même ordre).
function priseValide(v) {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(v) : null;
  if (!m) return null;
  const [, a, mo, j, h, mi, s] = m.map(Number);
  const jourOk = mo >= 1 && mo <= 12 && j >= 1 && j <= new Date(Date.UTC(a, mo, 0)).getUTCDate();
  return jourOk && h <= 23 && mi <= 59 && s <= 59 ? v : null;
}
const parNom = (a, b) => String(a?.nom ?? '').localeCompare(String(b?.nom ?? ''), 'fr', { numeric: true, sensitivity: 'base' });
export function trierPhotos(photos, tri = 'date') {
  const liste = Array.isArray(photos) ? [...photos] : [];
  if (tri === 'nom') return liste.sort(parNom);
  return liste.sort((a, b) => {
    const pa = priseValide(a?.prise);
    const pb = priseValide(b?.prise);
    if (pa && pb && pa !== pb) return pa < pb ? -1 : 1;
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    return parNom(a, b);
  });
}
