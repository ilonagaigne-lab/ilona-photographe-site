// Comportements communs : apparition au défilement, obturateur, curseur, menu mobile.
const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mouvement réduit : les vidéos décoratives restent sur leur première image.
if (calme) document.querySelectorAll('video[autoplay]').forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });

// Les sections démarrent leurs animations quand elles entrent à l'écran.
const sections = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
  sections.forEach((s) => io.observe(s));
} else {
  sections.forEach((s) => s.classList.add('in'));
}

// Obturateur : les volets se ferment avant de changer de page.
const obturateur = document.querySelector('.obturateur');
if (obturateur && !calme) {
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href]');
    if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    ev.preventDefault();
    obturateur.classList.add('ferme');
    setTimeout(() => { location.href = url.href; }, 200);
  });
  // Retour arrière depuis le cache du navigateur : rouvrir les volets.
  addEventListener('pageshow', (e) => { if (e.persisted) obturateur.classList.remove('ferme'); });
}

// Curseur contextuel : Voir / Lecture / Choisir.
const curseur = document.querySelector('.curseur');
if (curseur && !calme && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const libelles = { voir: 'Voir', lecture: 'Lecture', choisir: 'Choisir' };
  let x = -200, y = -200, actif = false;
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    const cible = e.target.closest('[data-curseur]');
    const type = cible ? cible.dataset.curseur : null;
    if (type) {
      if (curseur.dataset.type !== type) { curseur.dataset.type = type; curseur.textContent = libelles[type]; }
      if (!actif) { actif = true; curseur.classList.add('actif'); }
    } else if (actif) { actif = false; curseur.classList.remove('actif'); }
    curseur.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${actif ? 1 : .4})`;
  }, { passive: true });
}

// Menu mobile.
const menu = document.getElementById('menu');
const ouvrir = document.querySelector('.burger');
if (menu && ouvrir) {
  const fermer = menu.querySelector('.menu-fermer');
  const basculer = (etat) => {
    menu.classList.toggle('ouvert', etat);
    ouvrir.setAttribute('aria-expanded', String(etat));
    menu.inert = !etat;
    document.body.style.overflow = etat ? 'hidden' : '';
    (etat ? fermer : ouvrir).focus();
  };
  menu.inert = true;
  ouvrir.addEventListener('click', () => basculer(true));
  fermer.addEventListener('click', () => basculer(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('ouvert')) basculer(false); });
}
