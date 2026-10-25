/* TAIPEI CITY GUIDE v30.9.131 — restaurant data from the 2026-10-25 backup (254 shops).
   v30.9.130 — 料理種類 can be combined; 推薦レベル (pickLevel 1 精選 / 2 必食) from the
   editor ranks and orders shops; short fixed-size note; the list side keeps the front's size; turns the other way.
   v30.9.129 — curated picks (guideTagSource) rank first again until editor badges
   exist; chain links search Maps in Taipei.
   v30.9.127 — compact recommendation footer without hidden gaps.
   v30.9.126 — visible back-list fade and corrected front card spacing.
   v30.9.125 — artifact-free flip, reverse-list fade and stable iOS height.
   v30.9.124 — main heading snap and no-focus advanced filter toggle.
   v30.9.121 — the food section is no longer an accordion (full width); the block turns
   the other way.
   v30.9.120 — no drawer: the recommender is the front of 🥢 食べる・飲む and turns over
   to the full list (一覧へ ＞ / おすすめへ ＞). Location is asked for only after a tap.
   v30.9.119 — cards show the live status again (もうすぐ営業 within 30 min, もうすぐ閉店
   within 1 h); a shop closed now shows its next opening, e.g. （月）10:00から.
   v30.9.118 — 現在時刻 uses real opening hours (open → closing soon → opening within
   the hour; closed shops left out); 時間帯指定 shows each shop's hours for that band; 料理種類 has one
   layer; card labels 朝食／台湾式居酒屋; whole card opens Maps.
   v30.9.117 — v30.9.115 features merged onto v30.9.116 (火鍋 naming, larger cuisine
   descriptor); restaurant kinds are also read from displayType, so editor exports need no extra tags.
   v30.9.115 — station search in the line menu; stacked 2-digit + letter station
   codes (e.g. 03/A); the cuisine panel spans the result row; unavailable choices move last.
   v30.9.114 — two-layer cuisine picker: 料理種類 filters, 台湾グルメ details only lift
   matching shops; choices with no shop for the current time and place are greyed out.
   v30.9.113 — data files revalidate with cache:'no-cache' (304 when unchanged) instead of no-store.
   v30.9.112 — recommendations use curated 2026-10-23 200-venue / 733-branch restaurant database.
   v30.9.96 — same-page location/station switching with custom readable line and station menus.
   v30.9.85: includes curated nearby venues for the existing GPS option.
   v30.9.82: rotating editorial pick, soft variety, distance bands (less fixed picks).
   v30.9.83: venues.json — coordinates for the 6 bars.
   v30.9.81: match every listed map link; night-market stalls use their market;
   bars and 熱炒 are recommended again. */
