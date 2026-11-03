/* Builds data/night-market-map.js (北北基桃 district map for the 夜市マップ).
   Usage: npm install taiwan-atlas topojson-client polylabel && node build-night-market-map.mjs
   Writes night-market-map.js next to this script; copy it to data/. */
import fs from 'fs';
import {mesh, feature, merge} from 'topojson-client';
import polylabel from 'polylabel';
const topo = JSON.parse(fs.readFileSync('node_modules/taiwan-atlas/towns-10t.json','utf8'));
const SET = new Set(['A','F','C','H']);
const geoms = topo.objects.towns.geometries;
const inSet = g => SET.has(g.properties.COUNTYID);
// Local equirectangular projection, metres; 1 world unit = 10 m.
const LNG0 = 121.5, LAT0 = 25.0, KX = 111320*Math.cos(LAT0*Math.PI/180), KY = 110950, UNIT = 10;
const P = ([lng,lat]) => [(lng-LNG0)*KX/UNIT, -(lat-LAT0)*KY/UNIT];
function dp(pts, tol){ // Douglas–Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0]=keep[pts.length-1]=1;
  const stack=[[0,pts.length-1]];
  while(stack.length){const [a,b]=stack.pop();let max=0,idx=-1;const [ax,ay]=pts[a],[bx,by]=pts[b];const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;
    for(let i=a+1;i<b;i++){const d=Math.abs(dy*pts[i][0]-dx*pts[i][1]+bx*ay-by*ax)/len;if(d>max){max=d;idx=i;}}
    if(max>tol){keep[idx]=1;stack.push([a,idx],[idx,b]);}}
  return pts.filter((_,i)=>keep[i]);
}
function dpRing(pts,tol){ // closed ring: split at the farthest vertex so DP has a real baseline
  let far=0,best=-1;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1]);if(d>best){best=d;far=i;}}
  return dp(pts.slice(0,far+1),tol).concat(dp(pts.slice(far),tol).slice(1));
}
function lineLen(p){let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return s;}
function toPath(lines, tol, minLen){
  let out='', n=0;
  for (const raw of lines){
    let pts = raw.map(P);
    const closed = Math.hypot(pts[0][0]-pts.at(-1)[0], pts[0][1]-pts.at(-1)[1])<0.5;
    if (closed && lineLen(pts) < minLen) continue; // tiny islets/rocks
    pts = (closed?dpRing(pts,tol):dp(pts, tol)).map(([x,y])=>[Math.round(x),Math.round(y)]);
    pts = pts.filter((p,i)=>i===0||p[0]!==pts[i-1][0]||p[1]!==pts[i-1][1]);
    if (pts.length<2) continue;
    out += 'M'+pts[0][0]+' '+pts[0][1]; n+=pts.length;
    let cmd='';
    for(let i=1;i<pts.length;i++){const dx=pts[i][0]-pts[i-1][0],dy=pts[i][1]-pts[i-1][1];
      out+= i===1?('l'+dx+(dy<0?'':' ')+dy):((dx<0?'':' ')+dx+(dy<0?'':' ')+dy);}
  }
  return {d:out,n};
}
const county = g => g.properties.COUNTYID;
const cityMesh = mesh(topo, topo.objects.towns, (a,b)=> a===b ? inSet(a) : ((inSet(a)||inSet(b)) && county(a)!==county(b)));
const distMesh = mesh(topo, topo.objects.towns, (a,b)=> a!==b && inSet(a) && inSet(b) && county(a)===county(b));
const TOL=1.6, MIN=60; // 16 m tolerance; drop islets under 600 m perimeter
const city = toPath(cityMesh.coordinates, TOL, MIN), dist = toPath(distMesh.coordinates, TOL, MIN);
console.error('points city',city.n,'district',dist.n,'bytes',city.d.length+dist.d.length);
// Japanese shinjitai names
const JA = s => s.replace(/區/g,'区').replace(/臺/g,'台').replace(/萬/g,'万').replace(/內/g,'内').replace(/雙/g,'双').replace(/溪/g,'渓').replace(/峽/g,'峡').replace(/莊/g,'荘').replace(/蘆/g,'芦').replace(/樂/g,'楽').replace(/德/g,'徳').replace(/來/g,'来').replace(/觀/g,'観').replace(/龜/g,'亀');
function polyArea(ring){let a=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)a+=(ring[j][0]+ring[i][0])*(ring[j][1]-ring[i][1]);return Math.abs(a/2);}
function label(geo){ // pole of inaccessibility of the largest polygon, projected
  const polys = geo.type==='Polygon'?[geo.coordinates]:geo.coordinates;
  let best=null,ba=-1;for(const p of polys){const pr=p.map(r=>r.map(P));const a=polyArea(pr[0]);if(a>ba){ba=a;best=pr;}}
  const [x,y]=polylabel(best,0.5);let total=0;for(const p of polys)total+=polyArea(p[0].map(P));
  return {x:Math.round(x),y:Math.round(y),area:Math.round(total*UNIT*UNIT/1e6*10)/10};
}
const COUNTY_JA={A:'台北市',F:'新北市',C:'基隆市',H:'桃園市'};
const districts = geoms.filter(inSet).map(g=>{const f=feature(topo,g);const l=label(f.geometry);
  return {name:JA(g.properties.TOWNNAME),city:g.properties.COUNTYID,x:l.x,y:l.y,area:l.area};}).sort((a,b)=>b.area-a.area);
