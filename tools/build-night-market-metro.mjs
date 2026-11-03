/* Builds data/night-market-metro.js — MRT / light-rail lines and stations for the 夜市マップ.
   Usage (Node 18+, no packages needed):
     1. overpass-turbo.eu → run tools/osm-metro-query.overpassql → Export → "raw OSM data" (JSON)
     2. node build-night-market-metro.mjs <export.json> ../food/mrt_stations.json
        → writes night-market-metro.js here; copy it to data/.
   Track shapes: © OpenStreetMap contributors, ODbL 1.0 (the generated file is under ODbL too).
   Stations: food/mrt_stations.json (names, codes, positions); the 桃園機場捷運 stations,
   which that file does not have, come from the stop order of the OSM route.
   Same projection as data/night-market-map.js (1 unit = 10 m from 25.0°N 121.5°E). */
import fs from 'fs';

const [exportFile = 'export.json', stationsFile = '../food/mrt_stations.json'] = process.argv.slice(2);
const osm = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
const stationsDoc = JSON.parse(fs.readFileSync(stationsFile, 'utf8'));
const LNG0 = 121.5, LAT0 = 25.0, KX = 111320 * Math.cos(LAT0 * Math.PI / 180) / 10, KY = 11095;
const P = (lat, lng) => [(lng - LNG0) * KX, -(lat - LAT0) * KY];

// Line colours follow the guide (food/mrt_stations.json); the airport line is added here.
const LINES = Object.fromEntries(stationsDoc.lines.map(l => [l.id, {name: l.name, color: l.color}]));
LINES.A = {name: '桃園空港MRT', color: '#8246AF'};
const ORDER = ['BR', 'R', 'G', 'O', 'BL', 'Y', 'V', 'K', 'LB', 'A'];
function lineOf(tags) {
  const ref = String(tags.ref || ''), name = String(tags.name || '');
  if (/新北投/.test(ref + name)) return 'R';      // 新北投支線
  if (/小碧潭/.test(name)) return 'G';            // 小碧潭支線
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
function pathOf(lines) {
  let out = '';
  for (let pts of lines) {
    pts = dp(pts, 0.8).map(([x, y]) => [Math.round(x), Math.round(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    if (pts.length < 2) continue;
    out += 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      out += (i === 1 ? 'l' + dx : (dx < 0 ? '' : ' ') + dx) + (dy < 0 ? '' : ' ') + dy;
    }
  }
  return out;
}

// ---- Track shapes: every way of every route relation, once per line ---------
const ways = Object.fromEntries(ORDER.map(id => [id, new Map()]));
let airportStops = null;
for (const rel of osm.elements.filter(e => e.type === 'relation')) {
  const id = lineOf(rel.tags || {});
  if (!id) { console.error('skipped relation', rel.id, rel.tags?.name); continue; }
  for (const m of rel.members) {
    if (m.type !== 'way' || (m.role && m.role !== '') || !m.geometry) continue; // no platforms / inactive track
    if (!ways[id].has(m.ref)) ways[id].set(m.ref, m.geometry.map(g => P(g.lat, g.lon)));
  }
  // The all-stations airport service from 台北車站 to 老街溪 gives the station order.
  if (id === 'A') {
    const stops = rel.members.filter(m => m.type === 'node' && m.role === 'stop');
    if (!airportStops || stops.length > airportStops.length) airportStops = stops;
  }
}

// ---- Stations ---------------------------------------------------------------
const AIRPORT = ['台北車站', '三重', '新北產業園區', '新莊副都心', '泰山', '泰山貴和', '體育大學', '長庚醫院', '林口', '山鼻', '坑口',
  '機場第一航廈', '機場第二航廈', '機場旅館', '大園', '橫山', '領航', '高鐵桃園站', '桃園體育園區', '興南', '環北', '老街溪'];
const raw = stationsDoc.stations.map(s => ({name: s.name, line: s.line, code: s.code, lat: s.lat, lng: s.lng}));
if (airportStops && airportStops.length === AIRPORT.length) {
  if (airportStops[0].lat < airportStops.at(-1).lat) airportStops.reverse(); // 台北車站 first
  airportStops.forEach((m, i) => raw.push({name: AIRPORT[i], line: 'A', code: 'A' + (i + 1), lat: m.lat, lng: m.lon}));
} else console.error('airport stations not added: expected', AIRPORT.length, 'stops, got', airportStops?.length);
// One dot per station: the same name within 600 m is one (transfer) station.
const stations = [];
for (const s of raw) {
  const [x, y] = P(s.lat, s.lng);
  const same = stations.find(t => t.key === s.name && Math.hypot(t.x - x, t.y - y) < 60);
  if (same) { if (!same.lines.includes(s.line)) same.lines.push(s.line); continue; }
  stations.push({key: s.name, x, y, lines: [s.line]});
}
const ja = name => (/(車站|站)$/.test(name) ? name.replace(/(車站|站)$/, '') : name) + '駅';

// ---- Lines without OSM geometry: station-to-station straight segments --------
const lines = ORDER.map(id => {
  let polylines = [...ways[id].values()], approximate = false;
  if (!polylines.length) {
    const seq = raw.filter(s => s.line === id && /^\D+\d+$/.test(s.code))
      .sort((a, b) => parseInt(a.code.replace(/\D/g, ''), 10) - parseInt(b.code.replace(/\D/g, ''), 10));
    if (seq.length > 1) { polylines = [seq.map(s => P(s.lat, s.lng))]; approximate = true; console.error(id, 'has no OSM track: straight segments between stations'); }
  }
  return {id, name: LINES[id]?.name || id, color: LINES[id]?.color || '#8C8C8C', path: pathOf(polylines), ...(approximate ? {approximate: true} : {})};
}).filter(l => l.path);

const out = {schemaVersion: 1, type: 'night-market-metro',
  source: 'Track shapes © OpenStreetMap contributors (ODbL 1.0), overpass export ' + (osm.osm3s?.timestamp_osm_base || '') +
    '; stations: food/mrt_stations.json',
  license: 'ODbL 1.0 — https://opendatacommons.org/licenses/odbl/1-0/',
  lines,
  stations: stations.map(s => ({name: ja(s.key), x: Math.round(s.x), y: Math.round(s.y), lines: s.lines, ...(s.lines.length > 1 ? {transfer: true} : {})}))};
const header = '/* TAIPEI CITY GUIDE — 夜市マップ MRT layer. Generated by tools/build-night-market-metro.mjs, do not edit by hand.\n' +
  '   Track shapes © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0):\n' +
  '   https://www.openstreetmap.org/copyright — this file is a derived database under the same licence.\n' +
  '   Same projection as data/night-market-map.js. Loaded on demand by js/night-markets.js. */\n';
fs.writeFileSync('night-market-metro.js', header + 'window.TABI_NIGHT_MARKET_METRO=' + JSON.stringify(out) + ';\n');
console.error('lines', lines.map(l => l.id + (l.approximate ? '*' : '') + ':' + l.path.length).join(' '),
  '| stations', out.stations.length, 'transfers', out.stations.filter(s => s.transfer).map(s => s.name).join('、'));