(() => {
  'use strict';
  const VERSION='30.9.131';
  const drawer = document.getElementById('taipei-recommender');
  if(!drawer)return;
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
  const activeFilters=document.getElementById('recommend-active-filters');
  const secondaryControls=document.getElementById('recommend-controls-secondary');
  const advanced=document.getElementById('recommend-advanced');
  const advancedTrigger=advanced.querySelector('summary');
  const body=document.body;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const TIME=[['current','現在時刻'],['morning','朝'],['lunch','昼'],['afternoon','午後'],['night','夜'],['late','深夜']];
  // 料理種類 (single choice) filters the shops.
  // Each entry: [key, label, data tags in nearby.json "industries"].
  const CATEGORIES=[
    ['taiwan','🥢 台湾グルメ',['小吃','麺類','ごはん系','餃子','小籠包・点心','台湾料理','熱炒','鍋','モーニング']],
    ['world','🌏 各国・創作料理',['各国・創作料理']],
    ['sweets','🍧 スイーツ・カフェ',['スイーツ','アイス','カフェ']],
    ['drink','🧋 ドリンク',['ドリンク']],
    ['bar','🍸 バー',['バー']]
  ];
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
    const rank=x=>x.timing?.rank||0;
    const better=(a,b)=>rank(a)!==rank(b)?rank(a)>rank(b):a.distanceMeters<b.distanceMeters;
    const best=new Map();
    for(const item of items){
      const key=nearbyBrandKey(item),old=best.get(key);
      if(!old||better(item,old))best.set(key,item);
    }
    // A guide coordinate and an award-imported coordinate may use different
    // brand keys even for the identical storefront. Deduplicate display names
    // once more before ranking, keeping the nearest known storefront.
    const unique=new Map();
    for(const item of best.values()){
      const key=normalizeNoteName(item.name),previous=unique.get(key);
      if(!previous||better(item,previous))unique.set(key,item);
    }
    return [...unique.values()];
  }
  const AREA_MATCH=[['nakayama',/赤峰|中山駅/],['dihua',/迪化|大稻埕/],['dongmen',/永康|東門/],['xinyi',/信義/],['taipei',/台北駅/],['ximen',/西門/],['gongguan',/公館/],['east',/東区/]];
  function taipeiNow(){return new Date();}
  function taipeiTimeLabel(){return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(taipeiNow());}
  function taipeiHour(){return Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).formatToParts(taipeiNow()).find(p=>p.type==='hour')?.value??12);}
  // Taipei time bands: 朝 05–10:59, 昼 11–13:59, 午後 14–16:59, 夜 17–22:59, 深夜 23–04:59.
  function defaultBand(){const h=taipeiHour();return h>=5&&h<11?'morning':h>=11&&h<14?'lunch':h>=14&&h<17?'afternoon':h>=17&&h<23?'night':'late';}
  const state={timeMode:'current',time:defaultBand(),areaMode:'current',area:'',line:'',stationCode:'',categories:[],sortMode:'recommend',page:0,locationStatus:'idle',geoRequested:false,position:null};
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
    const candidates=nearbyVenues.flatMap(v=>(v.branches||[]).map(b=>{
      const district=Object.keys(DISTRICTS).find(d=>(b.address||'').includes(d));
      return district&&Number.isFinite(b.lat)&&Number.isFinite(b.lng)?
        {district,distance:distanceMeters(point.lat,point.lng,b.lat,b.lng)}:null;
    })).filter(x=>x&&x.distance<=350).sort((a,b)=>a.distance-b.distance).slice(0,7);
    if(!candidates.length||candidates[0].distance>240)return null;
    const scores=new Map();
    for(const x of candidates)scores.set(x.district,(scores.get(x.district)||0)+1/Math.max(60,x.distance));
    const best=[...scores.entries()].sort((a,b)=>b[1]-a[1])[0];
    return best?DISTRICTS[best[0]]:null;
  }
  // Offline Taipei municipal outline, simplified from MOI county GIS
  // (ronnywang/twgeojson county 63000). Coordinates are [longitude,latitude].
  // Keep a tolerance for survey/GPS uncertainty at the city boundary.
  const TAIPEI_OUTLINE=[
    [121.56408,25.19818],[121.57224,25.19358],[121.58379,25.19452],
    [121.58333,25.17717],[121.57698,25.16714],[121.58986,25.16385],
    [121.58918,25.15235],[121.60812,25.13132],[121.59548,25.11395],
    [121.59734,25.10962],[121.6259,25.09668],[121.62801,25.08352],
    [121.6163,25.06395],[121.62334,25.05718],[121.61629,25.05081],
    [121.61917,25.04351],[121.64658,25.02792],[121.66588,25.02984],
    [121.6626,25.02294],[121.63177,25.02571],[121.62274,25.01716],
    [121.60438,25.01929],[121.59753,25.01459],[121.60004,24.97694],
    [121.61999,24.96945],[121.59868,24.96045],[121.57867,24.96664],
    [121.56048,24.96499],[121.55232,24.98685],[121.54537,24.98355],
    [121.53513,24.99502],[121.53177,24.99017],[121.53238,25.00776],
    [121.51903,25.01979],[121.50928,25.02137],[121.49555,25.00927],
    [121.49057,25.01098],[121.48367,25.03691],[121.50488,25.04965],
    [121.50574,25.0757],[121.48689,25.09835],[121.46431,25.10252],
    [121.45705,25.10922],[121.46397,25.1306],[121.48692,25.15081],
    [121.50264,25.17289],[121.52027,25.16993],[121.52603,25.18302],
    [121.54066,25.1872],[121.54486,25.19577],[121.55203,25.19725],
    [121.55489,25.20849],[121.56265,25.20946],[121.56408,25.19818]
  ];
  function inTaipeiCity(lat,lng,accuracy=0){
    if(lat<24.94||lat>25.23||lng<121.43||lng>121.69)return false;
    let inside=false;
    let borderMeters=Infinity;
    const x=lng*101000,y=lat*111200;
    for(let i=0,j=TAIPEI_OUTLINE.length-1;i<TAIPEI_OUTLINE.length;j=i++){
      const a=TAIPEI_OUTLINE[j],b=TAIPEI_OUTLINE[i];
      if((a[1]>lat)!==(b[1]>lat)&&lng<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      const ax=a[0]*101000,ay=a[1]*111200,bx=b[0]*101000,by=b[1]*111200;
      const dx=bx-ax,dy=by-ay;
      const t=Math.min(1,Math.max(0,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
      borderMeters=Math.min(borderMeters,Math.hypot(x-(ax+dx*t),y-(ay+dy*t)));
    }
    // Simplified map vertices may differ from the actual boundary by ~300m.
    // For close calls, prefer not to incorrectly call someone outside Taipei.
    return inside||borderMeters<=Math.max(450,Math.min(1000,accuracy||0));
  }
  function currentStation(){return metroStations.find(x=>x.code===state.stationCode&&x.line===state.line)||null;}
  function stationOrigin(){const x=currentStation();return x?{lat:x.lat,lng:x.lng}:null;}
  async function loadMetroStations(){
    try{
      const response=await fetch(`food/mrt_stations.json?v=${VERSION}`,{cache:'no-cache'});
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
  const coordinates=new Map(); // Deprecated directory coordinates deliberately unused.
  let nearbyVenues=[],nearbyReady=false,nearbyCatalog=null;
  let directoryVenues=[],directoryLoaded=false;
  // v30.9.95 — editorial descriptions: provenance lives in a separate static
  // file, and absent evidence never becomes a fabricated customer review.
  let reviewedNotes=new Map();
  async function loadReviewedNotes(){
    try{
      const response=await fetch(`food/recommend_notes.json?v=${VERSION}`,{cache:'no-cache'});
      if(!response.ok)throw new Error('notes unavailable');
      const data=await response.json();
      if(data.schemaVersion!==1||!Array.isArray(data.notes))throw new Error('notes invalid');
      reviewedNotes=new Map(data.notes.filter(row=>row&&typeof row.name==='string'&&typeof row.text==='string'&&row.text.trim())
        .map(row=>[normalizeNoteName(row.name),row.text.trim()]));
    }catch(_){reviewedNotes=new Map();}
    renderResults();
  }
  function normalizeNoteName(name){return String(name||'').normalize('NFKC').toLowerCase().replace(/[\s　・·．.（）()「」『』]/g,'').replace(/魯/g,'滷').replace(/豊/g,'豐');}
  // ⭐ おすすめリスト contributes annotations only. It never adds a venue.
  // Read the live HTML so changes to the editorial list do not require a
  // second hand-maintained list of tags in the recommendation database.
  const editorialNotes=new Map();
  // The former Notion dining list was removed in v30.9.122.
  // The JSON guideTags and awards remain the source of editorial labels.

  // The editor's curated database is the only recommendation source.
  // The older venues.json and webpage catalogue are not loaded for picking.
  const FEATURED=/おすすめ|ミシュラン|ビブグルマン|孤独のグルメ|超行列|行列店|一番人気|高人気|人気店|人気老舗/;
  const MICHELIN_FLOWER_SVG='<svg viewBox="0 0 18.96 20.63" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path fill="#594f41" d="M12.82 4.38c.1.09.72-.4.89-.48 1.77-.91 3.68-.55 4.72 1.2 1.32 2.23.01 4.29-2.13 5.22.49.32 1.06.55 1.51.92 2.9 2.4-.11 7.49-4.1 5.5l-.88-.55c.44 2.54-1.04 4.61-3.74 4.43-2.28-.16-3.37-2.34-2.99-4.43-.04-.04-.88.52-1.01.58-3.84 1.89-6.9-3.04-3.8-5.63.4-.34.88-.55 1.33-.81C.78 9.41-.51 8.02.19 5.82c.86-2.68 3.88-3.04 5.91-1.37-.98-5.85 7.64-6 6.73-.07ZM11.19 7.99l-.57-.32c.94-1.68 2.25-5.63-.34-6.46-.63-.2-1.17-.19-1.79.06-2.39.97-1.07 4.74-.18 6.4l-.57.32c-1-1.63-3.58-4.68-5.66-3.02-.95.76-1.33 2.19-.55 3.21 1.06 1.38 3.47 1.69 5.1 1.81v.58c-1.58.19-4.61.59-5.33 2.25-.47 1.06.07 2.46 1.07 3.01 2.1 1.15 4.34-1.62 5.37-3.15l.59.19c-.66 1.48-1.55 3.52-1.06 5.15.59 1.94 3.56 2.09 4.32.21.67-1.64-.28-3.85-.97-5.36l.59-.19c.99 1.48 3.11 4.06 5.14 3.29.76-.29 1.42-1.24 1.5-2.04.29-2.59-3.67-3.18-5.53-3.36v-.58c2.24.02 7.14-1.27 5.08-4.45-1.82-2.8-5.17.62-6.2 2.45Z"/></svg>';
  // v30.9.107 — The sole restaurant database is derived from the user's
  // carefully maintained editor backup; each chain keeps branch-specific data.
  async function loadNearbyVenues(){
    try{
      const response=await fetch(`food/nearby.json?v=${VERSION}`,{cache:'no-cache'});
      if(!response.ok)throw new Error('restaurant database unavailable');
      const data=await response.json();
      if(data.schemaVersion!==1||!Array.isArray(data.venues))throw new Error('restaurant schema invalid');
      nearbyVenues=data.venues.filter(r=>r&&typeof r.name==='string'&&Array.isArray(r.branches)&&r.branches.some(b=>
        Number.isFinite(b.lat)&&Number.isFinite(b.lng)&&b.lat>24.9&&b.lat<25.3&&b.lng>121.35&&b.lng<121.73));
      directoryVenues=data.venues.filter(r=>r&&typeof r.name==='string'&&r.name.trim()&&Array.isArray(r.branches));
      directoryLoaded=true;
      nearbyCatalog=null;nearbyReady=true;
    }catch(e){nearbyReady=false;nearbyVenues=[];nearbyCatalog=null;directoryVenues=[];directoryLoaded=false;}
    renderFoodDirectory();syncUI();renderResults();
  }
  const pickLevelOf=r=>{const v=Number(r?.pickLevel??r?.recommendLevel??r?.['推薦レベル']);return v>=2?2:v>=1?1:0;};
  let pickLevelsKnown=null;
  const hasPickLevels=()=>pickLevelsKnown??(pickLevelsKnown=nearbyVenues.some(r=>r&&(r.pickLevel!==undefined||r.recommendLevel!==undefined||r['推薦レベル']!==undefined)));
  function readNearbyCatalog(){
    if(nearbyCatalog)return nearbyCatalog;
    nearbyCatalog=nearbyVenues.map((r,index)=>({
      name:r.name,url:r.branches[0]?.mapUrl||'',sourceMapUrls:[],
      // 推薦レベル from the editor (1 精選, 2 必食). Until any shop carries it, shops whose
      // tags came from the former ⭐ おすすめリスト stay curated picks.
      pickLevel:pickLevelOf(r),
      guidePick:pickLevelOf(r)>0||(!hasPickLevels()&&!!r.guideTagSource)||editorialNotes.has(normalizeNoteName(r.name))||r.awards?.bibGourmand2026||!!r.awards?.highestBowls,
      guideTags:(r.guideTags?.length?r.guideTags:(editorialNotes.get(normalizeNoteName(r.name))?.tags||[]).map(text=>({text,tone:'editorial'}))),
      editorialPick:editorialNotes.has(normalizeNoteName(r.name)),
      category:r.category||'meal',details:'',
      industries:withKindTags(r),
      timeBands:r.timeBands||[],
      timeVerified:r.timeVerified||'',
      awardDish:r.awardDish||'',
      volume:r.volume||[],
      genre:r.industries||[],
      curated:0,featured:editorialNotes.has(normalizeNoteName(r.name)),
      chain:!!r.chain,brandId:r.chain?r.id:null,irregularHours:!!r.irregularHours,
      area:'',order:10000+index,branches:r.branches,
      nearbySource:true,locationConfidence:'high',
      address:r.branches[0]?.address||'',district:'',hours:'',
      awards:r.awards||{},specialty:'',
      displayType:r.displayType||'レストラン'
    }));
    return nearbyCatalog;
  }
  const normalize=t=>String(t||'').replace(/\s+/g,'').toLowerCase();
  function eligibleTime(item,time){
    const bands=item.timeBands||[];
    return bands.includes(time)||Array.isArray(item.branches)&&item.branches.some(b=>b.timeBands?.includes(time));
  }
  // The editor sets a restaurant's kind as its card label (displayType); read it
  // as a filter tag too, so a shop labelled 火鍋 or 広東料理 is found without
  // also having to add the matching industries tag by hand.
  const KIND_TAGS={火鍋:'鍋',鍋:'鍋',台湾料理:'台湾料理',創作台湾料理:'台湾料理','熱炒・海鮮':'熱炒',熱炒:'熱炒',台湾式居酒屋:'熱炒',
    朝食:'モーニング',モーニング:'モーニング',小吃:'小吃','屋台料理・軽食':'小吃',
    広東料理:'各国・創作料理',四川料理:'各国・創作料理',雲南料理:'各国・創作料理',江浙料理:'各国・創作料理',中華料理:'各国・創作料理',
    インド料理:'各国・創作料理',メキシコ料理:'各国・創作料理',創作料理:'各国・創作料理',関東煮:'各国・創作料理'};
  function withKindTags(r){
    const tags=Array.isArray(r.industries)?[...r.industries]:[];
    const extra=KIND_TAGS[r.displayType];
    if(extra&&!tags.includes(extra))tags.push(extra);
    return tags;
  }
  const tagsMatch=(item,tags)=>(item.industries||[]).some(tag=>tags.includes(tag));
  function categoryMatch(item,key){const def=CATEGORIES.find(([k])=>k===key);return !!def&&tagsMatch(item,def[2]);}
  function reason(item){return '';} // No 500碗 text in the recommendation UI.
  function michelinStars(item){
    const parts=[item?.awards?.michelin,item?.awards?.summary,item?.details,(item?.guideTags||[]).map(t=>t.text).join('、')].filter(Boolean).join(' ');
    if(/(?:米其林|ミシュラン).{0,3}(?:三つ星|三星|3星|★★★|\*\*\*)/.test(parts))return 3;
    if(/(?:米其林|ミシュラン).{0,3}(?:二つ星|二星|2星|★★|\*\*)/.test(parts))return 2;
    if(/(?:米其林|ミシュラン).{0,3}(?:一つ星|一星|1星|★|\*)/.test(parts))return 1;
    return 0;
  }
  // Match ⭐ おすすめリスト's actual venue-label classification rules from
  // js/guide.js. Source annotations contain text; their "editorial" fallback
  // alone does not indicate a gold/red style. Keep Michelin Bib tags gold.
  const GUIDE_HIGHLIGHT = /おすすめ|孤独のグルメ|ミシュラン|超行列|一番人気|高人気|ビブグルマン|人気老舗|人気店|行列店|エビ水餃|抹茶焼き氷|芝麻湯圓|鴨舌|水出し珈琲|目玉焼き魯肉飯/;
  const GUIDE_CAUTION = /八角なし|治安|注意|⚠|臭い/;
  function cardTagTone(tag,item){
    const value=String(tag?.text||'');
    if(tag?.tone==='veg')return 'veg';
    if(GUIDE_CAUTION.test(value)||tag?.tone==='caution')return 'caution';
    if(GUIDE_HIGHLIGHT.test(value)||tag?.tone==='featured'||tag?.tone==='editorial-pick'||
       (item?.name==='甜満'&&value==='人気急上昇中'))return 'featured';
    return 'neutral';
  }
  // Show observed store hours, not a forecast based on the selected meal band.
  // All calculations use actual Taipei local weekday/time, including overnight
  // intervals, split shifts and contiguous 24-hour schedules.
  const WEEKDAY_KEYS=['sun','mon','tue','wed','thu','fri','sat'];
  const CLOSE_SOON_MINUTES=60;
  function taipeiClock(at=new Date()){
    const parts=new Intl.DateTimeFormat('en-US',{
      timeZone:'Asia/Taipei',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(at);
    const out=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const index=WEEKDAY_KEYS.indexOf(String(out.weekday||'').toLowerCase().slice(0,3));
    return {dayIndex:index,minute:Number(out.hour)*60+Number(out.minute)};
  }
  function scheduleMinute(value){
    if(typeof value!=='string'||!/^\d{1,2}:\d{2}$/.test(value))return null;
    const [h,m]=value.split(':').map(Number);
    return h===24&&m===0?1440:h>=0&&h<24&&m>=0&&m<60?h*60+m:null;
  }
  // Merged opening intervals in minutes from today's 00:00 (Taipei), covering
  // yesterday (overnight hours) to the day after tomorrow (tomorrow's 深夜).
  // null = no registered weekly hours; a day listed as [] is a closed day.
  function branchIntervals(branch,clock){
    const days=branch?.days;
    if(!days||typeof days!=='object'||clock.dayIndex<0||!Number.isFinite(clock.minute))return null;
    const list=[];let knownDays=0;
    for(const offset of [-1,0,1,2]){
      const slots=days[WEEKDAY_KEYS[(clock.dayIndex+offset+7)%7]];
      if(!Array.isArray(slots))continue;
      knownDays++;
      for(const pair of slots){
        if(!Array.isArray(pair)||pair.length<2)continue;
        const from=scheduleMinute(pair[0]),to=scheduleMinute(pair[1]);
        // 00:00 to 24:00 is a full day; equal start/end is not assumed to be 24h.
        if(from===null||to===null||from===to)continue;
        list.push({start:offset*1440+from,end:offset*1440+(to<from?to+1440:to)});
      }
    }
    if(!knownDays)return null;
    list.sort((a,b)=>a.start-b.start);
    const merged=[];
    for(const x of list){const last=merged[merged.length-1];if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else merged.push({...x});}
    return merged;
  }
  const OPEN_SOON_MINUTES=30,BAND_MIN_OVERLAP=30;
  const BAND_WINDOWS={morning:[300,660],lunch:[660,840],afternoon:[840,1020],night:[1020,1380],late:[1380,1740]};
  // 現在時刻: live status of one storefront.
  function liveStatus(branch,item,clock){
    if(branch?.irregularHours||(!branch&&item.irregularHours))return {code:'irregular'};
    const intervals=branchIntervals(branch,clock);
    if(!intervals)return {code:'unknown'};
    const now=clock.minute;
    const current=intervals.find(x=>x.start<=now&&now<x.end);
    if(current)return {code:current.end-now<=CLOSE_SOON_MINUTES?'soon':'open'};
    const next=intervals.find(x=>x.start>now);
    if(next&&next.start-now<=OPEN_SOON_MINUTES)return {code:'opening',at:next.start};
    return {code:'closed'};
  }
  // 時間帯指定: the chosen band today, counted from now once it is under way;
  // with less than 30 minutes of it left (or over), tomorrow's band.
  function bandWindow(clock){
    const [start,end]=BAND_WINDOWS[state.time]||BAND_WINDOWS.lunch;
    const now=clock.minute,early=state.time==='late'&&now<300;
    const s=early?start-1440:start,e=early?end-1440:end;
    if(e-now>=BAND_MIN_OVERLAP)return {start:Math.max(s,now),end:e,tomorrow:false};
    return early?{start,end,tomorrow:false}:{start:start+1440,end:end+1440,tomorrow:true};
  }
  function bandHours(branch,item,clock,win){
    if(branch?.irregularHours||(!branch&&item.irregularHours))return {code:'irregular'};
    const intervals=branchIntervals(branch,clock);
    if(!intervals)return {code:'unknown'};
    const spans=intervals.filter(x=>Math.min(x.end,win.end)-Math.max(x.start,win.start)>=BAND_MIN_OVERLAP);
    return spans.length?{code:'hours',spans,tomorrow:win.tomorrow}:{code:'closed'};
  }
  const clockText=m=>{const v=((m%1440)+1440)%1440;return `${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}`;};
  const WEEKDAY_JA='日月火水木金土';
  // Next opening of a storefront: the opening that covers the chosen band when it
  // is tomorrow's, otherwise the next opening after now.
  function nextOpening(branch,item,clock,win){
    if(branch?.irregularHours||(!branch&&item.irregularHours))return {code:'irregular'};
    const intervals=branchIntervals(branch,clock);
    if(!intervals)return {code:'unknown'};
    const x=win?intervals.find(i=>Math.min(i.end,win.end)-Math.max(i.start,win.start)>=BAND_MIN_OVERLAP):intervals.find(i=>i.start>clock.minute);
    if(!x)return {code:'closed'};
    if(x.end-x.start>=1440)return {code:'open'};
    return {code:'next',at:x.start,day:(clock.dayIndex+Math.floor(x.start/1440)+7)%7};
  }
  // What a card says: the live status; with a chosen band, a shop that is not
  // open now shows when it opens next (tomorrow's band: its opening tomorrow).
  function cardTiming(item){
    const branch=item.nearestBranch||item.branches?.[0]||null,clock=taipeiClock();
    if(state.timeMode==='current')return liveStatus(branch,item,clock);
    const win=bandWindow(clock);
    if(win.tomorrow)return nextOpening(branch,item,clock,win);
    const live=liveStatus(branch,item,clock);
    return live.code==='closed'?nextOpening(branch,item,clock,null):live;
  }
  const OPENING_LABEL={open:'営業中',soon:'もうすぐ閉店',opening:'もうすぐ営業',closed:'営業時間外',irregular:'不定期営業',unknown:'営業時間未確認'};
  function timingLabel(t){
    if(t.code==='next')return `（${WEEKDAY_JA[t.day]}）${clockText(t.at)}から`;
    return OPENING_LABEL[t.code]||OPENING_LABEL.unknown;
  }
  function updateOpeningStatusNode(node,item){
    const t=cardTiming(item);
    node.className='recommend-opening-status recommend-opening-'+t.code;
    node.textContent=timingLabel(t);
    node.title=t.code==='unknown'?'店舗別の営業時間を確認できません':t.code==='irregular'?'不定期営業のため、訪問前に最新情報をご確認ください':
      t.code==='opening'?'30分以内に営業開始予定です（通常営業時間による目安）':t.code==='soon'?'1時間以内に閉店予定です（通常営業時間による目安）':
      t.code==='next'?'次の営業開始（通常営業時間による目安）':'登録された通常営業時間による目安です';
  }
  let visibleRecommendations=[];
  function refreshVisibleOpeningStatuses(){
    results.querySelectorAll('.recommend-opening-status').forEach(node=>{
      const item=visibleRecommendations[Number(node.dataset.resultIndex)];
      if(item)updateOpeningStatusNode(node,item);
    });
  }

  function cardTags(item){
    const omit=/^グルメ$/;
    const tags=item.pickLevel>=2?[{text:'おすすめ',tone:'featured'}]:[];
    // Import the labels from ⭐ おすすめリスト, not a redundant badge bearing
    // the section title itself.
    for(const tag of item.guideTags||[]){
      if(!tag?.text||omit.test(tag.text)||/(?:500\s*碗|五百碗)/i.test(tag.text))continue;
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
      state.categories.join(',')].join('|');
  }
  const MAIN_SHARE=.4;
  // Candidates for the current time rule and, with a location, within range.
  // Each shop is represented by its best storefront: the best timing rank
  // (open > closing within 1 h > opening within 30 min > hours unknown), then the nearest.
  function contextCandidates(){
    const origin=state.areaMode==='station'?stationOrigin():
      state.areaMode==='current'&&state.locationStatus==='success'?state.position:null;
    const useDistance=!!origin&&nearbyReady;
    // Nearby import must not contaminate non-GPS area browsing.
    const sourceItems=readNearbyCatalog();
    const clock=taipeiClock();
    const win=state.timeMode==='current'?null:bandWindow(clock);
    const judge=(branch,item)=>{
      const t=win?bandHours(branch,item,clock,win):liveStatus(branch,item,clock);
      // Without registered hours, fall back to the shop's time-band tags.
      const tagged=(t.code==='unknown'||t.code==='irregular')&&eligibleTime(item,state.time)&&
        (!branch?.timeBands?.length||branch.timeBands.includes(state.time));
      const rank=t.code==='open'?4:t.code==='soon'?3:t.code==='opening'||t.code==='hours'?2:tagged?1:0;
      return {...t,rank};
    };
    const timed=[];
    for(const item of sourceItems){
      const own=Array.isArray(item.branches)?item.branches:Number.isFinite(item.lat)?[item]:[];
      let best=null;
      for(const branch of own.length?own:[null]){
        let distance=null;
        if(useDistance){
          if(!branch||!Number.isFinite(branch.lat)||!Number.isFinite(branch.lng))continue;
          distance=distanceMeters(origin.lat,origin.lng,branch.lat,branch.lng);
          if(distance>GEO_MAX_METERS)continue;
        }
        const timing=judge(branch,item);
        if(!timing.rank)continue;
        if(!best||timing.rank>best.timing.rank||(timing.rank===best.timing.rank&&useDistance&&distance<best.distance))best={branch,timing,distance};
      }
      if(!best)continue;
      // Carry the exact selected storefront into Maps search and the status label.
      timed.push({...item,timing:best.timing,nearestBranch:Array.isArray(item.branches)?best.branch:null,
        ...(useDistance?{distanceMeters:best.distance,distanceToMarket:false,nearestMapUrl:Array.isArray(item.branches)?best.branch.mapUrl:null}:{})});
    }
    const withinRange=useDistance?closestPerBrand(timed):[];
    const byTime=useDistance?withinRange:timed;
    return {useDistance,withinRange,byTime};
  }
  function recommendedPool(){
    const {useDistance,withinRange,byTime}=contextCandidates();
    const nearbyFallback=false;
    const criteria=[];
    if(state.area)criteria.push({label:'エリア',weight:35,fn:item=>item.area===state.area});
    // The 料理種類 is a filter; the timing rank is the first ranking tier.
    const lifted=[];
    const pool=byTime.filter(item=>(!state.categories.length||state.categories.some(key=>categoryMatch(item,key)))&&criteria.every(c=>c.fn(item)));
    const seed=recommendationSeed();
    const newestAwardBonus=item=>{
      // Awards remain ranking signals, but 500碗 badges are intentionally hidden;
      // don't award double points to restaurants included in both lists.
      const years=String(item.awards?.bowls||'');
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
      const matchedGenreCount=item.timing?.rank||0;
      const score=matched.reduce((sum,c)=>sum+c.weight,0)
        +(item.guidePick?(item.chain?12:26):0)+(item.pickLevel>=2?(item.chain?8:16):0) // original food picks rank ahead; everyday chains get a smaller boost
        +(item.featured?1:0) // visibility comes from the rotating slot-1 rule below
        +(item.nearbySource?(item.locationConfidence==='high'?0:item.locationConfidence==='medium'?-3:-10):0)
        +(state.area&&state.areaMode==='all'&&item.chain?6:0) // not a proxy for branch proximity
        // Preserve distance-aware recommendations within the expanded 1,200m radius.
        // Places beyond 800m stay available, but fall behind closer candidates.
        +(Number.isFinite(item.distanceMeters)?40-12*Math.min(4,Math.floor(item.distanceMeters/270))
          -(item.distanceMeters>GEO_PRIORITY_METERS?26:0):0)
        +mealBonus(item)+newestAwardBonus(item);
      return {...item,matchScore:matchedGenreCount,matchedGenreCount,score,
        fullMatch:matched.length===criteria.length,
        matched:matched.map(c=>c.label),
        diversityKey:diversityKey(item,''),
        random:dailyNoise(item.name,seed)};
    });
    // Timing takes priority over distance, award badges and editorial bonuses:
    // open shops always precede those closing soon, then those opening soon.
    const maxCoverage=scored.reduce((max,p)=>Math.max(max,p.matchedGenreCount),0);
    const topCoverage=scored.filter(p=>p.matchedGenreCount===maxCoverage);
    const topScore=topCoverage.reduce((max,p)=>Math.max(max,p.score),-Infinity);
    const strong=topCoverage.filter(p=>p.score>=topScore-12);
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
      const remaining=scored.filter(p=>!used.has(p.name));
      const highestCoverage=Math.max(...remaining.map(p=>p.matchedGenreCount));
      const matchingTier=remaining.filter(p=>p.matchedGenreCount===highestCoverage);
      const bestTierScore=Math.max(...matchingTier.map(p=>p.score));
      const tier=matchingTier.filter(p=>p.score>=bestTierScore-12);
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
      // Shops not yet open (or with unknown hours) stay after those open now.
      const group=p=>(p.timing?.rank||0)>=(state.timeMode==='current'?3:2)?0:1;
      ordered.sort((a,b)=>(group(a)-group(b))||(a.distanceMeters-b.distanceMeters)||b.score-a.score||a.name.localeCompare(b.name,'ja'));
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
    return item.displayType||item.category||'';
  }
  // Card labels use the guide's wording, whichever spelling the editor export has.
  const CARD_LABEL={モーニング:'朝食',朝ごはん:'朝食','熱炒・海鮮':'台湾式居酒屋',熱炒:'台湾式居酒屋',小吃:'屋台料理・軽食',鍋:'火鍋'};
  function cardCuisine(item){
    if(item.displayType&&item.displayType!=='グルメ')return CARD_LABEL[item.displayType]||item.displayType;
    const parts=[item.name,item.details,(item.guideTags||[]).map(t=>t.text).join('、')].filter(Boolean).join(' ');
    if(/バー|ウイスキー|カクテル|酒場|酒吧/i.test(parts)||item.category==='bar')return 'バー';
    if(/咖啡|コーヒー|珈琲|喫茶|カフェ/i.test(parts)||item.category==='cafe')return 'カフェ';
    if(/豆花|かき氷|冰|甜點|甜品|スイーツ/i.test(parts)||item.category==='sweet')return 'スイーツ';
    if(/奶茶|茶|ドリンク|豆漿|ミルク|ジュース/i.test(parts)||item.category==='drink')return 'ドリンク';
    if(/小籠包|蒸餃|鍋貼|水餃|餃子|点心/i.test(parts)||item.category==='dumpling')return '小籠包・点心';
    if(/火鍋|鍋|麻辣/.test(parts)||item.category==='hotpot')return '火鍋';
    if(/牛肉麵|牛肉麺|麺線|麵線|麺|麵|米粉/.test(parts)||item.category==='noodle')return '麺類';
    if(/魯肉飯|滷肉飯|雞肉飯|鶏肉飯|排骨飯|炒飯|米糕|便當|弁当|ごはん|飯/.test(parts)||item.category==='rice'||item.category==='meal')return 'ごはん料理';
    if(item.category==='breakfast')return '朝食';
    if(item.market||item.category==='nightmarket')return '夜市';
    if(item.category==='izakaya')return '台湾式居酒屋';
    return '台湾料理';
  }
  const typeLabel={breakfast:'朝食',nightmarket:'夜市',dumpling:'小籠包・餃子',rice:'ごはん',noodle:'麺',hotpot:'火鍋',bar:'バー',drink:'ドリンク',sweet:'スイーツ',cafe:'カフェ',meal:'ごはん',izakaya:'台湾式居酒屋'};
  function el(tag,cls,txt){const node=document.createElement(tag);if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;return node;}
  const timeControls=[],areaControls=[],categoryControls=[];
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
  // Codes such as G03A / R22A show the number on top and the letter below.
  function fillStationCode(node,code){
    const number=String(code||'').replace(/^[A-Z]+/,'');
    const split=number.match(/^(\d+)([A-Z])$/);
    node.classList.toggle('has-suffix',!!split);
    if(!split){node.textContent=number;node.removeAttribute('aria-label');return;}
    node.replaceChildren(el('span','recommend-code-number',split[1]),el('span','recommend-code-suffix',split[2]));
    node.setAttribute('aria-label',number);
  }
  // Line menu: a search field (station name, English name or number) above the line list.
  const lineSearch=el('input','recommend-station-search-input');
  lineSearch.type='search';lineSearch.placeholder='駅名・駅番号で検索';
  lineSearch.setAttribute('aria-label','駅名または駅番号で検索（例：中山、R11）');
  lineSearch.autocomplete='off';lineSearch.spellcheck=false;lineSearch.enterKeyHint='search';
  const lineSearchWrap=el('label','recommend-station-search');
  lineSearchWrap.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/></svg>';
  lineSearchWrap.append(lineSearch);
  const lineList=el('div','recommend-native-list');
  lineList.setAttribute('role','listbox');lineList.setAttribute('aria-label','地下鉄の路線を選択');
  lineMenu.append(lineSearchWrap,lineList);
  // Japanese / simplified forms of characters used in station names, folded to the data's forms.
  const STATION_CHAR_FOLD={亜:'亞',内:'內',剣:'劍',区:'區',国:'國',囲:'圍',円:'圓',学:'學',徳:'德',楼:'樓',権:'權',渓:'溪',万:'萬',芦:'蘆',覧:'覽',医:'醫',関:'關',双:'雙',体:'體',竜:'龍',荘:'莊',回:'迴',産:'產',臺:'台',
    关:'關',龙:'龍',园:'園',圆:'圓',权:'權',览:'覽',门:'門',东:'東',车:'車',头:'頭',汇:'匯',宁:'寧',桥:'橋',机:'機',场:'場',电:'電',馆:'館',阳:'陽',纪:'紀',兴:'興',华:'華',凤:'鳳',麟:'麟'};
  const foldStationText=text=>[...String(text||'').normalize('NFKC').toLowerCase().replace(/空港/g,'機場')].map(ch=>STATION_CHAR_FOLD[ch]??ch).join('')
    .replace(/車站|駅|站|[\s・·．.\-－_()（）]/g,'');
  function searchStations(query){
    const q=foldStationText(query);
    if(!q)return [];
    const ranked=[];
    for(const item of metroStations){
      const code=item.code.toLowerCase(),name=foldStationText(item.name),en=foldStationText(item.en);
      const rank=code===q?0:code.startsWith(q)?1:name===q||en===q?2:name.startsWith(q)?3:en.startsWith(q)?4:name.includes(q)?5:en.includes(q)||code.includes(q)?6:-1;
      if(rank>=0)ranked.push([rank,item]);
    }
    const lineOrder=id=>metroLines.findIndex(x=>x.id===id);
    return ranked.sort((a,b)=>a[0]-b[0]||lineOrder(a[1].line)-lineOrder(b[1].line)||a[1].code.localeCompare(b[1].code,'en',{numeric:true}))
      .slice(0,30).map(x=>x[1]);
  }
  function chooseStation(item){
    state.line=item.line;state.stationCode=item.code;state.page=0;
    lineSearch.value='';
    renderStationOptions();buildMetroLineOptions();syncUI();renderResults();closeStationMenus();
  }
  function renderLineSearch(){
    if(!lineSearch.value.trim()){buildMetroLineOptions();return;}
    lineList.replaceChildren();
    const found=searchStations(lineSearch.value);
    if(!found.length){
      const empty=el('div','recommend-native-empty','該当する駅がありません');
      empty.append(el('small','','駅名（中国語・英語）または駅番号で検索できます'));
      lineList.append(empty);return;
    }
    for(const item of found){
      const color=(metroLines.find(x=>x.id===item.line)?.color)||'#4288c9';
      const button=el('button','recommend-native-option recommend-native-option-station recommend-station-result');button.type='button';
      button.dataset.value=item.code;button.dataset.line=item.line;button.setAttribute('role','option');
      button.setAttribute('aria-selected',String(state.line===item.line&&state.stationCode===item.code));
      const badge=el('span','recommend-native-option-code');badge.classList.add('is-station');fillStationCode(badge,item.code);
      badge.style.setProperty('--station-code-border',color);badge.style.borderColor=color;badge.style.backgroundColor='#ffffff';badge.style.color='#202227';
      const copy=el('span','recommend-native-option-copy');
      copy.append(el('strong','',item.name),el('small','',`${item.code} · ${item.en||'MRT Station'}`));
      button.append(badge,copy);
      button.addEventListener('click',()=>chooseStation(item));
      lineList.append(button);
    }
  }
  lineSearch.addEventListener('input',renderLineSearch);
  lineSearch.addEventListener('keydown',event=>{
    if(event.key==='Enter'){
      event.preventDefault();
      const first=lineSearch.value.trim()?searchStations(lineSearch.value)[0]:null;
      if(first)chooseStation(first);
    }else if(event.key==='Escape'){event.preventDefault();closeStationMenus();lineTrigger.focus({preventScroll:true});}
  });
  function buildMetroLineOptions(){
    lineList.replaceChildren();
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
      lineList.append(button);
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
      const badge=el('span','recommend-native-option-code');fillStationCode(badge,item.code);badge.classList.add('is-station');const itemLineColor=(metroLines.find(x=>x.id===item.line)?.color)||'#4288c9';badge.style.setProperty('--station-code-border',itemLineColor);badge.style.borderColor=itemLineColor;badge.style.backgroundColor='#ffffff';badge.style.color='#202227';
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
      if(open){if(lineSearch.value){lineSearch.value='';buildMetroLineOptions();}lineMenu.hidden=false;lineTrigger.setAttribute('aria-expanded','true');lineField.classList.add('is-picking','is-open');stationControls.dataset.active='line';}
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
  buildChoice(categoryControls,CATEGORIES,moods,'recommend-pill',value=>{
    // Several kinds can be combined; a shop matching any of them qualifies.
    state.categories=state.categories.includes(value)?state.categories.filter(key=>key!==value):[...state.categories,value];
    state.page=0;syncUI();renderResults();
  });
  function closeOptions(){timeOptions.hidden=true;timeButton.setAttribute('aria-expanded','false');}
  function toggleTimeOptions(){const open=timeOptions.hidden;closeOptions();advanced.open=false;if(open){timeOptions.hidden=false;timeButton.setAttribute('aria-expanded','true');}}
  timeButton.addEventListener('click',toggleTimeOptions);
  areaButton.addEventListener('click',()=>activateMode(state.areaMode==='station'?'current':'station'));
  title.addEventListener('click',()=>activateMode('current'));
  title.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activateMode('current');}});
  drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){closeOptions();closeStationMenus();advanced.open=false;}});
  // Do not steal the page position when a pointer opens the advanced filter.
  // Keep the native <details> toggle and keyboard focus for accessibility.
  // Pointerdown may otherwise focus <summary> before click (notably Safari).
  advancedTrigger.addEventListener('pointerdown',event=>{
    if(event.isPrimary&&event.cancelable)event.preventDefault();
  });
  advancedTrigger.addEventListener('click',event=>{
    if(event.detail>0&&document.activeElement===advancedTrigger)advancedTrigger.blur();
  });
  advanced.addEventListener('toggle',()=>{if(advanced.open)closeOptions();});
  // The open panel can grow wider than its row (more selected chips); keep it above the sort tabs.
  advanced.addEventListener('toggle',()=>{
    advanced.closest('.recommend-result-head')?.classList.toggle('is-advanced-open',advanced.open);
    placeAdvancedPanel();
  });
  // The panel spans the whole result row so choices sit side by side, however
  // narrow the row of selected conditions (its positioning parent) is.
  const advancedPanel=advanced.querySelector('.recommend-advanced-panel');
  function placeAdvancedPanel(){
    if(!advanced.open||!advancedPanel)return;
    const head=advanced.closest('.recommend-result-head'),host=advancedPanel.offsetParent;
    if(!head||!host)return;
    const row=head.getBoundingClientRect(),origin=host.getBoundingClientRect();
    advancedPanel.style.left=`${Math.round(row.left-origin.left)}px`;
    advancedPanel.style.right='auto';
    advancedPanel.style.width=`${Math.round(row.width)}px`;
    advancedPanel.style.maxWidth='none';
  }
  window.addEventListener('resize',placeAdvancedPanel,{passive:true});
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
    for(const [value,label] of CATEGORIES){
      if(state.categories.includes(value))selected.push({kind:'category',value,label});
    }
    for(const choice of selected){
      const chip=el('button','recommend-active-chip');chip.type='button';
      chip.setAttribute('aria-label',`${choice.label}の条件を解除`);
      chip.title=`${choice.label}を解除`;
      chip.append(el('span','recommend-active-chip-label',choice.label));
      const remove=el('span','recommend-active-chip-remove','×');remove.setAttribute('aria-hidden','true');chip.append(remove);
      chip.addEventListener('click',()=>{
        state.categories=state.categories.filter(key=>key!==choice.value);
        state.page=0;syncUI();renderResults();
      });
      activeFilters.append(chip);
    }
    const hasSelections=selected.length>0;
    secondaryControls.classList.toggle('recommend-has-selected',hasSelections);
    advancedTrigger.setAttribute('aria-label','さらに条件を指定');
    advancedTrigger.title='さらに条件を指定';
    placeAdvancedPanel();
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
    if(selectedStation)fillStationCode(stationCode,selectedStation.code);else{stationCode.classList.remove('has-suffix');stationCode.removeAttribute('aria-label');stationCode.textContent='--';}
    stationCode.style.setProperty('--station-code-border',selectedLine?.color||'#424049');
    stationCode.style.backgroundColor=selectedLine?'#ffffff':'';
    stationCode.style.borderColor=selectedLine?.color||'';
    stationCode.style.color=selectedLine?'#202227':'';
    stationCode.classList.toggle('is-empty',!selectedStation);
    for(const option of lineList.querySelectorAll('.recommend-native-option-line'))option.setAttribute('aria-selected',String(option.dataset.value===state.line));
    for(const option of stationMenu.querySelectorAll('.recommend-native-option'))option.setAttribute('aria-selected',String(option.dataset.value===state.stationCode));
    const district=nearbyDistrict(state.position);
    districtName.textContent=state.locationStatus==='outside'?'台北市外':district?`台北市 ${district[0]}`:state.locationStatus==='loading'?'測位中':'現在地';
    districtEn.textContent=state.locationStatus==='outside'?'Outside Taipei':district?`${district[1]} Taipei City`:state.locationStatus==='loading'?'Locating…':state.locationStatus==='success'?'地区名は未確認':state.locationStatus==='idle'?'タップして現在地を取得':'Location';
    currentLocation.title=state.locationStatus==='outside'?'現在地は台北市の対象エリア外です。':district?'登録店の所在地から推定した行政区です。境界付近では異なる場合があります。':'現在地の座標を使って推薦します。';
    for(const b of timeControls)b.setAttribute('aria-pressed',String(b.dataset.value===state.timeMode));
    for(const b of categoryControls)b.setAttribute('aria-pressed',String(state.categories.includes(b.dataset.value)));
    const messages={idle:'',loading:'現在地を確認しています…',unsupported:'位置情報に対応していません。通常のおすすめを表示します。',denied:'位置情報が許可されていません。通常のおすすめを表示します。',outside:'現在地は対象地域外です。通常のおすすめを表示します。',imprecise:'位置情報の精度が足りません。通常のおすすめを表示します。',error:'現在地を取得できませんでした。通常のおすすめを表示します。',success:(!nearbyReady)?'登録店の位置情報を読み込んでいます…':`現在地から直線${GEO_MAX_METERS}m以内・位置登録済み${nearbyVenues.reduce((n,v)=>n+v.branches.length,0)}店舗からご案内します。`};
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
  // v30.9.106: Maps navigation searches the business name, NOT its GPS
  // coordinates. For chains, use the closest branch's new/official name.
  // Only fall back to a verified place link when the branch is nameless/ambiguous.
  function mapsBrandName(item){
    const original=String(item.name||'').trim();
    if(/^(?:Louisa Coffee|路易莎)/i.test(original))return '路易莎咖啡';
    if(/^五桐號/i.test(original))return '五桐號';
    if(/^鼎泰豊/.test(original))return '鼎泰豐';
    return original;
  }
  function mapsBranchName(value){
    return String(value||'').trim().replace(/\s*[|｜]\s*(?:線上|线上|點選|点選|歡迎|立即).*$/u,'').trim();
  }
  function mapsIsSpecificBranch(name,brand){
    const branch=normalizeNoteName(name),root=normalizeNoteName(brand);
    if(brand==='路易莎咖啡'&&/^(?:louisa(?:\s*coffee)?|路易莎(?:咖啡)?)(?:\s+路易莎咖啡)?$/i.test(String(name).trim()))return false;
    if(brand==='50嵐'&&/^(?:50\s*lan|50嵐)$/i.test(String(name).trim()))return false;
    if(brand==='五桐號'&&/^(?:五桐[號号](?:\s*wootea)?)$/i.test(String(name).trim()))return false;
    if(brand==='八方雲集'&&/^(?:八方雲集(?:鍋貼水餃專賣店)?)$/.test(String(name).trim()))return false;
    return !!branch&&branch!==root&&!/^(?:分店\d+|本店|門市|直營店|分店)$/u.test(String(name).trim());
  }
  function recommendationMapsUrl(item){
    const branch=item.nearestBranch||item.branches?.[0]||null;
    // Preserve the exact location/Google Maps link from the editor when available.
    if(/^https:\/\/(?:www\.google\.com\/maps\/|maps\.app\.goo\.gl\/)/.test(branch?.mapUrl||''))return branch.mapUrl;
    // A branch can have the brand before or after its store designation.
    const brand=mapsBrandName(item);
    const branchName=mapsBranchName(branch?.name||branch?.label||branch?.storeName||'');
    const isChain=!!(item.brandId||item.chain||(Array.isArray(item.branches)&&item.branches.length>1)||CHAIN_BRANDS.some(([,pattern])=>pattern.test(item.name)));
    const known=null;
    const address=String(branch?.address||item.address||known?.address||'').trim();
    // A brand-only entry (e.g. unnamed "50嵐" branch) would make Google pick
    // another storefront. Keep the existing location-specific place URL instead.
    if(branch&&isChain&&!mapsIsSpecificBranch(branchName,brand)&&!address){
      return branch.mapUrl||item.nearestMapUrl||item.url||'';
    }
    let name=brand;
    if(branch&&isChain&&mapsIsSpecificBranch(branchName,brand)){
      const normalized=normalizeNoteName(branchName);
      const aliases=brand==='路易莎咖啡'?/路易莎|louisa/i:brand==='五桐號'?/五桐[號号]|wootea/i:brand==='50嵐'?/50\s*lan|50嵐/i:brand==='麥味登'?/[麥麦]味登/i:null;
      const includesBrand=normalized.includes(normalizeNoteName(brand))||(aliases&&aliases.test(branchName));
      name=includesBrand?branchName:`${brand} ${branchName}`;
    }
    if(!name)return item.nearestMapUrl||item.url||'';
    // Search by name only; use address solely for unnamed chain branches.
    const specific=branch&&mapsIsSpecificBranch(branchName,brand);
    const query=address&&isChain&&!specific?`${name} ${address}`:name;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

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
    geoRun++;state.areaMode='current';state.area='';
    const inside=inTaipeiCity(lat,lng,debugPosition.accuracy);
    state.position=inside?{...debugPosition}:null;
    state.locationStatus=inside?'success':'outside';state.page=0;
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
      }else if(!inTaipeiCity(latitude,longitude,accuracy)){
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
  function formatDistance(meters){return `${Math.max(10,Math.round(meters/10)*10)}m`;}
  function reportDebug(orderedCount){
    if(!debugEnabled)return;
    const target=document.getElementById('recommend-debug-diagnostics');
    if(!target)return;
    try{
      const rows=readNearbyCatalog();
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
餐廳資料：${nearbyReady?'已載入 '+nearbyVenues.length+' 品牌': '載入中'}
新資料品牌：${rows.length} 筆
有座標品牌：${positioned.length} 筆
${GEO_MAX_METERS}m 內：${near} 筆
符合時段：${eligible} 品牌
實際推薦：${orderedCount} 筆
定位狀態：${state.locationStatus}
選擇時段：${state.time}
模擬座標：${state.position?state.position.lat.toFixed(4)+', '+state.position.lng.toFixed(4):'尚未設定'}`;
    }catch(e){target.textContent='推薦診斷錯誤：'+e.message;}
  }
  function updateSortControls(){
    const origin=state.areaMode==='station'?stationOrigin():
      state.areaMode==='current'&&state.locationStatus==='success'?state.position:null;
    const distanceAvailable=!!origin&&nearbyReady;
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
  // A choice without any registered shop for the current time band and place
  // is greyed out; a selection that has just become impossible is cleared.
  const UNAVAILABLE_TITLE='この時間帯・場所に該当する登録店はありません';
  function refreshChoiceAvailability(){
    const buttons=categoryControls;
    if(!nearbyReady){for(const b of buttons){b.disabled=false;b.removeAttribute('title');}moods.append(...categoryControls);return;}
    const {byTime}=contextCandidates();
    let cleared=false;
    const apply=(b,available)=>{b.disabled=!available;if(available)b.removeAttribute('title');else b.title=UNAVAILABLE_TITLE;};
    for(const b of categoryControls){
      const available=byTime.some(item=>categoryMatch(item,b.dataset.value));
      apply(b,available);
      if(!available&&state.categories.includes(b.dataset.value)){state.categories=state.categories.filter(key=>key!==b.dataset.value);cleared=true;}
    }
    const lastWhenUnavailable=(holder,controls)=>{
      const wanted=[...controls.filter(b=>!b.disabled),...controls.filter(b=>b.disabled)];
      if(wanted.some((b,i)=>holder.children[i]!==b))holder.append(...wanted);
    };
    lastWhenUnavailable(moods,categoryControls);
    if(cleared){state.page=0;syncUI();}
  }
  function renderResults(){
    refreshChoiceAvailability();
    updateSortControls();
    if(state.areaMode==='station'&&(!currentStation()||!nearbyReady)){
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
      relaxed.textContent=timeCount===0?(state.timeMode==='current'?
        (useDistance?`いま営業中の登録店は、直線${GEO_MAX_METERS}m以内にありません。時間帯を指定するとご覧いただけます。`:'いま営業中の収録店はありません。時間帯を指定してご覧ください。'):
        (useDistance?`選択地点から直線${GEO_MAX_METERS}m以内に該当する登録店はありません。`:'この時間帯に合う収録店は、まだありません。時間帯を変更してご覧ください。')):'該当店が見つかりません。';
      results.append(el('p','recommend-no-data','おすすめ情報を準備中です。'));
      count.textContent='0軒';reportDebug(0);return;
    }
    const pages=Math.ceil(ordered.length/3);
    state.page=((state.page%pages)+pages)%pages;
    const slice=ordered.slice(state.page*3,state.page*3+3);
    visibleRecommendations=slice;
    count.textContent=`${slice.length}軒をピックアップ`;
    relaxed.hidden=!lifted.length&&!nearbyFallback;
    relaxed.textContent=lifted.length?`条件を少しゆるめました（${lifted.join('・')}）。時間帯は変更していません。`:'';
    if(useDistance&&nearbyFallback){
      locationStatus.textContent=`この時間帯は直線${GEO_MAX_METERS}m以内に位置データ登録済みの店がありません。`;
      locationStatus.hidden=false;
    }
    if(useDistance&&!nearbyFallback){
      locationStatus.textContent=`${state.areaMode==='station'?'選択駅':'現在地'}から直線${GEO_MAX_METERS}m以内の位置データ登録済み${nearbyCount}軒を検索中（位置登録済み${nearbyVenues.reduce((n,v)=>n+v.branches.length,0)}店舗）。`;
      locationStatus.hidden=false;
    }
    reportDebug(ordered.length);
    slice.forEach((item,resultIndex)=>{
      const card=el('article','recommend-card');
      const shell=el('div','recommend-card-shell');
      const main=el('div','recommend-card-main');
      const side=el('div','recommend-card-side');
      const cuisine=cardCuisine(item);
      if(cuisine)main.append(el('div','recommend-card-type',cuisine));
      const a=el('a','recommend-venue',item.name);a.href=recommendationMapsUrl(item);a.target='_blank';a.rel='noopener noreferrer';main.append(a);
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
      const opening=el('span','recommend-opening-status');
      opening.dataset.resultIndex=String(resultIndex);
      updateOpeningStatusNode(opening,item);
      side.append(opening);
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
      if(starsCount)side.append(starsWrap);
      const tags=cardTags(item);
      if(tags.length){
        const tagList=el('div','recommend-guide-tags');
        tagList.setAttribute('aria-label','ガイドの店情報（横方向にスクロールできます）');
        const tagTrack=el('div','recommend-tag-track');
        for(const tag of tags){
          const chip=el('span','recommend-guide-tag',tag.text);
          const tone=cardTagTone(tag,item);
          if(tone==='featured')chip.classList.add('recommend-guide-tag-featured');
          if(tone==='caution')chip.classList.add('recommend-guide-tag-caution');
          if(tone==='veg')chip.classList.add('recommend-guide-tag-veg');
          tagTrack.append(chip);
        }
        tagList.append(tagTrack);
        tagList.addEventListener('scroll',()=>updateTagFade(tagList),{passive:true});
        shell.append(tagList);
      }
      shell.prepend(main,side);
      card.append(shell);
      results.append(card);
    });
    requestAnimationFrame(()=>results.querySelectorAll('.recommend-guide-tags').forEach(updateTagFade));
    more.hidden=ordered.length<=3;
    disclaimer.textContent=`※ ${state.timeMode==='current'?'台北時刻 '+taipeiTimeLabel()+'。':''}距離は直線、営業状況は通常営業時間による目安です。`;
  }
  more.addEventListener('click',()=>{state.page++;renderResults();});
  // Update labels while the panel stays open; no repeated geolocation request.
  window.setInterval(refreshVisibleOpeningStatuses,60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshVisibleOpeningStatuses();});
  window.addEventListener('pageshow',refreshVisibleOpeningStatuses);
  syncUI();renderResults();loadMetroStations();loadNearbyVenues();
  // Safari often restores a previous page snapshot from the Back/Forward cache.
  // Recompute results from current DOM, without requesting location.
  window.addEventListener('pageshow',event=>{
    if(event.persisted){nearbyCatalog=null;syncUI();renderResults();if(!nearbyReady)loadNearbyVenues();}
  });
  // The recommender is part of the page. Location is requested only after the
  // visitor taps 現在地 (or the title), unless they have already allowed it.
  try{
    navigator.permissions?.query({name:'geolocation'}).then(permission=>{
      if(permission.state==='granted'&&state.areaMode==='current'&&!state.geoRequested)requestLocation();
    }).catch(()=>{});
  }catch(error){}
  currentLocation.setAttribute('role','button');currentLocation.tabIndex=0;
  currentLocation.setAttribute('aria-label','現在地からおすすめを探す');
  const askLocation=()=>{if(state.areaMode==='current'&&state.locationStatus!=='loading')activateMode('current');};
  currentLocation.addEventListener('click',askLocation);
  currentLocation.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();askLocation();}});
  // Open menus close when the visitor taps anywhere else on the page.
  document.addEventListener('click',event=>{
    if(drawer.contains(event.target))return;
    closeOptions();closeStationMenus();advanced.open=false;
  });
  // 現在時刻 follows the clock: a new time band, or coming back to the page,
  // refreshes the picks; in between only the opening labels update.
  const followClock=()=>{
    if(state.timeMode!=='current')return;
    const band=defaultBand();
    if(band!==state.time){state.time=band;state.page=0;syncUI();}
    renderResults();
  };
  window.setInterval(()=>{if(state.timeMode==='current'&&defaultBand()!==state.time)followClock();},60*1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)followClock();});


  // Independent 13-category directory on the back of the flip.
  // This classification follows each card's displayType/category, not the old HTML list.
  const DIRECTORY_TYPES=[
    ['breakfast','朝食'],['drink','ドリンク'],['cafe','カフェ・喫茶'],
    ['sweet','スイーツ・アイス'],['dumpling','小籠包・餃子'],['rice','ご飯もの'],
    ['noodle','麺類'],['hotpot','火鍋'],['snack','屋台料理・軽食'],
    ['izakaya','台湾式居酒屋'],['taiwan','台湾料理店'],
    ['world','各国・創作料理'],['bar','バー']
  ];
  const directoryRoot=document.getElementById('food-directory');
  const directoryTabs=document.getElementById('food-directory-tabs');
  const directoryPanel=document.getElementById('food-directory-panel');
  let directoryChoice='breakfast';
  function directoryKey(venue){
    const kind=String(venue.displayType||'');
    const broad=venue.category||'';
    if(broad==='breakfast'||/^(モーニング|朝食)$/.test(kind))return 'breakfast';
    if(broad==='drink'||kind==='ドリンク')return 'drink';
    if(broad==='cafe'||/^(カフェ|喫茶|カフェ・喫茶)$/.test(kind))return 'cafe';
    if(broad==='sweet'||/^(スイーツ|アイス|スイーツ・アイス)$/.test(kind))return 'sweet';
    if(broad==='dumpling'||/小籠包|点心|餃子/.test(kind))return 'dumpling';
    if(broad==='rice'||/ごはん|ご飯/.test(kind))return 'rice';
    if(broad==='noodle'||/麺|麵/.test(kind))return 'noodle';
    if(/火鍋|^鍋$/.test(kind)||broad==='hotpot')return 'hotpot';
    if(broad==='snack'||/屋台料理|軽食|^小吃$/.test(kind))return 'snack';
    if(/台湾料理|創作台湾料理/.test(kind))return 'taiwan';
    if(/熱炒|居酒屋/.test(kind)||venue.industries?.includes('熱炒'))return 'izakaya';
    if(broad==='bar'||kind==='バー')return 'bar';
    if(broad==='meal')return 'world';
    // Future editor kinds should still remain visible in a defined tab.
    return 'world';
  }
  function directoryIsChain(venue){
    // Some editor-managed chain brands have only one registered branch; their
    // チェーン店 tag is the source of truth for directory presentation, too.
    return !!(venue.chain||venue.branches.length>1||
      (Array.isArray(venue.guideTags)&&venue.guideTags.some(tag=>tag&&tag.text?.trim()==='チェーン店')));
  }
  function directoryMapUrl(venue){
    // Never send a chain to a particular branch; the visitor chooses the branch on Maps.
    if(directoryIsChain(venue)){
      return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(venue.name+' 台北');
    }
    return venue.branches[0]?.mapUrl||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(venue.name+' 台北');
  }
  function directoryNode(tag,className,text){
    const element=document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=String(text);
    return element;
  }
  function renderFoodDirectory(){
    if(!directoryRoot||!directoryTabs||!directoryPanel)return;
    if(!directoryLoaded){
      directoryPanel.replaceChildren(directoryNode('p','food-directory-message','店舗データを読み込めませんでした。ページを再読み込みしてください。'));
      directoryRoot.dataset.fadeBottom='false';
      return;
    }
    const buckets=new Map(DIRECTORY_TYPES.map(([key])=>[key,[]]));
    const seenIds=new Set();
    for(const venue of directoryVenues){
      // One brand per row and one primary tab, even if its cuisine tags overlap.
      const identity=venue.id||venue.name.normalize('NFKC').trim();
      if(seenIds.has(identity))continue;
      seenIds.add(identity);
      buckets.get(directoryKey(venue)).push(venue);
    }
    if(!buckets.has(directoryChoice))directoryChoice='breakfast';
    directoryTabs.replaceChildren(...DIRECTORY_TYPES.map(([key,label])=>{
      const button=directoryNode('button','food-directory-tab',label);
      button.type='button';button.dataset.directoryKey=key;
      button.id='food-directory-tab-'+key;
      button.setAttribute('role','tab');button.setAttribute('aria-controls','food-directory-panel');
      button.setAttribute('aria-selected',String(key===directoryChoice));
      button.tabIndex=key===directoryChoice?0:-1;
      button.addEventListener('click',()=>selectDirectoryTab(key));
      button.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();
        const index=DIRECTORY_TYPES.findIndex(([id])=>id===key);
        const next=e.key==='Home'?0:e.key==='End'?DIRECTORY_TYPES.length-1:
          (index+(e.key==='ArrowRight'?1:-1)+DIRECTORY_TYPES.length)%DIRECTORY_TYPES.length;
        selectDirectoryTab(DIRECTORY_TYPES[next][0],true);
      });
      return button;
    }));
    const activeTab=directoryTabs.querySelector('[aria-selected="true"]');
    directoryPanel.setAttribute('aria-labelledby',activeTab?.id||'');
    const rows=(buckets.get(directoryChoice)||[]).slice().sort((a,b)=>pickLevelOf(b)-pickLevelOf(a));
    const heading=directoryNode('div','food-directory-summary');
    heading.append(directoryNode('span','food-directory-summary-title',DIRECTORY_TYPES.find(([key])=>key===directoryChoice)?.[1]||''));
    heading.append(directoryNode('span','food-directory-summary-count',rows.length+' 店'));
    const list=directoryNode('ol','food-directory-list');
    rows.forEach((v,index)=>{
      const li=directoryNode('li','food-directory-row');
      li.append(directoryNode('span','food-directory-number',String(index+1).padStart(2,'0')));
      const body=directoryNode('div','food-directory-row-main');
      const top=directoryNode('div','food-directory-name-line');
      const anchor=directoryNode('a','food-directory-link',v.name);
      anchor.href=directoryMapUrl(v);anchor.target='_blank';anchor.rel='noopener noreferrer';
      top.append(anchor);
      const branchCount=v.branches.length;
      if(directoryIsChain(v))top.append(directoryNode('span','food-directory-branches','チェーン店'));
      body.append(top);
      const badges=directoryNode('div','food-directory-badges');
      // Purple cuisine badges are useful only in the dessert and dim-sum tabs.
      if(directoryChoice==='sweet'||directoryChoice==='dumpling'){
        badges.append(directoryNode('span','food-directory-kind',v.displayType||'レストラン'));
      }
      const tagKeys=new Set();
      if(pickLevelOf(v)>=2){tagKeys.add('おすすめ');badges.append(directoryNode('span','food-directory-tag food-directory-tag--featured','おすすめ'));}
      for(const tag of (Array.isArray(v.guideTags)?v.guideTags:[])){
        if(!tag||typeof tag.text!=='string'||!tag.text.trim())continue;
        const text=tag.text.trim();if(tagKeys.has(text))continue;
        // A chain has one dedicated label by the name, never a duplicate chip.
        if(text==='チェーン店')continue;
        // Hide undated auto-generated Bib Gourmand badges; retain a year or
        // user-maintained editorial tag from the original guide list.
        if(/ビブグルマン|必比登/i.test(text)&&!/(?:19|20)\d{2}/.test(text)&&!v.guideTagSource)continue;
        tagKeys.add(text);
        const tone=tag.tone==='featured'?'featured':tag.tone==='caution'?'caution':tag.tone==='veg'?'veg':'editorial';
        badges.append(directoryNode('span','food-directory-tag food-directory-tag--'+tone,text));
      }
      // Do not synthesize a second plain ビブグルマン badge from awards data.
      if(badges.childElementCount)body.append(badges);
      li.append(body);list.append(li);
    });
    directoryPanel.replaceChildren(heading,list);
    directoryPanel.scrollTop=0;
    requestAnimationFrame(updateDirectoryScrollFade);
  }
  function updateDirectoryScrollFade(){
    if(!directoryRoot||!directoryPanel)return;
    // One pixel of rounding tolerance prevents a flicker at the very bottom
    // of momentum scrolling on iOS Safari.
    directoryRoot.dataset.fadeBottom=String(
      directoryPanel.scrollHeight-directoryPanel.clientHeight-directoryPanel.scrollTop>2
    );
  }
  directoryPanel?.addEventListener('scroll',updateDirectoryScrollFade,{passive:true});
  window.addEventListener('resize',()=>requestAnimationFrame(updateDirectoryScrollFade),{passive:true});
  function selectDirectoryTab(key,focus){
    if(directoryChoice===key)return;
    directoryChoice=key;
    renderFoodDirectory();
    if(focus)directoryTabs.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});
  }

  // 独立したグルメ一覧: おすすめ (front) ⇄ 一覧 (back). The block always turns the
  // same way; 3D is used only while turning, then the page is laid out normally.
  const flip=document.getElementById('food-flip');
  if(flip){
    const inner=flip.querySelector('.food-flip-inner');
    const faces={front:flip.querySelector('.food-flip-front'),back:flip.querySelector('.food-flip-back')};
    let face='front',turning=false;
    const updateBackHeight=()=>{
      // Safari's VisualViewport reflects the actual unobscured window when
      // the bottom bar expands; the reverse-side fade stays above that bar.
      const vv=window.visualViewport;
      const viewBottom=vv?vv.offsetTop+vv.height:window.innerHeight;
      const top=flip.getBoundingClientRect().top;
      const available=Math.floor(viewBottom-top-64);
      const height=Math.max(280,Math.min(700,available));
      inner.style.setProperty('--food-back-height',height+'px');
      requestAnimationFrame(updateDirectoryScrollFade);
    };
    window.addEventListener('resize',()=>{if(face==='back')updateBackHeight();},{passive:true});
    window.visualViewport?.addEventListener('resize',()=>{if(face==='back')updateBackHeight();},{passive:true});
    const show=name=>{
      face=name;flip.dataset.face=name;
      for(const [key,node] of Object.entries(faces)){const hidden=key!==name;node.inert=hidden;node.setAttribute('aria-hidden',String(hidden));}
    };
    show('front');
    const settleTurn=(name,focus)=>{
      inner.classList.remove('is-turning','is-fading');show(name);turning=false;
      if(name==='front')closeOptions();
      if(name==='back')updateBackHeight();
      if(flip.getBoundingClientRect().top<0)flip.scrollIntoView({block:'start',behavior:reduceMotion.matches?'auto':'smooth'});
      if(focus)faces[name].querySelector('.food-flip-toggle')?.focus({preventScroll:true});
      // Let the list re-measure its scroll areas now that it is visible.
      window.dispatchEvent(new Event('resize'));
      requestAnimationFrame(updateDirectoryScrollFade);
    };
    function turnTo(name,{animate=true,focus=true}={}){
      if(turning||name===face)return;
      if(name==='back'){
        // Bring the new panel's header into the visible window before sizing
        // its independently scrolling directory. In particular, a flip button
        // close to the bottom of a short viewport must not put the fade below
        // the bottom browser bar.
        const top=flip.getBoundingClientRect().top;
        if(top<0||top>80)flip.scrollIntoView({block:'start',behavior:'auto'});
        updateBackHeight();
      }
      if(!animate){settleTurn(name,false);return;}
      turning=true;closeOptions();closeStationMenus();advanced.open=false;
      // iOS Safari: rotating the parent while simultaneously exposing both 3D
      // faces may leave a ghost of the front on the back (compositor bug).
      // Turn the outgoing face halfway *alone*, switch visibility, then turn
      // the incoming face in. The faces never paint on top of one another.
      if(reduceMotion.matches){settleTurn(name,focus);return;}
      const outgoing=faces[face],incoming=faces[name];
      const direction=name==='back'?1:-1;
      const duration=270;
      inner.classList.add('is-turning');
      const away=outgoing.animate([
        {transform:'rotateY(0deg)',opacity:1},
        {transform:`rotateY(${direction*90}deg)`,opacity:0}
      ],{duration,easing:'cubic-bezier(.42,0,.9,.72)',fill:'both'});
      away.onfinish=()=>{
        away.oncancel=null;away.cancel();
        show(name);
        const toward=incoming.animate([
          {transform:`rotateY(${-direction*90}deg)`,opacity:0},
          {transform:'rotateY(0deg)',opacity:1}
        ],{duration,easing:'cubic-bezier(.16,.64,.25,1)',fill:'both'});
        toward.onfinish=()=>{toward.oncancel=null;toward.cancel();settleTurn(name,focus);};
        toward.oncancel=()=>{if(turning)settleTurn(name,focus);};
      };
      away.oncancel=()=>{if(turning)settleTurn(name,focus);};
    }
    flip.querySelectorAll('.food-flip-toggle').forEach(button=>button.addEventListener('click',()=>turnTo(button.dataset.to)));
    // Links to an item of the list (#…) open the list side directly.
    const revealTarget=()=>{
      const id=decodeURIComponent(location.hash.slice(1));
      const target=id&&document.getElementById(id);
      if(target&&faces.back.contains(target))turnTo('back',{animate:false,focus:false});
    };
    window.addEventListener('hashchange',revealTarget);
    revealTarget();
  }
})();
