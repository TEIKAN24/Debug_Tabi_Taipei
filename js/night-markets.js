/* v30.9.255 — 夜市マップ from data/night-markets.js (window.TABI_NIGHT_MARKETS).
   The box opens on an overview of 台北市区＋北海岸 and glides to the visitor's
   position (or 台北駅 when it is unknown / outside 北北基桃), every time it opens.
   The map is SVG from data/night-market-map.js (内政部 district lines, loaded on
   first open). One finger drags, two fingers pinch; the view stays in 北北基桃.
   Markets in view get a name pill on a leader line; pills that cannot be placed
   without overlapping merge into a number. Markets outside the view are counted
   at the edge in their direction; tapping a number moves there.
   Tapping a market opens its details in the same box; ‹ returns to the map.
   Data schema (also used by editor/directory.html, tab 🏮 夜市):
   {schemaVersion:1, type:'night-markets', markets:[{
     id, name, lead ('\n' = line break),
     access:{type:'mrt', code, color, station, exit} | {type:'text', label, text},
     hours, crowded, features:[text], specialties:[{label, query}], destination,
     location:{lat, lng} }]}
   A market without a location has no pin (it stays in the screen-reader list).
   The visitor's position is used on this device only: never stored or sent. */
(() => {
  'use strict';
  const host = document.getElementById('night-markets-tabs');
  const section = document.getElementById('night-markets-section');
  if (!host || !section) return;
  const doc = window.TABI_NIGHT_MARKETS;
  const MAP_SRC = 'data/night-market-map.js?v=30.9.255';
  const OVERVIEW = [25.105, 121.556];      // 台北市区＋北海岸
  const FALLBACK = [25.0478, 121.5170];    // 台北駅
  const DISTRICT_FONT = 10.5, CITY_FONT = 13;
  const LABEL_H = 32, CLUSTER_H = 26, EDGE = 26, GAP = 7; // GAP: clear space around each pill
  const FAR_KM = 17;  // view wider than this (km): markets shown as numbers only
  const SVGNS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches: false};

  const node = (tag, attrs = {}, text) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      el.setAttribute(key, value === true ? '' : String(value));
    }
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const svg = (tag, attrs = {}) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    return el;
  };
  const str = value => (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  if (!doc || doc.schemaVersion !== 1 || doc.type !== 'night-markets' || !Array.isArray(doc.markets) || !doc.markets.length) {
    host.replaceChildren(node('p', {class: 'directory-loading'}, '夜市を読み込めませんでした。ページを再読み込みしてください。'));
    return;
  }
  const idOf = (value, index) => (typeof value === 'string' && /^[\w-]+$/.test(value)) ? value : `market-${index + 1}`;
  const color = value => /^#[0-9a-f]{6}$/i.test(str(value)) ? str(value).toUpperCase() : '#8C8C8C';
  const mapsUrl = destination => 'https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=' + encodeURIComponent(destination);

  const markets = doc.markets.filter(m => m && str(m.name)).map((m, i) => {
    const lat = Number(m.location?.lat), lng = Number(m.location?.lng);
    const placed = Number.isFinite(lat) && Number.isFinite(lng) && lat > 24 && lat < 26 && lng > 120.5 && lng < 122.5;
    return {id: idOf(m.id, i), name: str(m.name), data: m, lat, lng, placed, order: i, x: 0, y: 0, w: 0};
  });

  // ---- Details (same content as the former tab panels) ----------------------
  function detailContent(m) {
    const out = [];
    const lead = node('p', {class: 'nm-lead'});
    str(m.lead).split('\n').forEach((part, p) => { if (p) lead.append(node('br')); lead.append(part); });
    out.push(lead);
    const info = node('dl', {class: 'nm-info'});
    const access = m.access || {};
    if (access.type === 'text') {
      const dd = node('dd');
      dd.append(node('span', {class: 'nm-access'}, str(access.text)));
      info.append(node('dt', {}, str(access.label) || 'アクセス'), dd);
    } else {
      const dd = node('dd');
      const station = node('span', {class: 'nm-station'});
      station.append(node('span', {class: 'nm-line', style: '--nm-line:' + color(access.color)}, str(access.code)), str(access.station));
      dd.append(station);
      if (str(access.exit)) {
        const exit = node('span', {class: 'nm-exit'});
        exit.append(node('span', {class: 'nm-exit-no'}, str(access.exit)), '出口');
        dd.append(exit);
      }
      info.append(node('dt', {}, '最寄り駅'), dd);
    }
    info.append(node('dt', {}, '営業時間'), node('dd', {}, str(m.hours)), node('dt', {}, '混雑時間帯'), node('dd', {}, str(m.crowded)));
    out.push(info);
    const features = (Array.isArray(m.features) ? m.features : []).map(str).filter(Boolean);
    if (features.length) {
      const ul = node('ul', {class: 'nm-features'});
      features.forEach(text => ul.append(node('li', {}, text)));
      out.push(node('p', {class: 'nm-feature-label'}, '特徴'), ul);
    }
    const specialties = (Array.isArray(m.specialties) ? m.specialties : []).filter(s => s && str(s.label));
    if (specialties.length) {
      const ul = node('ul', {class: 'nm-specialties'});
      specialties.forEach(s => {
        const label = str(s.label);
        const li = node('li');
        li.append(node('button', {type: 'button', class: 'nm-specialty', 'data-food-query': str(s.query) || label,
          'aria-label': label + 'を料理辞典で見る'}, label));
        ul.append(li);
      });
      out.push(node('p', {class: 'nm-feature-label nm-specialty-label'}, '名物'), ul);
    }
    const destination = str(m.destination) || str(m.name);
    out.push(node('a', {class: 'nm-go', href: mapsUrl(destination), rel: 'noopener noreferrer', target: '_blank'}, 'さっそく出発！'));
    return out;
  }

  // ---- Markup ---------------------------------------------------------------
  const stage = node('div', {class: 'nm-stage', 'data-view': 'map'});
  const mapEl = node('div', {class: 'nm-map', role: 'region', tabindex: '0',
    'aria-label': '夜市マップ。ドラッグで移動、ピンチで拡大・縮小。キーボードでは矢印キーで移動、＋と−で拡大・縮小'});
  const base = svg('svg', {class: 'nm-map-base', 'aria-hidden': 'true', focusable: 'false'});
  const world = svg('g', {class: 'nm-world'});
  const districtLines = svg('path', {class: 'nm-district-lines'});
  const cityLines = svg('path', {class: 'nm-city-lines'});
  const districtNames = svg('g', {class: 'nm-district-names'});
  const cityNames = svg('g', {class: 'nm-city-names'});
  world.append(districtLines, cityLines, districtNames, cityNames);
  base.append(world);
  const leaders = svg('svg', {class: 'nm-map-leaders', 'aria-hidden': 'true', focusable: 'false'});
  const me = node('div', {class: 'nm-me', 'aria-hidden': 'true'});
  me.append(node('span', {class: 'nm-me-wave'}), node('span', {class: 'nm-me-wave nm-me-wave--late'}), node('span', {class: 'nm-me-core'}));
  const pinsLayer = node('div', {class: 'nm-map-pins'});
  const edgesLayer = node('div', {class: 'nm-map-edges'});
  const status = node('p', {class: 'nm-sr', 'aria-live': 'polite'});
  mapEl.append(base, leaders, me, pinsLayer, edgesLayer);

  const detail = node('section', {class: 'nm-detail', 'aria-labelledby': 'nm-detail-title', 'aria-hidden': 'true'});
  detail.inert = true;
  const back = node('button', {type: 'button', class: 'nm-back', 'aria-label': '地図に戻る'});
  const chevron = svg('svg', {viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': 'true', focusable: 'false'});
  chevron.append(svg('path', {d: 'M15 5l-7 7 7 7', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
  back.append(chevron);
  const title = node('h4', {class: 'nm-title', id: 'nm-detail-title'});
  const head = node('div', {class: 'nm-detail-head'});
  head.append(back, title);
  const body = node('div', {class: 'nm-detail-body'});
  detail.append(head, body);

  // Every market as a plain list for screen readers (also reaches markets without a pin).
  const srList = node('ul', {class: 'nm-sr', 'aria-label': '夜市一覧'});
  markets.forEach(m => {
    const li = node('li');
    const b = node('button', {type: 'button', tabindex: '-1'}, m.name + 'の詳細');
    b.addEventListener('click', () => openDetail(m, null));
    li.append(b); srList.append(li);
  });
  stage.append(mapEl, detail, srList, status);
  host.replaceChildren(stage);
  // Focus inside a clipped box must never scroll it.
  for (const el of [stage, mapEl]) el.addEventListener('scroll', () => { el.scrollTop = 0; el.scrollLeft = 0; });

  // Pins: one name pill + leader per market, a pool of number pills, 8 edge counters.
  markets.forEach(m => {
    m.pin = node('button', {type: 'button', class: 'nm-pin', tabindex: '-1', 'aria-label': m.name + 'の詳細'}, m.name);
    m.pin.addEventListener('click', () => openDetail(m, m.pin));
    pinsLayer.append(m.pin);
    m.leader = svg('g', {class: 'nm-leader'});
    m.line = svg('line'); m.dot = svg('circle', {r: 3.4});
    m.leader.append(m.line, m.dot);
    leaders.append(m.leader);
  });
  const clusterPool = [];
  function clusterButton(i) {
    if (!clusterPool[i]) {
      const b = node('button', {type: 'button', class: 'nm-cluster', tabindex: '-1'});
      b.addEventListener('click', () => { if (b._item) zoomIntoCluster(b._item); });
      pinsLayer.append(b); clusterPool[i] = b;
    }
    return clusterPool[i];
  }
  const SECTOR_JA = ['東', '南東', '南', '南西', '西', '北西', '北', '北東'];
  const edgeChips = SECTOR_JA.map(() => {
    const b = node('button', {type: 'button', class: 'nm-edge', tabindex: '-1'});
    const count = node('span', {class: 'nm-edge-count'});
    const arrow = svg('svg', {class: 'nm-edge-arrow', viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true', focusable: 'false'});
    arrow.append(svg('path', {d: 'M3.5 2.2L9.5 6l-6 3.8z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 1, 'stroke-linejoin': 'round'}));
    b.append(count, arrow);
    b._count = count; b._arrow = arrow;
    b.addEventListener('click', () => { if (b._members) fitMembers(b._members); });
    edgesLayer.append(b);
    return b;
  });

  // ---- Map data -------------------------------------------------------------
  let map = null, mapPromise = null, regionRings = [];
  let project = () => [0, 0];
  function loadMap() {
    if (window.TABI_NIGHT_MARKET_MAP) return Promise.resolve(window.TABI_NIGHT_MARKET_MAP);
    if (mapPromise) return mapPromise;
    mapPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MAP_SRC; s.async = true;
      s.onload = () => window.TABI_NIGHT_MARKET_MAP ? resolve(window.TABI_NIGHT_MARKET_MAP) : reject(Error('map data'));
      s.onerror = () => { mapPromise = null; s.remove(); reject(Error('map data')); };
      document.head.append(s);
    });
    return mapPromise;
  }
  function setupMap(data) {
    if (map) return;
    map = data;
    const {lng0, lat0, kx, ky} = data.projection;
    project = (lat, lng) => [(lng - lng0) * kx, -(lat - lat0) * ky];
    districtLines.setAttribute('d', data.districtPath);
    cityLines.setAttribute('d', data.cityPath);
    map.districts.forEach(d => {
      const t = svg('text', {x: d.x, y: d.y}); t.textContent = d.name;
      d.el = t; d.len = [...d.name].length; districtNames.append(t);
    });
    map.cities.forEach(c => {
      const t = svg('text', {x: c.x, y: c.y}); t.textContent = c.name; cityNames.append(t);
    });
    regionRings = (data.regionRings || []).map(flat => { const r = []; for (let i = 0; i < flat.length; i += 2) r.push([flat[i], flat[i + 1]]); return r; });
    markets.forEach(m => { if (m.placed) [m.x, m.y] = project(m.lat, m.lng); });
  }
  function inRegion(x, y) {
    let inside = false;
    for (const ring of regionRings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
    }
    return inside;
  }

  // ---- View -----------------------------------------------------------------
  // World units are 10 m; view.s = screen px per unit; (cx, cy) = world point at the centre.
  const view = {cx: 0, cy: 0, s: 0.1};
  let W = 0, H = 0, sMin = 0.1, sMax = 1, sFocus = 0.4;
  let lastScale = NaN, layout = [], frame = 0, userPos = null;
  function measure() {
    const r = mapEl.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    if (Math.abs(r.width - W) < 0.5 && Math.abs(r.height - H) < 0.5) return true;
    W = r.width; H = r.height;
    for (const el of [base, leaders]) { el.setAttribute('width', W); el.setAttribute('height', H); }
    sMin = Math.max(W / 3000, H / 4000);           // at most ~30 km × 40 km in view
    sMax = Math.max(sMin * 2, W / 550);            // at least ~5.5 km across
    sFocus = clamp(W / 900, sMin, sMax);           // the focused view, ~9 km across
    lastScale = NaN; clampView();
    return true;
  }
  function clampView() {
    if (!map || !W) return;
    view.s = clamp(view.s, sMin, sMax);
    const [x0, y0, x1, y1] = map.bounds;
    const mx = Math.min(W / view.s * 0.3, (x1 - x0) / 2), my = Math.min(H / view.s * 0.3, (y1 - y0) / 2);
    view.cx = clamp(view.cx, x0 + mx, x1 - mx);
    view.cy = clamp(view.cy, y0 + my, y1 - my);
  }
  function requestRender() { if (!frame) frame = requestAnimationFrame(render); }
  function render() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!map || !W) return;
    const s = view.s, tx = W / 2 - view.cx * s, ty = H / 2 - view.cy * s;
    world.setAttribute('transform', `matrix(${s} 0 0 ${s} ${tx.toFixed(2)} ${ty.toFixed(2)})`);
    if (s !== lastScale) { lastScale = s; onScale(s); }
    placeOverlay(tx, ty);
  }

  // Zoom-dependent layers: 縣市 when far, 区 when close.
  function onScale(s) {
    const km = W / s / 100;
    const d = clamp((21 - km) / 6, 0, 1);
    mapEl.style.setProperty('--nm-district-alpha', d.toFixed(3));
    mapEl.style.setProperty('--nm-city-name-alpha', (1 - d).toFixed(3));
    districtNames.setAttribute('font-size', (DISTRICT_FONT / s).toFixed(2));
    cityNames.setAttribute('font-size', (CITY_FONT / s).toFixed(2));
    if (d > 0) cullDistrictNames(s);
    layout = layoutMarkets(s);
  }
  function overlaps(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
  function cullDistrictNames(s) {
    const placed = [], pxPerKm = s * 100;
    for (const d of map.districts) {
      const w = d.len * DISTRICT_FONT * 1.08 + 6, h = DISTRICT_FONT + 6;
      const r = {x0: d.x * s - w / 2, x1: d.x * s + w / 2, y0: d.y * s - h / 2, y1: d.y * s + h / 2};
      const fits = d.area * pxPerKm * pxPerKm > w * h * 2.2;
      const ok = fits && !placed.some(p => overlaps(p, r));
      if (ok) placed.push(r);
      d.el.style.display = ok ? '' : 'none';
    }
  }

  // ---- Pins: leader-line placement, merging into numbers --------------------
  function labelWidth(m) {
    if (!m.w) m.w = Math.ceil(m.pin.offsetWidth) || (m.name.length * 15 + 30);
    return m.w;
  }
  const CANDIDATES = [];
  for (const len of [58, 96]) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) CANDIDATES.push({sx, sy, len});
  CANDIDATES.push({sx: 0, sy: -1, len: 58}, {sx: 0, sy: 1, len: 58}, {side: 1}, {side: -1});
  function segmentHits(x0, y0, x1, y1, r) { // Liang–Barsky
    let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
    for (const [p, q] of [[-dx, x0 - r.x0], [dx, r.x1 - x0], [-dy, y0 - r.y0], [dy, r.y1 - y0]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  const nearScale = () => W / FAR_KM / 100;   // closer than this: names; farther: numbers only
  function layoutMarkets(s) {
    let items = markets.filter(m => m.placed).map(m => ({members: [m], x: m.x * s, y: m.y * s}));
    const merge = (a, b) => {
      const members = a.members.concat(b.members);
      return {members, x: members.reduce((t, m) => t + m.x, 0) / members.length * s, y: members.reduce((t, m) => t + m.y, 0) / members.length * s};
    };
    if (s < nearScale()) { // 縣市 level: every market or group of markets is a number
      for (let joined = true; joined;) {
        joined = false;
        for (let i = 0; i < items.length && !joined; i++) for (let j = i + 1; j < items.length; j++) {
          if (Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y) < 48) {
            const merged = merge(items[i], items[j]);
            items = items.filter((_, k) => k !== i && k !== j).concat(merged); joined = true; break;
          }
        }
      }
      items.forEach(it => { it.count = true; });
      return items;
    }
    const clusterRect = it => { const w = 22 + String(it.members.length).length * 9; return {x0: it.x - w / 2 - 3, x1: it.x + w / 2 + 3, y0: it.y - CLUSTER_H / 2 - 3, y1: it.y + CLUSTER_H / 2 + 3}; };
    const dotRect = it => ({x0: it.x - 6, x1: it.x + 6, y0: it.y - 6, y1: it.y + 6});
    for (let guard = 0; guard < 60; guard++) {
      let joined = false;
      for (let i = 0; i < items.length && !joined; i++) for (let j = i + 1; j < items.length; j++) {
        if (Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y) < 24) {
          const merged = merge(items[i], items[j]);
          items = items.filter((_, k) => k !== i && k !== j).concat(merged); joined = true; break;
        }
      }
      if (joined) continue;
      const placed = [];
      for (const it of items) if (it.members.length > 1) { it.rect = clusterRect(it); placed.push(it.rect); }
      const dots = items.map(it => it.members.length > 1 ? null : dotRect(it));
      // Keep the visitor's ◎ (and its first ripple) clear of the pills.
      if (userPos) placed.push({x0: userPos[0] * s - 16, x1: userPos[0] * s + 16, y0: userPos[1] * s - 16, y1: userPos[1] * s + 16});
      const singles = items.filter(it => it.members.length === 1).sort((a, b) => a.members[0].order - b.members[0].order);
      let failed = null;
      for (const it of singles) {
        const w = labelWidth(it.members[0]);
        let spot = null;
        for (const c of CANDIDATES) {
          const ox = c.side ? c.side * (w / 2 + 34) : c.sx * Math.max(0, w / 2 - 20);
          const oy = c.side ? 0 : c.sy * c.len;
          const lx = it.x + ox, ly = it.y + oy;
          const r = {x0: lx - w / 2 - GAP, x1: lx + w / 2 + GAP, y0: ly - LABEL_H / 2 - GAP, y1: ly + LABEL_H / 2 + GAP};
          if (placed.some(p => overlaps(p, r))) continue;
          if (dots.some((d, k) => d && items[k] !== it && overlaps(d, r))) continue;
          if (placed.some(p => p.label && segmentHits(it.x, it.y, lx, ly, p))) continue;
          if (placed.some(p => p.leader && segmentHits(p.leader[0], p.leader[1], p.leader[2], p.leader[3], r))) continue;
          spot = {ox, oy, r}; break;
        }
        if (!spot) { failed = it; break; }
        it.ox = spot.ox; it.oy = spot.oy;
        spot.r.label = true; spot.r.leader = [it.x, it.y, it.x + spot.ox, it.y + spot.oy];
        placed.push(spot.r);
      }
      if (!failed) return items;
      // The pill does not fit anywhere: join the nearest neighbour.
      let best = null, bd = Infinity;
      for (const other of items) {
        if (other === failed) continue;
        const d = Math.hypot(other.x - failed.x, other.y - failed.y);
        if (d < bd) { bd = d; best = other; }
      }
      if (!best) return items;
      items = items.filter(it => it !== failed && it !== best).concat(merge(failed, best));
    }
    return items;
  }

  function placeOverlay(tx, ty) {
    const shown = new Set(), off = [], boxes = [], pending = [];
    const offList = it => { for (const m of it.members) off.push({m, sx: m.x * view.s + tx, sy: m.y * view.s + ty}); };
    let ci = 0;
    for (const it of layout) {
      const sx = it.x + tx, sy = it.y + ty;
      const inside = sx >= EDGE && sx <= W - EDGE && sy >= EDGE && sy <= H - EDGE;
      if (!inside) { offList(it); continue; }
      if (it.members.length === 1 && !it.count) {
        // A pill pushed back inside the box may land on another one: then it
        // is counted at the edge instead (it sits near the edge anyway).
        const m = it.members[0], w = labelWidth(m);
        const lx = clamp(sx + it.ox, w / 2 + 6, W - w / 2 - 6), ly = clamp(sy + it.oy, LABEL_H / 2 + 6, H - LABEL_H / 2 - 6);
        const box = {x0: lx - w / 2, x1: lx + w / 2, y0: ly - LABEL_H / 2, y1: ly + LABEL_H / 2};
        const moved = Math.abs(lx - sx - it.ox) > .5 || Math.abs(ly - sy - it.oy) > .5;
        if (moved) { pending.push({it, sx, sy, lx, ly, box}); continue; }
        boxes.push(box); placePin(m, sx, sy, lx, ly); shown.add(m);
        continue;
      }
      const b = clusterButton(ci++);
      b._item = it;
      b.textContent = String(it.members.length);
      b.setAttribute('aria-label', it.members.map(m => m.name).join('、') + (it.members.length > 1 ? '（' + it.members.length + '件）' : '') + 'を拡大');
      b.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)`;
      b.classList.add('is-on'); b.tabIndex = 0;
      const cw = 22 + String(it.members.length).length * 9;
      boxes.push({x0: sx - cw / 2, x1: sx + cw / 2, y0: sy - CLUSTER_H / 2, y1: sy + CLUSTER_H / 2});
    }
    for (const p of pending) {
      if (boxes.some(b => overlaps(b, p.box))) { offList(p.it); continue; }
      boxes.push(p.box); placePin(p.it.members[0], p.sx, p.sy, p.lx, p.ly); shown.add(p.it.members[0]);
    }
    markets.forEach(m => {
      const on = shown.has(m);
      m.pin.classList.toggle('is-on', on);
      m.pin.tabIndex = on ? 0 : -1;
      m.leader.classList.toggle('is-on', on);
    });
    for (let i = ci; i < clusterPool.length; i++) { const b = clusterPool[i]; b.classList.remove('is-on'); b._item = null; b.tabIndex = -1; }
    // Off-view markets, counted per direction from the centre.
    const groups = SECTOR_JA.map(() => []);
    const cx = W / 2, cy = H / 2;
    for (const o of off) {
      const a = Math.atan2(o.sy - cy, o.sx - cx);
      groups[(Math.round(a / (Math.PI / 4)) + 8) % 8].push(o);
    }
    groups.forEach((g, i) => {
      const chip = edgeChips[i];
      if (!g.length) { chip.classList.remove('is-on'); chip.tabIndex = -1; chip._members = null; return; }
      const mx = g.reduce((t, o) => t + o.sx, 0) / g.length - cx, my = g.reduce((t, o) => t + o.sy, 0) / g.length - cy;
      const len = Math.hypot(mx, my) || 1, ux = mx / len, uy = my / len;
      const hx = W / 2 - 30, hy = H / 2 - 24;
      const t = Math.min(Math.abs(ux) > 1e-6 ? hx / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? hy / Math.abs(uy) : Infinity);
      let px = cx + ux * t, py = cy + uy * t;
      const deg = Math.atan2(uy, ux) * 180 / Math.PI;
      // Slide along the edge if a pill or number already sits there.
      const alongY = Math.abs(ux) > 1e-6 && hx / Math.abs(ux) <= t + .5;
      for (const shift of [0, 34, -34, 68, -68]) {
        const qx = alongY ? px : clamp(px + shift, 30, W - 30), qy = alongY ? clamp(py + shift, 24, H - 24) : py;
        const r = {x0: qx - 20, x1: qx + 20, y0: qy - 16, y1: qy + 16};
        if (!boxes.some(b => overlaps(b, r)) || shift === -68) { px = qx; py = qy; boxes.push(r); break; }
      }
      chip._members = g.map(o => o.m);
      chip._count.textContent = String(g.length);
      chip.setAttribute('aria-label', SECTOR_JA[i] + '方向の画面外の夜市 ' + g.length + '件（' + chip._members.map(m => m.name).join('、') + '）へ移動');
      chip.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) translate(-50%,-50%)`;
      chip._arrow.style.transform = `rotate(${deg.toFixed(1)}deg) translateX(20px)`;
      chip.classList.add('is-on'); chip.tabIndex = 0;
    });
    if (userPos) {
      const ux = userPos[0] * view.s + tx, uy = userPos[1] * view.s + ty;
      me.style.transform = `translate3d(${ux.toFixed(1)}px,${uy.toFixed(1)}px,0)`;
      me.classList.toggle('is-on', ux > -40 && ux < W + 40 && uy > -40 && uy < H + 40);
    } else me.classList.remove('is-on');
  }

  function placePin(m, sx, sy, lx, ly) {
    m.pin.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0) translate(-50%,-50%)`;
    m.line.setAttribute('x1', sx.toFixed(1)); m.line.setAttribute('y1', sy.toFixed(1));
    m.line.setAttribute('x2', lx.toFixed(1)); m.line.setAttribute('y2', ly.toFixed(1));
    m.dot.setAttribute('cx', sx.toFixed(1)); m.dot.setAttribute('cy', sy.toFixed(1));
  }

  // ---- Motion ---------------------------------------------------------------
  let anim = 0, inertia = 0, interacted = false;
  function stopMotion() {
    if (anim) cancelAnimationFrame(anim);
    if (inertia) cancelAnimationFrame(inertia);
    anim = inertia = 0;
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(target, duration, done) {
    stopMotion();
    const from = {...view};
    const keep = {...view};
    Object.assign(view, {cx: target.cx, cy: target.cy, s: target.s}); clampView();
    const to = {...view};
    Object.assign(view, keep);
    if (!duration || reduceMotion.matches) { Object.assign(view, to); render(); if (done) done(); return; }
    const start = performance.now(), l0 = Math.log(from.s), l1 = Math.log(to.s);
    const zooms = Math.abs(l1 - l0) > 1e-3;
    const step = now => {
      const t = Math.min(1, (now - start) / duration), e = ease(t);
      view.s = Math.exp(l0 + (l1 - l0) * e);
      // While zooming, the centre moves in step with the visible size so the
      // glide reads as one steady motion instead of a slide plus a zoom.
      const f = zooms ? clamp((1 / view.s - 1 / from.s) / (1 / to.s - 1 / from.s), 0, 1) : e;
      view.cx = from.cx + (to.cx - from.cx) * f; view.cy = from.cy + (to.cy - from.cy) * f;
      render();
      if (t < 1) anim = requestAnimationFrame(step);
      else { anim = 0; if (done) done(); }
    };
    anim = requestAnimationFrame(step);
  }
  function fitMembers(members) {
    interacted = true;
    const xs = members.map(m => m.x), ys = members.map(m => m.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const fit = Math.min((W - 160) / Math.max(1, x1 - x0), (H - 180) / Math.max(1, y1 - y0));
    flyTo({cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(view.s, fit)}, 750);
  }
  function zoomIntoCluster(item) {
    interacted = true;
    const ids = new Set(item.members.map(m => m.id));
    let s = Math.max(view.s, nearScale() * 1.15);
    if (ids.size === 1) s = Math.max(view.s, sFocus);
    else {
      const together = scale => layoutMarkets(scale).some(it => it.members.filter(m => ids.has(m.id)).length === ids.size);
      while (s < sMax && together(s)) s = Math.min(sMax, s * 1.25);
    }
    lastScale = NaN;
    const cx = item.members.reduce((t, m) => t + m.x, 0) / item.members.length;
    const cy = item.members.reduce((t, m) => t + m.y, 0) / item.members.length;
    flyTo({cx, cy, s}, 650);
  }

  // ---- Gestures ---------------------------------------------------------------
  const pointers = new Map();
  let gesture = null, dragged = false, dragEnd = 0, lastTap = null;
  const local = e => { const r = mapEl.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
  const zoomTarget = (px, py, s1) => {
    const wx = view.cx + (px - W / 2) / view.s, wy = view.cy + (py - H / 2) / view.s;
    return {cx: wx - (px - W / 2) / s1, cy: wy - (py - H / 2) / s1, s: s1};
  };
  function beginPinch() {
    const [a, b] = [...pointers.values()];
    gesture = {type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s,
      m0: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, c0: {cx: view.cx, cy: view.cy}};
  }
  function beginPan(p, moved) { gesture = {type: 'pan', x0: p.x, y0: p.y, c0: {cx: view.cx, cy: view.cy}, moved, samples: [{t: performance.now(), x: p.x, y: p.y}]}; }
  mapEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopMotion(); interacted = true;
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) { dragged = false; beginPan(local(e), false); }
    else if (pointers.size === 2) {
      dragged = true;
      for (const id of pointers.keys()) try { mapEl.setPointerCapture(id); } catch (_) {}
      beginPinch();
    }
  });
  mapEl.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    const p = local(e); pointers.set(e.pointerId, p);
    if (gesture.type === 'pan' && pointers.size === 1) {
      const dx = p.x - gesture.x0, dy = p.y - gesture.y0;
      if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
      if (!gesture.moved) { gesture.moved = dragged = true; try { mapEl.setPointerCapture(e.pointerId); } catch (_) {} mapEl.classList.add('is-dragging'); }
      view.cx = gesture.c0.cx - dx / view.s; view.cy = gesture.c0.cy - dy / view.s;
      clampView(); requestRender();
      gesture.samples.push({t: performance.now(), x: p.x, y: p.y});
      if (gesture.samples.length > 6) gesture.samples.shift();
    } else if (gesture.type === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), m = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
      const s1 = clamp(gesture.s0 * d / gesture.d0, sMin, sMax);
      const wx = gesture.c0.cx + (gesture.m0.x - W / 2) / gesture.s0, wy = gesture.c0.cy + (gesture.m0.y - H / 2) / gesture.s0;
      view.s = s1; view.cx = wx - (m.x - W / 2) / s1; view.cy = wy - (m.y - H / 2) / s1;
      clampView(); requestRender();
    }
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (gesture?.type === 'pinch') {
      if (pointers.size === 1) beginPan([...pointers.values()][0], true);
      else if (!pointers.size) { gesture = null; dragEnd = performance.now(); mapEl.classList.remove('is-dragging'); }
      return;
    }
    if (pointers.size) return;
    if (dragged) dragEnd = performance.now();
    mapEl.classList.remove('is-dragging');
    const g = gesture; gesture = null;
    if (!g) return;
    if (!g.moved) { // double tap on the map zooms in
      const now = performance.now(), onMap = !(e.target instanceof Element && e.target.closest('button'));
      if (onMap && e.type === 'pointerup' && e.pointerType !== 'mouse' && lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 26) {
        lastTap = null; flyTo(zoomTarget(p.x, p.y, view.s * 2), 320);
      } else lastTap = onMap ? {t: now, x: p.x, y: p.y} : null;
      return;
    }
    if (e.type !== 'pointerup' || reduceMotion.matches) return;
    const a = g.samples[0], b = g.samples[g.samples.length - 1], dt = b.t - a.t;
    if (dt <= 0 || performance.now() - b.t > 90) return;
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, last = performance.now();
    if (Math.hypot(vx, vy) < 0.2) return;
    const glide = now => {
      const step = Math.min(40, now - last); last = now;
      const cx = view.cx, cy = view.cy;
      view.cx -= vx * step / view.s; view.cy -= vy * step / view.s; clampView();
      if (view.cx === cx) vx = 0;
      if (view.cy === cy) vy = 0;
      render();
      const k = Math.pow(0.94, step / 16); vx *= k; vy *= k;
      inertia = Math.hypot(vx, vy) > 0.015 ? requestAnimationFrame(glide) : 0;
    };
    inertia = requestAnimationFrame(glide);
  }
  mapEl.addEventListener('pointerup', endPointer);
  mapEl.addEventListener('pointercancel', endPointer);
  // A drag never counts as a tap on a pin.
  mapEl.addEventListener('click', e => {
    if (dragged && performance.now() - dragEnd < 500) { e.stopPropagation(); e.preventDefault(); }
    dragged = false;
  }, true);
  // Trackpad pinch (ctrl + wheel) zooms; a plain wheel keeps scrolling the page.
  mapEl.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault(); stopMotion(); interacted = true;
    const p = local(e), t = zoomTarget(p.x, p.y, clamp(view.s * Math.exp(-e.deltaY * 0.01), sMin, sMax));
    Object.assign(view, t); clampView(); requestRender();
  }, {passive: false});
  mapEl.addEventListener('dblclick', e => {
    if (e.target instanceof Element && e.target.closest('button')) return;
    const p = local(e); interacted = true;
    flyTo(zoomTarget(p.x, p.y, view.s * 2), 320);
  });
  ['gesturestart', 'gesturechange'].forEach(type => mapEl.addEventListener(type, e => e.preventDefault()));
  mapEl.addEventListener('keydown', e => {
    if (e.target !== mapEl) return;
    const step = 70 / view.s;
    const moves = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
    if (moves[e.key]) { e.preventDefault(); interacted = true; flyTo({cx: view.cx + moves[e.key][0], cy: view.cy + moves[e.key][1], s: view.s}, 180); }
    else if (['+', '=', '-', '_'].includes(e.key)) {
      e.preventDefault(); interacted = true;
      flyTo({cx: view.cx, cy: view.cy, s: view.s * (e.key === '-' || e.key === '_' ? 1 / 1.6 : 1.6)}, 220);
    }
  });

  // ---- Details view -----------------------------------------------------------
  let returnFocus = null;
  function setView(name) {
    stage.dataset.view = name;
    const onDetail = name === 'detail';
    detail.inert = !onDetail; detail.setAttribute('aria-hidden', String(!onDetail));
    mapEl.inert = onDetail;
    if (onDetail) mapEl.setAttribute('aria-hidden', 'true'); else mapEl.removeAttribute('aria-hidden');
  }
  function openDetail(m, from) {
    stopMotion();
    returnFocus = from;
    title.textContent = m.name;
    body.replaceChildren(node('div', {class: 'nm-glow', 'aria-hidden': 'true'}), ...detailContent(m.data));
    body.scrollTop = 0;
    setView('detail');
    requestAnimationFrame(() => back.focus({preventScroll: true}));
  }
  function closeDetail() {
    setView('map');
    requestRender();
    const target = returnFocus && returnFocus.classList.contains('is-on') ? returnFocus : mapEl;
    requestAnimationFrame(() => target.focus({preventScroll: true}));
  }
  back.addEventListener('click', closeDetail);
  detail.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeDetail(); } });

  // ---- Opening: overview → visitor (or 台北駅) ---------------------------------
  function locate() {
    return new Promise(resolve => {
      if (!navigator.geolocation || !window.isSecureContext) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(p => {
        const {latitude: lat, longitude: lng, accuracy} = p.coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !(accuracy <= 3000)) { resolve(null); return; }
        const [x, y] = project(lat, lng);
        resolve(inRegion(x, y) ? [x, y] : null);
      }, () => resolve(null), {enableHighAccuracy: false, timeout: 15000, maximumAge: 120000});
    });
  }
  let introToken = 0, sizeWaiter = null;
  function intro() {
    const token = ++introToken;
    interacted = false; userPos = null;
    const [ox, oy] = project(...OVERVIEW);
    Object.assign(view, {cx: ox, cy: oy, s: sMin}); clampView(); lastScale = NaN; render();
    const opened = performance.now();
    let settled = false, fellBack = false;
    const glideTo = (pos, duration) => {
      if (token !== introToken || interacted) return;
      flyTo({cx: pos[0], cy: pos[1], s: sFocus}, duration);
    };
    // Waiting for the visitor to answer the location prompt: after a while,
    // show 台北駅 and move on to their position if it arrives later.
    const fallbackTimer = setTimeout(() => {
      if (settled || token !== introToken) return;
      fellBack = true; glideTo(project(...FALLBACK), 2000);
    }, 4200);
    locate().then(pos => {
      if (token !== introToken) return;
      settled = true; clearTimeout(fallbackTimer);
      userPos = pos; lastScale = NaN; requestRender();
      status.textContent = pos ? '現在地の周辺を表示しています。' : '台北駅の周辺を表示しています。';
      if (fellBack) { if (pos) glideTo(pos, 1200); return; }
      const hold = Math.max(0, 600 - (performance.now() - opened));
      setTimeout(() => glideTo(pos || project(...FALLBACK), 2000), hold);
    });
  }
  function onOpen() {
    setView('map');
    loadMap().then(data => {
      setupMap(data);
      if (!section.open) return;
      const start = () => { if (!measure()) return false; sizeWaiter = null; intro(); return true; };
      if (!start()) sizeWaiter = start;
    }).catch(showFallbackList);
  }
  function onClose() { introToken++; stopMotion(); sizeWaiter = null; }
  new ResizeObserver(() => {
    if (!section.open || !map) return;
    if (sizeWaiter) { sizeWaiter(); return; }
    if (measure()) requestRender();
  }).observe(mapEl);
  if (document.fonts?.ready) document.fonts.ready.then(() => { markets.forEach(m => { m.w = 0; }); lastScale = NaN; requestRender(); });
  function showFallbackList() {
    const box = node('div', {class: 'nm-fallback'});
    box.append(node('p', {class: 'nm-fallback-note'}, '地図を読み込めませんでした。夜市を選んでください。'));
    const ul = node('ul');
    markets.forEach(m => {
      const li = node('li'), b = node('button', {type: 'button'}, m.name);
      b.addEventListener('click', () => openDetail(m, b)); li.append(b); ul.append(li);
    });
    box.append(ul);
    mapEl.replaceChildren(box);
  }
  section.addEventListener('toggle', () => { if (section.open) onOpen(); else onClose(); });
  if (section.open) onOpen();
})();
