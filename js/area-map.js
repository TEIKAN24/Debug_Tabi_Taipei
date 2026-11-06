/* TAIPEI CITY GUIDE — 街歩きエリア map, v30.9.282.
   The same map as 夜市マップ (js/night-markets.js → window.tabiSpotMap), with one name
   pill per area at data/areas.js groups[].map {label, lat, lng}. It takes the place of
   the area cards: tapping a name opens that area's details exactly as its card did
   (js/guide.js "City Walk" browser: ‹, 出発！, category bubbles, list); ‹ comes back to
   the map. v30.9.280: it is the 夜市 map itself (window.tabiPlaceMap), moved into this
   section with the 街歩き places: switching tabs keeps the view and swaps the pins. */
(() => {
  'use strict';
  const root = document.querySelector('#guide details.area-directory-section:not(.night-market-section)');
  const grid = root?.querySelector('.walk-area-grid');
  const groups = window.TABI_AREAS?.groups;
  if (!root || !grid || !Array.isArray(groups) || !window.tabiPlaceMap) return;
  const cards = [...grid.querySelectorAll('.walk-area-card')];
  const items = groups.map((g, index) => {
    const lat = Number(g?.map?.lat), lng = Number(g?.map?.lng);
    const name = String(g?.map?.label || g?.title || '').split('・')[0].trim();
    return {id: 'area-' + (index + 1), name, location: {lat, lng}, index};
  }).filter(it => it.name && Number.isFinite(it.location.lat) && Number.isFinite(it.location.lng) && cards[it.index]);
  // v30.9.282: the area details end with a full-width 「さっそく出発！」 (as the 夜市 details),
  // instead of the small 出発！ beside the title. Same link (js/guide.js sets its address).
  const detail = root.querySelector('.walk-inline-detail');
  const go = detail?.querySelector('.walk-inline-go'), inner = detail?.querySelector('.walk-inline-inner');
  if (go && inner) { go.classList.add('walk-go-bottom'); go.textContent = 'さっそく出発！'; inner.append(go); }
  if (!items.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'walk-area-map'; wrap.id = 'walk-area-host';
  const host = document.createElement('div');
  host.id = 'walk-area-map';
  wrap.append(host);
  grid.before(wrap);
  root.classList.add('has-area-map');
  window.tabiPlaceMap.addSet('wa', items, {section: root, host, onSelect: item => cards[item.index]?.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1})) /* a tap, not a key press: no focus ring */});
})();
