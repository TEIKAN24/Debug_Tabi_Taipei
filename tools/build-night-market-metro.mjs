/* Builds data/night-market-metro.js — MRT, light rail, 台鉄 and 高鉄 for the 夜市マップ.
   Usage (Node 18+, no packages needed):
     1. overpass-turbo.eu → tools/osm-metro-query.overpassql → Export → raw OSM data  (MRT routes)
        overpass-turbo.eu → tools/osm-rail-query.overpassql  → Export → raw OSM data  (台鉄・高鉄 tracks)
     2. node build-night-market-metro.mjs <metro.json> <rail.json> ../food/mrt_stations.json ../data/night-market-map.js
        → writes night-market-metro.js here; copy it to data/.
   Lines keep the exact OSM track positions but are drawn once: one direction per
   route (its ways stitched in route order), branches added where they leave the
   line, the other direction and parallel railway tracks dropped. No smoothing.
   Track shapes © OpenStreetMap contributors, ODbL 1.0 (the generated file is too).
   Stations: food/mrt_stations.json; 桃園機場捷運 stations from the OSM stop order;
   台鉄・高鉄 stations listed below, snapped onto their track. */
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
const [bx0, by0, bx1, by1] = baseMap.bounds, MARGIN = 2500;

const LINES = Object.fromEntries(stationsDoc.lines.map(l => [l.id, {name: l.name, color: l.color}]));
LINES.A = {name: '桃園空港MRT', color: '#8246AF'};
LINES.TRA = {name: '台鉄', color: '#9AA3A8'};
LINES.THSR = {name: '高鉄', color: '#E8762C'};
const ORDER = ['TRA', 'THSR', 'BR', 'R', 'G', 'O', 'BL', 'Y', 'V', 'K', 'LB', 'A']; // drawing order: railways below
const OPERATOR = {BR: 'trtc', R: 'trtc', G: 'trtc', O: 'trtc', BL: 'trtc', Y: 'ntmc', V: 'ntmc', K: 'ntmc', LB: 'ntmc', A: 'tymc', TRA: 'tra', THSR: 'thsr'};
function lineOf(tags) {
  const ref = String(tags.ref || ''), name = String(tags.name || '');
  if (/新北投/.test(ref + name)) return 'R';
  if (/小碧潭/.test(name)) return 'G';
  if (/板南|南港-板橋-土城/.test(name)) return 'BL';
  return ORDER.includes(ref) ? ref : null;
}

