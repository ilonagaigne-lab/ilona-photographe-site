// Distance par la route entre le point de départ d'Ilona et la commune du client (Géoplateforme de l'IGN,
// service public gratuit). Le point de départ est posé sur <html data-depart="lon,lat"> par Base.astro.
const IGN = 'https://data.geopf.fr';

const depart = () => (document.documentElement.dataset.depart || '1.44,43.6').split(',').map(Number);

// Renvoie les communes qui correspondent au texte ; lève une erreur si le service ne répond pas.
async function chercher(texte) {
  const r = await fetch(`${IGN}/geocodage/search?${new URLSearchParams({ q: texte, type: 'municipality', autocomplete: '1', limit: '6' })}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`geocodage ${r.status}`);
  const d = await r.json();
  return d.features.map((f) => ({ nom: `${f.properties.city || f.properties.name} (${f.properties.postcode})`, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
}

export async function communes(texte) {
  if (texte.trim().length < 3) return [];
  try {
    return await chercher(texte);
  } catch {
    return [];
  }
}

// Renvoie les km par la route, ou null si le calcul échoue : jamais de distance inventée.
export async function kmDepuisIlona(lon, lat) {
  const [lon0, lat0] = depart();
  try {
    const p = new URLSearchParams({ resource: 'bdtopo-valhalla', start: `${lon0},${lat0}`, end: `${lon},${lat}`, profile: 'car', optimization: 'fastest', distanceUnit: 'kilometer', getSteps: 'false', getBbox: 'false', geometryFormat: 'polyline' });
    const r = await fetch(`${IGN}/navigation/itineraire?${p}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`itineraire ${r.status}`);
    const d = await r.json();
    if (typeof d.distance !== 'number' || !isFinite(d.distance)) throw new Error('pas de distance');
    return Math.round(d.distance);
  } catch {
    return null;
  }
}

export const prixDeplacement = (km, gratuit, prixKm) => Math.round(Math.max(0, km - gratuit) * prixKm);

// Branche les suggestions de communes sur un champ texte. rappel({ nom, km }) quand une commune est
// reconnue (km vaut null si la distance n'a pas pu être calculée, ou si le service ne répond pas),
// rappel(null) si le texte ne correspond à aucune commune (le client a pu taper une écurie).
// options.auChangement() : le texte vient de changer ou a été vidé, tout résultat précédent est caduc.
// options.auCalcul() : une commune est reconnue, la distance est en cours de calcul.
// Renvoie { attendre() } : promesse du dernier calcul lancé (relance le calcul si le texte a changé depuis).
export function brancherCommune(champ, rappel, options = {}) {
  const liste = document.createElement('datalist');
  liste.id = `${champ.id || champ.name}-communes`;
  champ.setAttribute('list', liste.id);
  champ.setAttribute('autocomplete', 'off');
  champ.after(liste);
  let trouvees = [];
  let minuteur;
  let tour = 0;
  let dernier = null; // texte du dernier calcul lancé
  let promesse = Promise.resolve();

  async function resoudre(texte) {
    const n = ++tour;
    if (!texte) return options.auChangement ? options.auChangement() : rappel(null);
    let c = trouvees.find((x) => x.nom === texte);
    if (!c && texte.length >= 3) {
      try {
        c = (await chercher(texte))[0];
      } catch {
        if (n === tour) rappel({ nom: texte, km: null }); // service indisponible : message « distance non calculée »
        return;
      }
    }
    if (n !== tour) return;
    if (!c) return rappel(null);
    options.auCalcul?.();
    const km = await kmDepuisIlona(c.lon, c.lat);
    if (n !== tour) return; // un calcul plus récent a pris la suite : on ignore celui-ci
    rappel({ nom: c.nom, km });
  }
  function lancer() {
    const texte = champ.value.trim();
    if (texte === dernier) return promesse;
    dernier = texte;
    promesse = resoudre(texte);
    return promesse;
  }

  champ.addEventListener('input', () => {
    dernier = null;
    tour++; // tout calcul en cours devient caduc
    options.auChangement?.();
    clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      trouvees = await communes(champ.value);
      liste.replaceChildren(...trouvees.map((c) => Object.assign(document.createElement('option'), { value: c.nom })));
      if (trouvees.some((x) => x.nom === champ.value.trim())) lancer();
    }, 250);
  });
  champ.addEventListener('change', lancer);
  return { attendre: lancer };
}
