// Préfixe des chemins internes : '' en local, '/lenveloppe' sur GitHub Pages (voir astro.config.mjs).
export const B = import.meta.env.BASE_URL.replace(/\/$/, '');
