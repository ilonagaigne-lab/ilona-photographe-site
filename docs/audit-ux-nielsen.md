# Audit UX : les 10 heuristiques de Nielsen

Site : https://ilonagaigne.com · audit du 3 novembre 2026

| # | Heuristique | Constat | Ce qui a été fait | Reste à faire |
|---|---|---|---|---|
| 1 | Visibilité de l’état du système | Bon : étapes de réservation, compteur de la galerie, prix recalculé en direct, page active surlignée. Faible : après « Envoyer ma demande », rien ne confirme que la demande est partie. | Écran « Demande prête » plus explicite, avec bouton « Copier ma demande ». | Vraie confirmation (e-mail automatique, écran « Demande reçue ») : nécessite un service d’envoi. |
| 2 | Correspondance avec le monde réel | Bon : vocabulaire cavalier (pré, paddock, robe, frontal), prix en euros TTC. | — | Préciser ce que contient chaque formule (durée, nombre de photos) : à fournir par Ilona. |
| 3 | Contrôle et liberté | Moyen : impossible de corriger une étape depuis le récapitulatif. | Boutons « Modifier » sur chaque ligne du récapitulatif ; « Retour » et « Quitter la réservation » ; menu fermable par Échap. | — |
| 4 | Cohérence et standards | Bon : un seul style de bouton, un seul geste (le surlignage), mêmes libellés partout. | — | — |
| 5 | Prévention des erreurs | Moyen : on pouvait choisir une date passée. | Dates passées bloquées ; champs obligatoires vérifiés étape par étape. | — |
| 6 | Reconnaissance plutôt que rappel | Moyen : pas de repère dans les pages profondes. | Fil d’Ariane sur la leçon, l’article et l’étude de cas ; résumé de la réservation toujours visible. | — |
| 7 | Flexibilité et efficacité | Moyen : sur mobile, le bouton « Réserver » disparaissait au défilement. | Bouton « Réserver une séance » flottant sur mobile ; liens directs vers une formule (« Choisir Sport » préremplit la réservation). | Créneaux disponibles en direct, réservation en un geste. |
| 8 | Esthétique et minimalisme | Faible : des cases d’exemple ([Durée], [Date], [X]) apparaissaient sur le site public. | Ces blocs ne s’affichent plus tant qu’ils sont vides ; l’agenda vide devient un message utile. | Fournir les contenus manquants. |
| 9 | Aider à reconnaître et corriger les erreurs | Moyen : si la messagerie ne s’ouvre pas, la demande était perdue. | Message d’erreur précis par champ, solution de secours (copier la demande, téléphone, e-mail). | — |
| 10 | Aide et documentation | Faible : aucune FAQ. | FAQ de six questions sur la page Séances, liée depuis le pied de page, décrite aussi pour Google et les IA. | — |

## Mesures après corrections (Google Lighthouse, mobile)

Vitesse 98 à 100 sur les 8 pages publiques · accessibilité 100 · bonnes pratiques 100 · référencement 100.

## SEO et GEO mis en place

- Données structurées : fiche d’activité (prestations et prix, zone Toulouse et Haute-Garonne, contact, Instagram), personne, FAQ, articles, fil d’Ariane.
- Plan du site (`/sitemap.xml`), `robots.txt`, adresses canoniques, image et textes de partage pour les réseaux.
- `/llms.txt` : fiche lisible par les IA (ChatGPT, Perplexity, Gemini) avec services, tarifs, zone et contact.

## Manques qui pèsent sur la conversion

- Aucune preuve sociale (avis, témoignages, nombre de séances).
- Pas de disponibilités ni de paiement d’acompte : la réservation reste une demande.
- Mentions légales absentes (obligatoires) et nom de domaine à brancher.
