/* Builds data/night-market-metro.js — MRT, light rail, 台鉄 and 高鉄 for the 夜市マップ.
   Usage (Node 18+, no packages needed):
     1. overpass-turbo.eu → tools/osm-metro-query.overpassql → Export → raw OSM data  (MRT routes)
        overpass-turbo.eu → tools/osm-rail-query.overpassql  → Export → raw OSM data  (台鉄・高鉄 tracks)
     2. node build-night-market-metro.mjs <metro.json> <rail.json> ../food/mrt_stations.json ../data/night-market-map.js
        → writes night-market-metro.js here; copy it to data/.
   Track shapes: © OpenStreetMap contributors, ODbL 1.0 (the generated file is under ODbL too).
   Stations: food/mrt_stations.json (names, codes, positions); the 桃園機場捷運 stations come
   from the stop order of the OSM route; 台鉄・高鉄 stations are listed below and snapped
   onto their track. Same projection as data/night-market-map.js. */
import fs from 'fs';

const [metroFile = 'metro.json', railFile = 'rail.json', stationsFile = '../food/mrt_stations.json', mapFile = '../data/night-market-map.js'] = process.argv.slice(2);
const osm = JSON.parse(fs.readFileSync(metroFile, 'utf8'));
const rail = fs.existsSync(railFile) ? JSON.parse(fs.readFileSync(railFile, 'utf8')) : {elements: []};
const stationsDoc = JSON.parse(fs.readFileSync(stationsFile, 'utf8'));
const mapText = fs.readFileSync(mapFile, 'utf8');
const baseMap = JSON.parse(mapText.slice(mapText.indexOf('{'), mapText.lastIndexOf('}') + 1));
const LNG0 = 121.5, LAT0 = 25.0, KX = 111320 * Math.cos(LAT0 * Math.PI / 180) / 10, KY = 11095;
const P = (lat, lng) => [(lng - LNG0) * KX, -(lat - LAT0) * KY];
const regionRings = baseMap.regionRings.map(f => { const r = []; for (let i = 0; i < f.length; i += 2) r.push([f[i], f[i + 1]]); return r; });
function inRegion(x, y) {
  let inside = false;
  for (const ring of regionRings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const [bx0, by0, bx1, by1] = baseMap.bounds, MARGIN = 2500; // keep rail up to ~25 km outside the map

// Colours follow the guide (food/mrt_stations.json); airport line and railways added here.
const LINES = Object.fromEntries(stationsDoc.lines.map(l => [l.id, {name: l.name, color: l.color}]));
LINES.A = {name: '桃園空港MRT', color: '#8246AF'};
LINES.TRA = {name: '台鉄', color: '#9AA3A8'};
LINES.THSR = {name: '高鉄', color: '#E8762C'};
const ORDER = ['TRA', 'THSR', 'BR', 'R', 'G', 'O', 'BL', 'Y', 'V', 'K', 'LB', 'A']; // drawing order: railways below
function lineOf(tags) {
  const ref = String(tags.ref || ''), name = String(tags.name || '');
  if (/新北投/.test(ref + name)) return 'R';
  if (/小碧潭/.test(name)) return 'G';
  if (/板南/.test(name)) return 'BL';
  return ORDER.includes(ref) ? ref : null;
}
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len; if (d > max) { max = d; idx = i; } }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function pathOf(lines, tol = 0.8) {
  let out = '';
  for (let pts of lines) {
    pts = dp(pts, tol).map(([x, y]) => [Math.round(x), Math.round(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    if (pts.length < 2) continue;
    out += 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      out += (i === 1 ? 'l' + dx : (dx < 0 ? '' : ' ') + dx) + (dy < 0 ? '' : ' ') + dy;
    }
  }
  return out;
}
// ---- One line per route: tracks of the two directions (and parallel railway tracks)
// are merged, then joined into chains and smoothed (Chaikin) so curves flow.
const lineLen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
function densify(pl, step) {
  const out = [pl[0]];
  for (let i = 1; i < pl.length; i++) {
    const [ax, ay] = pl[i - 1], [bx, by] = pl[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}
function mergeParallel(polylines, tol) {
  const CELL = 10, grid = new Map();
  const cells = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)];
  const addSeg = seg => {
    const [x0, y0] = cells(Math.min(seg[0], seg[2]) - tol, Math.min(seg[1], seg[3]) - tol), [x1, y1] = cells(Math.max(seg[0], seg[2]) + tol, Math.max(seg[1], seg[3]) + tol);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(seg); }
  };
  const near = (x, y) => {
    const [gx, gy] = cells(x, y);
    for (const seg of grid.get(gx + ',' + gy) || []) {
      const dx = seg[2] - seg[0], dy = seg[3] - seg[1];
      const t = Math.max(0, Math.min(1, ((x - seg[0]) * dx + (y - seg[1]) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(seg[0] + dx * t - x, seg[1] + dy * t - y) < tol) return true;
    }
    return false;
  };
  const kept = [];
  for (const pl of polylines.map(p => densify(p, 3)).sort((a, b) => lineLen(b) - lineLen(a))) {
    const far = pl.map(([x, y]) => !near(x, y));
    let run = null;
    for (let i = 0; i < pl.length; i++) {
      if (far[i]) { if (!run) run = i > 0 ? [pl[i - 1]] : []; run.push(pl[i]); }
      else if (run) { run.push(pl[i]); if (lineLen(run) > 8) kept.push(run); run = null; }
    }
    if (run && lineLen(run) > 8) kept.push(run);
    for (const k of kept.slice(-pl.length)) for (let i = 1; i < k.length; i++) addSeg([k[i - 1][0], k[i - 1][1], k[i][0], k[i][1]]);
  }
  return kept;
}
function chain(polylines) {
  let list = polylines.map(p => p.slice());
  // Join touching ends first, then bridge the small gaps the merge leaves (≤ 250 m).
  for (const limit of [2, 25]) {
    for (let changed = true; changed;) {
      changed = false;
      const grid = new Map(), cell = (x, y) => [Math.floor(x / limit), Math.floor(y / limit)];
      list.forEach((pl, i) => [[pl[0], false], [pl.at(-1), true]].forEach(([e, atEnd]) => {
        const [gx, gy] = cell(e[0], e[1]), k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push([i, atEnd]);
      }));
      const used = new Set(), out = [];
      for (let i = 0; i < list.length; i++) {
        if (used.has(i)) continue;
        used.add(i); let a = list[i];
        for (let side = 0; side < 2; side++) {
          for (let grown = true; grown;) {
            grown = false;
            const e = a.at(-1), [gx, gy] = cell(e[0], e[1]);
            search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const [j, atEnd] of grid.get((gx + dx) + ',' + (gy + dy)) || []) {
              if (used.has(j)) continue;
              const other = list[j], pt = atEnd ? other.at(-1) : other[0];
              if (Math.hypot(pt[0] - e[0], pt[1] - e[1]) >= limit) continue;
              a = a.concat((atEnd ? other.slice().reverse() : other).slice(1)); used.add(j); grown = changed = true; break search;
            }
          }
          a = a.slice().reverse();
        }
        out.push(a);
      }
      list = out;
    }
  }
  // A loose end close to the middle of another chain of the line is tied to it.
  const ties = [];
  for (const pl of list) for (const end of [pl[0], pl.at(-1)]) {
    let best = null;
    for (const other of list) {
      if (other === pl) continue;
      const on = nearestOn([other], end[0], end[1]);
      if (on.d > 0.5 && on.d < 15 && (!best || on.d < best.d)) best = on;
    }
    if (best) ties.push([[end[0], end[1]], [best.x, best.y]]);
  }
  return list.concat(ties);
}
function chaikin(pl, rounds) {
  let pts = pl;
  for (let r = 0; r < rounds; r++) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      out.push([ax * .75 + bx * .25, ay * .75 + by * .25], [ax * .25 + bx * .75, ay * .25 + by * .75]);
    }
    out.push(pts.at(-1));
    pts = out;
  }
  return pts;
}
const smoothLine = (polylines, tol) => chain(mergeParallel(polylines, tol)).map(pl => chaikin(dp(pl, 1.2), 2));
function nearestOn(polylines, x, y) {
  let best = {d: Infinity, x, y};
  for (const pts of polylines) for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px - x, py - y);
    if (d < best.d) best = {d, x: px, y: py};
  }
  return best;
}