// ---- geometry helpers -----------------------------------------------------------
const lineLen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
const same = (a, b, tol = 1) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
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
function pathOf(lines, tol) {
  let out = '';
  for (let pts of lines) {
    pts = dp(pts, tol).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])
      .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    if (pts.length < 2) continue;
    out += 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.round((pts[i][0] - pts[i - 1][0]) * 10) / 10, dy = Math.round((pts[i][1] - pts[i - 1][1]) * 10) / 10;
      out += (i === 1 ? 'l' + dx : (dx < 0 ? '' : ' ') + dx) + (dy < 0 ? '' : ' ') + dy;
    }
  }
  return out;
}
function nearestOn(polylines, x, y) {
  let best = {d: Infinity, x, y, a: 0};
  for (const pts of polylines) for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px - x, py - y);
    if (d < best.d) best = {d, x: px, y: py, a: Math.atan2(dy, dx) * 180 / Math.PI};
  }
  return best;
}
// Ways → continuous polylines: in the given order, each way turned to continue the last one.
function stitch(wayList) {
  const out = []; let cur = null;
  for (const w of wayList) {
    let pts = w;
    if (cur) {
      const end = cur.at(-1);
      if (same(end, pts[0], 2)) { cur.push(...pts.slice(1)); continue; }
      if (same(end, pts.at(-1), 2)) { cur.push(...pts.slice().reverse().slice(1)); continue; }
      if (cur.length === pts.length && false) continue;
      // first way may have been reversed
      if (out.length === 0 && cur.length && same(cur[0], pts[0], 2)) { cur.reverse(); cur.push(...pts.slice(1)); continue; }
      if (out.length === 0 && cur.length && same(cur[0], pts.at(-1), 2)) { cur.reverse(); cur.push(...pts.slice().reverse().slice(1)); continue; }
      out.push(cur);
    }
    cur = pts.slice();
  }
  if (cur) out.push(cur);
  return out;
}
// Join polylines whose ends touch (for railway ways, which come without route order).
function chainUnordered(polylines) {
  let list = polylines.map(p => p.slice());
  for (let changed = true; changed;) {
    changed = false;
    const grid = new Map(), key = p => Math.round(p[0] / 2) + ',' + Math.round(p[1] / 2);
    list.forEach((pl, i) => [[pl[0], false], [pl.at(-1), true]].forEach(([e, atEnd]) => { const k = key(e); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([i, atEnd]); }));
    const used = new Set(), out = [];
    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue;
      used.add(i); let a = list[i];
      for (let side = 0; side < 2; side++) {
        for (let grown = true; grown;) {
          grown = false;
          const hits = (grid.get(key(a.at(-1))) || []).filter(([j]) => !used.has(j));
          if (hits.length === 1) { // only where the track simply continues (not at a junction)
            const [j, atEnd] = hits[0], other = list[j];
            a = a.concat((atEnd ? other.slice().reverse() : other).slice(1)); used.add(j); grown = changed = true;
          }
        }
        a = a.slice().reverse();
      }
      out.push(a);
    }
    list = out;
  }
  return list;
}
// Keep the first (longest) polylines whole; of each next one keep only the parts more
// than `tol` away from what is kept, joined exactly onto the kept line (branches).
function addDistinct(kept, polylines, tol, minLen) {
  for (const pl of polylines.slice().sort((a, b) => lineLen(b) - lineLen(a))) {
    const pts = []; // densify so long straight segments are checked along their length
    for (let i = 0; i < pl.length; i++) {
      if (i) { const [ax, ay] = pl[i - 1], [bx, by] = pl[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4); for (let k = 1; k < n; k++) pts.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n, false]); }
      pts.push([pl[i][0], pl[i][1], true]);
    }
    const near = pts.map(([x, y]) => kept.length && nearestOn(kept, x, y).d < tol);
    let run = null;
    const finish = () => {
      if (!run) return;
      const clean = run.filter((p, i) => p[2] || i === 0 || i === run.length - 1).map(p => [p[0], p[1]]);
      // Tie the ends exactly onto the kept line (short spurs are pruned at the end,
      // once every piece is in, so a piece bridging to a later one is not lost).
      for (const at of [0, clean.length - 1]) {
        const on = kept.length ? nearestOn(kept, clean[at][0], clean[at][1]) : {d: Infinity};
        if (on.d < tol * 1.5) { if (at === 0) clean.unshift([on.x, on.y]); else clean.push([on.x, on.y]); }
      }
      if (clean.length > 1) kept.push(clean);
      run = null;
    };
    for (let i = 0; i < pts.length; i++) {
      if (!near[i]) { if (!run) run = i > 0 ? [pts[i - 1]] : []; run.push(pts[i]); }
      else if (run) { run.push(pts[i]); finish(); }
    }
    finish();
  }
  return pruneSpurs(kept, tol, minLen);
}
// Drop short pieces with a loose end (sidings, platform tracks), repeatedly; pieces
// joined at both ends stay, whatever their length.
function pruneSpurs(list, tol, minLen) {
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      const pl = list[i];
      if (lineLen(pl) >= minLen) continue;
      const others = list.filter((_, j) => j !== i);
      const loose = [pl[0], pl.at(-1)].some(e => !others.length || nearestOn(others, e[0], e[1]).d > tol * 1.5);
      if (loose) { list.splice(i, 1); changed = true; break; }
    }
  }
  return list;
}

