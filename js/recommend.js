/* TAIPEI CITY GUIDE v30.9.56 — mirrored no-keyword dining recommender. */
(() => {
  'use strict';
  const drawer = document.getElementById('taipei-recommender');
  if (!drawer) return;
  const backdrop = document.querySelector('.recommend-drawer-backdrop');
  const fields = document.getElementById('recommend-fields');
  const results = document.getElementById('recommend-results');
  const count = document.getElementById('recommend-count');
  const relaxed = document.getElementById('recommend-relaxed');
  const disclaimer = document.getElementById('recommend-disclaimer');
  const closeButton = drawer.querySelector('.recommend-close');
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TIME = [['morning','朝'],['lunch','昼'],['night','夜'],['late','深夜']];
  const MOODS = [['local','台湾らしいもの'],['sweet','甘いもの'],['light','軽く'],['hearty','がっつり']];
  const AREAS = [
    ['nakayama','中山駅・赤峰街'],['dihua','迪化街・大稻埕'],
    ['dongmen','東門駅・永康街'],['xinyi','信義・台北101'],
    ['taipei','台北駅'],['ximen','西門駅・西門町'],
    ['gongguan','公館駅'],['east','東区・忠孝復興']
  ];
  const AVOID = [['queue','並びたくない'],['cash','現金だけは困る'],['japanese','日本語メニューがほしい']];
  const AREA_MATCH = [
    ['nakayama', /赤峰|中山駅/],['dihua',/迪化|大稻埕/],
    ['dongmen',/永康|東門/],['xinyi',/信義/],
    ['taipei',/台北駅/],['ximen',/西門/],
    ['gongguan',/公館/],['east',/東区/]
  ];
  function taipeiHour() {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    return Number(parts.find(part=>part.type==='hour')?.value ?? 12);
  }
  function defaultBand() {const h=taipeiHour();return h>=5&&h<11?'morning':h>=11&&h<17?'lunch':h>=17&&h<23?'night':'late';}
  const state = {time:defaultBand(),area:'',mood:'',avoid:new Set(),customTime:false};
  const normalize = text => String(text||'').replace(/\s+/g,'').toLowerCase();
  const categoryOf = (tab,group) => {
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
  const panelLabel = panel => {
    if (!panel) return '';
    return document.getElementById(panel.getAttribute('aria-labelledby')||'')?.textContent.trim() || '';
  };
  let catalog = null;
  function readCatalog() {
    if(catalog) return catalog;
    // Read the website's existing curated directories after guide.js has constructed venue rows.
    const foodRoot = document.querySelector('#guide details.venue-directory-section:not(.area-directory-section)');
    const areaRoot = document.querySelector('#guide details.area-directory-section');
    const found = new Map();
    function read(root,isArea) {
      if(!root)return;
      root.querySelectorAll('li.venue-row').forEach(li=>{
        const a = li.querySelector('a.venue-main-link[href]');
        if(!a || !/^https:\/\/(?:maps\.app\.goo\.gl|www\.google\.com\/maps)/.test(a.href))return;
        const panel=li.closest('.tab-panel');
        const tab=panelLabel(panel);
        const group=li.closest('details.nested-accordion')?.querySelector(':scope > summary')?.textContent.trim() || '';
        // Area directory also lists shops and sightseeing spots. Recommend dining only.
        if(isArea && !/グルメ|カフェ|スイーツ/.test(group))return;
        const name=a.textContent.trim();
        if(!name)return;
        const tags=[...li.querySelectorAll('.venue-tag')].map(el=>el.textContent.trim()).filter(Boolean);
        const notes=li.querySelector('.venue-extra-note')?.textContent.trim()||'';
        const info=[...tags,notes].join('、');
        const key=normalize(name);
        const area=isArea?(AREA_MATCH.find(([code,rx])=>rx.test(tab))?.[0]||''):'';
        const cat=isArea?categoryOf('',group):categoryOf(tab,group);
        const score=(/おすすめ|地元人気|一番人気|人気|ビブグルマン|ミシュラン|孤独のグルメ/.test(info)?2:0)
          + (li.querySelector('.venue-tag--featured')?3:0) + (/定番/.test(info)?1:0);
        const queue=/行列|超行列/.test(info);
        const japanese=/日本語メニュー/.test(info);
        const record={name,url:a.href,area,category:cat,details:info,curated:score,queue,japanese,order:found.size};
        const existing=found.get(key);
        if(!existing){found.set(key,record);return;}
        // The area listing carries a more precise geographical association.
        if(isArea){existing.area=area;existing.url=a.href;}
        existing.curated=Math.max(existing.curated,score);
        existing.queue||=queue;
        existing.japanese||=japanese;
        existing.details=[...new Set([existing.details,info].filter(Boolean))].join('、').slice(0,135);
      });
    }
    read(foodRoot,false);
    read(areaRoot,true);
    catalog=[...found.values()];
    return catalog;
  }
  function eligibleTime(item,time) {
    const c=item.category, s=item.details;
    if(time==='morning')return c==='breakfast' || (c==='cafe' && !/夜カフェ/.test(s));
    if(time==='lunch')return !['breakfast','nightmarket','bar','izakaya'].includes(c);
    if(time==='night')return !['breakfast'].includes(c);
    // Only plausible late-night options; never present these as confirmed opening hours.
    return ['bar','izakaya'].includes(c) || /24h|24時間|深夜まで|夜カフェ/.test(s);
  }
  function moodMatch(item,mood) {
    const c=item.category, s=item.name+' '+item.details;
    if(mood==='sweet')return ['sweet','drink','cafe'].includes(c) || /豆花|粉圓|かき氷|スイーツ|甘味/.test(s);
    if(mood==='light')return ['drink','sweet','cafe','dumpling','nightmarket'].includes(c) || /小吃|軽食|おにぎり/.test(s);
    if(mood==='hearty')return ['rice','noodle','hotpot','meal','izakaya'].includes(c);
    if(mood==='local')return ['breakfast','nightmarket','dumpling','rice','noodle','hotpot','meal'].includes(c) || /台湾|ローカル|伝統/.test(s);
    return true;
  }
  function reason(item) {
    const c=item.category;
    let lead=({breakfast:'台湾の朝ごはんを気軽に',nightmarket:'夜市ならではの屋台グルメ',dumpling:'小籠包・餃子を楽しめる',rice:'台湾のごはん料理',noodle:'食べごたえのある麺料理',hotpot:'みんなで楽しむ台湾鍋',izakaya:'台湾式の熱炒・おつまみ',bar:'夜に立ち寄りたいバー',sweet:'台湾スイーツでひと休み',drink:'台湾のドリンクを楽しむ',cafe:'街歩き途中のカフェ',meal:'街歩きと一緒に楽しむごはん'})[c]||'台湾の一軒';
    if(item.area&&state.area===item.area)lead='選んだエリアで見つけた'+(c==='sweet'?'スイーツ':c==='cafe'?'カフェ':c==='drink'?'ドリンク':'お店');
    const detail=item.details.split('、').find(t=>/おすすめ|名物|人気|レトロ|地元|伝統|豆花|かき氷|小籠包|八角なし|水出し/.test(t) && t.length<18);
    return detail ? `${lead}。${detail.replace(/[（）]/g,'')}が特徴。`:`${lead}。地図で場所をチェック。`;
  }
  function pickRecommendations() {
    const byTime=readCatalog().filter(item=>eligibleTime(item,state.time));
    let pool=byTime;
    const lifted=[];
    if(state.area)pool=pool.filter(item=>item.area===state.area);
    if(state.mood)pool=pool.filter(item=>moodMatch(item,state.mood));
    if(state.avoid.has('queue'))pool=pool.filter(item=>!item.queue);
    if(state.avoid.has('japanese'))pool=pool.filter(item=>item.japanese);
    // Relax in reverse order without ever relaxing the current time band.
    if(!pool.length && state.avoid.has('japanese')){pool=byTime.filter(item=>(!state.area||item.area===state.area)&&(!state.mood||moodMatch(item,state.mood))&&(!state.avoid.has('queue')||!item.queue));lifted.push('日本語メニュー');}
    if(!pool.length && state.avoid.has('queue')){pool=byTime.filter(item=>(!state.area||item.area===state.area)&&(!state.mood||moodMatch(item,state.mood)));lifted.push('行列');}
    if(!pool.length && state.mood){pool=byTime.filter(item=>!state.area||item.area===state.area);lifted.push('気分');}
    if(!pool.length && state.area){pool=byTime;lifted.push('エリア');}
    // No false opening-hours promise and no empty result even when data coverage is thin.
    const timeBonus=item => state.time==='night' && item.category==='nightmarket'?21:
      state.time==='morning' && item.category==='breakfast'?16:
      state.time==='lunch' && ['rice','noodle','dumpling'].includes(item.category)?6:
      state.time==='late' && /24h|24時間|深夜まで/.test(item.details)?12:0;
    const score = item => item.curated*8 + timeBonus(item) + (state.area && item.area===state.area?16:0)
      + (state.mood && moodMatch(item,state.mood)?7:0)
      + (state.avoid.has('japanese') && item.japanese?8:0)
      - (state.avoid.has('queue') && item.queue?10:0);
    const ordered=[...pool].sort((a,b)=>score(b)-score(a)||a.order-b.order);
    const chosen=[];
    for(const item of ordered){
      if(chosen.length>=3)break;
      // Favor a little variety without sacrificing specific location matching.
      if(chosen.some(p=>p.category===item.category)&&ordered.some(p=>!chosen.includes(p)&&!chosen.some(c=>c.category===p.category)))continue;
      chosen.push(item);
    }
    for(const item of ordered){if(chosen.length>=3)break;if(!chosen.includes(item))chosen.push(item);}
    return {items:chosen,lifted};
  }
  function el(tag, cls, txt) {const node=document.createElement(tag);if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;return node;}
  const pillGroups=[];
  function group(label,id,choices,help) {
    const section=el('section','recommend-group');
    const heading=el('h3','recommend-group-heading',label);section.append(heading);
    const choicesEl=el('div','recommend-choices');choicesEl.setAttribute('role','group');choicesEl.setAttribute('aria-label',label);
    choices.forEach(([value,text])=>{
      const btn=el('button','recommend-pill',text);btn.type='button';btn.dataset.group=id;btn.dataset.value=value;
      btn.setAttribute('aria-pressed','false');btn.addEventListener('click',()=>{
        if(id==='avoid')state.avoid.has(value)?state.avoid.delete(value):state.avoid.add(value);
        else if(id==='time'){state.time=value;state.customTime=true;}
        else state[id]=state[id]===value?'':value;
        syncPills();renderResults();
      });choicesEl.append(btn);
    });
    section.append(choicesEl);if(help)section.append(el('p','recommend-help',help));fields.append(section);
    pillGroups.push(choicesEl);
  }
  group('01 いまの時間帯','time',TIME,'台北の現在時刻で自動選択。お店の営業確認ではありません。');
  group('02 エリア・最寄り駅','area',AREAS,'場所がわからない場合は選ばずに進めます。');
  group('03 今の気分','mood',MOODS,'選ばなくても大丈夫。');
  group('04 避けたい条件（任意）','avoid',AVOID,'支払い方法・日本語メニューの情報は一部のみ。確認できない場合はその旨を表示します。');
  function syncPills() {
    for(const group of pillGroups)for(const b of group.querySelectorAll('button')){
      const id=b.dataset.group,val=b.dataset.value;
      const on=id==='avoid'?state.avoid.has(val):state[id]===val;
      b.setAttribute('aria-pressed',String(on));
    }
  }
  function renderResults() {
    const {items,lifted}=pickRecommendations();
    results.replaceChildren();
    count.textContent=`${items.length}軒`;
    const notices=[];
    if(lifted.length)notices.push(`条件を少しゆるめました（${lifted.join('・')}）。時間帯はそのままです。`);
    if(state.avoid.has('cash'))notices.push('カード決済を確認できる情報がないため、支払い方法は来店前にご確認ください。');
    if(state.avoid.has('japanese') && lifted.includes('日本語メニュー'))notices.push('日本語メニューの確認済み店舗が足りないため、未確認のお店も表示しています。');
    if(state.avoid.has('queue'))notices.push('行列店の表示を避けていますが、実際の混雑は変動します。');
    relaxed.hidden=!notices.length;relaxed.textContent=notices.join(' ');
    if(!items.length){ // Defensive guard for a broken or empty source list; do not fabricate venues.
      results.append(el('p','recommend-no-data','店舗リストを読み込めませんでした。ページを再読み込みしてください。'));
    }
    items.forEach((item,i)=>{
      const card=el('article','recommend-card');
      const top=el('div','recommend-card-top');
      top.append(el('span','recommend-rank',String(i+1).padStart(2,'0')));
      top.append(el('span','recommend-category',({breakfast:'朝食',nightmarket:'夜市',dumpling:'小籠包・餃子',rice:'ごはん',noodle:'麺',hotpot:'鍋',bar:'バー',drink:'ドリンク',sweet:'スイーツ',cafe:'カフェ',meal:'ごはん',izakaya:'熱炒'})[item.category]||'ローカル'));
      if(item.curated>0)top.append(el('span','recommend-featured','おすすめ'));
      card.append(top);
      const a=el('a','recommend-venue',item.name);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);
      card.append(el('p','recommend-reason',reason(item)));
      const links=el('div','recommend-card-footer');
      if(item.area){const place=AREAS.find(([code])=>code===item.area);if(place)links.append(el('span','recommend-place','📍 '+place[1]));}
      const map=el('a','recommend-map','Google マップ ↗');map.href=item.url;map.target='_blank';map.rel='noopener noreferrer';links.append(map);card.append(links);results.append(card);
    });
    disclaimer.textContent='※ 時間帯は料理ジャンルの目安で、現在営業中とは限りません。営業時間・混雑・支払い方法は Google マップや店舗で確認してください。';
  }
  syncPills();renderResults();
  let isOpen=false, dragging=null, raf=0, queuedProgress=0, progress=0, lastFocus=null, lockedY=0, savedStyle=null, suppressedUntil=0;
  const panelWidth=()=>Math.min(innerWidth,480);
  const clamp=v=>Math.max(0,Math.min(1,v));
  function commit(){raf=0;progress=clamp(queuedProgress);body.style.setProperty('--recommend-offset',`${((progress-1)*panelWidth()).toFixed(2)}px`);body.style.setProperty('--recommend-progress',progress.toFixed(4));body.style.setProperty('--recommend-shift',`${(26*progress).toFixed(2)}px`);body.style.setProperty('--recommend-scale',(1-.015*progress).toFixed(4));body.style.setProperty('--recommend-brightness',(1-.12*progress).toFixed(4));}
  function draw(p,immediate=false){queuedProgress=clamp(p);if(immediate){cancelAnimationFrame(raf);commit();}else if(!raf)raf=requestAnimationFrame(commit);}
  function lock(){if(savedStyle)return;lastFocus=document.activeElement;lockedY=scrollY;savedStyle={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow};body.style.position='fixed';body.style.top=`-${lockedY}px`;body.style.width='100%';body.style.overflow='hidden';}
  function unlock(){if(!savedStyle)return;Object.assign(body.style,savedStyle);savedStyle=null;window.scrollTo({top:lockedY,behavior:'instant'});}
  function settle(open){
    isOpen=open;
    if(open){
      lock();
      if(!state.customTime){state.time=defaultBand();syncPills();renderResults();}
      drawer.inert=false;drawer.setAttribute('aria-hidden','false');
      body.classList.add('recommend-drawer-open','recommend-swipe-active');
      draw(1,true);drawer.focus({preventScroll:true});
    }else{
      body.classList.remove('recommend-drawer-open');drawer.setAttribute('aria-hidden','true');
      if(drawer.contains(document.activeElement))document.activeElement.blur();
      draw(0,true);unlock();
      if(lastFocus?.isConnected&&lastFocus!==body)lastFocus.focus({preventScroll:true});
      window.setTimeout(()=>{if(!isOpen&&!dragging){body.classList.remove('recommend-swipe-active');drawer.inert=true;}},reduceMotion.matches?0:350);
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
      drawer.inert=false;drawer.setAttribute('aria-hidden','false');
    }
    if(event?.cancelable)event.preventDefault();
    const t=performance.now(),dt=Math.max(1,t-g.t);
    g.velocity=.7*g.velocity+.3*(x-g.px)/dt;g.px=x;g.t=t;
    draw(g.start+dx/panelWidth(),true);
  }
  function finish(){
    if(!dragging)return;
    const g=dragging;dragging=null;if(!g.activated)return;
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