// ---- MRT tracks: every way of every route relation, once per line --------------
const tracks = Object.fromEntries(ORDER.map(id => [id, new Map()]));
let airportStops = null;
for (const rel of osm.elements.filter(e => e.type === 'relation')) {
  const id = lineOf(rel.tags || {});
  if (!id) { console.error('skipped relation', rel.id, rel.tags?.name); continue; }
  for (const m of rel.members) {
    if (m.type !== 'way' || (m.role && m.role !== '') || !m.geometry) continue;
    if (!tracks[id].has(m.ref)) tracks[id].set(m.ref, m.geometry.map(g => P(g.lat, g.lon)));
  }
  if (id === 'A') {
    const stops = rel.members.filter(m => m.type === 'node' && m.role === 'stop');
    if (!airportStops || stops.length > airportStops.length) airportStops = stops;
  }
}
// ---- 台鉄・高鉄 tracks (railway=rail ways), near the map only --------------------
const railOutside = {TRA: [], THSR: []};
for (const w of rail.elements.filter(e => e.type === 'way' && e.tags?.railway === 'rail' && e.geometry)) {
  if (w.tags.usage === 'tourism' || w.tags.service) continue;
  const id = (w.tags.highspeed === 'yes' || /高速鐵路/.test(w.tags.name || '')) ? 'THSR' : 'TRA';
  const pts = w.geometry.map(g => P(g.lat, g.lon));
  if (!pts.some(([x, y]) => x > bx0 - MARGIN && x < bx1 + MARGIN && y > by0 - MARGIN && y < by1 + MARGIN)) continue;
  // Split into the parts inside 北北基桃 (drawn as other lines) and outside (faint).
  let run = [pts[0]], inside = inRegion(...pts[0]);
  const flush = () => { if (run.length > 1) (inside ? tracks[id].set(w.id + ':' + tracks[id].size, run) : railOutside[id].push(run)); };
  for (let i = 1; i < pts.length; i++) {
    const now = inRegion(...pts[i]);
    run.push(pts[i]);
    if (now !== inside) { flush(); run = [pts[i]]; inside = now; }
  }
  flush();
}

