// Outils pour afficher le contenu saisi dans le back office (/admin).
import type { ImageMetadata } from 'astro';

// Toutes les photos du dossier src/assets/photos, y compris celles ajoutées depuis le back office.
const photos = import.meta.glob<{ default: ImageMetadata }>('/src/assets/photos/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', { eager: true });

export interface PhotoSaisie { image: string; alt?: string; cadrage?: string }
export interface VideoSaisie { fichier: string; affiche?: string; titre?: string }

// Chemin enregistré par le back office (/src/assets/photos/x.jpg) → image optimisée par Astro.
export function photo(chemin: string): ImageMetadata {
  const cle = chemin.startsWith('/') ? chemin : `/${chemin}`;
  const trouvee = photos[cle] ?? photos[decodeURI(cle)];
  if (!trouvee) throw new Error(`Photo introuvable : ${chemin} (elle doit être dans src/assets/photos)`);
  return trouvee.default;
}

// Cadrage choisi dans le back office → position CSS. Sans choix, on garde celle prévue par la page.
const cadrages: Record<string, string> = { centre: '50% 50%', haut: '50% 20%', bas: '50% 80%', gauche: '25% 50%', droite: '75% 50%' };
export const cadrage = (p: { cadrage?: string } | undefined, defaut = '50% 50%') => (p?.cadrage && cadrages[p.cadrage]) || defaut;

const echapper = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Texte d'un titre : *mot* = surligné en rose, retour à la ligne = nouvelle ligne.
// plein : surligné en aplat (sur fond sombre). delai : départ de l'animation du surlignage.
export function surligne(texte = '', { plein = false, delai }: { plein?: boolean; delai?: string } = {}) {
  const style = delai ? ` style="--d: ${delai}"` : '';
  return echapper(texte.trim())
    .replace(/\*([^*]+)\*/g, `<span class="hl${plein ? ' plein' : ''}"${style}>$1</span>`)
    .replace(/\r?\n/g, '<br>');
}

// Titre animé ligne par ligne (chaque ligne monte à son tour).
export function lignes(texte = '', pas = 0.12) {
  return texte.trim().split(/\r?\n/).map((l, i) =>
    `<span class="rv"><span${i ? ` style="--d: ${(i * pas + 0.08).toFixed(2)}s"` : ''}>${surligne(l, { delai: `${(0.9 + i * pas).toFixed(2)}s` })}</span></span>`,
  ).join('');
}

// Paragraphe simple : les retours à la ligne deviennent des sauts de ligne, le reste est du texte brut.
export const paragraphe = (texte = '') => echapper(texte.trim()).replace(/\r?\n/g, '<br>');
