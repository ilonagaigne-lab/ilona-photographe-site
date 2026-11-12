// Fiche lue par les assistants IA (ChatGPT, Perplexity…) : régénérée à chaque mise en ligne
// à partir des formules, des questions fréquentes et des coordonnées saisies dans le back office.
import { site, contact, seances, concours, phraseDeplacement, depart, faq } from '../data';

const eur = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;
const nombres = ['aucune', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit'];
const formules = seances.length === 1 ? 'la formule' : `les ${nombres[seances.length] ?? seances.length} formules`;
const u = (chemin: string) => new URL(chemin, site.url).href;
const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

const debut = `# ${site.nom}\n\n> Photographe et vidéaste spécialisée dans l’univers équestre et la création de contenu de marque, basée près de ${depart.ville} (Haute-Garonne, Occitanie). Séances photo avec votre cheval, photo et vidéo de concours hippique, contenus photo, vidéo et community management pour les marques équestres.\n\n`;

const suite = `## Pages
- [Séances photo équestres et tarifs](${u('/seances')}) : ${formules}, un calculateur de prix déplacement compris et les questions fréquentes.
- [Trouvez votre séance](${u('/trouver-ma-seance')}) : quiz de trois questions qui conseille la formule adaptée, avec son prix et, si vous le souhaitez, les heures de lumière dorée à ${depart.ville}.
- [Photographe de concours équestre](${u('/concours')}) : photo, vidéo et réel souvenir le jour du concours.
- [Contenu de marque et réseaux sociaux](${u('/marques')}) : shooting produit, vidéo, community management pour selleries, écuries, éleveurs et créateurs d’équipement.
- [Étude de cas GaloPlan](${u('/etudes-de-cas/galoplan')}) : deux réels verticaux tournés à l’écurie pour l’application du cheval partagé.
- [Demander une séance](${u('/reservation')}) : demande en quatre étapes, pour n’importe quel moment de la journée ; Ilona confirme la date, l’heure et le prix final par e-mail, rien n’est payé en ligne.
- [Leçon : lire la lumière du soir](${u('/academie/lire-la-lumiere-du-soir')}) : photographier son cheval en fin de journée avec un téléphone.
- [Préparer son cheval pour sa séance photo](${u('/journal/preparer-son-cheval')}) : pansage, harnachement, tenue du cavalier.

## Déroulé d’une séance
1. Demande en ligne : formule, lieu, moment souhaité (peu importe, matin, après-midi ou fin de journée), date facultative, coordonnées.
2. Ilona confirme par e-mail la date, l’heure et le prix final. Tous les moments de la journée peuvent être demandés ; la lumière dorée de fin de journée est un conseil d’Ilona pour qui la souhaite.
3. Séance à l’écurie ou au pré, au rythme du cheval.
4. Galerie privée en ligne : le client choisit ses favoris ; la formule inclut un nombre de photos, les supplémentaires s’ajoutent à l’unité.
`;

export function GET() {
  const tarifs = [
    ...seances.map((s) => `- Séance photo équestre ${s.nom} : ${eur(s.prix)}${s.details.length ? ` (${s.details.join(', ')})` : ''}`),
    ...concours.map((c) => `- En concours, ${c.nom.toLowerCase()} : ${eur(c.prix)}`),
    '- Marques et réseaux sociaux : sur devis',
  ].join('\n');
  const questions = faq.map((f) => `### ${f.q}\n${f.r}`).join('\n\n');
  const texte = `${debut}## Faits clés
- Qui : Ilona, photographe et vidéaste équestre (${site.nom}).
- Où : ${depart.ville}, Haute-Garonne et alentours, à l’écurie ou au pré.
- Quoi : séances photo avec votre cheval, photo et vidéo de concours, contenus pour les marques équestres.
- Réserver : demande en ligne sur ${u('/reservation')}, pour n’importe quel moment de la journée ; Ilona confirme la date, l’heure et le prix final par e-mail.

## Contact
- Téléphone : ${contact.telephone}
- E-mail : ${contact.email}
- Instagram : ${contact.instagram} (${contact.instagramLien})
- Zone : ${depart.ville} et alentours ; ${minuscule(phraseDeplacement)}

## Tarifs (TTC)
${tarifs}

${suite}
## Questions fréquentes
${questions}
`;
  return new Response(texte, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
