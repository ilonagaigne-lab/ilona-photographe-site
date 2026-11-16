// Envoi des photos d'une galerie : le navigateur d'Ilona envoie chaque fichier directement au magasin Blob,
// après avoir obtenu ici une autorisation limitée à galeries/<id>/(originaux|vues|miniatures)/…
// Autorisation par adresse présignée (uploadPresigned côté page) : elle passe par l'accès OIDC que Vercel donne
// au projet (BLOB_STORE_ID), ou à défaut par BLOB_READ_WRITE_TOKEN. L'ancienne autorisation (handleUpload),
// qui exige une clé BLOB_READ_WRITE_TOKEN complète, reste acceptée.
import { handleUpload, handleUploadPresigned } from '@vercel/blob/client';
import { issueSignedToken } from '@vercel/blob';
import { ID_VALIDE, DOSSIERS_PHOTOS, verifierIlona, joursAvant } from './_lib/galeries.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const TAILLE_MAX = 60 * 1024 * 1024;

// galeries/<id>/<dossier>/<12 caractères aléatoires>/<fichier> : segment aléatoire obligatoire, pas d'autre sous-dossier, pas de « .. », pas d'antislash.
export function cheminAutorise(pathname) {
  if (typeof pathname !== 'string' || pathname.length > 400 || pathname.includes('..') || pathname.includes('\\')) return false;
  const m = /^galeries\/([^/]+)\/([^/]+)\/([A-Za-z0-9_-]{12})\/([^/]{1,200})$/.exec(pathname);
  return Boolean(m && ID_VALIDE.test(m[1]) && DOSSIERS_PHOTOS.includes(m[2]));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erreur: 'Action non prévue.' });
  }
  try {
    if (!(await verifierIlona(req))) {
      return res.status(401).json({ ok: false, erreur: 'Connexion requise. Connectez-vous d’abord au back office.' });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
      return res.status(503).json({ ok: false, erreur: 'Le stockage des photos n’est pas encore relié au site.' });
    }
    const corps = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const dureeDe = (clientPayload) => {
      let expireLe = '';
      try { expireLe = JSON.parse(clientPayload || '{}').expireLe || ''; } catch { /* date absente : durée par défaut */ }
      return /^\d{4}-\d{2}-\d{2}$/.test(expireLe) ? joursAvant(expireLe) : 100;
    };
    if (corps?.type === 'blob.generate-presigned-url') {
      const reponse = await handleUploadPresigned({
        body: corps,
        request: req,
        // La clé publique ne sert qu'à vérifier les avis « envoi terminé » de Vercel Blob, que ce site n'utilise pas
        // (la page enregistre elle-même la fiche après l'envoi) : seule la demande d'adresse présignée passe ici.
        webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'non-utilisee',
        getSignedToken: async (pathname, clientPayload) => {
          if (!cheminAutorise(pathname)) throw new Error('Chemin d’envoi refusé.');
          const token = await issueSignedToken({
            pathname,
            operations: ['put'],
            allowedContentTypes: TYPES,
            maximumSizeInBytes: TAILLE_MAX,
            validUntil: Date.now() + 60 * 60 * 1000,
          });
          return {
            token,
            urlOptions: { allowedContentTypes: TYPES, maximumSizeInBytes: TAILLE_MAX, addRandomSuffix: false, ttlDays: dureeDe(clientPayload) },
          };
        },
      });
      return res.status(200).json(reponse);
    }
    const reponse = await handleUpload({
      body: corps,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!cheminAutorise(pathname)) throw new Error('Chemin d’envoi refusé.');
        let expireLe = '';
        try { expireLe = JSON.parse(clientPayload || '{}').expireLe || ''; } catch { /* date absente : durée par défaut */ }
        return {
          allowedContentTypes: TYPES,
          maximumSizeInBytes: TAILLE_MAX,
          addRandomSuffix: false,
          ttlDays: /^\d{4}-\d{2}-\d{2}$/.test(expireLe) ? joursAvant(expireLe) : 100,
        };
      },
    });
    return res.status(200).json(reponse);
  } catch (e) {
    console.error('galeries-envoi :', e?.name, e?.message);
    return res.status(400).json({ ok: false, erreur: e?.message === 'Chemin d’envoi refusé.' ? e.message : 'Cet envoi n’a pas pu être autorisé.' });
  }
}
