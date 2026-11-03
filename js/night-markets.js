/* v30.9.256 — 夜市マップ from data/night-markets.js (window.TABI_NIGHT_MARKETS).
   The box opens on an overview of 台北市区＋北海岸 and glides to the visitor's
   position (or 台北駅 when it is unknown / outside 北北基桃), every time it opens.
   Base map: data/night-market-map.js (内政部 lines; the rest of Taiwan fades out);
   MRT layer: data/night-market-metro.js (© OpenStreetMap contributors, ODbL).
   Both load on first open. One finger drags, two fingers pinch; the view stays
   in 北北基桃.
   Zoomed out: city lines and names, markets as numbers. Zoomed in: districts,
   MRT stations (transfer stations named first, every station at the closest
   zoom), small city names along the city borders, and a name pill per market
   on a leader line. A pill keeps its place while it can, otherwise it bends or
   lengthens its leader and slides there; only when nothing fits do markets
   merge into a number. The outer band of the map is kept for the numbers of
   off-view markets, so they never cover a pill.
   Tapping a market opens its details in the same box, which keeps the length of
   the former tabs (pill strip + longest market); ‹ returns to the map.
   Data schema (also used by editor/directory.html, tab 🏮 夜市):
   {schemaVersion:1, type:'night-markets', markets:[{
     id, name, lead ('\n' = line break),
     access:{type:'mrt', code, color, station, exit} | {type:'text', label, text},
     hours, crowded, features:[text], specialties:[{label, query}], destination,
     location:{lat, lng} }]}
   The visitor's position is used on this device only: never stored or sent.
   With ?debugLocation=1 the simulated position of the recommender is used. */
