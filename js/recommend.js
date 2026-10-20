/* TAIPEI CITY GUIDE v30.9.57 — instant local picks, no questionnaire. */
(() => {
  'use strict';
  const drawer = document.getElementById('taipei-recommender');
  if(!drawer)return;
  const backdrop=document.querySelector('.recommend-drawer-backdrop');
  const results=document.getElementById('recommend-results');
  const count=document.getElementById('recommend-count');
  const relaxed=document.getElementById('recommend-relaxed');
  const disclaimer=document.getElementById('recommend-disclaimer');
  const more=document.getElementById('recommend-more');
  const closeButton=drawer.querySelector('.recommend-close');
  const timeButton=document.getElementById('recommend-time-trigger');
  const timeLabel=document.getElementById('recommend-time-label');
  const timeOptions=document.getElementById('recommend-time-options');
  const areaButton=document.getElementById('recommend-area-trigger');
  const areaLabel=document.getElementById('recommend-area-label');
  const areaOptions=document.getElementById('recommend-area-options');
  const locationStatus=document.getElementById('recommend-location-status');
  const moods=document.getElementById('recommend-mood-options');
  const avoids=document.getElementById('recommend-avoid-options');
  const avoidCount=document.getElementById('recommend-advanced-count');
  const body=document.body;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const TIME=[['current','現時刻'],['morning','朝'],['lunch','昼'],['night','夜'],['late','深夜']];
  const MOODS=[['local','🇹🇼 台湾らしく'],['sweet','🍧 甘いもの'],['light','🥟 軽く'],['hearty','🍜 がっつり']];
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
  const AVOID=[['queue','並びたくない'],['cash','現金だけは困る'],['japanese','日本語メニューがほしい']];
  const AREA_MATCH=[['nakayama',/赤峰|中山駅/],['dihua',/迪化|大稻埕/],['dongmen',/永康|東門/],['xinyi',/信義/],['taipei',/台北駅/],['ximen',/西門/],['gongguan',/公館/],['east',/東区/]];
  function taipeiNow(){return new Date();}
  function taipeiTimeLabel(){return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(taipeiNow());}
  function taipeiHour(){return Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).formatToParts(taipeiNow()).find(p=>p.type==='hour')?.value??12);}
  function defaultBand(){const h=taipeiHour();return h>=5&&h<11?'morning':h>=11&&h<17?'lunch':h>=17&&h<23?'night':'late';}
  const state={timeMode:'current',time:defaultBand(),areaMode:'current',area:'',mood:'',avoid:new Set(),page:0,locationStatus:'idle',locationName:'',geoRequested:false};
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
    return 'meal';
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
      root.querySelectorAll('li.venue-row').forEach(li=>{
        const a=li.querySelector('a.venue-main-link[href]');
        if(!a||!/^https:\/\/(?:maps\.app\.goo\.gl|www\.google\.com\/maps)/.test(a.href))return;
        const tab=panelLabel(li.closest('.tab-panel'));
        const group=li.closest('details.nested-accordion')?.querySelector(':scope > summary')?.textContent.trim()||'';
        if(isArea&&!/グルメ|カフェ|スイーツ/.test(group))return;
        const name=a.textContent.trim();if(!name)return;
        const tags=[...li.querySelectorAll('.venue-tag')].map(n=>n.textContent.trim()).filter(Boolean);
        const notes=li.querySelector('.venue-extra-note')?.textContent.trim()||'';
        const info=[...tags,notes].join('、');
        const key=normalize(name);
        const area=isArea?(AREA_MATCH.find(([code,rx])=>rx.test(tab))?.[0]||''):'';
        const category=isArea?categoryOf('',group):categoryOf(tab,group);
        const curated=(/おすすめ|地元人気|一番人気|人気|ビブグルマン|ミシュラン|孤独のグルメ/.test(info)?2:0)
          +(li.querySelector('.venue-tag--featured')?3:0)+(/定番/.test(info)?1:0);
        const record={name,url:a.href,area,category,details:info,curated,queue:/行列|超行列/.test(info),japanese:/日本語メニュー/.test(info),order:found.size};
        const existing=found.get(key);
        if(!existing){found.set(key,record);return;}
        if(isArea){existing.area=area;existing.url=a.href;}
        existing.curated=Math.max(existing.curated,curated);
        existing.queue||=record.queue;existing.japanese||=record.japanese;
        existing.details=[...new Set([existing.details,info].filter(Boolean))].join('、').slice(0,135);
      });
    }
    read(foodRoot,false);read(areaRoot,true);
    catalog=[...found.values()];return catalog;
  }
  function eligibleTime(item,time){
    const c=item.category,s=item.details;
    if(time==='morning')return c==='breakfast'||(c==='cafe'&&!/夜カフェ/.test(s));
    if(time==='lunch')return !['breakfast','nightmarket','bar','izakaya'].includes(c);
    if(time==='night')return c!=='breakfast';
    return ['bar','izakaya'].includes(c)||/24h|24時間|深夜まで|夜カフェ/.test(s);
  }
  function moodMatch(item,mood){
    const c=item.category,s=item.name+' '+item.details;
    if(mood==='sweet')return ['sweet','drink','cafe'].includes(c)||/豆花|粉圓|かき氷|スイーツ|甘味/.test(s);
    if(mood==='light')return ['drink','sweet','cafe','dumpling','nightmarket'].includes(c)||/小吃|軽食|おにぎり/.test(s);
    if(mood==='hearty')return ['rice','noodle','hotpot','meal','izakaya'].includes(c);
    if(mood==='local')return ['breakfast','nightmarket','dumpling','rice','noodle','hotpot','meal'].includes(c)||/台湾|ローカル|伝統/.test(s);
    return true;
  }
  function reason(item){
    const c=item.category;
    let lead=({breakfast:'台湾の朝ごはんを気軽に',nightmarket:'夜市ならではの屋台グルメ',dumpling:'小籠包・餃子を楽しめる',rice:'台湾のごはん料理',noodle:'食べごたえのある麺料理',hotpot:'台湾鍋を楽しめる',izakaya:'台湾式の熱炒・おつまみ',bar:'夜に立ち寄りたいバー',sweet:'台湾スイーツでひと休み',drink:'台湾のドリンクを楽しむ',cafe:'街歩き途中のカフェ',meal:'街歩きと一緒に楽しむごはん'})[c]||'台湾で立ち寄りたい一軒';
    if(item.area&&state.area===item.area)lead='選んだエリアで楽しむ'+(c==='sweet'?'スイーツ':c==='cafe'?'カフェ':c==='drink'?'ドリンク':'一軒');
    const detail=item.details.split('、').find(t=>/おすすめ|名物|人気|レトロ|地元|伝統|豆花|かき氷|小籠包|八角なし|水出し/.test(t)&&t.length<18);
    return detail?`${lead}。${detail.replace(/[（）]/g,'')}が特徴。`:`${lead}。`;
  }
  function recommendedPool(){
    const byTime=readCatalog().filter(item=>eligibleTime(item,state.time));
    const steps=[];
    if(state.area)steps.push({label:'エリア',fn:item=>item.area===state.area});
    if(state.mood)steps.push({label:'気分',fn:item=>moodMatch(item,state.mood)});
    if(state.avoid.has('queue'))steps.push({label:'行列',fn:item=>!item.queue});
    if(state.avoid.has('japanese'))steps.push({label:'日本語メニュー',fn:item=>item.japanese});
    let active=[...steps];
    let pool=byTime.filter(item=>active.every(step=>step.fn(item)));
    const lifted=[];
    // Prefer 3 matches. Relax filters in reverse order, never the time band.
    while(pool.length<Math.min(3,byTime.length)&&active.length){
      const last=active.pop();lifted.push(last.label);
      pool=byTime.filter(item=>active.every(step=>step.fn(item)));
    }
    const bonus=item=>state.time==='night'&&item.category==='nightmarket'?21:
      state.time==='morning'&&item.category==='breakfast'?16:
      state.time==='lunch'&&['rice','noodle','dumpling'].includes(item.category)?6:
      state.time==='late'&&/24h|24時間|深夜まで/.test(item.details)?12:0;
    const score=item=>item.curated*8+bonus(item)+(state.area&&item.area===state.area?16:0)
      +(state.mood&&moodMatch(item,state.mood)?7:0)+(state.avoid.has('japanese')&&item.japanese?8:0)
      -(state.avoid.has('queue')&&item.queue?10:0);
    const ranked=pool.sort((a,b)=>score(b)-score(a)||a.order-b.order);
    // Put distinct genres at the front, then remaining venues. Each venue appears once.
    const ordered=[],pending=[...ranked];
    while(pending.length){
      const currentCategories=new Set(ordered.slice(-2).map(item=>item.category));
      const idx=pending.findIndex(item=>!currentCategories.has(item.category));
      ordered.push(pending.splice(idx<0?0:idx,1)[0]);
    }
    return {ordered,lifted,timeCount:byTime.length};
  }
  const typeLabel={breakfast:'朝食',nightmarket:'夜市',dumpling:'小籠包・餃子',rice:'ごはん',noodle:'麺',hotpot:'鍋',bar:'バー',drink:'ドリンク',sweet:'スイーツ',cafe:'カフェ',meal:'ごはん',izakaya:'熱炒'};
  function el(tag,cls,txt){const node=document.createElement(tag);if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;return node;}
  const timeControls=[],areaControls=[],moodControls=[],avoidControls=[];
  function buildChoice(group,items,holder,cls,callback){
    for(const [value,label] of items){
      const b=el('button',cls,label);b.type='button';b.dataset.value=value;b.setAttribute('aria-pressed','false');
      b.addEventListener('click',()=>callback(value));holder.append(b);group.push(b);
    }
  }
  buildChoice(timeControls,TIME,timeOptions,'recommend-option',value=>{
    state.timeMode=value;state.time=value==='current'?defaultBand():value;state.page=0;syncUI();renderResults();closeOptions();
  });
  buildChoice(areaControls,[['current','現在地'],['all','エリア指定なし'],...AREAS.map(([id,label])=>[id,label])],areaOptions,'recommend-option',value=>{
    state.areaMode=value;state.page=0;
    if(value==='current'){state.area='';state.locationStatus='loading';state.locationName='';requestLocation(true);}
    else {state.area=value==='all'?'':value;state.locationStatus='idle';}
    syncUI();renderResults();closeOptions();
  });
  buildChoice(moodControls,MOODS,moods,'recommend-pill',value=>{
    state.mood=state.mood===value?'':value;state.page=0;syncUI();renderResults();
  });
  buildChoice(avoidControls,AVOID,avoids,'recommend-pill',value=>{
    state.avoid.has(value)?state.avoid.delete(value):state.avoid.add(value);
    state.page=0;syncUI();renderResults();
  });
  function closeOptions(){for(const [b,options] of [[timeButton,timeOptions],[areaButton,areaOptions]]){options.hidden=true;b.setAttribute('aria-expanded','false');}}
  function toggleOptions(button,options){const shouldOpen=options.hidden;closeOptions();if(shouldOpen){options.hidden=false;button.setAttribute('aria-expanded','true');}}
  timeButton.addEventListener('click',()=>toggleOptions(timeButton,timeOptions));
  areaButton.addEventListener('click',()=>toggleOptions(areaButton,areaOptions));
  drawer.addEventListener('click',e=>{if(!e.target.closest('.recommend-control-wrap'))closeOptions();});
  function syncUI(){
    const timeName=TIME.find(([value])=>value===state.time)?.[1]||'昼';
    timeLabel.textContent=state.timeMode==='current'?`現時刻 · ${timeName}`:timeName;
    areaLabel.textContent=state.areaMode==='current'?'現在地':state.areaMode==='all'?'エリア指定なし':AREAS.find(([id])=>id===state.areaMode)?.[1]||'エリアを選ぶ';
    for(const b of timeControls)b.setAttribute('aria-pressed',String(b.dataset.value===state.timeMode));
    for(const b of areaControls)b.setAttribute('aria-pressed',String(b.dataset.value===state.areaMode));
    for(const b of moodControls)b.setAttribute('aria-pressed',String(b.dataset.value===state.mood));
    for(const b of avoidControls)b.setAttribute('aria-pressed',String(state.avoid.has(b.dataset.value)));
    avoidCount.textContent=state.avoid.size?`${state.avoid.size}件選択中`:'';
    const messages={idle:'',loading:'現在地を確認しています…',unsupported:'このブラウザでは位置情報を取得できません。エリア指定なしでご案内します。',denied:'位置情報を利用できません。エリア指定なしでご案内します。',outside:'現在地は収録エリア外です。エリア指定なしでご案内します。',imprecise:'位置情報の精度が足りません。エリア指定なしでご案内します。',error:'位置情報を取得できませんでした。エリア指定なしでご案内します。',success:`現在地付近：${state.locationName}（周辺エリアの目安）`};
    locationStatus.textContent=state.areaMode==='current'?messages[state.locationStatus]||'': '';
    locationStatus.hidden=!locationStatus.textContent;
  }
  // The Geolocation API requires HTTPS and explicit browser permission.
  // No coordinates are stored, sent to any service, or persisted.
  const rad=n=>n*Math.PI/180;
  function distanceMeters(lat1,lng1,lat2,lng2){const dLat=rad(lat2-lat1),dLng=rad(lng2-lng1);const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(a)));}
  let geoRun=0;
  function requestLocation(force=false){
    if(state.areaMode!=='current')return;
    if(!navigator.geolocation||!window.isSecureContext){state.area='';state.locationStatus='unsupported';syncUI();renderResults();return;}
    if(!force&&state.geoRequested)return;
    state.geoRequested=true;
    const request=++geoRun;
    state.locationStatus='loading';state.area='';syncUI();renderResults();
    navigator.geolocation.getCurrentPosition(pos=>{
      if(request!==geoRun||state.areaMode!=='current')return;
      const {latitude,longitude,accuracy}=pos.coords;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||accuracy>2500){
        state.area='';state.locationStatus='imprecise';
      }else{
        const nearest=AREAS.map(([id,label,lat,lng])=>({id,label,dist:distanceMeters(latitude,longitude,lat,lng)})).sort((a,b)=>a.dist-b.dist)[0];
        if(nearest&&nearest.dist<=2200){state.area=nearest.id;state.locationName=nearest.label;state.locationStatus='success';}
        else {state.area='';state.locationStatus='outside';}
      }
      state.page=0;syncUI();renderResults();
    },err=>{
      if(request!==geoRun||state.areaMode!=='current')return;
      state.area='';state.locationStatus=err.code===1?'denied':'error';state.page=0;syncUI();renderResults();
    },{enableHighAccuracy:false,timeout:9500,maximumAge:300000});
  }
  function refreshContextOnOpen(){
    if(state.timeMode==='current'){state.time=defaultBand();state.page=0;}
    syncUI();renderResults();
    if(state.areaMode==='current')requestLocation(true);
  }
  function renderResults(){
    const {ordered,lifted,timeCount}=recommendedPool();
    results.replaceChildren();
    if(!ordered.length){
      more.hidden=true;
      relaxed.hidden=false;
      relaxed.textContent=timeCount===0?'この時間帯に合う収録店は、まだありません。時間帯を変更してご覧ください。':'該当店が見つかりません。';
      results.append(el('p','recommend-no-data','おすすめ情報を準備中です。'));
      count.textContent='0軒';return;
    }
    const pages=Math.ceil(ordered.length/3);
    state.page=((state.page%pages)+pages)%pages;
    const slice=ordered.slice(state.page*3,state.page*3+3);
    count.textContent=`${slice.length}軒をピックアップ`;
    const notices=[];
    if(lifted.length)notices.push(`条件を少しゆるめました（${lifted.join('・')}）。時間帯は変更していません。`);
    if(state.avoid.has('cash'))notices.push('カード決済の確認済み情報がないため、この条件では絞り込めません。来店前にご確認ください。');
    if(state.avoid.has('japanese')&&lifted.includes('日本語メニュー'))notices.push('日本語メニューの確認済み店舗が足りないため、未確認店も含みます。');
    if(state.avoid.has('queue'))notices.push('行列の有無は時間帯で変わります。');
    relaxed.hidden=!notices.length;relaxed.textContent=notices.join(' ');
    slice.forEach((item,i)=>{
      const card=el('article','recommend-card');
      if(i===0&&state.page===0)card.classList.add('recommend-card-primary');
      const top=el('div','recommend-card-top');
      top.append(el('span','recommend-rank',String(state.page*3+i+1).padStart(2,'0')));
      top.append(el('span','recommend-category',typeLabel[item.category]||'ローカル'));
      if(item.curated>0)top.append(el('span','recommend-featured','おすすめ'));
      card.append(top);
      const a=el('a','recommend-venue',item.name);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);
      card.append(el('p','recommend-reason',reason(item)));
      const links=el('div','recommend-card-footer');
      if(item.area){const place=AREAS.find(([code])=>code===item.area);if(place)links.append(el('span','recommend-place','⌖ '+place[1]));}
      const map=el('a','recommend-map','地図を見る ↗');map.href=item.url;map.target='_blank';map.rel='noopener noreferrer';links.append(map);card.append(links);
      results.append(card);
    });
    more.hidden=ordered.length<=3;
    disclaimer.textContent=`※ ${state.timeMode==='current'?'台北時刻 '+taipeiTimeLabel()+'。':''}時間帯は料理ジャンルの目安です。現在営業中とは限りません。営業時間・混雑・支払い方法は訪問前にご確認ください。`;
  }
  more.addEventListener('click',()=>{state.page++;renderResults();});
  syncUI();renderResults();
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
    if(meta)meta.setAttribute('content',active?(document.documentElement.dataset.theme==='light'?'#F7F8F7':'#14191C'):(document.documentElement.dataset.theme==='light'?'#F7F8F7':'#111417'));
  }
  function settle(open){
    isOpen=open;
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
  closeButton.addEventListener('click',()=>settle(false));
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
    const focusable=[...drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(n=>n.getClientRects().length);
    const first=focusable[0],last=focusable[focusable.length-1];if(!first||!last)return;
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    else if(!drawer.contains(document.activeElement)){e.preventDefault();first.focus();}
  });
  window.addEventListener('resize',()=>draw(isOpen?1:0,true),{passive:true});
  window.addEventListener('blur',()=>{if(dragging)finish();});
  drawer.inert=true;draw(0,true);
})();
