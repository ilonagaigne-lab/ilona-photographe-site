// Distance par la route entre le point de départ d'Ilona et la commune du client (Géoplateforme de l'IGN,
// service public gratuit). Le point de départ est posé sur <html data-depart="lon,lat"> par Base.astro.
const IGN = 'https://data.geopf.fr';

const depart = () => (document.documentElement.dataset.depart || '1.44,43.6').split(',').map(Number);

// À vol d'oiseau × 1,3 : estimation de secours si le calcul d'itinéraire ne répond pas.
function volOiseau([lon1, lat1], [lon2, lat2]) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a)) * 1.3;
}

export async function communes(texte) {
  if (texte.trim().length < 3) return [];
  try {
    const r = await fetch(`${IGN}/geocodage/search?${new URLSearchParams({ q: texte, type: 'municipality', autocomplete: '1', limit: '6' })}`);
    const d = await r.json();
    return d.features.map((f) => ({ nom: `${f.properties.city || f.properties.name} (${f.properties.postcode})`, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
  } catch {
    return [];
  }
}

export async function kmDepuisIlona(lon, lat) {
  const [lon0, lat0] = depart();
  try {
    const p = new URLSearchParams({ resource: 'bdtopo-valhalla', start: `${lon0},${lat0}`, end: `${lon},${lat}`, profile: 'car', optimization: 'fastest', distanceUnit: 'kilometer', getSteps: 'false', getBbox: 'false', geometryFormat: 'polyline' });
    const d = await (await fetch(`${IGN}/navigation/itineraire?${p}`)).json();
    if (typeof d.distance !== 'number') throw new Error('pas de distance');
    return Math.round(d.distance);
  } catch {
    return Math.round(volOiseau([lon0, lat0], [lon, lat]));
  }
}

export const prixDeplacement = (km, gratuit, prixKm) => Math.round(Math.max(0, km - gratuit) * prixKm);

// Branche les suggestions de communes sur un champ texte. rappel({ nom, km }) quand une commune est
// reconnue, rappel(null) si le texte ne correspond à aucune commune (le client a pu taper une écurie).
export function brancherCommune(champ, rappel) {
  const liste = document.createElement('datalist');
  liste.id = `${champ.id || champ.name}-communes`;
  champ.setAttribute('list', liste.id);
  champ.setAttribute('autocomplete', 'off');
  champ.after(liste);
  let trouvees = [];
  let minuteur;
  let tour = 0;
  async function resoudre() {
    const texte = champ.value.trim();
    const n = ++tour;
    let c = trouvees.find((x) => x.nom === texte);
    if (!c && texte.length >= 3) c = (await communes(texte))[0];
    if (n !== tour) return;
    if (!c) return rappel(null);
    rappel({ nom: c.nom, km: await kmDepuisIlona(c.lon, c.lat) });
  }
  champ.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      trouvees = await communes(champ.value);
      liste.replaceChildren(...trouvees.map((c) => Object.assign(document.createElement('option'), { value: c.nom })));
      if (trouvees.some((x) => x.nom === champ.value.trim())) resoudre();
    }, 250);
  });
  champ.addEventListener('change', resoudre);
}