// ---- Stations -----------------------------------------------------------------------
const AIRPORT = [['A1', '台北車站'], ['A2', '三重'], ['A3', '新北產業園區'], ['A4', '新莊副都心'], ['A5', '泰山'], ['A6', '泰山貴和'],
  ['A7', '體育大學'], ['A8', '長庚醫院'], ['A9', '林口'], ['A10', '山鼻'], ['A11', '坑口'], ['A12', '機場第一航廈'], ['A13', '機場第二航廈'],
  ['A14a', '機場旅館'], ['A15', '大園'], ['A16', '橫山'], ['A17', '領航'], ['A18', '高鐵桃園站'], ['A19', '桃園體育園區'], ['A20', '興南'],
  ['A21', '環北'], ['A22', '老街溪']];
// 台鉄・高鉄 stations on the map (approximate centres; snapped onto the track below).
const RAIL_STATIONS = [
  ['TRA', '台北車站', 25.0478, 121.5170], ['TRA', '萬華', 25.0331, 121.4997], ['TRA', '板橋', 25.0141, 121.4637],
  ['TRA', '樹林', 24.9913, 121.4246], ['TRA', '鶯歌車站', 24.9543, 121.3554], ['TRA', '桃園', 24.9891, 121.3137],
  ['TRA', '中壢', 24.9537, 121.2257], ['TRA', '松山', 25.0493, 121.5779], ['TRA', '南港', 25.0530, 121.6071],
  ['TRA', '汐止', 25.0682, 121.6623], ['TRA', '七堵', 25.0929, 121.7134], ['TRA', '基隆', 25.1319, 121.7389],
  ['TRA', '瑞芳', 25.1088, 121.8060], ['TRA', '十分', 25.0412, 121.7754],
  ['THSR', '南港', 25.0531, 121.6070], ['THSR', '台北車站', 25.0478, 121.5170], ['THSR', '板橋', 25.0141, 121.4637],
  ['THSR', '高鐵桃園站', 25.0129, 121.2150]];
