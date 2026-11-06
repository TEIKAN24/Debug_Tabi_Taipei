/* TAIPEI CITY GUIDE — 街歩きエリア map, v30.9.279.
   The same map as 夜市マップ (js/night-markets.js → window.tabiSpotMap), with one name
   pill per area at data/areas.js groups[].map {label, lat, lng}. It takes the place of
   the area cards: tapping a name opens that area's details exactly as its card did
   (js/guide.js "City Walk" browser: ‹, 出発！, category bubbles, list); ‹ comes back to
   the map. Like the 夜市 map it starts from the overview every time it opens. */
(() => {
  'use strict';
  const root = document.querySelector('#guide details.area-directory-section:not(.night-market-section)');
  const grid = root?.querySelector('.walk-area-grid');
  const groups = window.TABI_AREAS?.groups;
  if (!root || !grid || !Array.isArray(groups) || typeof window.tabiSpotMap !== 'function') return;
  const cards = [...grid.querySelectorAll('.walk-area-card')];
  const items = groups.map((g, index) => {
    const lat = Number(g?.map?.lat), lng = Number(g?.map?.lng);
    const name = String(g?.map?.label || g?.title || '').split('・')[0].trim();
    return {id: 'area-' + (index + 1), name, location: {lat, lng}, index};
  }).filter(it => it.name && Number.isFinite(it.location.lat) && Number.isFinite(it.location.lng) && cards[it.index]);
  if (!items.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'walk-area-map'; wrap.id = 'walk-area-host';
  const host = document.createElement('div');
  host.id = 'walk-area-map';
  wrap.append(host);
  grid.before(wrap);
  root.classList.add('has-area-map');
  window.tabiSpotMap({
    host, section: root, items, key: 'wa', noun: '街歩きエリア', noFit: true,
    mapLabel: '街歩きエリアマップ', listLabel: '街歩きエリア一覧',
    fallback: '地図を読み込めませんでした。エリアを選んでください。',
    onSelect: item => cards[item.index]?.click(),
  });
})();
