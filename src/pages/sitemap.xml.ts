import { site } from '../data';

const pages = [
  { chemin: '/', priorite: '1.0' },
  { chemin: '/seances', priorite: '0.9' },
  { chemin: '/trouver-ma-seance', priorite: '0.9' },
  { chemin: '/concours', priorite: '0.8' },
  { chemin: '/marques', priorite: '0.8' },
  { chemin: '/reservation', priorite: '0.7' },
  { chemin: '/etudes-de-cas/galoplan', priorite: '0.6' },
  { chemin: '/academie/lire-la-lumiere-du-soir', priorite: '0.5' },
  { chemin: '/journal/preparer-son-cheval', priorite: '0.5' },
];

export function GET() {
  const jour = new Date().toISOString().slice(0, 10);
  const urls = pages.map((p) => `  <url><loc>${new URL(p.chemin, site.url).href.replace(/\/$/, p.chemin === '/' ? '/' : '')}</loc><lastmod>${jour}</lastmod><priority>${p.priorite}</priority></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
