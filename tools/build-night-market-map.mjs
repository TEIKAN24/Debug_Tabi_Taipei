/* Builds data/night-market-map.js — the 北北基桃 base map of the 夜市マップ.
   Usage (Node 18+):
     npm install taiwan-atlas topojson-client polylabel
     node build-night-market-map.mjs        → writes night-market-map.js here; copy it to data/.
   Source: 内政部「鄉鎮市區界線(TWD97經緯度)」 via taiwan-atlas (政府資料開放授權條款第1版).
   Output, in a local equirectangular projection (1 unit = 10 m, x east / y south of 25.0°N 121.5°E):
     cityPath      city borders + coast of 台北・新北・基隆・桃園
     districtPath  district borders inside those four cities
     neighborPaths county borders of the rest of Taiwan near the map, in 3 bands
                   by distance (drawn fainter the farther they are)
     districts     district names (Japanese shinjitai) at their pole of inaccessibility
     cities        city names with candidate anchors inside each city (zoomed out)
     borderLabels  points along the city borders (also with 新竹県・宜蘭県): position on the
                   line, angle of the line (never upside down) and the city on each side;
                   the page writes the two names along the line, one on each side
     regionRings   coarse outline of the four cities (is the visitor on the map?) */
import fs from 'fs';
import {mesh, feature, merge} from 'topojson-client';
import polylabel from 'polylabel';

const topo = JSON.parse(fs.readFileSync('node_modules/taiwan-atlas/towns-10t.json', 'utf8'));
const SET = new Set(['A', 'F', 'C', 'H']);
const COUNTY_JA = {A: '台北市', F: '新北市', C: '基隆市', H: '桃園市'};
const geoms = topo.objects.towns.geometries;
const county = g => g.properties.COUNTYID;
const inSet = g => SET.has(county(g));
const LNG0 = 121.5, LAT0 = 25.0, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 110950, UNIT = 10;
const P = ([lng, lat]) => [(lng - LNG0) * KX / UNIT, -(lat - LAT0) * KY / UNIT];

function dp(pts, tol) { // Douglas–Peucker
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
function dpRing(pts, tol) { // closed ring: split at the farthest vertex so DP has a baseline
  let far = 0, best = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > best) { best = d; far = i; } }
  return dp(pts.slice(0, far + 1), tol).concat(dp(pts.slice(far), tol).slice(1));
}
const lineLen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
function pathOf(lines, tol, minClosed) { // projected polylines → compact relative SVG path
  let out = '', n = 0;
  for (let pts of lines) {
    if (pts.length < 2) continue;
    const closed = Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 0.5;
    if (closed && lineLen(pts) < minClosed) continue; // islets and rocks
    pts = (closed ? dpRing(pts, tol) : dp(pts, tol)).map(([x, y]) => [Math.round(x), Math.round(y)]);
    pts = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (pts.length < 2) continue;
    out += 'M' + pts[0][0] + ' ' + pts[0][1]; n += pts.length;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      out += (i === 1 ? 'l' + dx : (dx < 0 ? '' : ' ') + dx) + (dy < 0 ? '' : ' ') + dy;
    }
  }
  return {d: out, n};
}
const polyArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
function inRings(x, y, rings) {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
const ringsOf = geo => (geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates).flatMap(poly => poly.map(r => r.map(P)));

// ---- Lines of the four cities ---------------------------------------------
const cityMesh = mesh(topo, topo.objects.towns, (a, b) => a === b ? inSet(a) : ((inSet(a) || inSet(b)) && county(a) !== county(b)));
const distMesh = mesh(topo, topo.objects.towns, (a, b) => a !== b && inSet(a) && inSet(b) && county(a) === county(b));
const city = pathOf(cityMesh.coordinates.map(l => l.map(P)), 1.6, 60);
const dist = pathOf(distMesh.coordinates.map(l => l.map(P)), 1.6, 60);
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const ln of cityMesh.coordinates) for (const c of ln) { const [x, y] = P(c); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
const bounds = [Math.floor(minX), Math.floor(minY), Math.ceil(maxX), Math.ceil(maxY)];

// ---- Region outline -------------------------------------------------------
const region = merge(topo, geoms.filter(inSet));
const regionRings = (region.type === 'Polygon' ? [region.coordinates] : region.coordinates)
  .map(poly => dpRing(poly[0].map(P), 6).map(([x, y]) => [Math.round(x), Math.round(y)]))
  .filter(r => r.length > 3 && polyArea(r) > 2500);
function distToRegion(x, y) {
  if (inRings(x, y, regionRings)) return 0;
  let best = Infinity;
  for (const r of regionRings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, ay] = r[j], [bx, by] = r[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

// ---- The rest of Taiwan nearby: county borders in distance bands ----------
const BANDS = [800, 1800, 3500];  // ≤ 8 km, ≤ 18 km, ≤ 35 km from the four cities
const restMesh = mesh(topo, topo.objects.towns, (a, b) => a === b ? !inSet(a) : (!inSet(a) && !inSet(b) && county(a) !== county(b)));
const banded = BANDS.map(() => []);
for (const raw of restMesh.coordinates) {
  const pts = raw.map(P);
  let run = null, runBand = -1;
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i][0] + pts[i - 1][0]) / 2, my = (pts[i][1] + pts[i - 1][1]) / 2;
    const d = distToRegion(mx, my), band = BANDS.findIndex(b => d <= b);
    if (band !== runBand || !run) { if (run && runBand >= 0) banded[runBand].push(run); run = [pts[i - 1]]; runBand = band; }
    run.push(pts[i]);
  }
  if (run && runBand >= 0) banded[runBand].push(run);
}
const neighborPaths = banded.map(lines => pathOf(lines, 4, 300).d);

