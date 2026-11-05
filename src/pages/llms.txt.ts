// Fiche lue par les assistants IA (ChatGPT, Perplexity…) : régénérée à chaque mise en ligne
// à partir des formules et coordonnées saisies dans le back office.
import { contact, seances, concours, phraseDeplacement, depart } from '../data';

const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;
const debut = "# Ilona Photographe\n\n> Photographe et vidéaste spécialisée dans l’univers équestre et la création de contenu de marque, basée près de Toulouse (Haute-Garonne, Occitanie). Séances photo avec votre cheval, photo et vidéo de concours hippique, contenus photo, vidéo et community management pour les marques équestres.\n\n";
const nombres = ['aucune', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit'];
const formules = seances.length === 1 ? 'la formule' : `les ${nombres[seances.length] ?? seances.length} formules`;
const suite = `## Pages\n- [Séances photo équestres et tarifs](https://ilonagaigne.com/seances) : ${formules}, un calculateur de prix déplacement compris et les questions fréquentes.\n- [Trouvez votre séance](https://ilonagaigne.com/trouver-ma-seance) : quiz de trois questions qui conseille la formule adaptée, avec son prix et les heures de lumière dorée à Toulouse.\n- [Photographe de concours équestre](https://ilonagaigne.com/concours) : photo, vidéo et réel souvenir le jour du concours.\n- [Contenu de marque et réseaux sociaux](https://ilonagaigne.com/marques) : shooting produit, vidéo, community management pour selleries, écuries, éleveurs et créateurs d’équipement.\n- [Étude de cas GaloPlan](https://ilonagaigne.com/etudes-de-cas/galoplan) : deux réels verticaux tournés à l’écurie pour l’application du cheval partagé.\n- [Réserver une séance](https://ilonagaigne.com/reservation) : demande en quatre étapes, confirmation par e-mail, rien n’est payé en ligne.\n- [Leçon : lire la lumière du soir](https://ilonagaigne.com/academie/lire-la-lumiere-du-soir) : photographier son cheval au coucher du soleil avec un téléphone.\n- [Préparer son cheval pour sa séance photo](https://ilonagaigne.com/journal/preparer-son-cheval) : pansage, harnachement, tenue du cavalier.\n\n## Déroulé d’une séance\n1. Réservation en ligne (formule, lieu, date, coordonnées).\n2. Préparation : conseils de tenue, de lieu et d’heure de lumière.\n3. Séance à l’écurie ou au pré, au rythme du cheval.\n4. Galerie privée en ligne : le client choisit ses favoris ; la formule inclut un nombre de photos, les supplémentaires s’ajoutent à l’unité.\n`;

export function GET() {
  const tarifs = [
    ...seances.map((s) => `- Séance photo équestre ${s.nom} : ${eur(s.prix)}${s.details.length ? ` (${s.details.join(', ')})` : ''}`),
    ...concours.map((c) => `- En concours, ${c.nom.toLowerCase()} : ${eur(c.prix)}`),
    '- Marques et réseaux sociaux : sur devis',
    '- Cavaliers des Écuries d’En Ségur : 10 % de remise sur toutes les prestations',
  ].join('\n');
  const texte = `${debut}## Contact
- Téléphone : ${contact.telephone}
- E-mail : ${contact.email}
- Instagram : ${contact.instagram} (${contact.instagramLien})
- Zone : ${depart.ville} et alentours ; ${phraseDeplacement.charAt(0).toLowerCase()}${phraseDeplacement.slice(1)}

## Tarifs (TTC)
${tarifs}

${suite}`;
  return new Response(texte, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
