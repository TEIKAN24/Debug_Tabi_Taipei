/* TAIPEI CITY GUIDE v30.9.96 — same-page location/station switching with custom readable line and station menus.
   v30.9.85: includes curated nearby venues for the existing GPS option.
   v30.9.82: rotating editorial pick, soft variety, distance bands (less fixed picks).
   v30.9.83: venues.json — coordinates for the 6 bars.
   v30.9.81: match every listed map link; night-market stalls use their market;
   bars and 熱炒 are recommended again. */
(() => {
  'use strict';
  const VERSION='30.9.102';
  const drawer = document.getElementById('taipei-recommender');
  if(!drawer)return;
  const backdrop=document.querySelector('.recommend-drawer-backdrop');
  const results=document.getElementById('recommend-results');
  const count=document.getElementById('recommend-count');
  const relaxed=document.getElementById('recommend-relaxed');
  const disclaimer=document.getElementById('recommend-disclaimer');
  const more=document.getElementById('recommend-more');
  const sortRecommend=document.getElementById('recommend-sort-recommended');
  const sortDistance=document.getElementById('recommend-sort-distance');
  const timeButton=document.getElementById('recommend-time-trigger');
  const timeLabel=document.getElementById('recommend-time-label');
  const timeCaption=document.getElementById('recommend-time-caption');
  const timeOptions=document.getElementById('recommend-time-options');
  const areaButton=document.getElementById('recommend-area-trigger');
  const areaLabel=document.getElementById('recommend-area-label');
  const locationStatus=document.getElementById('recommend-location-status');
  const stationControls=document.getElementById('recommend-station-controls');
  const currentLocation=document.getElementById('recommend-current-location');
  const mainPicker=document.getElementById('recommend-main-picker');
  const districtName=document.getElementById('recommend-district-name');
  const districtEn=document.getElementById('recommend-district-en');
  const title=document.getElementById('recommend-home-trigger');
  const lineTrigger=document.getElementById('recommend-line-trigger');
  const lineMenu=document.getElementById('recommend-line-menu');
  const lineField=document.getElementById('recommend-line-field');
  const lineLabel=document.getElementById('recommend-line-label');
  const lineEn=document.getElementById('recommend-line-en');
  const lineCode=document.getElementById('recommend-line-code');
  const stationTrigger=document.getElementById('recommend-station-trigger');
  const stationMenu=document.getElementById('recommend-station-menu');
  const stationField=document.getElementById('recommend-station-field');
  const stationLabel=document.getElementById('recommend-station-label');
  const stationEn=document.getElementById('recommend-station-en');
  const stationCode=document.getElementById('recommend-station-code');
  const moods=document.getElementById('recommend-mood-options');
  const volumes=document.getElementById('recommend-volume-options');
  const activeFilters=document.getElementById('recommend-active-filters');
  const secondaryControls=document.getElementById('recommend-controls-secondary');
  const advanced=document.getElementById('recommend-advanced');
  const advancedTrigger=advanced.querySelector('summary');
  const body=document.body;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const TIME=[['current','現在時刻'],['morning','朝'],['lunch','昼'],['afternoon','午後'],['night','夜'],['late','深夜']];
  const GENRES=[['rice','🍚 ごはん系'],['noodle','🍜 麺類'],['dumpling','🥟 小籠包・点心'],['sweet','🍧 スイーツ'],['drink','🧋 ドリンク'],['cafe','☕️ カフェ']];
  const VOLUMES=[['light','🥟 軽く'],['hearty','🍜 がっつり']];
  const AREAS=[
    ['nakayama','中山駅・赤峰街',25.0529,121.5204],
    ['dihua','迪化街・大稻埕',25.0560,121.5102],
    ['dongmen','東門駅・永康街',25.0338,121.5286],
    ['xinyi','信義・台北101',25.0337,121.5645],
    ['taipei','台北駅',25.0478,121.5170],
    ['ximen','西門駅・西門町',25.0420,121.5081],
    ['gongguan','公館駅',25.0143,121.5342],
    ['east','東区・忠孝復興',25.0416,121.5432]
  ];
  // Recognizable Taiwanese chains present in this guide. A convenience bonus
  // is NOT a claim that a branch is near the selected station.
  const CHAIN_NAMES=/50嵐|迷客夏|八方雲集|鼎泰豊|鼎泰豐|可不可|茶湯會|清心福全|大苑子|鮮茶道|COMEBUY|CoCo都可|路易莎|LOUISA|85度C|貢茶|春水堂|一芳|珍煮丹|すき家|壽司郎|すしろー|マクドナルド|星巴克|スターバックス|ミスタードーナツ|摩斯漢堡|MOS BURGER/i;
  // Deduplicate storefronts of the same recognized chain in nearby mode.
  // A chain appears only once, represented by its closest VERIFIED branch.
  const CHAIN_BRANDS=[
    ['50嵐',/50嵐/i],['迷客夏',/迷客夏/i],['八方雲集',/八方雲集/i],
    ['鼎泰豐',/鼎泰豊|鼎泰豐/i],['可不可',/可不可/i],['茶湯會',/茶湯會/i],
    ['清心福全',/清心福全/i],['大苑子',/大苑子/i],['鮮茶道',/鮮茶道/i],
    ['COMEBUY',/COMEBUY/i],['CoCo都可',/CoCo都可/i],
    ['路易莎',/路易莎|LOUISA/i],['85度C',/85度C/i],['貢茶',/貢茶/i],
    ['春水堂',/春水堂/i],['一芳',/一芳/i],['珍煮丹',/珍煮丹/i],
    ['すき家',/すき家/i],['壽司郎',/壽司郎|すしろー/i],
    ['マクドナルド',/マクドナルド/i],['星巴克',/星巴克|スターバックス/i],
    ['ミスタードーナツ',/ミスタードーナツ/i],['摩斯漢堡',/摩斯漢堡|MOS BURGER/i]
  ];
  function nearbyBrandKey(item){
    if(item.brandId)return `brand:${item.brandId}`;
    const brand=CHAIN_BRANDS.find(([,pattern])=>pattern.test(item.name));
    return brand?`brand:${brand[0]}`:`venue:${normalize(item.name)}`;
  }
  function closestPerBrand(items){
    const best=new Map();
    for(const item of items){
      const key=nearbyBrandKey(item),old=best.get(key);
      if(!old||item.distanceMeters<old.distanceMeters)best.set(key,item);
    }
    // A guide coordinate and an award-imported coordinate may use different
    // brand keys even for the identical storefront. Deduplicate display names
    // once more before ranking, keeping the nearest known storefront.
    const unique=new Map();
    for(const item of best.values()){
      const key=normalizeNoteName(item.name),previous=unique.get(key);
      if(!previous||item.distanceMeters<previous.distanceMeters)unique.set(key,item);
    }
    return [...unique.values()];
  }
  const AREA_MATCH=[['nakayama',/赤峰|中山駅/],['dihua',/迪化|大稻埕/],['dongmen',/永康|東門/],['xinyi',/信義/],['taipei',/台北駅/],['ximen',/西門/],['gongguan',/公館/],['east',/東区/]];
  function taipeiNow(){return new Date();}
  function taipeiTimeLabel(){return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(taipeiNow());}
  function taipeiHour(){return Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).formatToParts(taipeiNow()).find(p=>p.type==='hour')?.value??12);}
  // Taipei time bands: 朝 05–10:59, 昼 11–13:59, 午後 14–16:59, 夜 17–22:59, 深夜 23–04:59.
  function defaultBand(){const h=taipeiHour();return h>=5&&h<11?'morning':h>=11&&h<14?'lunch':h>=14&&h<17?'afternoon':h>=17&&h<23?'night':'late';}
  const state={timeMode:'current',time:defaultBand(),areaMode:'current',area:'',line:'',stationCode:'',genre:'',volume:'',sortMode:'recommend',page:0,locationStatus:'idle',geoRequested:false,position:null};
  // Static station coordinates are used on-device: no geolocation permission,
  // API key, third-party request or location upload in station mode.
  let metroLines=[],metroStations=[],stationsReady=false,stationsFailed=false;
  const LINE_EN={BR:'Wenhu Line',R:'Tamsui-Xinyi Line',G:'Songshan-Xindian Line',O:'Zhonghe-Xinlu Line',BL:'Bannan Line',Y:'Circular Line'};
  const DISTRICTS={
    '中正區':['中正区','Zhongzheng Dist.'],'大安區':['大安区','Da’an Dist.'],'中山區':['中山区','Zhongshan Dist.'],
    '大同區':['大同区','Datong Dist.'],'萬華區':['万華区','Wanhua Dist.'],'松山區':['松山区','Songshan Dist.'],
    '信義區':['信義区','Xinyi Dist.'],'士林區':['士林区','Shilin Dist.'],'北投區':['北投区','Beitou Dist.'],
    '文山區':['文山区','Wenshan Dist.'],'內湖區':['内湖区','Neihu Dist.'],'南港區':['南港区','Nangang Dist.']
  };
  // District is an estimate from nearby address-verified reference venues.
  // No coordinates leave the device. If no reliable reference is close, show
  // the location as unconfirmed instead of inventing an administrative district.
  function nearbyDistrict(point){
    if(!point||!nearbyReady)return null;
    const candidates=nearbyVenues.filter(v=>DISTRICTS[v.district]&&v.addressVerified!==false)
      .map(v=>({district:v.district,distance:distanceMeters(point.lat,point.lng,v.lat,v.lng)}))
      .filter(x=>x.distance<=350).sort((a,b)=>a.distance-b.distance).slice(0,7);
    if(!candidates.length||candidates[0].distance>240)return null;
    const scores=new Map();
    for(const x of candidates)scores.set(x.district,(scores.get(x.district)||0)+1/Math.max(60,x.distance));
    const best=[...scores.entries()].sort((a,b)=>b[1]-a[1])[0];
    return best?DISTRICTS[best[0]]:null;
  }
  function currentStation(){return metroStations.find(x=>x.code===state.stationCode&&x.line===state.line)||null;}
  function stationOrigin(){const x=currentStation();return x?{lat:x.lat,lng:x.lng}:null;}
  async function loadMetroStations(){
    try{
      const response=await fetch(`food/mrt_stations.json?v=${VERSION}`,{cache:'no-store'});
      if(!response.ok)throw new Error('station file unavailable');
      const data=await response.json();
      if(data.schemaVersion!==1||!Array.isArray(data.lines)||!Array.isArray(data.stations))throw new Error('station file invalid');
      metroLines=data.lines.filter(x=>/^(BR|R|G|O|BL|Y)$/.test(x.id)&&typeof x.name==='string');
      metroStations=data.stations.filter(x=>metroLines.some(line=>line.id===x.line)&&
        typeof x.code==='string'&&typeof x.name==='string'&&
        Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&x.lat>24.8&&x.lat<25.3&&x.lng>121.3&&x.lng<121.8);
      stationsReady=metroLines.length===6&&metroStations.length>=130;
      if(!stationsReady)throw new Error('station list incomplete');
      stationsFailed=false;
    }catch(_){stationsFailed=true;metroLines=[];metroStations=[];}
    buildMetroLineOptions();renderStationOptions();syncUI();renderResults();
  }
  const GEO_MAX_METERS=1200;
  const GEO_PRIORITY_METERS=800; // Straight-line radius for GPS and selected-station recommendations.
  let coordinates=new Map(),markets=new Map(),coordinatesReady=false,coordinatesFailed=false;
  let nearbyVenues=[],nearbyReady=false,nearbyCatalog=null;
  // v30.9.95 — editorial descriptions: provenance lives in a separate static
  // file, and absent evidence never becomes a fabricated customer review.
  let reviewedNotes=new Map();
  async function loadReviewedNotes(){
    try{
      const response=await fetch(`food/recommend_notes.json?v=${VERSION}`,{cache:'no-store'});
      if(!response.ok)throw new Error('notes unavailable');
      const data=await response.json();
      if(data.schemaVersion!==1||!Array.isArray(data.notes))throw new Error('notes invalid');
      reviewedNotes=new Map(data.notes.filter(row=>row&&typeof row.name==='string'&&typeof row.text==='string'&&row.text.trim())
        .map(row=>[normalizeNoteName(row.name),row.text.trim()]));
    }catch(_){reviewedNotes=new Map();}
    renderResults();
  }
  function normalizeNoteName(name){return String(name||'').normalize('NFKC').toLowerCase().replace(/[\s　・·．.（）()「」『』]/g,'').replace(/魯/g,'滷').replace(/豊/g,'豐');}
  function guideEditorialNote(item){
    // Exact storefront name only. Fuzzy/brand-wide matches risk attributing a
    // different branch's review to the selected one.
    const match=readCatalog().find(x=>normalizeNoteName(x.name)===normalizeNoteName(item.name)&&x.guideNote);
    return match?.guideNote||'';
  }

  // Static same-origin JSON; no key, request to mapping APIs, or GPS upload.
  async function loadCoordinates(){
    try{
      const reply=await fetch(`food/venues.json?v=${VERSION}`,{cache:'no-store'});
      if(!reply.ok)throw new Error('venue file unavailable');
      const data=await reply.json();
      if(data.schemaVersion!==1||!data.venues||typeof data.venues!=='object')throw new Error('venue file invalid');
      const clean=new Map();
      for(const [name,entry] of Object.entries(data.venues)){
        if(!entry)continue;
        const valid=point=>point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&point.lat>=24.7&&point.lat<=25.4&&point.lng>=121.2&&point.lng<=122&&/^https:\/\//.test(point.mapUrl||'');
        if(Array.isArray(entry.branches)){const branches=entry.branches.filter(valid);if(branches.length)clean.set(name,{...entry,branches});}
        else if(valid(entry))clean.set(name,entry);
      }
      // Night markets: one reference point per market for stalls without their
      // own verified point. Entries with null coordinates are simply skipped.
      const marketPoints=new Map();
      for(const [name,point] of Object.entries(data.nightMarkets||{})){
        if(point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&point.lat>=24.7&&point.lat<=25.4&&point.lng>=121.2&&point.lng<=122)
          marketPoints.set(name,{lat:point.lat,lng:point.lng});
      }
      coordinates=clean;markets=marketPoints;coordinatesReady=true;catalog=null;nearbyCatalog=null;
    }catch(_){coordinatesFailed=true;}
    // Updating metadata never requests location or stores the user's coordinates.
    if(state.areaMode==='current'||state.areaMode==='station'){syncUI();renderResults();}
  }
  const FEATURED=/おすすめ|ミシュラン|ビブグルマン|孤独のグルメ|超行列|行列店|一番人気|高人気|人気店|人気老舗/;
  const MICHELIN_FLOWER_SVG='<svg viewBox="0 0 18.96 20.63" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="#594f41" d="M12.82 4.38c.1.09.72-.4.89-.48 1.77-.91 3.68-.55 4.72 1.2 1.32 2.23.01 4.29-2.13 5.22.49.32 1.06.55 1.51.92 2.9 2.4-.11 7.49-4.1 5.5l-.88-.55c.44 2.54-1.04 4.61-3.74 4.43-2.28-.16-3.37-2.34-2.99-4.43-.04-.04-.88.52-1.01.58-3.84 1.89-6.9-3.04-3.8-5.63.4-.34.88-.55 1.33-.81C.78 9.41-.51 8.02.19 5.82c.86-2.68 3.88-3.04 5.91-1.37-.98-5.85 7.64-6 6.73-.07ZM11.19 7.99l-.57-.32c.94-1.68 2.25-5.63-.34-6.46-.63-.2-1.17-.19-1.79.06-2.39.97-1.07 4.74-.18 6.4l-.57.32c-1-1.63-3.58-4.68-5.66-3.02-.95.76-1.33 2.19-.55 3.21 1.06 1.38 3.47 1.69 5.1 1.81v.58c-1.58.19-4.61.59-5.33 2.25-.47 1.06.07 2.46 1.07 3.01 2.1 1.15 4.34-1.62 5.37-3.15l.59.19c-.66 1.48-1.55 3.52-1.06 5.15.59 1.94 3.56 2.09 4.32.21.67-1.64-.28-3.85-.97-5.36l.59-.19c.99 1.48 3.11 4.06 5.14 3.29.76-.29 1.42-1.24 1.5-2.04.29-2.59-3.67-3.18-5.53-3.36v-.58c2.24.02 7.14-1.27 5.08-4.45-1.82-2.8-5.17.62-6.2 2.45Z"/></svg>';
  // v30.9.85: separate award-sourced venue index, included only in distance-based GPS/station mode.
  // No geolocation is sent to a server; all distance checks run locally.
  async function loadNearbyVenues(){
    try{
      const response=await fetch(`food/nearby.json?v=${VERSION}`,{cache:'no-store'});
      if(!response.ok)throw new Error('nearby dataset unavailable');
      const data=await response.json();
      if(data.schemaVersion!==1||!Array.isArray(data.venues))throw new Error('nearby schema invalid');
      nearbyVenues=data.venues.filter(r=>r&&typeof r.name==='string'&&
        Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&
        r.lat>24.95&&r.lat<25.25&&r.lng>121.35&&r.lng<121.72&&
        /^https:\/\/www\.google\.com\/maps\/|^https:\/\/maps\.app\.goo\.gl\//.test(r.mapUrl||''));
      nearbyCatalog=null;nearbyReady=true;
    }catch(e){nearbyReady=false;nearbyVenues=[];}
    if(state.areaMode==='current'||state.areaMode==='station'){syncUI();renderResults();}
  }
  function readNearbyCatalog(){
    if(nearbyCatalog)return nearbyCatalog;
    // Match nearby records to the human-curated food directory. An exact
    // name can be reused at a different branch, so coordinate conflicts are
    // checked rather than blindly transplanting a shop's labels.
    const guideByName=new Map();
    const guideByMap=new Map();
    const foodPicks=readCatalog().filter(item=>item.guidePick);
    for(const pick of foodPicks){
      const key=normalizeNoteName(pick.name);
      if(!guideByName.has(key))guideByName.set(key,[]);
      guideByName.get(key).push(pick);
      for(const url of pick.sourceMapUrls||[])guideByMap.set(url,pick);
    }
    nearbyCatalog=nearbyVenues.map((r,index)=>{
      const candidates=guideByName.get(normalizeNoteName(r.name))||[];
      let guidePick=guideByMap.get(r.mapUrl)||null;
      if(!guidePick&&candidates.length===1){
        const match=candidates[0];
        const points=match.branches||((Number.isFinite(match.lat)&&Number.isFinite(match.lng))?[match]:[]);
        // Unknown guide coordinates: exact unique name is sufficient.
        // Known coordinates: do not attach tags to an unrelated branch.
        if(!points.length||points.some(p=>distanceMeters(p.lat,p.lng,r.lat,r.lng)<=250))guidePick=match;
      }
      // Nearby aliases may contain an extra branch/designator; only match
      // when the guide venue actually has a verified nearby coordinate.
      if(!guidePick){
        const rn=normalizeNoteName(r.name);
        const aliases=foodPicks.filter(p=>{
          const pn=normalizeNoteName(p.name);
          if(Math.min(pn.length,rn.length)<5||!(pn.includes(rn)||rn.includes(pn)))return false;
          const points=p.branches||((Number.isFinite(p.lat)&&Number.isFinite(p.lng))?[p]:[]);
          return points.some(q=>distanceMeters(q.lat,q.lng,r.lat,r.lng)<=100);
        });
        if(aliases.length===1)guidePick=aliases[0];
      }
      const row={name:r.name,url:r.mapUrl,sourceMapUrls:[r.mapUrl],
        guidePick:!!guidePick,guideTags:guidePick?.guideTags||[],
        category:r.category||'meal',details:r.specialty||'',
        curated:0,featured:false,chain:CHAIN_NAMES.test(r.name),
        area:'',order:10000+index,lat:r.lat,lng:r.lng,
        brandId:null,nearbySource:true,locationConfidence:r.locationConfidence,
        address:r.address||'',district:r.district||'',hours:r.time||'',
        awards:r.awards||{},specialty:r.specialty||'',
        displayType:r.displayType||'グルメ'};
      const inferred=inferVenueTags(row);
      // Award-winning desserts at a regular restaurant do not turn that
      // restaurant into a dedicated sweets venue.
      if(row.category!=='sweet'&&row.category!=='cafe')inferred.genre=inferred.genre.filter(g=>g!=='sweet');
      if(row.category==='meal'){inferred.volume=['hearty'];}
      return {...row,...inferred,displayType:r.displayType||inferred.displayType};
    });
    return nearbyCatalog;
  }
  const normalize=t=>String(t||'').replace(/\s+/g,'').toLowerCase();
  const categoryOf=(tab,group)=>{
    if(/朝ごはん/.test(tab))return 'breakfast';
    if(/夜市/.test(tab))return 'nightmarket';
    if(/小籠包|餃子/.test(tab))return 'dumpling';
    if(/お米|ルーローハン/.test(tab))return 'rice';
    if(/麺類/.test(tab))return 'noodle';
    if(/火鍋/.test(tab))return 'hotpot';
    if(/居酒屋/.test(tab))return 'izakaya';
    if(/バー/.test(group))return 'bar';
    if(/スイーツ|デザート/.test(group))return 'sweet';
    if(/タピオカ|ティースタンド|ジュース|お茶専門/.test(group))return 'drink';
    if(/カフェ|喫茶/.test(group))return 'cafe';
    // The area directory's broad 「グルメ」 category is not a portion size
    // and must never automatically become a rice/hearty meal.
    return 'other';
  };
  const panelLabel=panel=>document.getElementById(panel?.getAttribute('aria-labelledby')||'')?.textContent.trim()||'';
  let catalog=null;
  function readCatalog(){
    if(catalog)return catalog;
    const foodRoot=document.querySelector('#guide details.venue-directory-section:not(.area-directory-section)');
    const areaRoot=document.querySelector('#guide details.area-directory-section');
    const found=new Map();
    function read(root,isArea){
      if(!root)return;
      root.querySelectorAll('li.venue-list-item, li.venue-row').forEach(li=>{
        // Match the actual published guide markup. The legacy class names
        // venue-row/venue-main-link were never present on the static HTML.
        const a=li.querySelector('a.venue-main-link[href], a[href^="https://maps.app.goo.gl/"], a[href^="https://www.google.com/maps/"]');
        if(!a||!/^https:\/\/(?:maps\.app\.goo\.gl|www\.google\.com\/maps)/.test(a.href))return;
        const tab=panelLabel(li.closest('.tab-panel'));
        const group=li.closest('details.nested-accordion')?.querySelector(':scope > summary')?.textContent.trim()||'';
        if(isArea&&!/グルメ|カフェ|スイーツ/.test(group))return;
        const name=a.textContent.trim();if(!name)return;
        const tagNodes=[...li.querySelectorAll('.venue-tag')];
        const tags=tagNodes.map(n=>n.textContent.trim()).filter(Boolean);
        const notes=li.querySelector('.venue-extra-note')?.textContent.trim()||'';
        // The published guide stores the user's editorial text as a bare text
        // node directly after the map link, e.g. <a>店名</a>（冷麺、ローカル）.
        // It has no .venue-tag or .venue-extra-note nodes. Reading only those
        // classes silently dropped almost every user-authored note.
        const inlineNote=[...li.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE)
          .map(n=>n.textContent.trim()).join(' ').trim();
        const guideNote=[inlineNote,notes].filter(Boolean).join('、').trim();
        // Reuse the labels from the author's original 食べる・飲む directory.
        // On the published page guide.js creates .venue-tag elements; the
        // fallback also works if this module is tested without guide.js.
        const rawGuideTags=tags.length?tags:
          (inlineNote.match(/^[（(]([^）)]*)[）)]$/)?.[1]||'')
            .split(/[、，,]/).map(t=>t.trim()).filter(t=>t&&t.length<=22&&!/[。！？]/.test(t));
        const extraGuideTags=(li.dataset.curatedTags||'').split('、').map(t=>t.trim()).filter(Boolean);
        const editorialTags=[];
        if(!isArea){
          for(const text of [...rawGuideTags,...extraGuideTags]){
            if(editorialTags.some(t=>t.text===text))continue;
            const node=tagNodes.find(n=>n.textContent.trim()===text);
            const tone=node?.classList.contains('venue-tag--caution')||/八角なし|注意|臭い|⚠/.test(text)?'caution':
              node?.classList.contains('venue-tag--featured')||/おすすめ|ミシュラン|孤独のグルメ|超行列|一番人気|高人気|ビブグルマン|人気店|行列店|水出し珈琲/.test(text)?'featured':'normal';
            editorialTags.push({text,tone});
          }
        }
        const info=[...tags,guideNote].filter(Boolean).join('、');
        const key=normalize(name);
        const area=isArea?(AREA_MATCH.find(([code,rx])=>rx.test(tab))?.[0]||''):'';
        const category=isArea?categoryOf('',group):categoryOf(tab,group);
        // Editorial pick = a store-level label in the guide. Plain 「人気」 and dish
        // highlights (芝麻湯圓, 水出し珈琲 …) describe dishes, not the shop.
        const featured=FEATURED.test(info);
        // guide.js rewrites map links to Google Maps search URLs on touch devices.
        // Match coordinates against the original per-place URL, not the mobile navigation URL.
        // A venue listed twice keeps every link it is listed with.
        const sourceMapUrl=a.dataset.originalMapsUrl || a.href;
        // Night-market stalls are grouped under 「〇〇夜市おすすめ…」.
        const market=category==='nightmarket'?(group.match(/^(.+?夜市)/)?.[1]||''):'';
        const record={name,url:a.href,sourceMapUrls:[sourceMapUrl],market,area,category,details:info,guideNote,
          guidePick:!isArea,guideTags:editorialTags,featured,chain:CHAIN_NAMES.test(name),order:found.size};
        const existing=found.get(key);
        if(!existing){found.set(key,record);return;}
        if(isArea){existing.area=area;existing.url=a.href;}
        if(!existing.sourceMapUrls.includes(sourceMapUrl))existing.sourceMapUrls.push(sourceMapUrl);
        existing.featured||=featured;
        existing.guidePick||=record.guidePick;
        if(!existing.guideTags?.length&&record.guideTags?.length)existing.guideTags=record.guideTags;
        existing.chain||=record.chain;
        existing.details=[...new Set([existing.details,info].filter(Boolean))].join('、').slice(0,135);
        if(!existing.guideNote&&guideNote)existing.guideNote=guideNote;
      });
    }
    read(foodRoot,false);read(areaRoot,true);
    // Venue metadata is independent of the legacy navigation category.
    // Uncertain tags are left absent rather than fabricated from 「グルメ」.
    catalog=[...found.values()].map(item=>{
      const stored=coordinates.get(item.name);
      // Check the original place link; mobile links may be rewritten for navigation.
      // Keep verification strict so an unrelated branch's coordinates never attach.
      const listed=item.sourceMapUrls;
      const location=stored&&(listed.includes(stored.mapUrl)||listed.includes(stored.searchUrl))?(stored.branches?{branches:stored.branches,brandId:stored.brandId||null}:{lat:stored.lat,lng:stored.lng,brandId:stored.brandId||null}):{};
      // A stall without its own verified point is placed at its market.
      const marketPoint=item.market&&!location.branches&&!Number.isFinite(location.lat)?markets.get(item.market)||null:null;
      return Object.assign(item,inferVenueTags(item),location,{marketPoint});
    });
    return catalog;
  }
  function eligibleTime(item,time){
    const c=item.category,s=item.details;
    if(time==='morning')return c==='breakfast'||(c==='cafe'&&!/夜カフェ/.test(s));
    if(time==='lunch')return !['breakfast','nightmarket','bar','izakaya'].includes(c);
    if(time==='afternoon')return !['breakfast','nightmarket','bar','izakaya'].includes(c);
    if(time==='night')return c!=='breakfast';
    if(time==='late')return ['bar','izakaya'].includes(c)||/24h|24時間|深夜まで|夜カフェ/.test(s);
    return false;
  }
  // The three recommendation dimensions are independent and may contain
  // multiple values. They are editorial estimates, not verified portion sizes.
  // Specific known food signals override broad directory categories.
  function inferVenueTags(item){
    const c=item.category;
    const source=item.name+' '+(item.details||'');
    const genre=new Set(), volume=new Set();
    const contains=rx=>rx.test(source);
    const pancake=contains(/葱抓餅|蔥抓餅|葱油餅|蔥油餅|蛋餅|焼餅|燒餅/);
    const streetFood=contains(/胡椒餅|葱抓餅|蔥抓餅|葱油餅|蔥油餅|雞蛋糕|鶏蛋糕|車輪餅|地瓜球|雞排|鶏排|鹽酥雞|塩酥雞|水煎包|割包|刈包|大腸包小腸|甜不辣|肉圓/);
    const isSweet=contains(/豆花|雪花冰|かき氷|刨冰|粉圓|湯圓|仙草|甜品|デザート|スイーツ|パンケーキ|ケーキ/);
    const isDrink=contains(/手搖|手揺|奶茶|ミルクティー|タピオカ|ジュース|果汁|ドリンク|ティースタンド|飲料|茶飲|手沖茶/);
    const isCafe=c==='cafe'||contains(/カフェ|喫茶|咖啡|珈琲|コーヒー|coffee|café|cafe/i);
    const isNoodle=contains(/牛肉麵|牛肉麺|涼麵|涼麺|乾麵|乾麺|担仔麺|擔仔麵|ラーメン|拉麵|拉麺|米粉湯|麺線|麵線/);
    const isRice=contains(/魯肉飯|滷肉飯|肉燥飯|排骨飯|雞肉飯|鶏肉飯|炒飯|米糕|飯糰|飯團|弁当|便當|丼飯|おこわ/);
    const isDumpling=contains(/小籠包|小籠湯包|蒸餃|鍋貼|水餃|餃子|水煎包/);
    const isHotpot=contains(/火鍋|麻辣鍋|しゃぶしゃぶ|鍋物|羊肉爐/);
    const isHearty=contains(/定食|セットメニュー|食べ放題|吃到飽|便當|弁当|焼肉|燒肉|熱炒|合菜|丼飯|排骨飯/);
    // Categories from the food-specific directory carry narrower meaning.
    if(c==='rice'||isRice)genre.add('rice');
    if(c==='noodle'||isNoodle)genre.add('noodle');
    if(c==='dumpling'||isDumpling)genre.add('dumpling');
    if(c==='hotpot'||isHotpot)genre.add('hotpot');
    if(c==='sweet'||isSweet)genre.add('sweet');
    if(c==='drink'||isDrink)genre.add('drink');
    if(isCafe)genre.add('cafe');
    if(c==='breakfast'||c==='nightmarket'||c==='dumpling'||c==='rice'||c==='hotpot'||pancake||streetFood||contains(/臺灣料理|台湾料理|滷味|魯味|伝統小吃|台式/))genre.add('taiwan');
    if(c==='noodle'&&!contains(/ラーメン|日本式/))genre.add('taiwan');

    if(['drink','sweet','cafe','nightmarket'].includes(c)||isSweet||isDrink||pancake||streetFood)volume.add('light');
    if(['rice','noodle','hotpot','izakaya'].includes(c)||isRice||isNoodle||isHotpot||isHearty)volume.add('hearty');
    if(c==='dumpling'||isDumpling){volume.add('light');volume.add('hearty');}
    // Breakfast sets may be filling, but snacks are not automatically so.
    if(c==='breakfast'&&!pancake){volume.add('light');if(contains(/飯糰|飯團|朝食セット|定食/))volume.add('hearty');}
    // Specific street-food form takes precedence over generic directory name.
    let displayType='グルメ';
    if(streetFood||pancake)displayType='台湾小吃';
    else if(genre.has('sweet'))displayType='スイーツ';
    else if(genre.has('dumpling'))displayType='小籠包・点心';
    else if(genre.has('hotpot'))displayType='鍋料理';
    else if(genre.has('noodle'))displayType='麺類';
    else if(genre.has('rice'))displayType='ごはん料理';
    else if(c==='breakfast')displayType='朝ごはん';
    else if(c==='nightmarket')displayType='夜市';
    else if(genre.has('cafe'))displayType='カフェ';
    else if(genre.has('drink'))displayType='ドリンク';
    else if(c==='izakaya')displayType='熱炒';
    else if(c==='bar')displayType='バー';
    return {genre:[...genre],volume:[...volume],displayType};
  }
  function genreMatch(item,genre){return item.genre.includes(genre);}
  function volumeMatch(item,volume){return item.volume.includes(volume);}
  // Reviewed descriptions for a small set of identifiable venues. Other
  // entries use the guide's own editorial notes, never generic "おすすめが特徴".
  // Some examples use publicly reported visitor impressions and menu details;
  // other descriptions draw on existing guide notes, never invented ratings.
  const venueReasons=new Map([
    ['阜杭豆漿','厚焼きの焼餅と豆乳が名物。行列も多い定番の台湾朝食。'],
    ['鼎泰豊','薄皮の小籠包と丁寧なサービスで知られる定番店。'],
    ['金峰魯肉飯','甘辛く煮込んだ魯肉飯に、肉羹スープを添えて。'],
    ['白水豆花','なめらかな豆花に、麦芽糖とピーナッツの香ばしさ。'],
    ['蜂大咖啡','昔ながらの喫茶空間で、水出しコーヒーや焼き菓子を。'],
    ['阿城鵝肉','香り豊かな燻製ガチョウ肉とガチョウ油ご飯。'],
    ['香滿園','八角の風味が控えめな魯肉飯。漬物や小皿料理と一緒に。'],
    ['小王煮瓜','色の濃い魯肉飯と、あっさりした瓜仔肉のスープ。'],
  ]);
  const detailReasons=[
    [/八角なし/, '八角が苦手な人にも選びやすい、八角不使用の味付け。'],
    [/炭火トースト/, '炭火で焼くトーストが看板の台湾朝食店。'],
    [/台湾おにぎり/, '具をたっぷり包んだ台湾式おにぎりで朝ごはん。'],
    [/ミルク系/, 'ミルク系の台湾茶ドリンクが好きな人に。'],
    [/芝芝金萱/, '「芝芝金萱」のチーズフォームとお茶の組み合わせ。'],
    [/パパイヤミルク/, 'パパイヤミルクで台湾らしいドリンク休憩。'],
    [/水出し珈琲/, '水出しコーヒーをゆっくり味わいたいときに。'],
    [/茶チョコ/, 'お茶の風味を生かしたチョコレートも楽しめます。'],
    [/夜カフェ/, '夜にカフェでひと息つきたいときの候補。'],
    [/トウファ専門/, '台湾の豆花を味わいたいときに立ち寄りたい専門店。'],
    [/マンゴーかき氷/, 'マンゴーを使った台湾かき氷でひと休み。'],
    [/お餅入りかき氷/, 'もちもち食感を楽しめる台湾かき氷。'],
    [/烏龍茶小籠包/, '烏龍茶の香りを生かした小籠包が目当てなら。'],
    [/焼き小籠包/, '焼き目の香ばしい小籠包を味わえるお店。'],
    [/小籠包/, 'スープを包んだ小籠包を食べたいときに。'],
    [/水餃子|焼き棒餃子/, 'もちもちの水餃子や焼き餃子を気軽に。'],
    [/蒸し餃子/, '蒸したての餃子を楽しみたいときに。'],
    [/豚足の煮込み/, 'じっくり煮込んだ豚足を、ごはんと一緒に。'],
    [/台湾豚角煮丼/, 'やわらかく煮込んだ豚角煮をごはんと一緒に。'],
    [/台湾南部風おこわ/, '台湾南部風のおこわ「米糕」を味わえます。'],
    [/台湾北部風おこわ/, '台湾北部風のおこわ「米糕」を味わえます。'],
    [/牛肉麺/, '台湾の牛肉麺を一杯しっかり楽しみたいときに。'],
    [/券売機/, '券売機で注文できる台湾の食堂。'],
    [/冷麺/, 'さっぱりした台湾式の涼麺を食べたいときに。'],
    [/豆乳ベース/, '豆乳ベースの鍋を囲んで台湾の鍋料理を。'],
    [/辛くない|辛さ調整/, '辛さに配慮した鍋の選択肢もあります。'],
    [/ハーゲンダッツ/, '火鍋に加え、アイス食べ放題も楽しめます。'],
    [/ヤギ肉鍋/, '薬膳と羊肉を合わせた台湾の鍋料理。'],
    [/台湾風煮込み/, '台湾風の煮込み料理「滷味」をつまみに。'],
    [/さつまいもボール/, 'もちっとした地瓜球を食べ歩きで。'],
    [/焼きエリンギ/, '香ばしく焼いたエリンギを屋台で。'],
    [/揚げイカ/, 'サクサクの揚げイカで夜市の食べ歩きを。'],
    [/胡椒餅/, '焼きたての胡椒餅で食べ歩き。'],
    [/塩ゆで鶏肉/, 'さっぱりした塩ゆで鶏と野菜の小吃。'],
    [/薬膳スープ/, '薬膳の風味を楽しむ温かいスープ。'],
    [/レトロ/, 'どこか懐かしい雰囲気を楽しみたいときに。'],
    [/老舗/, '昔ながらの台湾の味をたどる一軒。'],
  ];
  function reason(item){
    // 1. Guide author's original annotation is authoritative. Never overwrite
    // it with a generated snippet, even if the shop also appears in nearby.json.
    const original=item.guideNote||guideEditorialNote(item);
    if(original)return original;
    // 2. Each new note was manually edited against a published review or
    // award-listed dish. This does not claim today's opening status.
    const checked=reviewedNotes.get(normalizeNoteName(item.name));
    if(checked)return checked;
    // 3. Legacy explicitly verified sentences may be used where available.
    if(!item.nearbySource){
      const precise=venueReasons.get(item.name);
      if(precise)return precise;
      for(const [pattern,sentence] of detailReasons){if(pattern.test(item.details||''))return sentence;}
    }
    // No speculative ratings or generic filler. An empty description is better
    // than suggesting an actual visitor opinion we do not have evidence for.
    return '';
  }
  function michelinStars(item){
    const parts=[item?.awards?.michelin,item?.awards?.summary,item?.details,(item?.guideTags||[]).map(t=>t.text).join('、')].filter(Boolean).join(' ');
    if(/(?:米其林|ミシュラン).{0,3}(?:三つ星|三星|3星|★★★|\*\*\*)/.test(parts))return 3;
    if(/(?:米其林|ミシュラン).{0,3}(?:二つ星|二星|2星|★★|\*\*)/.test(parts))return 2;
    if(/(?:米其林|ミシュラン).{0,3}(?:一つ星|一星|1星|★|\*)/.test(parts))return 1;
    return 0;
  }
  function cardTags(item){
    const omit=/^(?:チェーン店|連鎖店|チェーン|ドリンク|カフェ|スイーツ|麺類|ごはん系|ごはん料理|小籠包・点心|鍋料理|夜市|台湾小吃|朝ごはん|熱炒|バー|グルメ)$/;
    const tags=[];
    for(const tag of item.guideTags||[]){
      if(!tag?.text||omit.test(tag.text))continue;
      if(tags.some(x=>x.text===tag.text))continue;
      tags.push(tag);
    }
    return tags;
  }


  // Stable seeded PRNG and date in Taipei: shareable daily picks that change
  // only when the local Taipei date or explicitly selected conditions change.
  function taipeiDate(){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const d=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return `${d.year}-${d.month}-${d.day}`;
  }
  function hash32(text){let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function dailyNoise(name,seed){const v=hash32(seed+'|'+name);return ((v^v>>>16)>>>0)/4294967296;}
  function recommendationSeed(){
    // Include rounded position only in ephemeral daily ordering, never storage.
    const point=state.areaMode==='station'?stationOrigin():state.areaMode==='current'?state.position:null;
    const geoKey=point?`${point.lat.toFixed(3)},${point.lng.toFixed(3)}`:'';
    return [taipeiDate(),state.time,geoKey||state.area,
      state.genre,state.volume].join('|');
  }
  const MAIN_SHARE=.4;
  function recommendedPool(){
    const origin=state.areaMode==='station'?stationOrigin():
      state.areaMode==='current'&&state.locationStatus==='success'?state.position:null;
    const useDistance=!!origin&&(coordinatesReady||nearbyReady);
    // Nearby import must not contaminate non-GPS area browsing.
    const sourceItems=useDistance?[...readCatalog(),...readNearbyCatalog()]:readCatalog();
    const timeCandidates=sourceItems.filter(item=>eligibleTime(item,state.time));
    // Only verified, specifically matched storefronts take part in GPS ranking.
    // An unknown location is never assumed to be at a neighborhood midpoint.
    const withinRange=useDistance?closestPerBrand(timeCandidates.map(item=>{
      const own=Array.isArray(item.branches)?item.branches:Number.isFinite(item.lat)?[item]:[];
      const candidates=own.length?own:item.marketPoint?[item.marketPoint]:[];
      const nearest=candidates.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng))
        .map(p=>({...p,distanceMeters:distanceMeters(origin.lat,origin.lng,p.lat,p.lng)}))
        .sort((a,b)=>a.distanceMeters-b.distanceMeters)[0];
      return nearest?{...item,distanceMeters:nearest.distanceMeters,distanceToMarket:!own.length,nearestMapUrl:Array.isArray(item.branches)?nearest.mapUrl:null}:null;
    }).filter(item=>item&&item.distanceMeters<=GEO_MAX_METERS)):[];
    const nearbyFallback=false;
    const byTime=useDistance?withinRange:timeCandidates;
    const criteria=[];
    if(state.area)criteria.push({label:'エリア',weight:35,fn:item=>item.area===state.area});
    if(state.genre)criteria.push({label:'料理ジャンル',weight:30,fn:item=>genreMatch(item,state.genre)});
    if(state.volume)criteria.push({label:'ボリューム',weight:20,fn:item=>volumeMatch(item,state.volume)});
    // Start with every requested condition. If fewer than three candidates
    // remain, relax from the last optional choice backward (volume, genre,
    // then area). The Taipei time band is never relaxed.
    const active=[...criteria],lifted=[];
    let pool=byTime.filter(item=>active.every(c=>c.fn(item)));
    while(pool.length<Math.min(3,byTime.length)&&active.length){
      lifted.push(active.pop().label);
      pool=byTime.filter(item=>active.every(c=>c.fn(item)));
    }
    const seed=recommendationSeed();
    const newestAwardBonus=item=>{
      // 500盤 and 500碗 both follow 2026 > 2025 > 2024;
      // don't award double points to restaurants included in both lists.
      const years=String(item.awards?.plates||'')+'；'+String(item.awards?.bowls||'');
      if(/2026\s*[:：]\s*\d+\s*[盤碗]/.test(years))return 9;
      if(/2025\s*[:：]\s*\d+\s*[盤碗]/.test(years))return 6;
      if(/2024\s*[:：]\s*\d+\s*[盤碗]/.test(years))return 3;
      return 0;
    };
    const mealBonus=item=>state.time==='morning'&&item.category==='breakfast'?6:
      state.time==='night'&&item.category==='nightmarket'?5:
      state.time==='afternoon'&&['sweet','drink','cafe'].includes(item.category)?5:
      state.time==='lunch'&&['rice','noodle','dumpling'].includes(item.category)?4:0;
    const scored=pool.map(item=>{
      const matched=criteria.filter(c=>c.fn(item));
      const score=matched.reduce((sum,c)=>sum+c.weight,0)
        +(item.guidePick?(item.chain?12:26):0) // original food picks rank ahead; everyday chains get a smaller boost
        +(item.featured?1:0) // visibility comes from the rotating slot-1 rule below
        +(item.nearbySource?(item.locationConfidence==='high'?0:item.locationConfidence==='medium'?-3:-10):0)
        +(state.area&&state.areaMode==='all'&&item.chain?6:0) // not a proxy for branch proximity
        // Preserve distance-aware recommendations within the expanded 1,200m radius.
        // Places beyond 800m stay available, but fall behind closer candidates.
        +(Number.isFinite(item.distanceMeters)?40-12*Math.min(4,Math.floor(item.distanceMeters/270))
          -(item.distanceMeters>GEO_PRIORITY_METERS?26:0):0)
        +mealBonus(item)+newestAwardBonus(item);
      return {...item,matchScore:matched.reduce((sum,c)=>sum+c.weight,0),score,
        fullMatch:matched.length===criteria.length,matched:matched.map(c=>c.label),
        diversityKey:diversityKey(item,state.genre),
        random:dailyNoise(item.name,seed)};
    });
    // Quality band: only venues within 12 points of the best compete first.
    const best=scored.reduce((max,p)=>Math.max(max,p.score),0);
    const strong=scored.filter(p=>p.score>=best-12);
    const weak=scored.filter(p=>p.score<best-12);
    const noise=(item,step)=>dailyNoise(item.name+'#'+step,seed);
    const ordered=[],used=new Set();
    const take=item=>{ordered.push(item);used.add(item.name);};
    // On ~40% of days slot 1 is reserved for an editorial pick; on the other
    // days editorial picks compete like everyone else, so no shop is daily.
    // Chains are excluded from the reserved slot: a branch is everywhere, so it
    // is not a 「本命」. They still compete for every slot like other venues.
    const featured=strong.filter(p=>p.featured&&!p.chain);
    if(featured.length&&dailyNoise('__editorial-slot__',seed)<MAIN_SHARE){
      take(featured.reduce((x,y)=>y.score+7*noise(y,0)>x.score+7*noise(x,0)?y:x));
    }
    // Every further slot: best seeded value in the strongest remaining tier.
    // Repeating the type of the last two picks costs 4 points — this favours
    // variety without forcing a one-of-a-kind shop into every result.
    while(ordered.length<scored.length){
      const tier=strong.some(p=>!used.has(p.name))?strong:weak;
      const recent=ordered.slice(-2).map(p=>p.diversityKey);
      const step=ordered.length;
      let pick=null,value=-Infinity;
      for(const item of tier){
        if(used.has(item.name))continue;
        const v=item.score+7*noise(item,step)-4*recent.filter(k=>k===item.diversityKey).length;
        if(v>value){pick=item;value=v;}
      }
      if(!pick)break; // Exhausted unique venues; no repeated cards or null item.
      take(pick);
    }
    // Distance order is strictly ascending straight-line metres. Reuse the
    // same time, radius and user filters, but not recommendation score.
    // Fall back to recommended order while GPS/station location is unavailable.
    if(state.sortMode==='distance'&&useDistance){
      ordered.sort((a,b)=>(a.distanceMeters-b.distanceMeters)||b.score-a.score||a.name.localeCompare(b.name,'ja'));
    }
    return {ordered,timeCount:byTime.length,criteria,lifted,nearbyFallback,useDistance,nearbyCount:withinRange.length};
  }
  function diversityKey(item,genre){
    if(genre==='noodle'){
      const s=item.name+' '+item.details;
      if(/牛肉/.test(s))return 'beef-noodles';
      if(/涼麵|冷麺/.test(s))return 'cold-noodles';
      if(/担仔|擔仔/.test(s))return 'danzi-noodles';
      if(/乾麵|乾麺/.test(s))return 'dry-noodles';
    }
    if(genre==='sweet'){
      const s=item.name+' '+item.details;
      if(/豆花/.test(s))return 'tofu-pudding';
      if(/かき氷|冰/.test(s))return 'ice';
    }
    if(item.category==='breakfast'){
      const s=item.name+' '+item.details;
      if(/飯糰|飯團|おにぎり/.test(s))return 'breakfast-riceball';
      if(/豆漿/.test(s))return 'breakfast-soymilk';
      if(/トースト|吐司|三明治|サンド/.test(s))return 'breakfast-toast';
      if(/蛋餅|焼餅|燒餅/.test(s))return 'breakfast-bing';
      return 'breakfast';
    }
    return item.genre.find(g=>g!=='taiwan')||item.displayType||'';
  }
  function cardCuisine(item){
    if(item.displayType&&item.displayType!=='グルメ')return item.displayType;
    const parts=[item.name,item.details,(item.guideTags||[]).map(t=>t.text).join('、')].filter(Boolean).join(' ');
    if(/バー|ウイスキー|カクテル|酒場|酒吧/i.test(parts)||item.category==='bar')return 'バー';
    if(/咖啡|コーヒー|珈琲|喫茶|カフェ/i.test(parts)||item.category==='cafe')return 'カフェ';
    if(/豆花|かき氷|冰|甜點|甜品|スイーツ/i.test(parts)||item.category==='sweet')return 'スイーツ';
    if(/奶茶|茶|ドリンク|豆漿|ミルク|ジュース/i.test(parts)||item.category==='drink')return 'ドリンク';
    if(/小籠包|蒸餃|鍋貼|水餃|餃子|点心/i.test(parts)||item.category==='dumpling')return '小籠包・点心';
    if(/火鍋|鍋|麻辣/.test(parts)||item.category==='hotpot')return '鍋料理';
    if(/牛肉麵|牛肉麺|麺線|麵線|麺|麵|米粉/.test(parts)||item.category==='noodle')return '麺類';
    if(/魯肉飯|滷肉飯|雞肉飯|鶏肉飯|排骨飯|炒飯|米糕|便當|弁当|ごはん|飯/.test(parts)||item.category==='rice'||item.category==='meal')return 'ごはん料理';
    if(item.category==='breakfast')return '朝ごはん';
    if(item.market||item.category==='nightmarket')return '夜市';
    if(item.category==='izakaya')return '熱炒';
    return '台湾料理';
  }
  const typeLabel={breakfast:'朝食',nightmarket:'夜市',dumpling:'小籠包・餃子',rice:'ごはん',noodle:'麺',hotpot:'鍋',bar:'バー',drink:'ドリンク',sweet:'スイーツ',cafe:'カフェ',meal:'ごはん',izakaya:'熱炒'};
  function el(tag,cls,txt){const node=document.createElement(tag);if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;return node;}
  const timeControls=[],areaControls=[],genreControls=[],volumeControls=[];
  function buildChoice(group,items,holder,cls,callback){
    for(const [value,label] of items){
      const b=el('button',cls,label);b.type='button';b.dataset.value=value;b.setAttribute('aria-pressed','false');
      b.addEventListener('click',()=>callback(value));holder.append(b);group.push(b);
    }
  }
  buildChoice(timeControls,TIME,timeOptions,'recommend-option',value=>{
    state.timeMode=value;state.time=value==='current'?defaultBand():value;state.page=0;syncUI();renderResults();closeOptions();
  });
  function activateMode(mode){
    const switching=state.areaMode!==mode;
    state.areaMode=mode;state.area='';state.page=0;
    if(mode==='current'&&state.sortMode==='distance')state.sortMode='recommend';
    closeOptions();closeStationMenus();advanced.open=false;
    if(mode==='current'){
      // The pinned button always returns to GPS mode and requests a fresh fix.
      state.position=null;state.locationStatus='idle';state.geoRequested=false;
      geoRun++;requestLocation(true);
    }else{
      geoRun++;state.position=null;state.locationStatus='idle';
      syncUI();renderResults();
    }
  }
  function buildMetroLineOptions(){
    lineMenu.replaceChildren();
    for(const line of metroLines){
      const button=el('button','recommend-native-option recommend-native-option-line');button.type='button';
      button.dataset.value=line.id;button.setAttribute('role','option');button.setAttribute('aria-selected',String(state.line===line.id));
      const badge=el('span','recommend-native-option-code',line.id);badge.classList.add('is-line');badge.style.backgroundColor=line.color||'';badge.style.borderColor=line.color||'';badge.style.color='#ffffff';
      const copy=el('span','recommend-native-option-copy');
      copy.append(el('strong','',line.name));copy.append(el('small','',LINE_EN[line.id]||'MRT Line'));
      button.append(badge,copy);
      button.addEventListener('click',()=>{
        if(state.line!==line.id){state.line=line.id;state.stationCode='';state.page=0;}
        renderStationOptions();syncUI();renderResults();closeStationMenus();
      });
      lineMenu.append(button);
    }
  }
  function renderStationOptions(){
    stationMenu.replaceChildren();
    const items=metroStations.filter(s=>s.line===state.line);
    if(!state.line){
      const empty=el('div','recommend-native-empty','先に路線を選択');
      const sub=el('small','', 'Select line first');empty.append(sub);stationMenu.append(empty);return;
    }
    if(!items.length){
      const empty=el('div','recommend-native-empty','駅データがありません');stationMenu.append(empty);return;
    }
    for(const item of items){
      const button=el('button','recommend-native-option recommend-native-option-station');button.type='button';
      button.dataset.value=item.code;button.setAttribute('role','option');button.setAttribute('aria-selected',String(state.stationCode===item.code));
      const badge=el('span','recommend-native-option-code',item.code.replace(/^[A-Z]+/,''));badge.classList.add('is-station');const itemLineColor=(metroLines.find(x=>x.id===item.line)?.color)||'#4288c9';badge.style.setProperty('--station-code-border',itemLineColor);badge.style.borderColor=itemLineColor;badge.style.backgroundColor='#ffffff';badge.style.color='#202227';
      const copy=el('span','recommend-native-option-copy');
      copy.append(el('strong','',item.name));copy.append(el('small','',item.en||'MRT Station'));
      button.append(badge,copy);
      button.addEventListener('click',()=>{
        state.stationCode=item.code;state.page=0;
        syncUI();renderResults();closeStationMenus();
      });
      stationMenu.append(button);
    }
  }
  function closeStationMenus(){
    lineMenu.hidden=true;stationMenu.hidden=true;
    lineTrigger.setAttribute('aria-expanded','false');stationTrigger.setAttribute('aria-expanded','false');
    lineField.classList.remove('is-picking','is-open');stationField.classList.remove('is-picking','is-open');
    stationControls.dataset.active='';
  }
  function openStationMenu(kind){
    if(kind==='line'){
      if(!stationsReady)return;
      const open=lineMenu.hidden;
      closeStationMenus();closeOptions();advanced.open=false;
      if(open){lineMenu.hidden=false;lineTrigger.setAttribute('aria-expanded','true');lineField.classList.add('is-picking','is-open');stationControls.dataset.active='line';}
      return;
    }
    if(stationTrigger.disabled)return;
    const open=stationMenu.hidden;
    closeStationMenus();closeOptions();advanced.open=false;
    if(open){stationMenu.hidden=false;stationTrigger.setAttribute('aria-expanded','true');stationField.classList.add('is-picking','is-open');stationControls.dataset.active='station';}
  }
  lineTrigger.addEventListener('click',()=>openStationMenu('line'));
  stationTrigger.addEventListener('click',()=>openStationMenu('station'));
  lineTrigger.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeStationMenus();}});
  stationTrigger.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeStationMenus();}});
  buildChoice(genreControls,GENRES,moods,'recommend-pill',value=>{
    state.genre=state.genre===value?'':value;state.page=0;advanced.open=false;syncUI();renderResults();
  });
  buildChoice(volumeControls,VOLUMES,volumes,'recommend-pill',value=>{
    state.volume=state.volume===value?'':value;state.page=0;advanced.open=false;syncUI();renderResults();
  });
  function closeOptions(){timeOptions.hidden=true;timeButton.setAttribute('aria-expanded','false');}
  function toggleTimeOptions(){const open=timeOptions.hidden;closeOptions();advanced.open=false;if(open){timeOptions.hidden=false;timeButton.setAttribute('aria-expanded','true');}}
  timeButton.addEventListener('click',toggleTimeOptions);
  areaButton.addEventListener('click',()=>activateMode(state.areaMode==='station'?'current':'station'));
  title.addEventListener('click',()=>activateMode('current'));
  title.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activateMode('current');}});
  drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){closeOptions();closeStationMenus();advanced.open=false;}});
  advanced.addEventListener('toggle',()=>{if(advanced.open)closeOptions();});
  drawer.addEventListener('click',e=>{
    if(!e.target.closest('.recommend-control-time-wrap'))closeOptions();
    if(!e.target.closest('.recommend-control-advanced-wrap'))advanced.open=false;
    if(!e.target.closest('.recommend-native-field'))closeStationMenus();
  });
  // Selected conditions become removable bubbles; the add button stays last.
  // With no active conditions the wide "さらに条件を指定 ＋" button returns.
  function syncActiveConditions(){
    activeFilters.replaceChildren();
    const selected=[];
    for(const [kind,items] of [['genre',GENRES],['volume',VOLUMES]]){
      const value=state[kind];
      const match=items.find(([id])=>id===value);
      if(match)selected.push({kind,value,label:match[1]});
    }
    for(const choice of selected){
      const chip=el('button','recommend-active-chip');chip.type='button';
      chip.setAttribute('aria-label',`${choice.label}の条件を解除`);
      chip.title=`${choice.label}を解除`;
      chip.append(el('span','recommend-active-chip-label',choice.label));
      const remove=el('span','recommend-active-chip-remove','×');remove.setAttribute('aria-hidden','true');chip.append(remove);
      chip.addEventListener('click',()=>{
        state[choice.kind]='';state.page=0;advanced.open=false;closeOptions();syncUI();renderResults();
      });
      activeFilters.append(chip);
    }
    const hasSelections=selected.length>0;
    secondaryControls.classList.toggle('recommend-has-selected',hasSelections);
    advancedTrigger.setAttribute('aria-label',hasSelections?'条件を追加':'さらに条件を指定');
    advancedTrigger.title=hasSelections?'条件を追加':'さらに条件を指定';
  }
  function syncUI(){
    syncActiveConditions();
    const timeName=TIME.find(([value])=>value===state.time)?.[1]||'昼';
    timeLabel.textContent=timeName;
    timeCaption.textContent=state.timeMode==='current'?'現在時刻':'時間帯指定';
    const isStation=state.areaMode==='station';
    areaLabel.textContent=isStation?'駅から検索':'現在地';
    mainPicker.classList.toggle('is-station',isStation);
    stationControls.hidden=!isStation;
    currentLocation.hidden=isStation;
    areaButton.setAttribute('aria-label',isStation?'現在地に戻る':'駅から検索に切り替え');
    areaButton.title=isStation?'現在地に戻る':'駅から検索';
    if(!isStation)closeStationMenus();
    const selectedLine=metroLines.find(x=>x.id===state.line);
    const selectedStation=currentStation();
    lineTrigger.disabled=!stationsReady;
    stationTrigger.disabled=!selectedLine;
    lineLabel.textContent=selectedLine?selectedLine.name:stationsFailed?'路線データなし':'路線を選択';
    lineEn.textContent=selectedLine?LINE_EN[selectedLine.id]:'Select Line';
    lineCode.textContent=selectedLine?.id||'--';
    lineCode.style.backgroundColor=selectedLine?.color||'';
    lineCode.style.borderColor=selectedLine?.color||'';
    lineCode.style.color='#ffffff';
    lineCode.classList.toggle('is-empty',!selectedLine);
    stationLabel.textContent=selectedStation?selectedStation.name:selectedLine?'駅を選択':'先に路線を選択';
    stationEn.textContent=selectedStation?(selectedStation.en||'MRT Station'):selectedLine?'Select Station':'Select Line First';
    stationCode.textContent=selectedStation?selectedStation.code.replace(/^[A-Z]+/,''):'--';
    stationCode.style.setProperty('--station-code-border',selectedLine?.color||'#424049');
    stationCode.style.backgroundColor=selectedLine?'#ffffff':'';
    stationCode.style.borderColor=selectedLine?.color||'';
    stationCode.style.color=selectedLine?'#202227':'';
    stationCode.classList.toggle('is-empty',!selectedStation);
    for(const option of lineMenu.querySelectorAll('.recommend-native-option'))option.setAttribute('aria-selected',String(option.dataset.value===state.line));
    for(const option of stationMenu.querySelectorAll('.recommend-native-option'))option.setAttribute('aria-selected',String(option.dataset.value===state.stationCode));
    const district=nearbyDistrict(state.position);
    districtName.textContent=district?`台北市 ${district[0]}`:state.locationStatus==='loading'?'測位中':state.locationStatus==='success'?'現在地':'現在地';
    districtEn.textContent=district?`${district[1]} Taipei City`:state.locationStatus==='loading'?'Locating…':state.locationStatus==='success'?'地区名は未確認':'Location';
    currentLocation.title=district?'登録店の所在地から推定した行政区です。境界付近では異なる場合があります。':'現在地の座標を使って推薦します。';
    for(const b of timeControls)b.setAttribute('aria-pressed',String(b.dataset.value===state.timeMode));
    for(const b of genreControls)b.setAttribute('aria-pressed',String(b.dataset.value===state.genre));
    for(const b of volumeControls)b.setAttribute('aria-pressed',String(b.dataset.value===state.volume));
    const messages={idle:'',loading:'現在地を確認しています…',unsupported:'位置情報に対応していません。通常のおすすめを表示します。',denied:'位置情報が許可されていません。通常のおすすめを表示します。',outside:'現在地は対象地域外です。通常のおすすめを表示します。',imprecise:'位置情報の精度が足りません。通常のおすすめを表示します。',error:'現在地を取得できませんでした。通常のおすすめを表示します。',success:(!coordinatesReady&&!nearbyReady)?'登録店の位置情報を読み込んでいます…':`現在地から直線${GEO_MAX_METERS}m以内・位置登録済み${coordinates.size+nearbyVenues.length}候補からご案内します。`};
    locationStatus.textContent=!isStation?messages[state.locationStatus]||'':
      stationsFailed?'駅データを読み込めませんでした。再読み込みしてください。':
      !stationsReady?'駅データを読み込み中…':
      !state.line?'路線を選んでください。':
      !selectedStation?'駅を選んでください。':
      `選択した駅から直線${GEO_MAX_METERS}m以内の登録店を検索します。`;
    locationStatus.hidden=!locationStatus.textContent;
  }
  // The Geolocation API requires HTTPS and explicit browser permission.
  // No coordinates are stored, sent to any service, or persisted.
  const rad=n=>n*Math.PI/180;
  function distanceMeters(lat1,lng1,lat2,lng2){const dLat=rad(lat2-lat1),dLng=rad(lng2-lng1);const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(a)));}
  let geoRun=0; // Initialized before persisted debug position can be restored.
  // Debug-only location override, enabled solely by ?debugLocation=1.
  const debugEnabled=new URLSearchParams(location.search).get('debugLocation')==='1';
  const debugPoints=[['station','台北車站',25.046255,121.517532],['ximen','西門町',25.0421,121.5081],['zhongshan','中山站',25.0526,121.5204]];
  let debugPosition=null;
  function setDebugPosition(lat,lng){
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<24.7||lat>25.4||lng<121.2||lng>122)return false;
    debugPosition={lat,lng,accuracy:10};
    try{sessionStorage.setItem('taipeiDebugLocation',JSON.stringify({lat,lng}));}catch(e){}
    geoRun++;state.areaMode='current';state.area='';state.position={...debugPosition};state.locationStatus='success';state.page=0;
    syncUI();renderResults();return true;
  }
  if(debugEnabled){
    // Debug tools float over the drawer rather than consume the three-card layout.
    const toggle=document.createElement('button');
    toggle.type='button';toggle.id='recommend-debug-fab';
    toggle.setAttribute('aria-label','模擬定位設定');
    toggle.setAttribute('aria-controls','recommend-debug-location');
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('title','模擬定位設定');
    toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/></svg>';
    const panel=document.createElement('section');panel.id='recommend-debug-location';
    panel.setAttribute('aria-label','模擬定位設定');panel.hidden=true;
    panel.innerHTML='<div class="recommend-debug-header"><strong>模擬定位設定</strong><button id="recommend-debug-close" type="button" aria-label="關閉設定">×</button></div><label for="recommend-debug-select">測試位置</label><select id="recommend-debug-select"><option value="station">台北車站</option><option value="ximen">西門町</option><option value="zhongshan">中山站</option><option value="custom">自訂座標</option><option value="real">恢復真實定位</option></select><div id="recommend-debug-custom" hidden><input id="recommend-debug-lat" type="number" step="any" placeholder="緯度 Latitude" inputmode="decimal"><input id="recommend-debug-lng" type="number" step="any" placeholder="經度 Longitude" inputmode="decimal"></div><button id="recommend-debug-apply" type="button">套用位置</button><small id="recommend-debug-feedback">只影響網站距離計算，不會更改手機 GPS。</small>';
    // Keep the popover outside .recommend-drawer-inner: that mobile container
    // has a fixed height and overflow:hidden, so an inline debug panel hid results.
    drawer.append(toggle,panel);
    function setPanelOpen(open){
      panel.hidden=!open;
      toggle.setAttribute('aria-expanded',String(open));
      toggle.classList.toggle('is-active',open);
      if(open)panel.querySelector('#recommend-debug-select').focus({preventScroll:true});
      else toggle.focus({preventScroll:true});
    }
    toggle.addEventListener('click',()=>setPanelOpen(panel.hidden));
    panel.querySelector('#recommend-debug-close').addEventListener('click',()=>setPanelOpen(false));
    document.addEventListener('pointerdown',e=>{
      if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target)){
        panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.classList.remove('is-active');
      }
    },true);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!panel.hidden){
        e.preventDefault();e.stopImmediatePropagation();setPanelOpen(false);
      }
    });
    const diag=document.createElement('pre');
    diag.id='recommend-debug-diagnostics';
    diag.textContent=`推薦診斷 v${VERSION}：資料載入中…`;
    panel.append(diag);

    const select=panel.querySelector('select'),custom=panel.querySelector('#recommend-debug-custom'),feedback=panel.querySelector('#recommend-debug-feedback');
    select.addEventListener('change',()=>{custom.hidden=select.value!=='custom';});
    panel.querySelector('#recommend-debug-apply').addEventListener('click',()=>{
      if(select.value==='real'){
        debugPosition=null;try{sessionStorage.removeItem('taipeiDebugLocation');}catch(e){}
        state.position=null;state.geoRequested=false;state.areaMode='current';requestLocation(true);
        feedback.textContent='已恢復真實 GPS 定位';setPanelOpen(false);return;
      }
      const point=debugPoints.find(p=>p[0]===select.value);
      const lat=point?point[2]:Number(panel.querySelector('#recommend-debug-lat').value);
      const lng=point?point[3]:Number(panel.querySelector('#recommend-debug-lng').value);
      if((select.value==='custom'&&(!panel.querySelector('#recommend-debug-lat').value||!panel.querySelector('#recommend-debug-lng').value))||!setDebugPosition(lat,lng)){
        feedback.textContent='請輸入有效的台北地區經緯度';return;
      }
      feedback.textContent=`模擬定位已套用：${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      toggle.title=`模擬定位：${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setPanelOpen(false);
    });
    try{const saved=JSON.parse(sessionStorage.getItem('taipeiDebugLocation')||'null');if(saved&&Number.isFinite(saved.lat)&&Number.isFinite(saved.lng)){
      const savedPoint=debugPoints.find(p=>p[2]===saved.lat&&p[3]===saved.lng);
      select.value=savedPoint?savedPoint[0]:'custom';custom.hidden=!!savedPoint;
      panel.querySelector('#recommend-debug-lat').value=saved.lat;panel.querySelector('#recommend-debug-lng').value=saved.lng;
      setDebugPosition(saved.lat,saved.lng);
    }}catch(e){}
  }
  function requestLocation(force=false){
    if(state.areaMode!=='current')return;
    if(debugEnabled&&debugPosition){setDebugPosition(debugPosition.lat,debugPosition.lng);return;}
    if(!navigator.geolocation||!window.isSecureContext){state.area='';state.locationStatus='unsupported';syncUI();renderResults();return;}
    if(!force&&state.geoRequested)return;
    state.geoRequested=true;
    const request=++geoRun;
    state.locationStatus='loading';state.area='';syncUI();renderResults();
    navigator.geolocation.getCurrentPosition(pos=>{
      if(request!==geoRun||state.areaMode!=='current')return;
      const {latitude,longitude,accuracy}=pos.coords;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||accuracy>1000){
        state.position=null;state.locationStatus='imprecise';
      }else if(latitude<24.7||latitude>25.4||longitude<121.2||longitude>122){
        state.position=null;state.locationStatus='outside';
      }else{
        state.position={lat:latitude,lng:longitude,accuracy}; // session only; never persisted or transmitted
        state.locationStatus='success';
      }
      state.page=0;syncUI();renderResults();
    },err=>{
      if(request!==geoRun||state.areaMode!=='current')return;
      state.position=null;state.locationStatus=err.code===1?'denied':'error';state.page=0;syncUI();renderResults();
    },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  }
  function refreshContextOnOpen(){
    if(state.timeMode==='current'){state.time=defaultBand();state.page=0;}
    syncUI();renderResults();
    // Opening the drawer is an explicit gesture. Request GPS once when it is
    // needed; never repeatedly prompt users who already declined.
    if(state.areaMode==='current'&&!state.geoRequested&&state.locationStatus==='idle')requestLocation();
  }
  function formatDistance(meters){return `${Math.max(10,Math.round(meters/10)*10)}m`;}
  function reportDebug(orderedCount){
    if(!debugEnabled)return;
    const target=document.getElementById('recommend-debug-diagnostics');
    if(!target)return;
    try{
      const rows=[...readCatalog(),...readNearbyCatalog()];
      const positioned=rows.filter(x=>Array.isArray(x.branches)?x.branches.length:(Number.isFinite(x.lat)&&Number.isFinite(x.lng))||!!x.marketPoint);
      let near=0,eligible=0;
      if(state.position){
        for(const x of positioned){
          const points=Array.isArray(x.branches)?x.branches:Number.isFinite(x.lat)?[x]:x.marketPoint?[x.marketPoint]:[];
          if(points.some(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&distanceMeters(state.position.lat,state.position.lng,p.lat,p.lng)<=GEO_MAX_METERS)){
            near++;
            if(eligibleTime(x,state.time))eligible++;
          }
        }
      }
      target.textContent=`JS 版本：v${VERSION}
座標 JSON：${coordinatesReady?'已載入 '+coordinates.size+' 筆':coordinatesFailed?'載入失敗':'載入中'}
網頁餐飲清單：${rows.length} 筆
配對成功：${positioned.length} 筆
${GEO_MAX_METERS}m 內：${near} 筆
符合時段：${eligible} 筆
實際推薦：${orderedCount} 筆
定位狀態：${state.locationStatus}
選擇時段：${state.time}
模擬座標：${state.position?state.position.lat.toFixed(4)+', '+state.position.lng.toFixed(4):'尚未設定'}`;
    }catch(e){target.textContent='推薦診斷錯誤：'+e.message;}
  }
  function updateSortControls(){
    const origin=state.areaMode==='station'?stationOrigin():
      state.areaMode==='current'&&state.locationStatus==='success'?state.position:null;
    const distanceAvailable=!!origin&&(coordinatesReady||nearbyReady);
    sortDistance.disabled=!distanceAvailable;
    sortDistance.title=distanceAvailable?'直線距離が近い順に表示します':'現在地を取得するか、駅を選択すると使えます';
    sortRecommend.setAttribute('aria-pressed',String(state.sortMode==='recommend'));
    sortDistance.setAttribute('aria-pressed',String(state.sortMode==='distance'));
  }
  function setSortMode(mode){
    if(mode==='distance'&&sortDistance.disabled)return;
    if(state.sortMode===mode)return;
    state.sortMode=mode;state.page=0;
    closeOptions();closeStationMenus();advanced.open=false;
    renderResults();
  }
  sortRecommend.addEventListener('click',()=>setSortMode('recommend'));
  sortDistance.addEventListener('click',()=>setSortMode('distance'));
  function updateTagFade(node){
    const maxScroll=Math.max(0,node.scrollWidth-node.clientWidth);
    node.dataset.fade=maxScroll<2?'none':node.scrollLeft<2?'right':node.scrollLeft>=maxScroll-2?'left':'both';
    node.tabIndex=maxScroll>=2?0:-1;
  }
  window.addEventListener('resize',()=>{
    document.querySelectorAll('.recommend-guide-tags').forEach(updateTagFade);
  },{passive:true});
  function renderResults(){
    updateSortControls();
    if(state.areaMode==='station'&&(!currentStation()||(!coordinatesReady&&!nearbyReady))){
      results.replaceChildren(el('p','recommend-no-data',stationsFailed?'駅データを読み込めませんでした。':currentStation()?'位置データを読み込み中です。':`路線と駅を選ぶと、駅から${GEO_MAX_METERS}m以内のおすすめを表示します。`));
      count.textContent='駅を選択';more.hidden=true;relaxed.hidden=true;
      disclaimer.textContent='※ 選択駅からの直線距離を基準にご案内します。';
      return;
    }
    const {ordered,timeCount,lifted,nearbyFallback,useDistance,nearbyCount}=recommendedPool();
    results.replaceChildren();
    if(!ordered.length){
      more.hidden=true;
      relaxed.hidden=false;
      relaxed.textContent=timeCount===0?(useDistance?`選択地点から直線${GEO_MAX_METERS}m以内に該当する登録店はありません。`:'この時間帯に合う収録店は、まだありません。時間帯を変更してご覧ください。'):'該当店が見つかりません。';
      results.append(el('p','recommend-no-data','おすすめ情報を準備中です。'));
      count.textContent='0軒';reportDebug(0);return;
    }
    const pages=Math.ceil(ordered.length/3);
    state.page=((state.page%pages)+pages)%pages;
    const slice=ordered.slice(state.page*3,state.page*3+3);
    count.textContent=`${slice.length}軒をピックアップ`;
    relaxed.hidden=!lifted.length&&!nearbyFallback;
    relaxed.textContent=lifted.length?`条件を少しゆるめました（${lifted.join('・')}）。時間帯は変更していません。`:'';
    if(useDistance&&nearbyFallback){
      locationStatus.textContent=`この時間帯は直線${GEO_MAX_METERS}m以内に位置データ登録済みの店がありません。`;
      locationStatus.hidden=false;
    }
    if(useDistance&&!nearbyFallback){
      locationStatus.textContent=`${state.areaMode==='station'?'選択駅':'現在地'}から直線${GEO_MAX_METERS}m以内の位置データ登録済み${nearbyCount}軒を検索中（位置登録済み${coordinates.size+nearbyVenues.length}候補）。`;
      locationStatus.hidden=false;
    }
    reportDebug(ordered.length);
    slice.forEach(item=>{
      const card=el('article','recommend-card');
      const shell=el('div','recommend-card-shell');
      const main=el('div','recommend-card-main');
      const side=el('div','recommend-card-side');
      const cuisine=cardCuisine(item);
      if(cuisine)main.append(el('div','recommend-card-type',cuisine));
      const a=el('a','recommend-venue',item.name);a.href=item.nearestMapUrl||item.url;a.target='_blank';a.rel='noopener noreferrer';main.append(a);
      const distanceText=Number.isFinite(item.distanceMeters)?`約${formatDistance(item.distanceMeters)}`:'';
      if(distanceText){
        const badge=el('span','recommend-distance-pill');
        if(item.distanceMeters>GEO_PRIORITY_METERS)badge.classList.add('recommend-distance-pill-outer');
        badge.setAttribute('aria-label',`${state.areaMode==='station'?'選択駅':'現在地'}からの直線距離 ${distanceText}`);
        const pin=el('span','recommend-distance-pill-icon');
        pin.setAttribute('aria-hidden','true');
        pin.innerHTML='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.7"/></svg>';
        badge.append(pin,el('span','recommend-distance-pill-label',distanceText));
        side.append(badge);
      }else side.append(el('span','recommend-distance-pill recommend-distance-pill-empty',''));
      const starsCount=Math.min(3,michelinStars(item));
      const starsWrap=el('div','recommend-card-stars');
      starsWrap.setAttribute('aria-label',starsCount?`ミシュラン${starsCount}つ星`:'ミシュラン評価なし');
      if(starsCount){
        for(let i=0;i<starsCount;i++){
          const star=el('span','recommend-card-star');
          star.innerHTML=MICHELIN_FLOWER_SVG;
          starsWrap.append(star);
        }
      }
      side.append(starsWrap);
      const tags=cardTags(item);
      if(tags.length){
        const tagList=el('div','recommend-guide-tags');
        tagList.setAttribute('aria-label','ガイドの店情報（横方向にスクロールできます）');
        const tagTrack=el('div','recommend-tag-track');
        for(const tag of tags){
          const chip=el('span','recommend-guide-tag',tag.text);
          if(tag.tone==='featured')chip.classList.add('recommend-guide-tag-featured');
          if(tag.tone==='caution')chip.classList.add('recommend-guide-tag-caution');
          tagTrack.append(chip);
        }
        tagList.append(tagTrack);
        tagList.addEventListener('scroll',()=>updateTagFade(tagList),{passive:true});
        side.append(tagList);
      }
      shell.append(main,side);
      card.append(shell);
      results.append(card);
    });
    requestAnimationFrame(()=>results.querySelectorAll('.recommend-guide-tags').forEach(updateTagFade));
    more.hidden=ordered.length<=3;
    disclaimer.textContent=`※ ${state.timeMode==='current'?'台北時刻 '+taipeiTimeLabel()+'。':''}${useDistance&&!nearbyFallback?'距離は直線の概算で、徒歩ルートとは異なります。':''}${useDistance&&slice.some(x=>x.distanceToMarket)?'夜市の店は夜市までの距離です。':''}時間帯・ボリュームは目安です。営業中とは限りません。訪問前に営業時間をご確認ください。${slice.some(x=>x.nearbySource&&!x.address)?'住所未確認の店舗は、地図上で店名と場所をご確認ください。':''}`;
  }
  more.addEventListener('click',()=>{state.page++;renderResults();});
  syncUI();renderResults();loadMetroStations();loadCoordinates();loadNearbyVenues();loadReviewedNotes();
  // Safari often restores a previous page snapshot from the Back/Forward cache.
  // Recompute results from current DOM, without requesting location.
  window.addEventListener('pageshow',event=>{
    if(event.persisted){catalog=null;syncUI();renderResults();if(!coordinatesReady&&!coordinatesFailed)loadCoordinates();}
  });
  let isOpen=false, dragging=null, raf=0, queuedProgress=0, progress=0, lastFocus=null, lockedY=0, savedStyle=null, suppressedUntil=0;
  const panelWidth=()=>Math.min(innerWidth,480);
  const clamp=v=>Math.max(0,Math.min(1,v));
  function commit(){raf=0;progress=clamp(queuedProgress);body.style.setProperty('--recommend-offset',`${((progress-1)*panelWidth()).toFixed(2)}px`);body.style.setProperty('--recommend-progress',progress.toFixed(4));body.style.setProperty('--recommend-shift',`${(26*progress).toFixed(2)}px`);}
  function draw(p,immediate=false){queuedProgress=clamp(p);if(immediate){cancelAnimationFrame(raf);commit();}else if(!raf)raf=requestAnimationFrame(commit);}
  function lock(){if(savedStyle)return;lastFocus=document.activeElement;lockedY=scrollY;savedStyle={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow};body.style.position='fixed';body.style.top=`-${lockedY}px`;body.style.width='100%';body.style.overflow='hidden';}
  function unlock(){if(!savedStyle)return;Object.assign(body.style,savedStyle);savedStyle=null;window.scrollTo({top:lockedY,behavior:'instant'});}
  let openGeneration=0;
  function syncChrome(active){
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',active?(document.documentElement.dataset.theme==='light'?'#F7F8F7':'#0D0D0D'):(document.documentElement.dataset.theme==='light'?'#F7F8F7':'#111417'));
  }
  function settle(open){
    isOpen=open;
    if(!open){closeOptions();advanced.open=false;}
    if(open){
      lock();
      // The first three picks are rendered before opening. Defer costly
      // geolocation / rebuilding until after the slide settles.
      const thisOpening=++openGeneration;
      window.setTimeout(()=>{if(isOpen&&openGeneration===thisOpening)refreshContextOnOpen();},reduceMotion.matches?0:350);
      drawer.inert=false;drawer.setAttribute('aria-hidden','false');
      body.classList.add('recommend-drawer-open','recommend-swipe-active');
      syncChrome(true);
      draw(1,true);drawer.focus({preventScroll:true});
    }else{
      ++openGeneration;
      body.classList.remove('recommend-drawer-open');drawer.setAttribute('aria-hidden','true');
      if(drawer.contains(document.activeElement))document.activeElement.blur();
      draw(0,true);unlock();
      if(lastFocus?.isConnected&&lastFocus!==body)lastFocus.focus({preventScroll:true});
      window.setTimeout(()=>{if(!isOpen&&!dragging){body.classList.remove('recommend-swipe-active');drawer.inert=true;syncChrome(false);}},reduceMotion.matches?0:350);
    }
  }
  backdrop.addEventListener('click',()=>{if(isOpen)settle(false);});
  function blocked(target){
    if(!(target instanceof Element))return true;
    if(target.closest('input,textarea,select,[contenteditable="true"],audio,video,a[href]'))return true;
    if(target.closest('.tab-pills,#airport-route-selector .route-panel,.sights-day-trips .daytrip-destination-panel'))return true;
    // Don't steal gestures owned by horizontal scrolling controls.
    for(let n=target;n&&n!==body;n=n.parentElement){
      if(n.scrollWidth>n.clientWidth+5 && /auto|scroll|overlay/.test(getComputedStyle(n).overflowX))return true;
    }
    return false;
  }
  function begin(x,y,target,kind){
    // Let restaurant tag chips scroll horizontally without activating the drawer swipe.
    if(target instanceof Element && target.closest('.recommend-guide-tags,#recommend-debug-fab,#recommend-debug-location'))return;
    if(dragging||body.classList.contains('food-drawer-open')||body.classList.contains('food-swipe-active'))return;
    if(!isOpen&&blocked(target))return;
    dragging={x,y,px:x,t:performance.now(),velocity:0,axis:'unset',activated:false,start:isOpen?1:0,kind};
  }
  function move(x,y,event){
    if(!dragging)return;
    const g=dragging,dx=x-g.x,dy=y-g.y;
    if(g.axis==='unset'){
      if(Math.hypot(dx,dy)<10)return;
      if(Math.abs(dy)>Math.abs(dx)*1.1){dragging=null;return;}
      if((!isOpen&&dx<=0)||(isOpen&&dx>=0)){dragging=null;return;}
      g.axis='x';g.activated=true;
      body.classList.add('recommend-swipe-active','recommend-swipe-dragging');
      syncChrome(true);
      drawer.inert=false;drawer.setAttribute('aria-hidden','false');
    }
    if(event?.cancelable)event.preventDefault();
    const t=performance.now(),dt=Math.max(1,t-g.t);
    g.velocity=.7*g.velocity+.3*(x-g.px)/dt;g.px=x;g.t=t;
    draw(g.start+dx/panelWidth());
  }
  function finish(){
    if(!dragging)return;
    const g=dragging;dragging=null;if(!g.activated)return;
    draw(queuedProgress,true);
    body.classList.remove('recommend-swipe-dragging');suppressedUntil=performance.now()+400;
    const open=isOpen?!(progress<.52||(g.velocity<-.52&&progress<.88)):(progress>.48||(g.velocity>.52&&progress>.12));
    settle(open);
  }
  let touchId=null;
  document.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0];touchId=t.identifier;begin(t.clientX,t.clientY,e.target,'touch');},{passive:true,capture:true});
  document.addEventListener('touchmove',e=>{if(!dragging||dragging.kind!=='touch')return;const t=[...e.changedTouches].find(t=>t.identifier===touchId);if(t)move(t.clientX,t.clientY,e);},{passive:false,capture:true});
  document.addEventListener('touchend',e=>{if(dragging?.kind==='touch'&&[...e.changedTouches].some(t=>t.identifier===touchId)){finish();touchId=null;}},{passive:true,capture:true});
  document.addEventListener('touchcancel',()=>{if(dragging?.kind==='touch')finish();},{passive:true,capture:true});
  document.addEventListener('mousedown',e=>{if(e.button===0)begin(e.clientX,e.clientY,e.target,'mouse');},true);
  document.addEventListener('mousemove',e=>{if(dragging?.kind==='mouse')move(e.clientX,e.clientY,e);},true);
  document.addEventListener('mouseup',()=>{if(dragging?.kind==='mouse')finish();},true);
  document.addEventListener('dragstart',e=>{if(dragging?.kind==='mouse')e.preventDefault();},true);
  document.addEventListener('click',e=>{if(performance.now()<suppressedUntil){e.preventDefault();e.stopPropagation();}},true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&isOpen){e.preventDefault();settle(false);return;}
    // Keyboard-only access without adding a homepage entrance.
    if(e.altKey&&e.key.toLowerCase()==='r'&&!isOpen&&!body.classList.contains('food-drawer-open')){e.preventDefault();settle(true);return;}
    if(!isOpen||e.key!=='Tab')return;
    const focusable=[...drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[role=button][tabindex="0"]')].filter(n=>n.getClientRects().length);
    const first=focusable[0],last=focusable[focusable.length-1];if(!first||!last)return;
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    else if(!drawer.contains(document.activeElement)){e.preventDefault();first.focus();}
  });
  window.addEventListener('resize',()=>draw(isOpen?1:0,true),{passive:true});
  window.addEventListener('blur',()=>{if(dragging)finish();});
  drawer.inert=true;draw(0,true);
})();