// ---- Names ------------------------------------------------------------------
const JA = s => s.replace(/區/g, '区').replace(/臺/g, '台').replace(/萬/g, '万').replace(/內/g, '内').replace(/雙/g, '双')
  .replace(/溪/g, '渓').replace(/峽/g, '峡').replace(/莊/g, '荘').replace(/蘆/g, '芦').replace(/樂/g, '楽').replace(/德/g, '徳')
  .replace(/來/g, '来').replace(/觀/g, '観').replace(/龜/g, '亀');
function label(geo) { // pole of inaccessibility of the largest polygon
  const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
  let best = null, ba = -1;
  for (const p of polys) { const pr = p.map(r => r.map(P)); const a = polyArea(pr[0]); if (a > ba) { ba = a; best = pr; } }
  const [x, y] = polylabel(best, 0.5);
  let total = 0; for (const p of polys) total += polyArea(p[0].map(P));
  return {x: Math.round(x), y: Math.round(y), area: Math.round(total * UNIT * UNIT / 1e6 * 10) / 10};
}
const districts = geoms.filter(inSet).map(g => {
  const l = label(feature(topo, g).geometry);
  return {name: JA(g.properties.TOWNNAME), city: county(g), x: l.x, y: l.y, area: l.area};
}).sort((a, b) => b.area - a.area);
const NEIGHBOUR_JA = {J: '新竹県', G: '宜蘭県'};
const countyRings = Object.fromEntries([...SET, ...Object.keys(NEIGHBOUR_JA)].map(id => [id, ringsOf(merge(topo, geoms.filter(g => county(g) === id)))]));

// City names when zoomed out: candidate anchors, first = preferred; anchors outside
// their county are dropped (logged). 宜蘭県・新竹県 are neighbours, drawn fainter.
const ANCHORS = {
  A: [[25.128, 121.538], [25.088, 121.592], [24.995, 121.575], [25.040, 121.560]],
  F: [[25.040, 121.432], [25.238, 121.598], [25.050, 121.705], [24.930, 121.520], [25.170, 121.450]],
  C: [[25.118, 121.715], [25.140, 121.745]],
  H: [[24.960, 121.215], [25.020, 121.335]],
  G: [[24.870, 121.810], [24.900, 121.860], [24.820, 121.700], [24.960, 121.900]],
  J: [[24.800, 121.170], [24.860, 121.050], [24.760, 121.250]]
};
const cities = Object.entries(ANCHORS).map(([id, list]) => {
  const anchors = list.map(([lat, lng]) => P([lng, lat]).map(Math.round)).filter(([x, y], i) => {
    const ok = inRings(x, y, countyRings[id]); if (!ok) console.error('anchor', i, 'of', id, 'is outside its county: dropped'); return ok;
  });
  return {id, name: COUNTY_JA[id] || NEIGHBOUR_JA[id], anchors, ...(SET.has(id) ? {} : {neighbor: true})};
}).filter(c => c.anchors.length);

