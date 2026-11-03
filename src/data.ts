export const site = {
  url: 'https://ilonagaigne.com',
  nom: 'Ilona Photographe',
  description: 'Photographe et vidéaste spécialisée dans l’univers équestre et la création de contenu de marque, près de Toulouse.',
};

export const contact = {
  telephone: '06 83 41 01 80',
  telephoneLien: 'tel:+33683410180',
  telephoneInternational: '+33683410180',
  email: 'ilona.photography@gmail.com',
  instagram: '@ilona_photographe_',
  instagramLien: 'https://www.instagram.com/ilona_photographe_/',
};

export const seances = [
  { id: 'sport', nom: 'Sport', prix: 90, accroche: 'Votre couple en mouvement : le geste, l’effort, la concentration.' },
  { id: 'complicite', nom: 'Complicité', prix: 110, accroche: 'Vous et lui, à pied, en douceur. Les regards et les gestes qui ne trompent pas.' },
  { id: 'signature', nom: 'Signature', prix: 180, accroche: 'La séance éditoriale : lieu, lumière et tenue pensés ensemble avant le jour J.' },
  { id: 'collection', nom: 'Collection complète', prix: 250, accroche: 'Toutes les facettes de votre couple réunies en une seule séance.' },
];

// Détails par formule (durée, nombre de photos…) : à compléter avec Ilona. Une liste vide n'affiche rien.
export const detailsFormules: Record<string, string[]> = {
  sport: [],
  complicite: [],
  signature: [],
  collection: [],
};

export const concours = [
  { id: 'concours-photo', nom: 'Photo de concours', prix: 60 },
  { id: 'concours-video', nom: 'Photo + vidéo', prix: 80 },
  { id: 'concours-reel', nom: 'Réel souvenir', prix: 50 },
];

// Prochains concours : à compléter. Vide = un message invite à écrire à Ilona.
export const agenda: { date: string; nom: string; lieu: string; discipline: string }[] = [];

// Barème de déplacement : à confirmer avec Ilona.
export const deplacement = { gratuitJusqua: 20, prixKm: 0.5 };

// Galerie client de démonstration : à confirmer avec Ilona.
export const galerieDemo = { quota: 8, prixPhoto: 15 };

// Étude de cas GaloPlan : citation et chiffres à fournir. Vide = section masquée.
export const galoplan: { citation: string; auteur: string; resultats: { valeur: string; libelle: string }[] } = {
  citation: '',
  auteur: '',
  resultats: [],
};

// Questions fréquentes (affichées sur la page Séances et décrites pour Google et les IA).
export const faq = [
  {
    q: 'Où se déroulent les séances photo ?',
    r: `À votre écurie ou au pré, près de Toulouse. Le déplacement est offert jusqu’à ${deplacement.gratuitJusqua} km de Toulouse, puis facturé ${String(deplacement.prixKm).replace('.', ',')} € par kilomètre.`,
  },
  {
    q: 'Combien coûte une séance photo équestre ?',
    r: 'Quatre formules : Sport 90 €, Complicité 110 €, Signature 180 € et Collection complète 250 €. En concours : photo 60 €, photo + vidéo 80 €, réel souvenir 50 €.',
  },
  {
    q: 'Comment réserver ?',
    r: 'En quatre étapes sur la page Réservation : prestation, lieu et date, coordonnées, récapitulatif. Ilona confirme ensuite la date et le prix final par e-mail. Rien n’est payé en ligne au moment de la demande.',
  },
  {
    q: 'Comment reçoit-on ses photos ?',
    r: 'Dans une galerie privée en ligne. Vous choisissez vos favoris : la formule en inclut un nombre, et les photos supplémentaires s’ajoutent à l’unité.',
  },
  {
    q: 'Est-ce que vous faites aussi de la vidéo ?',
    r: 'Oui : réels verticaux pour les réseaux, vidéo de concours, films et contenus pour les marques équestres.',
  },
  {
    q: 'Y a-t-il une remise pour les Écuries d’En Ségur ?',
    r: 'Oui, les cavaliers des Écuries d’En Ségur bénéficient de 10 % de remise sur toutes les prestations, sur simple mention de leur écurie à la réservation.',
  },
];

// Témoignages clients : à fournir par Ilona (avec l'accord des clients). Vide = section masquée.
export const temoignages: { texte: string; auteur: string; cheval?: string; seance?: string }[] = [];
