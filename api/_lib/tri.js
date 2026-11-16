// Ordre des photos d'un projet (fiche de galerie) : une seule règle, partagée par l'enregistrement (api/galeries.js)
// et la galerie du client (api/galerie.js). La page /admin/galeries en garde une copie fidèle (src/scripts/projets-photos.js).
//   « date » : date de prise de vue croissante ; à égalité, ou sans date, par nom ; les photos sans date à la fin.
//   « nom »  : ordre naturel des noms (IMG_2 avant IMG_10).
export const TRIS = ['date', 'nom'];
// `prise` : « AAAA-MM-JJTHH:MM:SS » (heure de l'appareil, sans fuseau) ou null.
export const PRISE_VALIDE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

export function priseValide(v) {
  const m = typeof v === 'string' ? PRISE_VALIDE.exec(v) : null;
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

// Liste des projets : date de séance (sinon date de création) de la plus récente à la plus ancienne ; à date égale, par nom.
export const dateDuProjet = (g) => (typeof g?.date === 'string' && g.date ? g.date : String(g?.creeLe ?? '').slice(0, 10));
export function trierProjets(projets) {
  return [...projets].sort((a, b) => {
    const da = dateDuProjet(a);
    const db = dateDuProjet(b);
    if (da !== db) return da < db ? 1 : -1;
    return String(a?.titre ?? '').localeCompare(String(b?.titre ?? ''), 'fr', { numeric: true, sensitivity: 'base' });
  });
}
