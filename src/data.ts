// Le contenu modifiable vit dans src/contenu/*.json, édité par Ilona depuis /admin.
// Ce fichier le met en forme pour les pages.
import contenuContact from './contenu/contact.json';
import prestations from './contenu/prestations.json';
import contenuAgenda from './contenu/agenda.json';
import contenuTemoignages from './contenu/temoignages.json';
import contenuGaloplan from './contenu/galoplan.json';
import contenuFaq from './contenu/faq.json';
import type { PhotoSaisie } from './lib/contenu';

export const site = {
  url: 'https://ilonagaigne.com',
  nom: 'Ilona Photographe',
  description: 'Photographe et vidéaste spécialisée dans l’univers équestre et la création de contenu de marque, près de Toulouse.',
};

// Point de départ d'Ilona pour le calcul des déplacements : son adresse est géolocalisée à la mise
// en ligne (Géoplateforme de l'IGN). Seules la commune et des coordonnées arrondies (~1 km) sont publiées.
const toulouse = { ville: 'Toulouse', lon: 1.44, lat: 43.6 };
async function localiser(adresse: string) {
  if (!adresse.trim()) return toulouse;
  try {
    const r = await fetch(`https://data.geopf.fr/geocodage/search?${new URLSearchParams({ q: adresse, limit: '1' })}`, { signal: AbortSignal.timeout(8000) });
    const f = (await r.json()).features?.[0];
    if (!f) throw new Error('adresse introuvable');
    const [lon, lat] = f.geometry.coordinates as [number, number];
    return { ville: f.properties.city || f.properties.name, lon: Math.round(lon * 100) / 100, lat: Math.round(lat * 100) / 100 };
  } catch (e) {
    console.warn(`Adresse d'Ilona non localisée (${adresse}) : Toulouse par défaut.`, e);
    return toulouse;
  }
}
export const depart = await localiser(contenuContact.adresse ?? '');

const chiffres = contenuContact.telephone.replace(/\D/g, '');
const international = `+33${chiffres.replace(/^0/, '')}`;
const pseudo = contenuContact.instagram.replace(/^@/, '').trim();
export const contact = {
  telephone: contenuContact.telephone,
  telephoneLien: `tel:${international}`,
  telephoneInternational: international,
  email: contenuContact.email,
  instagram: `@${pseudo}`,
  instagramLien: `https://www.instagram.com/${pseudo}/`,
};

// Identifiant d'une formule (sert dans les liens /reservation?formule=…) : celui d'origine, sinon tiré du nom.
const identifiant = (nom: string) => nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;

interface Formule { id: string; nom: string; prix: number; accroche: string; details: string[]; photo: PhotoSaisie; video: boolean; vedette: boolean }
interface FormuleConcours { id: string; nom: string; nomCourt: string; prix: number; description: string; photo: boolean; video: boolean; vedette: boolean }

export const seances: Formule[] = (prestations.seances as Partial<Formule>[]).filter((s) => s.nom).map((s) => ({
  id: s.id || identifiant(s.nom!), nom: s.nom!, prix: Number(s.prix) || 0, accroche: s.accroche ?? '',
  details: (s.details ?? []).filter(Boolean), photo: s.photo!, video: !!s.video, vedette: !!s.vedette,
}));
// Formule mise en avant (présélectionnée dans le calculateur et la réservation).
export const seanceVedette = seances.find((s) => s.vedette) ?? seances[0];

// Détails par formule (durée, nombre de photos…). Une liste vide n'affiche rien.
export const detailsFormules: Record<string, string[]> = Object.fromEntries(seances.map((s) => [s.id, s.details]));

export const concours: FormuleConcours[] = (prestations.concours as Partial<FormuleConcours>[]).filter((c) => c.nom).map((c) => ({
  id: c.id || `concours-${identifiant(c.nom!)}`, nom: c.nom!, nomCourt: c.nomCourt || c.nom!, prix: Number(c.prix) || 0,
  description: c.description ?? '', photo: c.photo ?? true, video: !!c.video, vedette: !!c.vedette,
}));

const min = (l: { prix: number }[]) => (l.length ? Math.min(...l.map((x) => x.prix)) : 0);
export const prixMinSeance = min(seances);
export const prixMinConcours = min(concours);
const tous = [...seances, ...concours].map((x) => x.prix);
export const fourchettePrix = tous.length ? `${Math.min(...tous)} € – ${Math.max(...tous)} €` : '';
// Phrases réutilisées dans les descriptions Google et les réponses automatiques.
export const listeSeances = seances.map((s) => `${s.nom} ${eur(s.prix)}`).join(', ');
export const listeConcours = concours.map((c) => `${c.nomCourt.toLowerCase()} ${eur(c.prix)}`).join(', ');

// Prochains concours, triés par date ; ceux déjà passés au moment de la mise en ligne sont retirés.
// Vide = un message invite à écrire à Ilona.
const aujourdhui = new Date().toISOString().slice(0, 10);
const dateCourte = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const agenda: { date: string; nom: string; lieu: string; discipline: string }[] = (
  (contenuAgenda.concours ?? []) as { date: string; nom: string; lieu?: string; discipline?: string }[]
)
  .filter((c) => c.date && c.nom && String(c.date).slice(0, 10) >= aujourdhui)
  .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  .map((c) => ({ date: dateCourte.format(new Date(String(c.date).slice(0, 10))), nom: c.nom, lieu: c.lieu ?? '', discipline: c.discipline ?? '' }));

export const deplacement = prestations.deplacement;
export const phraseDeplacement = `Déplacement offert jusqu’à ${deplacement.gratuitJusqua} km de ${depart.ville}, puis ${eur(deplacement.prixKm)} par kilomètre.`;

export const galerieDemo = prestations.galerieDemo;

// Étude de cas GaloPlan. Vide = section masquée.
export const galoplan: { citation: string; auteur: string; resultats: { valeur: string; libelle: string }[] } = {
  citation: contenuGaloplan.citation ?? '',
  auteur: contenuGaloplan.auteur ?? '',
  resultats: contenuGaloplan.resultats ?? [],
};

// Questions fréquentes (affichées sur la page Séances et décrites pour Google et les IA).
// Les deux premières sont écrites automatiquement à partir des formules, pour rester toujours justes.
export const faq = [
  { q: 'Où se déroulent les séances photo ?', r: `À votre écurie ou au pré, autour de ${depart.ville}. ${phraseDeplacement}` },
  { q: 'Combien coûte une séance photo équestre ?', r: `${seances.length > 1 ? `${seances.length} formules` : 'Une formule'} : ${listeSeances}.${concours.length ? ` En concours : ${listeConcours}.` : ''}` },
  ...(contenuFaq.questions ?? []).filter((x) => x.question && x.reponse).map((x) => ({ q: x.question, r: x.reponse })),
];

// Témoignages clients (avec l'accord des clients). Vide = section masquée.
export const temoignages: { texte: string; auteur: string; cheval?: string; seance?: string }[] = contenuTemoignages.temoignages ?? [];
