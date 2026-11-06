/* TAIPEI CITY GUIDE — offline copy (service worker), v30.9.279.
   Keeps the whole site on the phone so it opens without a connection
   (MRT underground, mountains, roaming off). Nothing on screen changes.

   How it works
   - The first visit online stores every file listed in PRECACHE (in the background,
     after the page has loaded). Files added later are stored the first time they
     are used online.
   - The page itself (index.html) and unversioned data (…json, …csv without ?v=)
     come from the network when there is one, so updates show at once; the stored
     copy is used only when offline.
   - Versioned files (…?v=30.9.xxx) never change, so the stored copy is used directly;
     a new version is a new address and is fetched once.
   - Once a day, when online, every stored file is re-checked with a conditional
     request (unchanged files are not downloaded again).
   - Google Maps and every other site are never touched. editor/ is not handled.

   Maintenance: nothing is required. If a file is renamed or removed, the old entry
   simply drops out at the next daily check. */
'use strict';
const CACHE = 'tabi-taipei-v1';
const DAY = 24 * 60 * 60 * 1000;
const PRECACHE = [
  './',
  'index.html',
  'assets/apple-touch-icon.png',
  'assets/daytrips/jiufen.webp',
  'assets/daytrips/jiufen/10_lanterns_distant.webp',
  'assets/daytrips/jiufen/20_s1.webp',
  'assets/daytrips/jiufen/20_s10.webp',
  'assets/daytrips/jiufen/20_s2.webp',
  'assets/daytrips/jiufen/20_s3.webp',
  'assets/daytrips/jiufen/20_s4.webp',
  'assets/daytrips/jiufen/20_s5.webp',
  'assets/daytrips/jiufen/20_s6.webp',
  'assets/daytrips/jiufen/20_s7.webp',
  'assets/daytrips/jiufen/20_s8.webp',
  'assets/daytrips/jiufen/20_s9.webp',
  'assets/daytrips/jiufen/30_lanterns_glow.webp',
  'assets/daytrips/jiufen/bg.webp',
  'assets/daytrips/keelung.webp',
  'assets/daytrips/keelung/10_boat_1.webp',
  'assets/daytrips/keelung/10_boat_2.webp',
  'assets/daytrips/keelung/10_boat_3.webp',
  'assets/daytrips/keelung/20_sea_breeze.webp',
  'assets/daytrips/keelung/30_water_surface_ripples.webp',
  'assets/daytrips/keelung/bg.webp',
  'assets/daytrips/shifen.webp',
  'assets/daytrips/shifen/10_waterfall.webp',
  'assets/daytrips/shifen/20_sky_lanterns_distant.webp',
  'assets/daytrips/shifen/30_s1.webp',
  'assets/daytrips/shifen/30_s2.webp',
  'assets/daytrips/shifen/30_s3.webp',
  'assets/daytrips/shifen/30_s4.webp',
  'assets/daytrips/shifen/30_s5.webp',
  'assets/daytrips/shifen/30_static.webp',
  'assets/daytrips/shifen/40_people_on_platform.webp',
  'assets/daytrips/shifen/bg.webp',
  'assets/daytrips/yehliu.webp',
  'assets/daytrips/yehliu/10_ocean_wind.webp',
  'assets/daytrips/yehliu/20_waves_distant.webp',
  'assets/daytrips/yehliu/30_waves_near.webp',
  'assets/daytrips/yehliu/bg.webp',
  'assets/fonts/tabi-greeting-serif.woff2',
  'assets/icons/jade-cabbage.webp',
  'assets/icons/sky-lantern.webp',
  'assets/icons/taiwan-railways.webp',
  'assets/icons/tra-emblem.svg',
  'assets/rail-logos/ntmc.svg',
  'assets/rail-logos/thsr.svg',
  'assets/rail-logos/tra.svg',
  'assets/rail-logos/trtc.svg',
  'assets/rail-logos/tymc.svg',
  'css/area-map.css',
  'css/chapter-tabs.css',
  'css/events.css',
  'css/guide.css',
  'css/recommend.css',
  'data/areas.js',
  'data/events.js',
  'data/experiences.json',
  'data/night-market-map.js',
  'data/night-market-metro.js',
  'data/night-markets.js',
  'data/sights.json',
  'data/souvenirs.json',
  'food/foods.csv',
  'food/index.html',
  'food/market_items.csv',
  'food/mrt_stations.json',
  'food/nearby.json',
  'food/recommend_notes.json',
  'food/synonyms.json',
  'js/areas.js',
  'js/area-map.js',
  'js/chapter-tabs.js',
  'js/daytrip-scenes.js',
  'js/directory.js',
  'js/events.js',
  'js/guide.js',
  'js/hero-intro.js',
  'js/night-markets.js',
  'js/recommend.js'
];

const base = new URL('./', self.location).href;                 // the site folder
const isOwn = url => url.origin === self.location.origin && url.href.startsWith(base);
const handled = url => isOwn(url) && !url.pathname.includes('/editor/') && !url.pathname.endsWith('/sw.js');

// Store one file; a missing or failing file is skipped, never breaks the rest.
async function store(cache, path) {
  try {
    const res = await fetch(new Request(path, {cache: 'no-cache'}));
    if (res.ok) await cache.put(path, res);
  } catch (_) {}
}
async function refreshAll() {
  const cache = await caches.open(CACHE);
  const known = (await cache.keys()).map(r => r.url);
  const list = new Set([...PRECACHE.map(p => new URL(p, base).href), ...known]);
  // A few at a time, so a phone on a slow line is not flooded.
  const queue = [...list];
  const worker = async () => { while (queue.length) await store(cache, queue.shift()); };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await cache.put(new URL('__refreshed__', base).href, new Response(String(Date.now())));
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(refreshAll());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('tabi-taipei-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
// The page says hello once it has loaded: re-check everything if the last check is
// more than a day old.
self.addEventListener('message', event => {
  if (event.data !== 'refresh') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const stamp = await cache.match(new URL('__refreshed__', base).href);
    const last = stamp ? Number(await stamp.text()) : 0;
    if (Date.now() - last > DAY) await refreshAll();
  })());
});

// Offline fallback: the stored copy of this file, whatever its ?v= is.
const fromCache = async request => {
  const cache = await caches.open(CACHE);
  return (await cache.match(request)) || (await cache.match(request, {ignoreSearch: true}));
};
// Keep one copy per file: a new ?v= replaces the older ones.
async function keep(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  if (url.search) {
    for (const old of await cache.keys(request, {ignoreSearch: true})) if (old.url !== request.url) await cache.delete(old);
  }
  await cache.put(request, response);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!handled(url)) return;

  if (request.mode === 'navigate') {
    // Network first (fresh content when online), the stored page when offline.
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        event.waitUntil(keep(new Request(new URL('./', base).href), res.clone()));
        return res;
      } catch (_) {
        return (await fromCache(request)) || (await fromCache(new Request(new URL('./', base).href)))
          || (await fromCache(new Request(new URL('index.html', base).href)))
          || new Response('オフラインです。', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }

  if (/[?&]v=/.test(url.search)) {
    // Versioned: stored copy first, network once for a new version.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        event.waitUntil(keep(request, res.clone()));
        return res;
      } catch (_) {
        return (await fromCache(request)) || Response.error();
      }
    })());
    return;
  }

  // Everything else of ours: network first, stored copy when offline.
  event.respondWith((async () => {
    try {
      const res = await fetch(request);
      event.waitUntil(keep(request, res.clone()));
      return res;
    } catch (_) {
      return (await fromCache(request)) || Response.error();
    }
  })());
});