// 台鉄・高鉄 come as loose ways (no routes): every way is drawn whole, exactly where it is,
// except a way that runs alongside an already kept one over its whole length (the second
// track of a double track) — so nothing is cut and nothing breaks.
function dropTwinTracks(ways, tol) {
  const CELL = 8, grid = new Map(), kept = [];
  const add = pl => { for (let i = 1; i < pl.length; i++) {
    const seg = [pl[i - 1][0], pl[i - 1][1], pl[i][0], pl[i][1]];
    for (let gx = Math.floor((Math.min(seg[0], seg[2]) - tol) / CELL); gx <= Math.floor((Math.max(seg[0], seg[2]) + tol) / CELL); gx++)
      for (let gy = Math.floor((Math.min(seg[1], seg[3]) - tol) / CELL); gy <= Math.floor((Math.max(seg[1], seg[3]) + tol) / CELL); gy++) {
        const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(seg);
      }
  } };
  const near = (x, y) => (grid.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)) || []).some(seg => {
    const dx = seg[2] - seg[0], dy = seg[3] - seg[1], t = Math.max(0, Math.min(1, ((x - seg[0]) * dx + (y - seg[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(seg[0] + dx * t - x, seg[1] + dy * t - y) < tol;
  });
  for (const pl of ways.slice().sort((a, b) => lineLen(b) - lineLen(a))) {
    const pts = []; // every ~3 units along the way
    for (let i = 0; i < pl.length; i++) {
      if (i) { const [ax, ay] = pl[i - 1], [bx, by] = pl[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3); for (let k = 1; k < n; k++) pts.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); }
      pts.push(pl[i]);
    }
    if (kept.length && pts.every(([x, y]) => near(x, y))) continue;
    kept.push(pl); add(pl);
  }
  return kept;
}

// ---- MRT: one route per variant, stitched in order ------------------------------
const routes = Object.fromEntries(ORDER.map(id => [id, []]));
let airportStops = null;
for (const rel of osm.elements.filter(e => e.type === 'relation').sort((a, b) => a.id - b.id)) {
  const id = lineOf(rel.tags || {});
  if (!id) { console.error('skipped relation', rel.id, rel.tags?.name); continue; }
  const ways = rel.members.filter(m => m.type === 'way' && (!m.role || m.role === '') && m.geometry).map(m => m.geometry.map(g => P(g.lat, g.lon)));
  const stops = rel.members.filter(m => m.type === 'node' && /^stop/.test(m.role || ''));
  if (ways.length) routes[id].push({id: rel.id, polylines: stitch(ways), stops});
  if (id === 'A') {
    const s = rel.members.filter(m => m.type === 'node' && m.role === 'stop');
    if (!airportStops || s.length > airportStops.length) airportStops = s;
  }
}
const tracks = {};
for (const id of ORDER) {
  if (!routes[id].length) continue;
  // Longest route first; the rest only add what they do not share (branches).
  const sorted = routes[id].sort((a, b) => b.polylines.reduce((t, p) => t + lineLen(p), 0) - a.polylines.reduce((t, p) => t + lineLen(p), 0));
  const kept = [];
  for (const r of sorted) addDistinct(kept, r.polylines, 6, 25);
  tracks[id] = kept;
}
// ---- 台鉄・高鉄: tracks near the map, parallel tracks dropped --------------------------
const railWays = {TRA: [], THSR: []};
for (const w of rail.elements.filter(e => e.type === 'way' && e.tags?.railway === 'rail' && e.geometry)) {
  if (w.tags.usage === 'tourism' || w.tags.service) continue;
  const id = (w.tags.highspeed === 'yes' || /高速鐵路/.test(w.tags.name || '')) ? 'THSR' : 'TRA';
  const pts = w.geometry.map(g => P(g.lat, g.lon));
  if (pts.some(([x, y]) => x > bx0 - MARGIN && x < bx1 + MARGIN && y > by0 - MARGIN && y < by1 + MARGIN)) railWays[id].push(pts);
}
const railOutside = {};
for (const id of ['TRA', 'THSR']) {
  const single = dropTwinTracks(railWays[id], 4);
  const inside = [], outside = [];
  for (const pl of single) { // split at the edge of 北北基桃: outside drawn faint
    let run = [pl[0]], inn = inRegion(...pl[0]);
    for (let i = 1; i < pl.length; i++) {
      const now = inRegion(...pl[i]); run.push(pl[i]);
      if (now !== inn) { (inn ? inside : outside).push(run); run = [pl[i]]; inn = now; }
    }
    if (run.length > 1) (inn ? inside : outside).push(run);
  }
  tracks[id] = inside; railOutside[id] = outside;
}

// ---- Stations ---------------------------------------------------------------------------
const AIRPORT = [['A1', '台北車站'], ['A2', '三重'], ['A3', '新北產業園區'], ['A4', '新莊副都心'], ['A5', '泰山'], ['A6', '泰山貴和'],
  ['A7', '體育大學'], ['A8', '長庚醫院'], ['A9', '林口'], ['A10', '山鼻'], ['A11', '坑口'], ['A12', '機場第一航廈'], ['A13', '機場第二航廈'],
  ['A14a', '機場旅館'], ['A15', '大園'], ['A16', '橫山'], ['A17', '領航'], ['A18', '高鐵桃園站'], ['A19', '桃園體育園區'], ['A20', '興南'],
  ['A21', '環北'], ['A22', '老街溪']];
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
  if (airportStops[0].lat < airportStops.at(-1).lat) airportStops.reverse();
  airportStops.forEach((m, i) => raw.push({name: AIRPORT[i][1], line: 'A', code: AIRPORT[i][0], lat: m.lat, lng: m.lon}));
} else console.error('airport stations not added: expected', AIRPORT.length, 'stops, got', airportStops?.length);
const stations = [];
const add = (name, line, code, x, y) => {
  const hit = stations.find(t => t.key === name && Math.hypot(t.x - x, t.y - y) < 80);
  if (hit) {
    if (!hit.lines.includes(line)) hit.lines.push(line);
    if (code && !hit.codes.some(c => c.code === code)) hit.codes.push({code, line});
    return;
  }
  stations.push({key: name, x, y, lines: [line], codes: code ? [{code, line}] : []});
};
raw.forEach(s => add(s.name, s.line, s.code, ...P(s.lat, s.lng)));
for (const [line, name, lat, lng] of RAIL_STATIONS) {
  const [x, y] = P(lat, lng), on = nearestOn(tracks[line] || [], x, y);
  add(name, line, '', on.d < 40 ? on.x : x, on.d < 40 ? on.y : y);
}
const ja = name => (/(車站|站)$/.test(name) ? name.replace(/(車站|站)$/, '') : name) + '駅';

// ---- Lines ------------------------------------------------------------------------------
const geometry = {};
const lines = ORDER.map(id => {
  let polylines = tracks[id] || [], approximate = false;
  if (!polylines.length) {
    const seq = raw.filter(s => s.line === id && /^\D+\d+$/.test(s.code))
      .sort((a, b) => parseInt(a.code.replace(/\D/g, ''), 10) - parseInt(b.code.replace(/\D/g, ''), 10));
    if (seq.length > 1) { polylines = [seq.map(s => P(s.lat, s.lng))]; approximate = true; console.error(id, 'has no OSM track: straight segments'); }
  }
  // A station drawn a little off its line (e.g. the airport line's 台北 platform west of
  // the shared 台北駅 dot) gets a short connector, so the line reaches the dot.
  if (polylines.length && !approximate && id !== 'TRA' && id !== 'THSR') for (const st of stations.filter(s => s.lines.includes(id))) {
    const on = nearestOn(polylines, st.x, st.y);
    if (on.d > 8 && on.d < 60) polylines = polylines.concat([[[on.x, on.y], [st.x, st.y]]]);
  }
  const isRail = id === 'TRA' || id === 'THSR';
  geometry[id] = polylines;
  return {id, name: LINES[id]?.name || id, color: LINES[id]?.color || '#8C8C8C', path: pathOf(polylines, 0.5),
    ...(isRail ? {rail: true, outside: pathOf(railOutside[id] || [], 3)} : {}), ...(approximate ? {approximate: true} : {})};
}).filter(l => l.path);

// Station shapes. Where the lines of a station do not meet in one point (台鉄・高鉄 next
// to the MRT at 台北, 板橋, 南港; 鶯歌 …) the marker is an oval laid across them: its centre
// halfway between the outermost lines, its length (span, map units) reaching both,
// its angle the direction of the lines there. Otherwise a circle.
function shape(st) {
  if (st.lines.length < 2) return {};
  const ref = st.lines.find(l => l === 'TRA' || l === 'THSR') || st.lines[0];
  const along = nearestOn(geometry[ref] || [], st.x, st.y);
  const a = (along.a * Math.PI) / 180, nx = -Math.sin(a), ny = Math.cos(a);
  const offsets = st.lines.map(l => { const on = nearestOn(geometry[l] || [], st.x, st.y); return on.d < 60 ? (on.x - st.x) * nx + (on.y - st.y) * ny : 0; });
  const lo = Math.min(0, ...offsets), hi = Math.max(0, ...offsets), span = hi - lo;
  const oval = span > 4 || (st.lines.length >= 3 && st.lines.some(l => l === 'TRA' || l === 'THSR'));
  if (!oval) return {};
  let deg = along.a; if (deg > 90) deg -= 180; if (deg <= -90) deg += 180;
  const mid = (lo + hi) / 2;
  return {x: st.x + nx * mid, y: st.y + ny * mid, oval: Math.round(deg), span: Math.round(span * 10) / 10};
}
const out = {schemaVersion: 3, type: 'night-market-metro',
  source: 'Track shapes © OpenStreetMap contributors (ODbL 1.0), overpass exports ' +
    [osm.osm3s?.timestamp_osm_base, rail.osm3s?.timestamp_osm_base].filter(Boolean).join(' / ') + '; stations: food/mrt_stations.json',
  license: 'ODbL 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
  lines,
  stations: stations.map(s => {
    const ops = [...new Set(s.lines.map(l => OPERATOR[l]).filter(Boolean))], sh = shape(s);
    return {name: ja(s.key), x: Math.round(sh.x ?? s.x), y: Math.round(sh.y ?? s.y), lines: s.lines, ops, codes: s.codes,
      ...(s.lines.length > 1 ? {transfer: true} : {}), ...(sh.oval !== undefined ? {oval: sh.oval, span: sh.span} : {})};
  })};
const header = '/* TAIPEI CITY GUIDE — 夜市マップ rail layer (MRT, light rail, 台鉄, 高鉄).\n' +
  '   Generated by tools/build-night-market-metro.mjs, do not edit by hand.\n' +
  '   Track shapes © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0):\n' +
  '   https://www.openstreetmap.org/copyright — this file is a derived database under the same licence.\n' +
  '   Same projection as data/night-market-map.js. Loaded on demand by js/night-markets.js. */\n';
fs.writeFileSync('night-market-metro.js', header + 'window.TABI_NIGHT_MARKET_METRO=' + JSON.stringify(out) + ';\n');
console.error('lines', lines.map(l => l.id + (l.approximate ? '*' : '') + ':' + l.path.length).join(' '),
  '| stations', out.stations.length, '| ovals', out.stations.filter(s => s.oval !== undefined).map(s => s.name + '@' + s.oval + '/' + s.span).join(' '));