const raw = stationsDoc.stations.map(s => ({name: s.name, line: s.line, code: s.code, lat: s.lat, lng: s.lng}));
if (airportStops && airportStops.length === AIRPORT.length) {
  if (airportStops[0].lat < airportStops.at(-1).lat) airportStops.reverse(); // 台北車站 first
  airportStops.forEach((m, i) => raw.push({name: AIRPORT[i][1], line: 'A', code: AIRPORT[i][0], lat: m.lat, lng: m.lon}));
} else console.error('airport stations not added: expected', AIRPORT.length, 'stops, got', airportStops?.length);
// One dot per station: the same name within 800 m is one (transfer) station; MRT positions win.
const stations = [];
const add = (name, line, code, x, y) => {
  const same = stations.find(t => t.key === name && Math.hypot(t.x - x, t.y - y) < 80);
  if (same) {
    if (!same.lines.includes(line)) same.lines.push(line);
    if (code && !same.codes.some(c => c.code === code)) same.codes.push({code, line});
    return;
  }
  stations.push({key: name, x, y, lines: [line], codes: code ? [{code, line}] : []});
};
raw.forEach(s => add(s.name, s.line, s.code, ...P(s.lat, s.lng)));
for (const [line, name, lat, lng] of RAIL_STATIONS) {
  const [x, y] = P(lat, lng), on = nearestOn([...tracks[line].values()], x, y);
  add(name, line, '', on.d < 40 ? on.x : x, on.d < 40 ? on.y : y);
}
const ja = name => (/(車站|站)$/.test(name) ? name.replace(/(車站|站)$/, '') : name) + '駅';

// ---- Lines ----------------------------------------------------------------------------
const lines = ORDER.map(id => {
  let polylines = [...tracks[id].values()], approximate = false;
  if (!polylines.length) {
    const seq = raw.filter(s => s.line === id && /^\D+\d+$/.test(s.code))
      .sort((a, b) => parseInt(a.code.replace(/\D/g, ''), 10) - parseInt(b.code.replace(/\D/g, ''), 10));
    if (seq.length > 1) { polylines = [seq.map(s => P(s.lat, s.lng))]; approximate = true; console.error(id, 'has no OSM track: straight segments between stations'); }
  }
  // A station drawn a little off its line (e.g. the airport line's 台北 platform west of the
  // shared 台北駅 dot) gets a short connector, so the line visibly reaches the dot.
  const rail = id === 'TRA' || id === 'THSR';
  if (polylines.length && !approximate) polylines = smoothLine(polylines, rail ? 6 : 5);
  if (polylines.length && !approximate) {
    for (const st of stations.filter(s => s.lines.includes(id))) {
      const on = nearestOn(polylines, st.x, st.y);
      if (on.d > 8 && on.d < 60) polylines.push([[on.x, on.y], [st.x, st.y]]);
    }
  }
  return {id, name: LINES[id]?.name || id, color: LINES[id]?.color || '#8C8C8C', path: pathOf(polylines, 0.5),
    ...(rail ? {rail: true, outside: pathOf(mergeParallel(railOutside[id], 8), 3)} : {}), ...(approximate ? {approximate: true} : {})};
}).filter(l => l.path);

const out = {schemaVersion: 2, type: 'night-market-metro',
  source: 'Track shapes © OpenStreetMap contributors (ODbL 1.0), overpass exports ' +
    [osm.osm3s?.timestamp_osm_base, rail.osm3s?.timestamp_osm_base].filter(Boolean).join(' / ') + '; stations: food/mrt_stations.json',
  license: 'ODbL 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
  lines,
  stations: stations.map(s => ({name: ja(s.key), x: Math.round(s.x), y: Math.round(s.y), lines: s.lines, codes: s.codes,
    ...(s.lines.length > 1 ? {transfer: true} : {})}))};
const header = '/* TAIPEI CITY GUIDE — 夜市マップ rail layer (MRT, light rail, 台鉄, 高鉄).\n' +
  '   Generated by tools/build-night-market-metro.mjs, do not edit by hand.\n' +
  '   Track shapes © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0):\n' +
  '   https://www.openstreetmap.org/copyright — this file is a derived database under the same licence.\n' +
  '   Same projection as data/night-market-map.js. Loaded on demand by js/night-markets.js. */\n';
fs.writeFileSync('night-market-metro.js', header + 'window.TABI_NIGHT_MARKET_METRO=' + JSON.stringify(out) + ';\n');
console.error('lines', lines.map(l => l.id + (l.approximate ? '*' : '') + ':' + l.path.length + (l.outside ? '+' + l.outside.length : '')).join(' '),
  '| stations', out.stations.length, '| transfers', out.stations.filter(s => s.transfer).map(s => s.name + '[' + s.lines.join('/') + ']').join(' '));
