// Heure du coucher du soleil et début de la lumière dorée à Toulouse (formules astronomiques usuelles, précision ~1 min).
const RAD = Math.PI / 180;
const JOUR = 864e5, J1970 = 2440588, J2000 = 2451545, OBLIQUITE = RAD * 23.4397, J0 = 0.0009;
const TOULOUSE = { lat: 43.6045, lng: 1.4442 };

const versJours = (date) => date.valueOf() / JOUR - 0.5 + J1970 - J2000;
const depuisJulien = (j) => new Date((j + 0.5 - J1970) * JOUR);
const anomalie = (d) => RAD * (357.5291 + 0.98560028 * d);
function longitude(M) {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  return M + C + RAD * 102.9372 + Math.PI;
}
const declinaison = (l) => Math.asin(Math.sin(OBLIQUITE) * Math.sin(l));
const transit = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

/** Renvoie { coucher, doree } (objets Date) pour le jour donné. */
export function lumiereDuSoir(date, { lat, lng } = TOULOUSE) {
  const lw = RAD * -lng, phi = RAD * lat;
  const midi = new Date(date); midi.setHours(12, 0, 0, 0);
  const d = versJours(midi);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = anomalie(ds), L = longitude(M), dec = declinaison(L);
  const pourHauteur = (h) => {
    const w = Math.acos((Math.sin(h * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    return depuisJulien(transit(J0 + (w + lw) / (2 * Math.PI) + n, M, L));
  };
  return { coucher: pourHauteur(-0.833), doree: pourHauteur(6) };
}

export const heure = (date) => date.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
export const jour = (date) => date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' });

/** Les n prochains samedis (à partir de demain). */
export function prochainsSamedis(n = 3, depuis = new Date()) {
  const res = [];
  const d = new Date(depuis); d.setDate(d.getDate() + 1);
  while (res.length < n) { if (d.getDay() === 6) res.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return res;
}