(() => {
  'use strict';
  const host = document.getElementById('night-markets-tabs');
  const section = document.getElementById('night-markets-section');
  if (!host || !section) return;
  const doc = window.TABI_NIGHT_MARKETS;
  const VERSION = '30.9.256';
  const MAP_SRC = 'data/night-market-map.js?v=' + VERSION;
  const METRO_SRC = 'data/night-market-metro.js?v=' + VERSION;
  const OVERVIEW = [25.105, 121.556];      // 台北市区＋北海岸
  const FALLBACK = [25.0478, 121.5170];    // 台北駅
  const DEBUG = new URLSearchParams(location.search).get('debugLocation') === '1';
  // Sizes in screen px.
  const DISTRICT_FONT = 10.5, STATION_FONT = 9.5, BORDER_FONT = 8.5, CITY_FONT = 13;
  const LABEL_H = 29, CLUSTER_H = 24, GAP = 7;
  const BAND = 42;      // outer band kept for the off-view numbers: no pill enters it
  const DOT_EDGE = 36;  // a market dot closer than this to the edge counts as off view
  const SLIDE_MS = 320;
  // View widths in km.
  const FAR_KM = 17;        // wider: markets as numbers only
  const TRANSFER_KM = 13;   // narrower: names of transfer stations
  const ALL_KM = 7.5;       // narrower: names of every station
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

  // ---- Details ----------------------------------------------------------------
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
  const backIcon = () => {
    const icon = svg('svg', {viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': 'true', focusable: 'false'});
    icon.append(svg('path', {d: 'M15 5l-7 7 7 7', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
    return icon;
  };
  function detailParts(m, withIds) {
    const back = node('button', {type: 'button', class: 'nm-back', 'aria-label': '地図に戻る', tabindex: withIds ? null : '-1'});
    back.append(backIcon());
    const title = node('h4', {class: 'nm-title', id: withIds ? 'nm-detail-title' : null}, m ? m.name : '');
    const head = node('div', {class: 'nm-detail-head'});
    head.append(back, title);
    const body = node('div', {class: 'nm-detail-body'});
    if (m) body.append(node('div', {class: 'nm-glow', 'aria-hidden': 'true'}), ...detailContent(m.data));
    return {back, title, head, body};
  }

  // ---- Markup -----------------------------------------------------------------
  const stage = node('div', {class: 'nm-stage', 'data-view': 'map'});
  const mapEl = node('div', {class: 'nm-map', role: 'region', tabindex: '0',
    'aria-label': '夜市マップ。ドラッグで移動、ピンチで拡大・縮小。キーボードでは矢印キーで移動、＋と−で拡大・縮小'});
  const base = svg('svg', {class: 'nm-map-base', 'aria-hidden': 'true', focusable: 'false'});
  const world = svg('g', {class: 'nm-world'});
  const neighborLines = [0, 1, 2].map(i => svg('path', {class: 'nm-neighbor-lines nm-neighbor-' + i}));
  const districtLines = svg('path', {class: 'nm-district-lines'});
  const cityLines = svg('path', {class: 'nm-city-lines'});
  const metroLines = svg('g', {class: 'nm-metro-lines'});
  const stationDots = svg('g', {class: 'nm-station-dots'});
  const districtNames = svg('g', {class: 'nm-district-names'});
  const stationNames = svg('g', {class: 'nm-station-names'});
  const borderNames = svg('g', {class: 'nm-border-names'});
  const cityNames = svg('g', {class: 'nm-city-names'});
  world.append(...neighborLines, districtLines, cityLines, metroLines, stationDots, districtNames, stationNames, borderNames, cityNames);
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
  const live = detailParts(null, true);
  const {back, title, body} = live;
  detail.append(live.head, body);
  // Off-screen copy of the former tab layout, to give the box its old length.
  const measurer = node('div', {class: 'nm-measure', 'aria-hidden': 'true'});
  measurer.inert = true;

  const srList = node('ul', {class: 'nm-sr', 'aria-label': '夜市一覧'});
  markets.forEach(m => {
    const li = node('li');
    const b = node('button', {type: 'button', tabindex: '-1'}, m.name + 'の詳細');
    b.addEventListener('click', () => openDetail(m, null));
    li.append(b); srList.append(li);
  });
  stage.append(mapEl, detail, measurer, srList, status);
  host.replaceChildren(stage);
  for (const el of [stage, mapEl]) el.addEventListener('scroll', () => { el.scrollTop = 0; el.scrollLeft = 0; });

  markets.forEach(m => {
    m.pin = node('button', {type: 'button', class: 'nm-pin', tabindex: '-1', 'aria-label': m.name + 'の詳細'}, m.name);
    m.pin.addEventListener('click', () => openDetail(m, m.pin));
    pinsLayer.append(m.pin);
    m.leader = svg('g', {class: 'nm-leader'});
    m.line = svg('line'); m.dot = svg('circle', {r: 3.1});
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
  // Off-view numbers, one per direction (E, SE, S, SW, W, NW, N, NE) with a thin chevron.
  const SECTOR_JA = ['東', '南東', '南', '南西', '西', '北西', '北', '北東'];
  const edgeChips = SECTOR_JA.map((_, i) => {
    const b = node('button', {type: 'button', class: 'nm-edge', tabindex: '-1'});
    const count = node('span', {class: 'nm-edge-count'});
    const arrow = svg('svg', {class: 'nm-edge-arrow', viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true', focusable: 'false'});
    arrow.append(svg('path', {d: 'M4.3 2.4L8 6l-3.7 3.6', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
    arrow.style.transform = `rotate(${i * 45}deg)`;
    b.append(count, arrow);
    b._count = count; b._arrow = arrow;
    b.addEventListener('click', () => { if (b._members) fitMembers(b._members); });
    edgesLayer.append(b);
    return b;
  });

  // ---- Map data ---------------------------------------------------------------
  let map = null, metro = null, mapPromise = null, regionRings = [];
  let project = () => [0, 0];
  const loaded = {};
  function loadScript(src, key) {
    if (window[key]) return Promise.resolve(window[key]);
    if (loaded[key]) return loaded[key];
    loaded[key] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => window[key] ? resolve(window[key]) : reject(Error(key));
      s.onerror = () => { loaded[key] = null; s.remove(); reject(Error(key)); };
      document.head.append(s);
    });
    return loaded[key];
  }
  function loadMap() {
    if (!mapPromise) {
      mapPromise = Promise.all([
        loadScript(MAP_SRC, 'TABI_NIGHT_MARKET_MAP'),
        loadScript(METRO_SRC, 'TABI_NIGHT_MARKET_METRO').catch(() => null) // the map works without the MRT layer
      ]).catch(e => { mapPromise = null; throw e; });
    }
    return mapPromise;
  }
  const textEl = (parent, x, y, text, cls) => {
    const t = svg('text', {x, y}); if (cls) t.setAttribute('class', cls);
    t.textContent = text; parent.append(t); return t;
  };
  function setupMap([data, metroData]) {
    if (map) return;
    map = data;
    const {lng0, lat0, kx, ky} = data.projection;
    project = (lat, lng) => [(lng - lng0) * kx, -(lat - lat0) * ky];
    (data.neighborPaths || []).forEach((d, i) => neighborLines[i]?.setAttribute('d', d));
    districtLines.setAttribute('d', data.districtPath);
    cityLines.setAttribute('d', data.cityPath);
    map.districts.forEach(d => { d.el = textEl(districtNames, d.x, d.y, d.name); d.len = [...d.name].length; });
    map.cities.forEach(c => { c.el = textEl(cityNames, 0, 0, c.name); c.el.style.opacity = 0; });
    map.borderNames = ['台北市', '新北市', '基隆市', '桃園市'].map(name => {
      const el = textEl(borderNames, 0, 0, name); el.style.display = 'none'; return {name, el};
    });
    regionRings = (data.regionRings || []).map(flat => { const r = []; for (let i = 0; i < flat.length; i += 2) r.push([flat[i], flat[i + 1]]); return r; });
    markets.forEach(m => { if (m.placed) [m.x, m.y] = project(m.lat, m.lng); });
    if (metroData && metroData.type === 'night-market-metro') {
      metro = metroData;
      metro.lines.forEach(l => metroLines.append(svg('path', {d: l.path, stroke: l.color, class: 'nm-metro-line' + (l.approximate ? ' is-approximate' : '')})));
      const dots = (list, cls) => {
        const d = list.map(s => `M${s.x} ${s.y}h0`).join('');
        if (d) stationDots.append(svg('path', {d, class: cls + '-halo'}), svg('path', {d, class: cls}));
      };
      dots(metro.stations.filter(s => !s.transfer), 'nm-station');
      dots(metro.stations.filter(s => s.transfer), 'nm-transfer');
      metro.stations.forEach(s => { s.el = textEl(stationNames, s.x, s.y, s.name); s.len = [...s.name].length; s.el.style.display = 'none'; });
    }
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

  // ---- View -------------------------------------------------------------------
  // World units are 10 m; view.s = screen px per unit; (cx, cy) = world point at the centre.
  const view = {cx: 0, cy: 0, s: 0.1};
  let W = 0, H = 0, sMin = 0.1, sMax = 1, sFocus = 0.4;
  let lastScale = NaN, layout = [], frame = 0, userPos = null, textRects = [];
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
  const kmAcross = s => W / s / 100;
  function requestRender() { if (!frame) frame = requestAnimationFrame(render); }
  function render() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!map || !W) return;
    const s = view.s, tx = W / 2 - view.cx * s, ty = H / 2 - view.cy * s;
    world.setAttribute('transform', `matrix(${s} 0 0 ${s} ${tx.toFixed(2)} ${ty.toFixed(2)})`);
    if (s !== lastScale) { lastScale = s; onScale(s); }
    if (placeOverlay(tx, ty)) frame = requestAnimationFrame(render); // pills still sliding
  }

  // Zoom-dependent layers.
  function onScale(s) {
    const km = kmAcross(s);
    const d = clamp((21 - km) / 6, 0, 1);
    mapEl.style.setProperty('--nm-district-alpha', d.toFixed(3));
    mapEl.style.setProperty('--nm-city-name-alpha', (1 - d).toFixed(3));
    mapEl.style.setProperty('--nm-metro-alpha', (0.32 + 0.23 * d).toFixed(3));
    districtNames.setAttribute('font-size', (DISTRICT_FONT / s).toFixed(2));
    stationNames.setAttribute('font-size', (STATION_FONT / s).toFixed(2));
    borderNames.setAttribute('font-size', (BORDER_FONT / s).toFixed(2));
    cityNames.setAttribute('font-size', (CITY_FONT / s).toFixed(2));
    layout = layoutMarkets(s, true);
    placeTexts(s, d);
  }
  const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const box = (x, y, w, h, pad = 0) => ({x0: x - w / 2 - pad, x1: x + w / 2 + pad, y0: y - h / 2 - pad, y1: y + h / 2 + pad});
  // Station and district names, in scaled world coordinates (independent of panning).
  // Priority: market pills > station names > district names.
  function placeTexts(s, districtAlpha) {
    const taken = [];
    for (const it of layout) {
      if (it.members.length > 1 || it.count) taken.push(box(it.x, it.y, 34, CLUSTER_H, 2));
      else taken.push(box(it.x + it.ox, it.y + it.oy, labelWidth(it.members[0]), LABEL_H, 2));
    }
    const km = kmAcross(s);
    const named = [];
    if (metro) {
      const showAll = km <= ALL_KM, showTransfer = km <= TRANSFER_KM && districtAlpha > 0;
      const order = metro.stations.slice().sort((a, b) => (b.transfer ? 1 : 0) - (a.transfer ? 1 : 0));
      for (const st of order) {
        let side = 0;
        if (showAll || (showTransfer && st.transfer)) {
          const w = st.len * STATION_FONT * 1.04 + 2, h = STATION_FONT + 4, x = st.x * s, y = st.y * s;
          for (const dir of [1, -1]) {
            const r = {x0: dir > 0 ? x + 6 : x - 6 - w, x1: dir > 0 ? x + 6 + w : x - 6, y0: y - h / 2, y1: y + h / 2};
            if (!taken.some(t => overlaps(t, r)) && !named.some(t => overlaps(t, r))) { named.push(r); side = dir; break; }
          }
        }
        if (side !== st.side) {
          st.side = side;
          st.el.style.display = side ? '' : 'none';
          if (side) { st.el.setAttribute('text-anchor', side > 0 ? 'start' : 'end'); st.el.setAttribute('dx', side > 0 ? '0.68em' : '-0.68em'); }
        }
      }
    }
    const districts = [], pxPerKm = s * 100;
    for (const d of map.districts) {
      let ok = false;
      if (districtAlpha > 0) {
        const w = d.len * DISTRICT_FONT * 1.08 + 6, h = DISTRICT_FONT + 6;
        const r = box(d.x * s, d.y * s, w, h);
        ok = d.area * pxPerKm * pxPerKm > w * h * 2.2 && !taken.some(t => overlaps(t, r)) && !named.some(t => overlaps(t, r)) && !districts.some(t => overlaps(t, r));
        if (ok) districts.push(r);
      }
      d.el.style.display = ok ? '' : 'none';
    }
    textRects = named.concat(districts);
  }

  // ---- Pills: flexible leaders, sticky places, merging as the last resort -------
  function labelWidth(m) {
    if (!m.w) m.w = Math.ceil(m.pin.offsetWidth) || Math.round(m.name.length * 13.5 + 29);
    return m.w;
  }
  // Leader directions: up first (the design), angle from vertical, then down.
  const ANGLES = [30, -30, 15, -15, 45, -45, 0, 60, -60];
  const LENGTHS = [52, 68, 86, 108];
  const CANDIDATES = [];
  for (const sy of [-1, 1]) for (const len of LENGTHS) for (const a of ANGLES) {
    const r = a * Math.PI / 180;
    CANDIDATES.push({ox: Math.sin(r) * len, oy: sy * Math.cos(r) * len, cost: len * 0.5 + Math.abs(Math.abs(a) - 30) * 0.35 + (sy > 0 ? 34 : 0)});
  }
  function segmentHits(x0, y0, x1, y1, r) { // Liang–Barsky
    let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
    for (const [p, q] of [[-dx, x0 - r.x0], [dx, r.x1 - x0], [-dy, y0 - r.y0], [dy, r.y1 - y0]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  function segmentsCross(a, b) {
    const d = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const p1 = [a[0], a[1]], p2 = [a[2], a[3]], p3 = [b[0], b[1]], p4 = [b[2], b[3]];
    return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0;
  }
  let prevOffsets = new Map(), prevGroup = new Map();
  function layoutMarkets(s, commit) {
    let items = markets.filter(m => m.placed).map(m => ({members: [m], x: m.x * s, y: m.y * s}));
    const merge = (a, b) => {
      const members = a.members.concat(b.members);
      return {members, x: members.reduce((t, m) => t + m.x, 0) / members.length * s, y: members.reduce((t, m) => t + m.y, 0) / members.length * s};
    };
    // Markets that were one number stay one a little longer (no flicker at the threshold).
    const together = (a, b) => a.members.some(m => b.members.some(n => prevGroup.get(m.id) && prevGroup.get(m.id) === prevGroup.get(n.id)));
    const mergeClose = limit => {
      for (let joined = true; joined;) {
        joined = false;
        for (let i = 0; i < items.length && !joined; i++) for (let j = i + 1; j < items.length; j++) {
          const lim = limit * (together(items[i], items[j]) ? 1.3 : 1);
          if (Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y) < lim) {
            const merged = merge(items[i], items[j]);
            items = items.filter((_, k) => k !== i && k !== j).concat(merged); joined = true; break;
          }
        }
      }
    };
    const finish = list => {
      if (commit) {
        prevGroup = new Map(); prevOffsets = new Map();
        list.forEach(it => {
          const key = it.members.length > 1 ? it.members.map(m => m.id).sort().join('|') : '';
          it.members.forEach(m => prevGroup.set(m.id, key));
          if (it.members.length === 1 && !it.count) prevOffsets.set(it.members[0].id, {ox: it.ox, oy: it.oy});
        });
      }
      return list;
    };
    if (kmAcross(s) > FAR_KM) { // city level: every market or group of markets is a number
      mergeClose(46);
      items.forEach(it => { it.count = true; });
      return finish(items);
    }
    mergeClose(24);
    const clusterBox = it => box(it.x, it.y, 22 + String(it.members.length).length * 8, CLUSTER_H, 3);
    for (let guard = 0; guard < 60; guard++) {
      const placed = [], leadersSoFar = [];
      for (const it of items) if (it.members.length > 1) placed.push(clusterBox(it));
      if (userPos) placed.push(box(userPos[0] * s, userPos[1] * s, 30, 30));
      const dots = items.filter(it => it.members.length === 1).map(it => ({it, r: box(it.x, it.y, 10, 10)}));
      // Pills that already had a place go first, so they keep it.
      const singles = items.filter(it => it.members.length === 1)
        .sort((a, b) => (prevOffsets.has(b.members[0].id) - prevOffsets.has(a.members[0].id)) || a.members[0].order - b.members[0].order);
      let failed = null;
      for (const it of singles) {
        const m = it.members[0], w = labelWidth(m);
        const gap = GAP + (prevGroup.get(m.id) ? 6 : 0); // leaving a number needs a bit more room
        const fits = (ox, oy) => {
          const lx = it.x + ox, ly = it.y + oy, r = box(lx, ly, w, LABEL_H, gap), seg = [it.x, it.y, lx, ly];
          if (placed.some(p => overlaps(p, r))) return null;
          if (dots.some(d => d.it !== it && overlaps(d.r, r))) return null;
          if (placed.some(p => p.label && segmentHits(it.x, it.y, lx, ly, p))) return null;
          if (leadersSoFar.some(l => segmentHits(l[0], l[1], l[2], l[3], r) || segmentsCross(l, seg))) return null;
          return r;
        };
        let spot = null;
        const prev = prevOffsets.get(m.id);
        if (prev) { const r = fits(prev.ox, prev.oy); if (r) spot = {ox: prev.ox, oy: prev.oy, r}; }
        if (!spot) {
          let best = Infinity;
          for (const c of CANDIDATES) {
            const cost = c.cost + (prev ? Math.hypot(c.ox - prev.ox, c.oy - prev.oy) * 0.8 : 0);
            if (cost >= best) continue;
            const r = fits(c.ox, c.oy);
            if (r) { best = cost; spot = {ox: c.ox, oy: c.oy, r}; }
          }
        }
        if (!spot) { failed = it; break; }
        it.ox = spot.ox; it.oy = spot.oy;
        spot.r.label = true; placed.push(spot.r);
        leadersSoFar.push([it.x, it.y, it.x + spot.ox, it.y + spot.oy]);
      }
      if (!failed) return finish(items);
      let best = null, bd = Infinity;
      for (const other of items) {
        if (other === failed) continue;
        const d = Math.hypot(other.x - failed.x, other.y - failed.y);
        if (d < bd) { bd = d; best = other; }
      }
      if (!best) return finish(items);
      items = items.filter(it => it !== failed && it !== best).concat(merge(failed, best));
    }
    return finish(items);
  }

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  function slide(m, ox, oy, wasOn, now) { // the pill glides to a new place instead of jumping
    if (!wasOn || !m.cur || reduceMotion.matches) { m.cur = {ox, oy}; m.tw = null; return false; }
    if (!m.tw || Math.abs(m.tw.to.ox - ox) > .5 || Math.abs(m.tw.to.oy - oy) > .5) {
      if (Math.abs(m.cur.ox - ox) <= .5 && Math.abs(m.cur.oy - oy) <= .5) { m.cur = {ox, oy}; m.tw = null; return false; }
      m.tw = {from: {...m.cur}, to: {ox, oy}, t0: now};
    }
    const t = Math.min(1, (now - m.tw.t0) / SLIDE_MS), e = easeOut(t);
    m.cur = {ox: m.tw.from.ox + (ox - m.tw.from.ox) * e, oy: m.tw.from.oy + (oy - m.tw.from.oy) * e};
    if (t >= 1) { m.tw = null; return false; }
    return true;
  }

  function placeOverlay(tx, ty) {
    const now = performance.now();
    const shown = new Set(), off = [], boxes = [], pending = [];
    const offList = it => { for (const m of it.members) off.push({m, sx: m.x * view.s + tx, sy: m.y * view.s + ty}); };
    let ci = 0, moving = false;
    const inside = (x, y, e) => x >= e && x <= W - e && y >= e && y <= H - e;
    for (const it of layout) {
      const sx = it.x + tx, sy = it.y + ty;
      if (it.members.length === 1 && !it.count) {
        if (!inside(sx, sy, DOT_EDGE)) { offList(it); continue; }
        const m = it.members[0], w = labelWidth(m);
        if (slide(m, it.ox, it.oy, m.pin.classList.contains('is-on'), now)) moving = true;
        // Pills stay out of the outer band; one pushed in that lands on another is counted at the edge.
        const lx = clamp(sx + m.cur.ox, BAND + w / 2, W - BAND - w / 2), ly = clamp(sy + m.cur.oy, BAND + LABEL_H / 2, H - BAND - LABEL_H / 2);
        const r = box(lx, ly, w, LABEL_H);
        if (Math.abs(lx - sx - m.cur.ox) > .5 || Math.abs(ly - sy - m.cur.oy) > .5) { pending.push({m, sx, sy, lx, ly, r}); continue; }
        boxes.push(r); placePin(m, sx, sy, lx, ly); shown.add(m);
        continue;
      }
      if (!inside(sx, sy, BAND)) { offList(it); continue; }
      const b = clusterButton(ci++);
      b._item = it;
      b.textContent = String(it.members.length);
      b.setAttribute('aria-label', it.members.map(m => m.name).join('、') + (it.members.length > 1 ? '（' + it.members.length + '件）' : '') + 'を拡大');
      b.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)`;
      b.classList.add('is-on'); b.tabIndex = 0;
      boxes.push(box(sx, sy, 22 + String(it.members.length).length * 8, CLUSTER_H));
    }
    for (const p of pending) {
      if (boxes.some(b => overlaps(b, p.r))) { off.push({m: p.m, sx: p.sx, sy: p.sy}); continue; }
      boxes.push(p.r); placePin(p.m, p.sx, p.sy, p.lx, p.ly); shown.add(p.m);
    }
    markets.forEach(m => {
      const on = shown.has(m);
      m.pin.classList.toggle('is-on', on);
      m.pin.tabIndex = on ? 0 : -1;
      m.leader.classList.toggle('is-on', on);
      if (!on) { m.tw = null; m.cur = null; }
    });
    for (let i = ci; i < clusterPool.length; i++) { const b = clusterPool[i]; b.classList.remove('is-on'); b._item = null; b.tabIndex = -1; }
    placeEdges(off, boxes);
    placeCityNames(tx, ty, boxes);
    placeBorderNames(tx, ty, boxes);
    if (userPos) {
      const ux = userPos[0] * view.s + tx, uy = userPos[1] * view.s + ty;
      me.style.transform = `translate3d(${ux.toFixed(1)}px,${uy.toFixed(1)}px,0)`;
      me.classList.toggle('is-on', ux > -40 && ux < W + 40 && uy > -40 && uy < H + 40);
    } else me.classList.remove('is-on');
    return moving;
  }
  function placePin(m, sx, sy, lx, ly) {
    m.pin.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0) translate(-50%,-50%)`;
    m.line.setAttribute('x1', sx.toFixed(1)); m.line.setAttribute('y1', sy.toFixed(1));
    m.line.setAttribute('x2', lx.toFixed(1)); m.line.setAttribute('y2', ly.toFixed(1));
    m.dot.setAttribute('cx', sx.toFixed(1)); m.dot.setAttribute('cy', sy.toFixed(1));
  }
  // Numbers in the outer band, in the direction of the markets they count.
  function placeEdges(off, boxes) {
    const groups = SECTOR_JA.map(() => []);
    const cx = W / 2, cy = H / 2;
    for (const o of off) groups[(Math.round(Math.atan2(o.sy - cy, o.sx - cx) / (Math.PI / 4)) + 8) % 8].push(o);
    const chips = [];
    groups.forEach((g, i) => {
      const chip = edgeChips[i];
      if (!g.length) { chip.classList.remove('is-on'); chip.tabIndex = -1; chip._members = null; return; }
      const mx = g.reduce((t, o) => t + o.sx, 0) / g.length - cx, my = g.reduce((t, o) => t + o.sy, 0) / g.length - cy;
      const len = Math.hypot(mx, my) || 1, ux = mx / len, uy = my / len;
      chip._members = g.map(o => o.m);
      chip._count.textContent = String(g.length);
      const cw = chip.offsetWidth || 32, ch = CLUSTER_H;
      const hx = W / 2 - 8 - cw / 2, hy = H / 2 - 8 - ch / 2;
      const t = Math.min(Math.abs(ux) > 1e-6 ? hx / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? hy / Math.abs(uy) : Infinity);
      let px = cx + ux * t, py = cy + uy * t;
      const alongY = Math.abs(ux) > 1e-6 && hx / Math.abs(ux) <= t + .5;
      for (const shift of [0, 30, -30, 60, -60]) {
        const qx = alongY ? px : clamp(px + shift, 8 + cw / 2, W - 8 - cw / 2), qy = alongY ? clamp(py + shift, 8 + ch / 2, H - 8 - ch / 2) : py;
        const r = box(qx, qy, cw + 14, ch + 14);
        if (!chips.some(c => overlaps(c, r)) || shift === -60) { px = qx; py = qy; chips.push(r); break; }
      }
      // The chevron sits on the side / corner the markets are in.
      const dx = Math.round(Math.cos(i * Math.PI / 4)), dy = Math.round(Math.sin(i * Math.PI / 4));
      chip._arrow.style.left = `calc(50% + ${dx * (cw / 2 + 5)}px)`;
      chip._arrow.style.top = `calc(50% + ${dy * (ch / 2 + 5)}px)`;
      chip.setAttribute('aria-label', SECTOR_JA[i] + '方向の画面外の夜市 ' + g.length + '件（' + chip._members.map(m => m.name).join('、') + '）へ移動');
      chip.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) translate(-50%,-50%)`;
      chip.classList.add('is-on'); chip.tabIndex = 0;
    });
    boxes.push(...chips);
  }
  // Zoomed out: one name per city, at the first of its anchors that is in view and free.
  function placeCityNames(tx, ty, boxes) {
    const alpha = Number(mapEl.style.getPropertyValue('--nm-city-name-alpha')) || 0;
    for (const c of map.cities) {
      let spot = null;
      if (alpha > 0.02) {
        const w = [...c.name].length * CITY_FONT * 1.3 + 8;
        for (const [x, y] of c.anchors) {
          const sx = x * view.s + tx, sy = y * view.s + ty, r = box(sx, sy, w, CITY_FONT + 8);
          if (sx < 50 || sx > W - 50 || sy < 40 || sy > H - 40 || boxes.some(b => overlaps(b, r))) continue;
          spot = [x, y]; boxes.push(r); break;
        }
      }
      if (spot) { c.el.setAttribute('x', spot[0]); c.el.setAttribute('y', spot[1]); c.el.style.opacity = ''; }
      else c.el.style.opacity = 0;
    }
  }
  // Zoomed in: small city names along the city borders in view, each name once.
  function placeBorderNames(tx, ty, boxes) {
    const alpha = Number(mapEl.style.getPropertyValue('--nm-district-alpha')) || 0;
    const used = new Set();
    const rects = textRects.map(r => ({x0: r.x0 + tx, x1: r.x1 + tx, y0: r.y0 + ty, y1: r.y1 + ty}));
    const spots = new Map();
    if (alpha > 0.5) {
      const cands = map.borderLabels.map(b => ({b, sx: b.x * view.s + tx, sy: b.y * view.s + ty}))
        .filter(c => c.sx > BAND + 20 && c.sx < W - BAND - 20 && c.sy > BAND && c.sy < H - BAND)
        .sort((a, b) => Math.hypot(a.sx - W / 2, a.sy - H / 2) - Math.hypot(b.sx - W / 2, b.sy - H / 2));
      for (const c of cands) {
        if (used.has(c.b.name)) continue;
        const r = box(c.sx, c.sy, [...c.b.name].length * BORDER_FONT * 1.25 + 4, BORDER_FONT + 4);
        if (boxes.some(b => overlaps(b, r)) || rects.some(b => overlaps(b, r))) continue;
        used.add(c.b.name); spots.set(c.b.name, c.b); boxes.push(r);
      }
    }
    for (const n of map.borderNames) {
      const b = spots.get(n.name);
      if (b) { n.el.setAttribute('x', b.x); n.el.setAttribute('y', b.y); n.el.style.display = ''; }
      else n.el.style.display = 'none';
    }
  }

  // ---- Motion -------------------------------------------------------------------
  let anim = 0, inertia = 0, interacted = false;
  function stopMotion() {
    if (anim) cancelAnimationFrame(anim);
    if (inertia) cancelAnimationFrame(inertia);
    anim = inertia = 0;
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(target, duration, done) {
    stopMotion();
    const from = {...view}, keep = {...view};
    Object.assign(view, {cx: target.cx, cy: target.cy, s: target.s}); clampView();
    const to = {...view};
    Object.assign(view, keep);
    if (!duration || reduceMotion.matches) { Object.assign(view, to); render(); if (done) done(); return; }
    const start = performance.now(), l0 = Math.log(from.s), l1 = Math.log(to.s);
    const zooms = Math.abs(l1 - l0) > 1e-3;
    const step = now => {
      const t = Math.min(1, (now - start) / duration), e = ease(t);
      view.s = Math.exp(l0 + (l1 - l0) * e);
      // While zooming, the centre moves in step with the visible size: one steady glide.
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
    const fit = Math.min((W - 2 * BAND - 120) / Math.max(1, x1 - x0), (H - 2 * BAND - 140) / Math.max(1, y1 - y0));
    flyTo({cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(view.s, fit)}, 750);
  }
  function zoomIntoCluster(item) {
    interacted = true;
    const ids = new Set(item.members.map(m => m.id));
    let s = Math.max(view.s, W / FAR_KM / 100 * 1.15);
    if (ids.size === 1) s = Math.max(view.s, sFocus);
    else {
      const together = scale => layoutMarkets(scale, false).some(it => it.members.filter(m => ids.has(m.id)).length === ids.size);
      while (s < sMax && together(s)) s = Math.min(sMax, s * 1.25);
    }
    const cx = item.members.reduce((t, m) => t + m.x, 0) / item.members.length;
    const cy = item.members.reduce((t, m) => t + m.y, 0) / item.members.length;
    flyTo({cx, cy, s}, 650);
  }

  // ---- Gestures -------------------------------------------------------------------
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

  // ---- Details view ---------------------------------------------------------------
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

  // The box keeps the length of the former tabs: the 10 + 14 px margins, the
  // pill strip and the longest market panel, measured in their old layout.
  let fittedFor = '';
  function fitHeight() {
    const width = stage.clientWidth;
    if (!width) return;
    const key = String(width);
    if (key === fittedFor) return;
    const pills = node('div', {class: 'tab-pills', role: 'presentation'});
    pills.append(node('button', {type: 'button', class: 'tab-pill', tabindex: '-1'}, markets[0].name));
    const panel = node('div', {class: 'tab-panel night-market-panel'});
    measurer.replaceChildren(pills, panel);
    measurer.style.width = Math.max(200, width - 32) + 'px';
    let tallest = 0;
    for (const m of markets) {
      panel.replaceChildren(node('h4', {class: 'nm-title'}, m.name), ...detailContent(m.data));
      tallest = Math.max(tallest, panel.offsetHeight);
    }
    const strip = pills.offsetHeight;
    measurer.replaceChildren(); measurer.style.width = '';
    if (!tallest) return;
    fittedFor = key;
    stage.style.height = Math.round(Math.max(360, 10 + 14 + strip + tallest)) + 'px';
  }

  // ---- Opening: overview → visitor (or 台北駅) -----------------------------------
  function debugPosition() {
    if (!DEBUG) return null;
    try {
      const saved = JSON.parse(sessionStorage.getItem('taipeiDebugLocation') || 'null');
      return saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng) ? saved : null;
    } catch (_) { return null; }
  }
  function locate() {
    return new Promise(resolve => {
      const sim = debugPosition();
      if (sim) { const [x, y] = project(sim.lat, sim.lng); resolve(inRegion(x, y) ? [x, y] : null); return; }
      if (!navigator.geolocation || !window.isSecureContext) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(p => {
        const {latitude: lat, longitude: lng, accuracy} = p.coords;
        // iPhone without 正確な位置情報 reports a few km of uncertainty: still useful here.
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !(accuracy <= 10000)) { resolve(null); return; }
        const [x, y] = project(lat, lng);
        resolve(inRegion(x, y) ? [x, y] : null);
      }, () => resolve(null), {enableHighAccuracy: false, timeout: 15000, maximumAge: 30000});
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
    // While the visitor answers the location prompt: show 台北駅 after a while,
    // then move on to their position if it arrives later.
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
  // ?debugLocation=1: a new simulated position moves the map there at once.
  document.addEventListener('tabi:debug-location', () => {
    if (!section.open || !map || !W) return;
    locate().then(pos => {
      userPos = pos; lastScale = NaN;
      flyTo({cx: (pos || project(...FALLBACK))[0], cy: (pos || project(...FALLBACK))[1], s: Math.max(view.s, sFocus)}, 900);
    });
  });
  function onOpen() {
    setView('map');
    fitHeight();
    loadMap().then(data => {
      setupMap(data);
      if (!section.open) return;
      const start = () => { if (!measure()) return false; sizeWaiter = null; intro(); return true; };
      if (!start()) sizeWaiter = start;
    }).catch(showFallbackList);
  }
  function onClose() { introToken++; stopMotion(); sizeWaiter = null; }
  new ResizeObserver(() => {
    if (!section.open) return;
    fitHeight();
    if (!map) return;
    if (sizeWaiter) { sizeWaiter(); return; }
    if (measure()) requestRender();
  }).observe(stage);
  window.addEventListener('resize', () => { if (section.open) fitHeight(); });
  if (document.fonts?.ready) document.fonts.ready.then(() => {
    markets.forEach(m => { m.w = 0; }); fittedFor = '';
    if (section.open) fitHeight();
    lastScale = NaN; requestRender();
  });
  function showFallbackList() {
    const list = node('div', {class: 'nm-fallback'});
    list.append(node('p', {class: 'nm-fallback-note'}, '地図を読み込めませんでした。夜市を選んでください。'));
    const ul = node('ul');
    markets.forEach(m => {
      const li = node('li'), b = node('button', {type: 'button'}, m.name);
      b.addEventListener('click', () => openDetail(m, b)); li.append(b); ul.append(li);
    });
    list.append(ul);
    mapEl.replaceChildren(list);
  }
  section.addEventListener('toggle', () => { if (section.open) onOpen(); else onClose(); });
  if (section.open) onOpen();
})();