// Points along the city borders, every ~2.5 km: on the line, with the line's angle
// (kept between −90° and 90° so the text is never upside down) and the city on each
// side: p on the side of the normal (−sin a, cos a), m on the other.
const NAME = id => COUNTY_JA[id] || NEIGHBOUR_JA[id] || null;
const borderMesh = mesh(topo, topo.objects.towns, (a, b) => a !== b && county(a) !== county(b) && (inSet(a) || inSet(b)));
const borderLabels = [];
for (const raw of borderMesh.coordinates) {
  const pts = raw.map(P);
  let carry = 125;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], seg = Math.hypot(bx - ax, by - ay);
    if (!seg) continue;
    let t = carry;
    while (t <= seg) {
      const x = ax + (bx - ax) * t / seg, y = ay + (by - ay) * t / seg;
      // Direction over ~±300 m of the line, so a wiggle does not tilt the name.
      let k = i - 1, m = i;
      while (k > 0 && Math.hypot(pts[k][0] - x, pts[k][1] - y) < 30) k--;
      while (m < pts.length - 1 && Math.hypot(pts[m][0] - x, pts[m][1] - y) < 30) m++;
      let a = Math.atan2(pts[m][1] - pts[k][1], pts[m][0] - pts[k][0]) * 180 / Math.PI;
      if (a > 90) a -= 180; if (a <= -90) a += 180;
      const r = a * Math.PI / 180, nx = -Math.sin(r), ny = Math.cos(r);
      const side = sgn => Object.keys(countyRings).find(c => inRings(x + nx * 40 * sgn, y + ny * 40 * sgn, countyRings[c]));
      const p = NAME(side(1)), q = NAME(side(-1));
      if ((p || q) && p !== q && (SET.has(side(1)) || SET.has(side(-1))))
        borderLabels.push({x: Math.round(x), y: Math.round(y), a: Math.round(a), p, m: q});
      t += 250;
    }
    carry = t - seg;
  }
}

const out = {schemaVersion: 2, type: 'night-market-map',
  source: '内政部 鄉鎮市區界線(TWD97經緯度) via taiwan-atlas 2021.9.20 (政府資料開放授權條款第1版)',
  projection: {lng0: LNG0, lat0: LAT0, kx: +(KX / UNIT).toFixed(3), ky: KY / UNIT, unitMeters: UNIT},
  bounds, cityPath: city.d, districtPath: dist.d, neighborPaths, cities, districts, borderLabels,
  regionRings: regionRings.map(r => r.flat())};
const header = '/* TAIPEI CITY GUIDE — 夜市マップ base map (北北基桃). Generated by tools/build-night-market-map.mjs, do not edit by hand.\n' +
  '   Boundaries: 内政部「鄉鎮市區界線(TWD97經緯度)」 via taiwan-atlas 2021.9.20, 政府資料開放授權條款第1版.\n' +
  '   Coordinates: local equirectangular projection, 1 unit = 10 m, x east / y south of 25.0°N 121.5°E\n' +
  '   (x = (lng − lng0)·kx, y = −(lat − lat0)·ky). Loaded on demand by js/night-markets.js. */\n';
fs.writeFileSync('night-market-map.js', header + 'window.TABI_NIGHT_MARKET_MAP=' + JSON.stringify(out) + ';\n');
console.error('points: city', city.n, 'district', dist.n, '| neighbour bands', neighborPaths.map(p => p.length),
  '| border labels', borderLabels.length, '| bytes', JSON.stringify(out).length);