// City names are shown when zoomed out. Several anchors for the large cities so a
// name is in view wherever the overview lands (hand-picked, inside each city).
const ANCHORS={A:[[25.112,121.598]],F:[[25.040,121.432],[25.238,121.598],[25.050,121.705],[24.930,121.520]],C:[[25.118,121.715]],H:[[24.960,121.215],[25.020,121.335]]};
const cities = Object.entries(ANCHORS).flatMap(([id,pts])=>pts.map(([lat,lng])=>{const [x,y]=P([lng,lat]);return {id,name:COUNTY_JA[id],x:Math.round(x),y:Math.round(y)};}));
// Coarse outline of the four cities (~60 m tolerance) for "is the visitor inside the map?".
const region = merge(topo, geoms.filter(inSet));
const regionRings = (region.type==='Polygon'?[region.coordinates]:region.coordinates)
  .map(poly=>dpRing(poly[0].map(P),6).map(([x,y])=>[Math.round(x),Math.round(y)]))
  .filter(r=>r.length>3 && polyArea(r)>2500);
// bbox
let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
for(const ln of cityMesh.coordinates)for(const c of ln){const [x,y]=P(c);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
const out={schemaVersion:1,type:'night-market-map',
  source:'内政部 鄉鎮市區界線(TWD97經緯度) via taiwan-atlas 2021.9.20 (政府資料開放授權條款第1版)',
  projection:{lng0:LNG0,lat0:LAT0,kx:+(KX/UNIT).toFixed(3),ky:KY/UNIT,unitMeters:UNIT},
  bounds:[Math.floor(minX),Math.floor(minY),Math.ceil(maxX),Math.ceil(maxY)],
  cityPath:city.d, districtPath:dist.d, cities, districts, regionRings:regionRings.map(r=>r.flat())};
fs.writeFileSync('map.json', JSON.stringify(out));
const header='/* TAIPEI CITY GUIDE — 夜市マップ base map (北北基桃). Generated, do not edit by hand.\n'+
 '   Boundaries: 内政部「鄉鎮市區界線(TWD97經緯度)」 via taiwan-atlas 2021.9.20, 政府資料開放授權條款第1版.\n'+
 '   Coordinates: local equirectangular projection, 1 unit = 10 m, x east / y south of 25.0°N 121.5°E\n'+
 '   (x = (lng − lng0)·kx, y = −(lat − lat0)·ky). Loaded on demand by js/night-markets.js. */\n';
fs.writeFileSync('night-market-map.js', header+'window.TABI_NIGHT_MARKET_MAP='+JSON.stringify(out)+';\n');
console.error('bounds',out.bounds, 'json bytes', JSON.stringify(out).length);
console.error(cities);
