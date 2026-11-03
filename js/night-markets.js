/* v30.9.259 — 夜市マップ from data/night-markets.js (window.TABI_NIGHT_MARKETS).
   The box opens on an overview of 台北市区＋北海岸 and glides to the visitor's
   position (or 台北駅 when it is unknown / outside 北北基桃), every time it opens.
   Base map: data/night-market-map.js (内政部 lines; the rest of Taiwan fades out).
   Rail layer: data/night-market-metro.js — MRT, light rail, 台鉄, 高鉄 on their exact
   tracks, one line per route (© OpenStreetMap contributors, ODbL). Both load on
   first open. One finger drags, two fingers pinch; the view stays between 桃園駅,
   九份 and 三峽老街 (north as far as the map goes).
   Markets: zoomed out, numbers. Zoomed in, a name pill per market whose leader
   points away from the centre of the screen, long near the centre and shorter
   outwards; near the edge the pill sits on its dot, shrinks as it is squeezed
   and, small enough, joins the number at the edge (and comes back out of it).
   This follows every frame of a drag. Off-view markets are counted at the edge,
   grouped by direction (within ~70°).
   Stations (radius in view): main stations (several systems, 台鉄, 高鉄) dot from
   4.5 km, transfers and the markets' stations from 3.5 km, all from 2.5 km; names
   within 2.5 km, by priority and a label budget per screen area. Several systems
   meet: a white circle (an oval across side-by-side lines) and the logos under the
   name. At the closest zoom the other named stations show their operator's logo.
   City names along the borders within 1.5 km. Logos: assets/rail-logos/*.svg.
   Tapping a market opens its details in the same box (as long as the former tabs);
   ‹ returns. ⌖ (bottom right) goes back to the visitor's position.
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
  const VERSION = '30.9.259';
  const MAP_SRC = 'data/night-market-map.js?v=' + VERSION;
  const METRO_SRC = 'data/night-market-metro.js?v=' + VERSION;
  const OVERVIEW = [25.105, 121.556];      // 台北市区＋北海岸
  const FALLBACK = [25.0478, 121.5170];    // 台北駅
  const LIMIT_SOUTH = [24.9345, 121.3690]; // 三峽老街: the view centre goes no further south
  const LIMIT_EAST = [25.1092, 121.8448];  // 九份
  const LIMIT_WEST = [24.9891, 121.3137];  // 桃園駅
  const DEBUG = new URLSearchParams(location.search).get('debugLocation') === '1';
  // Sizes in screen px.
  const DISTRICT_FONT = 10.5, BORDER_FONT = 9, CITY_FONT = 13;
  const LABEL_H = 28.2, CLUSTER_H = 23.5, GAP = 6;
  const BAND = 42;      // outer band kept for the off-view numbers: no pill enters it
  const DOT_EDGE = 18;  // a market dot closer than this to the edge counts as off view
  // View widths in km (= 2 × the radius in view).
  const FAR_KM = 17;        // wider: markets as numbers only
  const A_DOTS_KM = 9;      // main stations (several systems, 台鉄・高鉄): dots
  const B_DOTS_KM = 7;      // transfers and the markets' stations: dots
  const C_DOTS_KM = 5;      // every station: dots; station names from here on
  const LOGO_KM = 2.6;      // the closest zoom: named stations show their logo
  const BORDER_KM = 3;      // city names along the borders
  const CLOSEST_KM = 2;     // the closest zoom: about 1 km around the centre
  const LABEL_AREA = 120 * 120; // one station name per this many px² of map
  const LOGO_DIR = 'assets/rail-logos/';
  const OPERATORS = {trtc: '北捷', ntmc: '新北', tymc: '機捷', tra: '台鉄', thsr: '高鉄'};
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
    const code = m.access?.type === 'mrt' ? str(m.access.code).toUpperCase() : '';
    return {id: idOf(m.id, i), name: str(m.name), data: m, lat, lng, placed, order: i, x: 0, y: 0, w: 0, code};
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
  const borderNames = svg('g', {class: 'nm-border-names'});
  const cityNames = svg('g', {class: 'nm-city-names'});
  world.append(...neighborLines, districtLines, cityLines, metroLines, stationDots, districtNames, borderNames, cityNames);
  base.append(world);
  const leaders = svg('svg', {class: 'nm-map-leaders', 'aria-hidden': 'true', focusable: 'false'});
  const me = node('div', {class: 'nm-me', 'aria-hidden': 'true'});
  me.append(node('span', {class: 'nm-me-wave'}), node('span', {class: 'nm-me-wave nm-me-wave--late'}), node('span', {class: 'nm-me-core'}));
  const stationsLayer = node('div', {class: 'nm-map-stations', 'aria-hidden': 'true'});
  const pinsLayer = node('div', {class: 'nm-map-pins'});
  const edgesLayer = node('div', {class: 'nm-map-edges'});
  // ⌖ back to the visitor's position (28 px, with a larger touch area).
  const locateBtn = node('button', {type: 'button', class: 'nm-locate', 'aria-label': '現在地に戻る'});
  const locateIcon = svg('svg', {viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false'});
  locateIcon.append(svg('circle', {cx: 10, cy: 10, r: 5.2, class: 'nm-locate-ring'}), svg('circle', {cx: 10, cy: 10, r: 2.4, class: 'nm-locate-dot'}),
    svg('path', {d: 'M10 1.5v3.3M10 15.2v3.3M1.5 10h3.3M15.2 10h3.3', class: 'nm-locate-ticks'}));
  locateBtn.append(locateIcon);
  const toast = node('p', {class: 'nm-toast', role: 'status'});
  const status = node('p', {class: 'nm-sr', 'aria-live': 'polite'});
  // Leaders above the pills, ending at their edge: an even line, never shaded.
  mapEl.append(base, stationsLayer, me, pinsLayer, leaders, edgesLayer, locateBtn, toast);

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
  // Off-view numbers with a thin chevron on the side / corner of their direction.
  const edgeChips = Array.from({length: 8}, () => {
    const b = node('button', {type: 'button', class: 'nm-edge', tabindex: '-1'});
    const count = node('span', {class: 'nm-edge-count'});
    const arrow = svg('svg', {class: 'nm-edge-arrow', viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true', focusable: 'false'});
    arrow.append(svg('path', {d: 'M4.3 2.4L8 6l-3.7 3.6', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}));
    b.append(count, arrow);
    b._count = count; b._arrow = arrow; b._n = 0;
    b.addEventListener('click', () => { if (b._members) fitMembers(b._members); });
    edgesLayer.append(b);
    return b;
  });
  const DIR_JA = ['東', '南東', '南', '南西', '西', '北西', '北', '北東'];

  // ---- Map data ---------------------------------------------------------------
  let map = null, metro = null, mapPromise = null, regionRings = [], limits = null;
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
        loadScript(METRO_SRC, 'TABI_NIGHT_MARKET_METRO').catch(() => null) // the map works without the rail layer
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
    limits = {south: project(...LIMIT_SOUTH)[1], east: project(...LIMIT_EAST)[0], west: project(...LIMIT_WEST)[0]};
    (data.neighborPaths || []).forEach((d, i) => neighborLines[i]?.setAttribute('d', d));
    districtLines.setAttribute('d', data.districtPath);
    cityLines.setAttribute('d', data.cityPath);
    map.districts.forEach(d => { d.el = textEl(districtNames, d.x, d.y, d.name); d.len = [...d.name].length; });
    map.cities.forEach(c => { c.el = textEl(cityNames, 0, 0, c.name, c.neighbor ? 'is-neighbor' : ''); c.el.style.opacity = 0; });
    map.borderPool = Array.from({length: 6}, () => { const el = textEl(borderNames, 0, 0, ''); el.style.display = 'none'; return el; });
    regionRings = (data.regionRings || []).map(flat => { const r = []; for (let i = 0; i < flat.length; i += 2) r.push([flat[i], flat[i + 1]]); return r; });
    markets.forEach(m => { if (m.placed) [m.x, m.y] = project(m.lat, m.lng); });
    if (metroData && metroData.type === 'night-market-metro') setupRail(metroData);
  }
  const marketCodes = new Set(markets.map(m => m.code).filter(Boolean));
  const LINE_COLOR = {};
  function opTile(op, extra) {
    const tile = node('span', {class: 'nm-op nm-op-' + op + (extra ? ' ' + extra : '')});
    tile.append(node('b', {}, OPERATORS[op] || ''));
    return tile;
  }
  function setupRail(data) {
    metro = data;
    const lineGroup = [];
    metro.lines.forEach(l => {
      LINE_COLOR[l.id] = l.color;
      if (l.outside) metroLines.append(svg('path', {d: l.outside, stroke: l.color, class: 'nm-metro-line nm-rail nm-rail-outside'}));
      lineGroup.push(svg('path', {d: l.path, stroke: l.color, class: 'nm-metro-line' + (l.rail ? ' nm-rail' : '')}));
      indexSegments(l.path);
    });
    metroLines.append(...lineGroup);
    metro.stations.forEach(st => {
      st.ops = st.ops || [];
      st.multi = st.ops.length >= 2;                 // several systems meet: circle / oval + logos
      st.railway = st.lines.some(id => id === 'TRA' || id === 'THSR');
      st.marketStation = (st.codes || []).some(c => marketCodes.has(String(c.code).toUpperCase()));
      st.tier = st.multi || st.railway ? 0 : (st.transfer || st.marketStation) ? 1 : 2;
      st.mark = node('div', {class: 'nm-st-mark'});
      if (st.oval !== undefined) st.mark.style.setProperty('--nm-oval', st.oval + 'deg');
      st.mark.append(opTile(st.ops[0] || 'trtc'));
      st.el = node('div', {class: 'nm-st' + (st.tier < 2 ? ' is-important' : '')});
      st.el.append(node('span', {class: 'nm-st-name'}, st.name));
      if (st.multi) { const row = node('span', {class: 'nm-st-ops'}); st.ops.forEach(op => row.append(opTile(op))); st.el.append(row); }
      stationsLayer.append(st.mark, st.el);
      st.w = 0; st.place = null; st.mode = '';
    });
    const dots = (list, cls) => {
      const d = list.map(st => `M${st.x} ${st.y}h0`).join('');
      if (d) stationDots.append(svg('path', {d, class: cls + '-halo'}), svg('path', {d, class: cls}));
    };
    dots(metro.stations.filter(st => st.tier === 2), 'nm-station nm-tier-c');
    dots(metro.stations.filter(st => st.tier === 1 && !st.transfer), 'nm-station nm-tier-b');
    dots(metro.stations.filter(st => st.tier === 1 && st.transfer), 'nm-transfer nm-tier-b');
    dots(metro.stations.filter(st => st.tier === 0), 'nm-transfer nm-tier-a');
    loadLogos();
  }
  // A logo file that loads replaces the short name everywhere (one CSS variable per operator).
  function loadLogos() {
    for (const op of Object.keys(OPERATORS)) {
      const tryExt = exts => {
        if (!exts.length) return;
        const img = new Image();
        img.onload = () => { stage.style.setProperty('--nm-logo-' + op, `url("${img.src}")`); stage.classList.add('has-logo-' + op); };
        img.onerror = () => tryExt(exts.slice(1));
        img.src = LOGO_DIR + op + '.' + exts[0] + '?v=' + VERSION;
      };
      tryExt(['svg', 'png']);
    }
  }
  // Line segments in a coarse grid, so station names can be kept off the lines.
  const GRID = 60, segGrid = new Map();
  function indexSegments(path) {
    for (const part of path.split('M')) {
      const n = part.match(/-?\d+(?:\.\d+)?/g); if (!n || n.length < 4) continue;
      let x = +n[0], y = +n[1];
      for (let i = 2; i + 1 < n.length; i += 2) {
        const x2 = x + +n[i], y2 = y + +n[i + 1], seg = [x, y, x2, y2];
        for (let gx = Math.floor(Math.min(x, x2) / GRID); gx <= Math.floor(Math.max(x, x2) / GRID); gx++)
          for (let gy = Math.floor(Math.min(y, y2) / GRID); gy <= Math.floor(Math.max(y, y2) / GRID); gy++) {
            const k = gx + ',' + gy; if (!segGrid.has(k)) segGrid.set(k, []); segGrid.get(k).push(seg);
          }
        x = x2; y = y2;
      }
    }
  }
  function lineCrossings(r) { // r in world units
    let n = 0; const seen = new Set();
    for (let gx = Math.floor(r.x0 / GRID); gx <= Math.floor(r.x1 / GRID); gx++)
      for (let gy = Math.floor(r.y0 / GRID); gy <= Math.floor(r.y1 / GRID); gy++)
        for (const seg of segGrid.get(gx + ',' + gy) || []) {
          if (seen.has(seg)) continue; seen.add(seg);
          if (segmentHits(seg[0], seg[1], seg[2], seg[3], r)) n++;
        }
    return n;
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
  let lastScale = NaN, frame = 0, userPos = null, located = false, textRects = [], groups = [], pillBoxes = [];
  function measure() {
    const r = mapEl.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    if (Math.abs(r.width - W) < 0.5 && Math.abs(r.height - H) < 0.5) return true;
    W = r.width; H = r.height;
    for (const el of [base, leaders]) { el.setAttribute('width', W); el.setAttribute('height', H); }
    sMin = Math.max(W / 3000, H / 4000);               // at most ~30 km × 40 km in view
    sMax = Math.max(sMin * 2, W / (CLOSEST_KM * 100)); // about 1 km around the centre
    sFocus = clamp(W / 900, sMin, sMax);               // the focused view, ~9 km across
    lastScale = NaN; clampView();
    return true;
  }
  function clampView() {
    if (!map || !W) return;
    view.s = clamp(view.s, sMin, sMax);
    const [x0, y0, x1, y1] = map.bounds;
    const mx = Math.min(W / view.s * 0.3, (x1 - x0) / 2), my = Math.min(H / view.s * 0.3, (y1 - y0) / 2);
    const range = (lo, hi) => lo <= hi ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2];
    const [xl, xh] = range(Math.max(x0 + mx, limits.west), Math.min(x1 - mx, limits.east));
    const [yl, yh] = range(y0 + my, Math.min(y1 - my, limits.south));
    view.cx = clamp(view.cx, xl, xh);
    view.cy = clamp(view.cy, yl, yh);
  }
  const kmAcross = s => W / s / 100;
  function requestRender() { if (!frame) frame = requestAnimationFrame(render); }
  // After a pan comes to rest the station names are chosen again for what is on screen.
  let settleTimer = 0;
  function settle() { clearTimeout(settleTimer); settleTimer = setTimeout(() => { lastScale = NaN; requestRender(); }, 140); }
  function render() {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!map || !W) return;
    const s = view.s, tx = W / 2 - view.cx * s, ty = H / 2 - view.cy * s;
    world.setAttribute('transform', `matrix(${s} 0 0 ${s} ${tx.toFixed(2)} ${ty.toFixed(2)})`);
    const rescaled = s !== lastScale;
    if (rescaled) { lastScale = s; onScale(s); }
    const moving = placeOverlay(tx, ty);
    if (rescaled) placeTexts(s, tx, ty);
    placeStations(tx, ty);
    placeCityNames(tx, ty);
    placeBorderNames(tx, ty);
    placeMe(tx, ty);
    if (moving) frame = requestAnimationFrame(render); // pills still catching up
  }

  // Zoom-dependent layers.
  function onScale(s) {
    const km = kmAcross(s);
    const d = clamp((21 - km) / 6, 0, 1);
    const fade = (from, to) => clamp((from - km) / (from - to), 0, 1).toFixed(3);
    mapEl.style.setProperty('--nm-district-alpha', d.toFixed(3));
    mapEl.style.setProperty('--nm-city-name-alpha', (1 - d).toFixed(3));
    mapEl.style.setProperty('--nm-metro-alpha', (0.24 + 0.34 * d).toFixed(3));
    mapEl.style.setProperty('--nm-far', (1 - d).toFixed(3));
    mapEl.style.setProperty('--nm-a-alpha', fade(A_DOTS_KM, A_DOTS_KM - 0.8));
    mapEl.style.setProperty('--nm-b-alpha', fade(B_DOTS_KM, B_DOTS_KM - 0.8));
    mapEl.style.setProperty('--nm-c-alpha', fade(C_DOTS_KM, C_DOTS_KM - 0.8));
    mapEl.classList.toggle('is-deep', km <= LOGO_KM);
    districtNames.setAttribute('font-size', (DISTRICT_FONT / s).toFixed(2));
    borderNames.setAttribute('font-size', (BORDER_FONT / s).toFixed(2));
    cityNames.setAttribute('font-size', (CITY_FONT / s).toFixed(2));
    groups = groupMarkets(s);
  }
  const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const box = (x, y, w, h, pad = 0) => ({x0: x - w / 2 - pad, x1: x + w / 2 + pad, y0: y - h / 2 - pad, y1: y + h / 2 + pad});
  const shift = (r, dx, dy) => ({x0: r.x0 + dx, x1: r.x1 + dx, y0: r.y0 + dy, y1: r.y1 + dy});
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
  const locateBox = () => box(W - 24, H - 24, 44, 44); // the ⌖ button and a margin

  // ---- Markets: groups per zoom ----------------------------------------------------
  // Zoomed out every market or group is a number; zoomed in, markets closer than a
  // pill's height share a number. Markets that were together stay so a little longer.
  let prevGroup = new Map();
  function groupMarkets(s, simulate) {
    let items = markets.filter(m => m.placed).map(m => ({members: [m], x: m.x * s, y: m.y * s}));
    const far = kmAcross(s) > FAR_KM, limit = far ? 46 : 24;
    const together = (a, b) => a.members.some(m => b.members.some(n => prevGroup.get(m.id) && prevGroup.get(m.id) === prevGroup.get(n.id)));
    for (let joined = true; joined;) {
      joined = false;
      for (let i = 0; i < items.length && !joined; i++) for (let j = i + 1; j < items.length; j++) {
        if (Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y) < limit * (together(items[i], items[j]) ? 1.3 : 1)) {
          items = items.filter((_, k) => k !== i && k !== j).concat(mergeItems(items[i], items[j], s)); joined = true; break;
        }
      }
    }
    if (far) items.forEach(it => { it.count = true; });
    if (!simulate) {
      prevGroup = new Map();
      items.forEach(it => { const key = it.members.length > 1 ? it.members.map(m => m.id).sort().join('|') : ''; it.members.forEach(m => prevGroup.set(m.id, key)); });
    }
    return items;
  }
  function mergeItems(a, b, s) {
    const members = a.members.concat(b.members);
    return {members, x: members.reduce((t, m) => t + m.x, 0) / members.length * s, y: members.reduce((t, m) => t + m.y, 0) / members.length * s};
  }
  function labelWidth(m) {
    if (!m.w) m.w = Math.ceil(m.pin.offsetWidth) || Math.round(m.name.length * 13.5 + 27);
    return m.w;
  }

  // ---- Markets on screen, every frame -------------------------------------------------
  // A pill's leader points away from the centre of the screen: long near the centre
  // (at most ~70 px), shorter outwards, none near the edge, where the pill sits on its
  // dot and shrinks as it is squeezed; at 60 % it joins the number at the edge.
  const TURNS = [0, 15, -15, 30, -30, 45, -45, 60, -60, 90, -90];
  const STRETCH = [1, 0.6, 0.3, 1.25];
  let failGroups = [];
  function placeOverlay(tx, ty) {
    const s = view.s, cx = W / 2, cy = H / 2;
    const off = [], shown = new Map(), clusters = [];
    pillBoxes = [];
    const area = {x0: BAND, x1: W - BAND, y0: BAND, y1: H - BAND};
    const fixed = [locateBox()];
    if (userPos) fixed.push(box(userPos[0] * s + tx, userPos[1] * s + ty, 30, 30));
    const offList = it => { for (const m of it.members) off.push({m, sx: m.x * s + tx, sy: m.y * s + ty}); };
    let items = groups.map(it => ({...it, x: it.x + tx, y: it.y + ty}));
    // Markets that could not be placed apart last frame stay one number while still close.
    for (const ids of failGroups) {
      const parts = items.filter(it => it.members.length === 1 && !it.count && ids.has(it.members[0].id));
      if (parts.length < 2 || parts.some(a => parts.some(b => Math.hypot(a.x - b.x, a.y - b.y) > 70))) continue;
      items = items.filter(it => !parts.includes(it));
      let g = parts[0]; for (const p of parts.slice(1)) g = mergeScreen(g, p);
      items.push(g);
    }
    const newFails = [];
    const Lmax = Math.min(70, 0.18 * Math.min(W, H)), R = Math.hypot(W / 2 - BAND, H / 2 - BAND);
    let result = null;
    for (let guard = 0; guard < 40 && !result; guard++) {
      const placed = fixed.slice(), leadersSoFar = [], picks = new Map();
      clusters.length = 0;
      for (const it of items) if (it.members.length > 1 || it.count) {
        if (it.x < BAND || it.x > W - BAND || it.y < BAND || it.y > H - BAND) continue;
        const r = box(it.x, it.y, 22 + String(it.members.length).length * 8, CLUSTER_H, 3);
        placed.push(r); clusters.push(it);
      }
      const singles = items.filter(it => it.members.length === 1 && !it.count)
        .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
      const dots = singles.map(it => ({it, r: box(it.x, it.y, 10, 10)}));
      let failed = null;
      for (const it of singles) {
        const m = it.members[0], sx = it.x, sy = it.y;
        if (sx < DOT_EDGE || sx > W - DOT_EDGE || sy < DOT_EDGE || sy > H - DOT_EDGE) continue;
        const e = Math.min(sx - area.x0, area.x1 - sx, sy - area.y0, area.y1 - sy);
        if (m.absorbed ? e < 6 : e < 0) { m.absorbed = true; continue; }
        m.absorbed = false;
        const sc = 0.6 + 0.4 * clamp(e / 36, 0, 1);
        const w = labelWidth(m) * sc, h = LABEL_H * sc;
        const dist = Math.hypot(sx - cx, sy - cy);
        const want = dist < 24 ? -90 : Math.atan2(sy - cy, sx - cx) * 180 / Math.PI;
        const L = Math.min(Lmax * Math.pow(1 - clamp(dist / R, 0, 1), 0.7), Lmax * clamp((e - 30) / 60, 0, 1));
        const k = clamp((e - 6) / 34, 0, 1); // 0: the pill sits on its dot
        let pick = null;
        search: for (const turn of TURNS) for (const f of STRETCH) {
          const len = Math.min(L * f, Lmax), a = (want + turn) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
          const reach = Math.min(Math.abs(dx) > 1e-6 ? (w / 2) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? (h / 2) / Math.abs(dy) : Infinity);
          const lx = clamp(sx + dx * (len + reach * k), area.x0 + w / 2, area.x1 - w / 2);
          const ly = clamp(sy + dy * (len + reach * k), area.y0 + h / 2, area.y1 - h / 2);
          const r = box(lx, ly, w, h, GAP * sc), seg = [sx, sy, lx, ly];
          if (placed.some(p => overlaps(p, r))) continue;
          if (dots.some(d => d.it !== it && overlaps(d.r, r))) continue;
          if (placed.some(p => p.label && segmentHits(sx, sy, lx, ly, p))) continue;
          if (leadersSoFar.some(l => segmentHits(l[0], l[1], l[2], l[3], r) || segmentsCross(l, seg))) continue;
          pick = {lx, ly, sc, w, h, r}; break search;
        }
        if (!pick) { failed = it; break; }
        pick.r.label = true; placed.push(pick.r);
        leadersSoFar.push([sx, sy, pick.lx, pick.ly]);
        picks.set(m, pick);
      }
      if (!failed) { result = picks; break; }
      let best = null, bd = Infinity;
      for (const other of items) {
        if (other === failed || other.count) continue;
        const d = Math.hypot(other.x - failed.x, other.y - failed.y);
        if (d < bd) { bd = d; best = other; }
      }
      if (!best) { result = picks; break; }
      const merged = mergeScreen(failed, best);
      newFails.push(new Set(merged.members.map(m => m.id)));
      items = items.filter(it => it !== failed && it !== best).concat(merged);
    }
    failGroups = newFails.filter(ids => items.some(it => it.members.length === ids.size && it.members.every(m => ids.has(m.id))));
    // Draw: clusters, pills (gliding when their place jumps), leaders.
    let ci = 0, moving = false;
    for (const it of clusters) {
      const b = clusterButton(ci++);
      b._item = it;
      b.textContent = String(it.members.length);
      b.setAttribute('aria-label', it.members.map(m => m.name).join('、') + (it.members.length > 1 ? '（' + it.members.length + '件）' : '') + 'を拡大');
      b.style.transform = `translate3d(${it.x.toFixed(1)}px,${it.y.toFixed(1)}px,0) translate(-50%,-50%)`;
      b.classList.add('is-on'); b.tabIndex = 0;
      pillBoxes.push(box(it.x, it.y, 22 + String(it.members.length).length * 8, CLUSTER_H));
    }
    for (let i = ci; i < clusterPool.length; i++) { const b = clusterPool[i]; b.classList.remove('is-on'); b._item = null; b.tabIndex = -1; }
    for (const it of items) {
      if (it.members.length > 1 || it.count) { if (!clusters.includes(it)) offList(it); continue; }
      const m = it.members[0], p = result && result.get(m);
      if (!p) { offList(it); continue; }
      const wasOn = m.pin.classList.contains('is-on');
      if (!wasOn || !m.cur || reduceMotion.matches) m.cur = {x: p.lx, y: p.ly, sc: p.sc};
      else {
        const jump = Math.hypot(p.lx - m.cur.x, p.ly - m.cur.y);
        if (jump > 14 || m.chasing) {
          m.chasing = jump > 0.8;
          m.cur = {x: m.cur.x + (p.lx - m.cur.x) * 0.3, y: m.cur.y + (p.ly - m.cur.y) * 0.3, sc: m.cur.sc + (p.sc - m.cur.sc) * 0.3};
          if (m.chasing) moving = true;
        } else m.cur = {x: p.lx, y: p.ly, sc: p.sc};
      }
      shown.set(m, true);
      placePin(m, it.x, it.y, m.cur.x, m.cur.y, m.cur.sc);
      pillBoxes.push(box(m.cur.x, m.cur.y, labelWidth(m) * m.cur.sc, LABEL_H * m.cur.sc));
    }
    markets.forEach(m => {
      const on = shown.has(m);
      m.pin.classList.toggle('is-on', on);
      m.pin.tabIndex = on ? 0 : -1;
      if (!on) { m.leader.classList.remove('is-on'); m.cur = null; m.chasing = false; }
    });
    placeEdges(off);
    return moving;
  }
  function mergeScreen(a, b) {
    const members = a.members.concat(b.members), s = view.s, tx = W / 2 - view.cx * s, ty = H / 2 - view.cy * s;
    return {members, x: members.reduce((t, m) => t + m.x * s + tx, 0) / members.length, y: members.reduce((t, m) => t + m.y * s + ty, 0) / members.length};
  }
  function placePin(m, sx, sy, lx, ly, sc) {
    m.pin.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0) translate(-50%,-50%) scale(${sc.toFixed(3)})`;
    // The leader ends on the pill's edge; with the pill on its dot there is none.
    const w = labelWidth(m) * sc, h = LABEL_H * sc, dx = sx - lx, dy = sy - ly;
    const k = Math.min(Math.abs(dx) > 1e-6 ? (w / 2) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? (h / 2) / Math.abs(dy) : Infinity, 1);
    const ex = lx + dx * k, ey = ly + dy * k, visible = k < 1 && Math.hypot(sx - ex, sy - ey) > 5;
    m.leader.classList.toggle('is-on', visible);
    if (!visible) return;
    m.line.setAttribute('x1', sx.toFixed(1)); m.line.setAttribute('y1', sy.toFixed(1));
    m.line.setAttribute('x2', ex.toFixed(1)); m.line.setAttribute('y2', ey.toFixed(1));
    m.dot.setAttribute('cx', sx.toFixed(1)); m.dot.setAttribute('cy', sy.toFixed(1));
  }
  // Numbers in the outer band: off-view markets grouped by direction (within ~70°).
  function placeEdges(off) {
    const cx = W / 2, cy = H / 2;
    const list = off.map(o => ({...o, a: Math.atan2(o.sy - cy, o.sx - cx)})).sort((p, q) => p.a - q.a);
    const groupsOut = [];
    if (list.length) {
      // Start after the widest gap so no group wraps around ±180°.
      let start = 0, gapMax = -1;
      for (let i = 0; i < list.length; i++) {
        const next = list[(i + 1) % list.length], gap = (next.a - list[i].a + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
        if (gap > gapMax) { gapMax = gap; start = (i + 1) % list.length; }
      }
      const ordered = list.slice(start).concat(list.slice(0, start));
      let cur = null;
      for (const o of ordered) {
        if (cur && ((o.a - cur.first + 2 * Math.PI) % (2 * Math.PI)) <= 70 * Math.PI / 180) cur.items.push(o);
        else { cur = {first: o.a, items: [o]}; groupsOut.push(cur); }
      }
    }
    const chips = [locateBox()];
    edgeChips.forEach((chip, i) => {
      const g = groupsOut[i];
      if (!g) { chip.classList.remove('is-on'); chip.tabIndex = -1; chip._members = null; chip._n = 0; return; }
      const mx = g.items.reduce((t, o) => t + Math.cos(o.a), 0), my = g.items.reduce((t, o) => t + Math.sin(o.a), 0);
      const ang = Math.atan2(my, mx), ux = Math.cos(ang), uy = Math.sin(ang);
      const n = g.items.length;
      chip._members = g.items.map(o => o.m);
      chip._count.textContent = String(n);
      if (n > chip._n && chip._n > 0) { chip.classList.remove('is-pop'); void chip.offsetWidth; chip.classList.add('is-pop'); }
      chip._n = n;
      const cw = chip.offsetWidth || 32, ch = CLUSTER_H;
      const hx = W / 2 - 8 - cw / 2, hy = H / 2 - 8 - ch / 2;
      const t = Math.min(Math.abs(ux) > 1e-6 ? hx / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? hy / Math.abs(uy) : Infinity);
      let px = cx + ux * t, py = cy + uy * t;
      const alongY = Math.abs(ux) > 1e-6 && hx / Math.abs(ux) <= t + .5;
      for (const sh of [0, 30, -30, 60, -60, 90, -90]) {
        const qx = alongY ? px : clamp(px + sh, 8 + cw / 2, W - 8 - cw / 2), qy = alongY ? clamp(py + sh, 8 + ch / 2, H - 8 - ch / 2) : py;
        const r = box(qx, qy, cw + 12, ch + 12);
        if (!chips.some(c => overlaps(c, r)) || sh === -90) { px = qx; py = qy; chips.push(r); break; }
      }
      // The chevron sits on the side / corner of the direction (8 directions).
      const dir = (Math.round(ang / (Math.PI / 4)) + 8) % 8;
      const dx = Math.round(Math.cos(dir * Math.PI / 4)), dy = Math.round(Math.sin(dir * Math.PI / 4));
      chip._arrow.style.left = `calc(50% + ${dx * (cw / 2 + 5)}px)`;
      chip._arrow.style.top = `calc(50% + ${dy * (ch / 2 + 5)}px)`;
      chip._arrow.style.transform = `rotate(${dir * 45}deg)`;
      chip.setAttribute('aria-label', DIR_JA[dir] + '方向の画面外の夜市 ' + n + '件（' + chip._members.map(m => m.name).join('、') + '）へ移動');
      chip.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) translate(-50%,-50%)`;
      chip.classList.add('is-on'); chip.tabIndex = 0;
      pillBoxes.push(box(px, py, cw, ch));
    });
  }

  // ---- Stations and district names (per zoom, and when a pan comes to rest) ----------
  // Station names within 2.5 km: priority (several systems / 台鉄・高鉄, then transfers
  // and stations of markets on screen, then the rest), nearer the centre first, and a
  // budget of one name per LABEL_AREA. Names sit off the lines.
  function placeTexts(s, tx, ty) {
    const km = kmAcross(s), districtAlpha = clamp((21 - km) / 6, 0, 1);
    const taken = pillBoxes.map(r => shift(r, -tx, -ty)); // scaled world coordinates
    taken.push(shift(locateBox(), -tx, -ty));
    const named = [];
    if (metro) {
      const deep = km <= LOGO_KM;
      const onScreen = new Set(markets.filter(m => m.pin.classList.contains('is-on')).map(m => m.code));
      const prio = st => st.tier === 0 || (st.codes || []).some(c => onScreen.has(String(c.code).toUpperCase())) ? 0 : st.tier;
      const cxw = view.cx * s, cyw = view.cy * s;
      const list = km > C_DOTS_KM ? [] : metro.stations.filter(st => {
        const x = st.x * s - cxw, y = st.y * s - cyw;
        return Math.abs(x) < W / 2 - 16 && Math.abs(y) < H / 2 - 16;
      }).sort((a, b) => (prio(a) - prio(b)) || (Math.hypot(a.x * s - cxw, a.y * s - cyw) - Math.hypot(b.x * s - cxw, b.y * s - cyw)));
      const budget = Math.max(4, Math.round(W * H / LABEL_AREA));
      const keep = new Set();
      for (const st of list) {
        if (keep.size >= budget) break;
        // The marker: several systems → circle (oval across side-by-side lines); otherwise
        // the operator's logo at the closest zoom, a circle at a transfer, else the dot.
        const mode = st.multi ? (st.oval !== undefined ? 'oval' : 'circle') : deep ? 'tile' : st.transfer ? 'circle' : '';
        if (st.mode !== mode) { st.mode = mode; st.mark.className = 'nm-st-mark' + (mode ? ' is-' + mode : ''); st.markOn = false; }
        if (!st.w) { st.w = st.el.offsetWidth || 60; st.h = st.el.offsetHeight || 16; }
        const x = st.x * s, y = st.y * s, w = st.w, h = st.h;
        const mw = mode === 'tile' ? 18 : mode === 'oval' ? 22 : mode === 'circle' ? 12 : 8, gap = mw / 2 + 4;
        const markBox = box(x, y, mw, mw);
        if (taken.some(t => overlaps(t, markBox))) continue;
        const spots = [[0, gap + h / 2], [0, -gap - h / 2], [gap + w / 2, 0], [-gap - w / 2, 0],
          [gap + w / 2 - 3, gap + h / 2 - 3], [-gap - w / 2 + 3, gap + h / 2 - 3], [gap + w / 2 - 3, -gap - h / 2 + 3], [-gap - w / 2 + 3, -gap - h / 2 + 3]];
        let best = null, bestCost = Infinity;
        spots.forEach(([ox, oy], i) => {
          const r = box(x + ox, y + oy, w, h);
          if (taken.some(t => overlaps(t, r)) || named.some(t => overlaps(t, r))) return;
          const cost = lineCrossings({x0: r.x0 / s, x1: r.x1 / s, y0: r.y0 / s, y1: r.y1 / s}) * 10 + i;
          if (cost < bestCost) { bestCost = cost; best = {ox, oy, r}; }
        });
        if (!best) continue;
        named.push(best.r, markBox); keep.add(st);
        st.place = {ox: best.ox, oy: best.oy};
      }
      metro.stations.forEach(st => { if (!keep.has(st)) st.place = null; });
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
  function placeStations(tx, ty) {
    if (!metro) return;
    for (const st of metro.stations) {
      const on = !!st.place;
      if (on) {
        const sx = st.x * view.s + tx, sy = st.y * view.s + ty;
        st.mark.style.transform = `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)` + (st.mode === 'oval' ? ' rotate(var(--nm-oval))' : '');
        st.el.style.transform = `translate3d(${(sx + st.place.ox).toFixed(1)}px,${(sy + st.place.oy).toFixed(1)}px,0) translate(-50%,-50%)`;
      }
      if (on !== st.on) { st.on = on; st.el.classList.toggle('is-on', on); }
      const markOn = on && !!st.mode;
      if (markOn !== st.markOn) { st.markOn = markOn; st.mark.classList.toggle('is-on', markOn); }
    }
  }
  // Zoomed out: one name per city (宜蘭県・新竹県 fainter), at the first free anchor in view.
  function placeCityNames(tx, ty) {
    const alpha = Number(mapEl.style.getPropertyValue('--nm-city-name-alpha')) || 0;
    const used = pillBoxes.slice();
    for (const c of map.cities) {
      let spot = null;
      if (alpha > 0.02) {
        const w = [...c.name].length * CITY_FONT * 1.3 + 8;
        for (const [x, y] of c.anchors) {
          const sx = x * view.s + tx, sy = y * view.s + ty, r = box(sx, sy, w, CITY_FONT + 8);
          if (sx < 50 || sx > W - 50 || sy < 40 || sy > H - 40 || used.some(b => overlaps(b, r))) continue;
          spot = [x, y]; used.push(r); break;
        }
      }
      if (spot) { c.el.setAttribute('x', spot[0]); c.el.setAttribute('y', spot[1]); c.el.style.opacity = ''; }
      else c.el.style.opacity = 0;
    }
  }
  // Within 1.5 km: the two city names along a border in view, one on each side of the
  // line at its angle (never upside down); each pair of cities once, up to three.
  function placeBorderNames(tx, ty) {
    const pool = map.borderPool;
    let used = 0;
    if (kmAcross(view.s) <= BORDER_KM) {
      const rects = textRects.map(r => shift(r, tx, ty)), boxes = pillBoxes.slice(), pairs = new Set();
      const cands = map.borderLabels.map(b => ({b, sx: b.x * view.s + tx, sy: b.y * view.s + ty}))
        .filter(c => c.sx > BAND + 30 && c.sx < W - BAND - 30 && c.sy > BAND + 10 && c.sy < H - BAND - 10)
        .sort((a, b) => Math.hypot(a.sx - W / 2, a.sy - H / 2) - Math.hypot(b.sx - W / 2, b.sy - H / 2));
      const off = BORDER_FONT * 0.95;
      for (const c of cands) {
        if (used + 2 > pool.length) break;
        const key = [c.b.p, c.b.m].sort().join('|');
        if (pairs.has(key)) continue;
        const r = c.b.a * Math.PI / 180, nx = -Math.sin(r), ny = Math.cos(r), cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
        const sides = [[c.b.p, 1], [c.b.m, -1]].filter(([name]) => name).map(([name, sgn]) => {
          const px = c.sx + nx * off * sgn, py = c.sy + ny * off * sgn, w = [...name].length * BORDER_FONT * 1.2, h = BORDER_FONT + 2;
          return {name, sgn, rect: box(px, py, w * cos + h * sin, w * sin + h * cos)};
        });
        if (!sides.length || sides.some(sd => boxes.some(b => overlaps(b, sd.rect)) || rects.some(b => overlaps(b, sd.rect)))) continue;
        pairs.add(key);
        for (const sd of sides) {
          const el = pool[used++], d = off / view.s;
          const x = c.b.x + nx * d * sd.sgn, y = c.b.y + ny * d * sd.sgn;
          el.textContent = sd.name;
          el.setAttribute('x', x.toFixed(1)); el.setAttribute('y', y.toFixed(1));
          el.setAttribute('transform', `rotate(${c.b.a} ${x.toFixed(1)} ${y.toFixed(1)})`);
          el.style.display = '';
          boxes.push(sd.rect);
        }
      }
    }
    for (let i = used; i < pool.length; i++) pool[i].style.display = 'none';
  }
  function placeMe(tx, ty) {
    if (userPos) {
      const ux = userPos[0] * view.s + tx, uy = userPos[1] * view.s + ty;
      me.style.transform = `translate3d(${ux.toFixed(1)}px,${uy.toFixed(1)}px,0)`;
      me.classList.toggle('is-on', ux > -40 && ux < W + 40 && uy > -40 && uy < H + 40);
      locateBtn.classList.toggle('is-here', Math.hypot(ux - W / 2, uy - H / 2) < 12);
    } else { me.classList.remove('is-on'); locateBtn.classList.remove('is-here'); }
    locateBtn.classList.toggle('is-off', located && !userPos);
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
    if (!duration || reduceMotion.matches) { Object.assign(view, to); render(); settle(); if (done) done(); return; }
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
      else { anim = 0; settle(); if (done) done(); }
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
      const together = scale => groupMarkets(scale, true).some(it => it.members.filter(m => ids.has(m.id)).length === ids.size);
      s = Math.max(s, view.s * 1.6);
      while (s < sMax && together(s)) s = Math.min(sMax, s * 1.25);
    }
    const cx = item.members.reduce((t, m) => t + m.x, 0) / item.members.length;
    const cy = item.members.reduce((t, m) => t + m.y, 0) / item.members.length;
    flyTo({cx, cy, s}, 650);
  }
  // ⌖: back to the visitor's position (asks again), or 台北駅 with a note.
  let toastTimer = 0;
  function showToast(text) {
    toast.textContent = text; toast.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  }
  locateBtn.addEventListener('click', e => {
    e.stopPropagation(); interacted = true;
    locateBtn.classList.add('is-busy');
    locate().then(pos => {
      locateBtn.classList.remove('is-busy');
      located = true; userPos = pos;
      const target = pos || project(...FALLBACK);
      if (!pos) showToast('現在地を取得できません');
      flyTo({cx: target[0], cy: target[1], s: Math.max(view.s, sFocus)}, 800);
    });
  });

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
      else if (!pointers.size) { gesture = null; dragEnd = performance.now(); mapEl.classList.remove('is-dragging'); settle(); }
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
    if (e.type !== 'pointerup' || reduceMotion.matches) { settle(); return; }
    const a = g.samples[0], b = g.samples[g.samples.length - 1], dt = b.t - a.t;
    if (dt <= 0 || performance.now() - b.t > 90) { settle(); return; }
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, last = performance.now();
    if (Math.hypot(vx, vy) < 0.2) { settle(); return; }
    const glide = now => {
      const step = Math.min(40, now - last); last = now;
      const cx = view.cx, cy = view.cy;
      view.cx -= vx * step / view.s; view.cy -= vy * step / view.s; clampView();
      if (view.cx === cx) vx = 0;
      if (view.cy === cy) vy = 0;
      render();
      const k = Math.pow(0.94, step / 16); vx *= k; vy *= k;
      inertia = Math.hypot(vx, vy) > 0.015 ? requestAnimationFrame(glide) : 0;
      if (!inertia) settle();
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
    Object.assign(view, t); clampView(); requestRender(); settle();
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
    // Spare height is shared evenly between the groups: info · 特徴 · 名物 · さっそく出発！
    const parts = detailContent(m.data), spaced = [];
    parts.forEach(el => {
      if (el.matches('.nm-feature-label, .nm-go')) spaced.push(node('div', {class: 'nm-gap', 'aria-hidden': 'true'}));
      spaced.push(el);
    });
    body.replaceChildren(node('div', {class: 'nm-glow', 'aria-hidden': 'true'}), ...spaced);
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
      userPos = pos; located = true; lastScale = NaN; requestRender();
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
      userPos = pos; located = true; lastScale = NaN;
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
