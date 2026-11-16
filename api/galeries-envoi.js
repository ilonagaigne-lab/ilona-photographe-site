// Envoi des photos d'une galerie : le navigateur d'Ilona envoie chaque fichier directement au magasin Blob,
// après avoir obtenu ici une autorisation limitée à galeries/<id>/(originaux|vues|miniatures)/…
import { handleUpload } from '@vercel/blob/client';
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
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ ok: false, erreur: 'Le stockage des photos n’est pas encore relié au site.' });
    }
    const corps = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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
