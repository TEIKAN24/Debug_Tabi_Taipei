/* v30.9.213 — Top page intro.
   The wordmark settles (TAIPEI CITY GUIDE fades out, TABI / TAIPEI shrinks and
   the guide label slides out to its right), the golden horizon sinks, and a
   greeting for the current time of day fades in line by line.

   Greetings: one per time slot per day (the day turns at 05:00, so a late
   night stays one night), chosen at random; a greeting is not shown again in
   the same slot for at least three days. Characters used here must exist in
   assets/fonts/tabi-greeting-serif.woff2 (kana and punctuation are all in it;
   a NEW kanji needs the font subset regenerated, otherwise that one character
   falls back to the system Mincho). */
(function(){
  'use strict';
  const hero=document.getElementById('top');
  const greet=document.getElementById('hero-greeting');
  if(!hero||!greet)return;

  const GREETINGS={
    dawn:[ // 05:00–07:29
      ['おはよう。','街は、まだ少し静か。'],
      ['おはよう。','朝ごはん屋は、もう開いてるよ。'],
      ['おはよう。','朝の空気が、気持ちいい。'],
      ['おはよう。','今日は、街よりひと足早く。']
    ],
    morning:[ // 07:30–10:59
      ['おはよう。','朝ごはん、もう食べた？'],
      ['おはよう。','蛋餅にする？それとも飯糰？'],
      ['おはよう。','通りには、もうバイクの列。'],
      ['おはよう。','さて、何から食べようか。']
    ],
    noon:[ // 11:00–12:59
      ['こんにちは。','今日はどこを歩く？'],
      ['こんにちは。','お腹がすいたら、路地の奥へ。'],
      ['こんにちは。','行列のできてる店、気になるね。'],
      ['こんにちは。','お昼は、魯肉飯でいこうか。']
    ],
    afternoon:[ // 13:00–16:59
      ['こんにちは。','そろそろ、タピオカでひと休み。'],
      ['こんにちは。','夕立がきたら、カフェで雨宿り。'],
      ['こんにちは。','少し遠回りしてみよう。'],
      ['こんにちは。','豆花は、いかが？'],
      ['こんにちは。','夕暮れまで、もうひと歩き。']
    ],
    evening:[ // 17:00–22:29
      ['こんばんは。','街に灯りがともるころ。'],
      ['こんばんは。','夜市は、これからが本番。'],
      ['こんばんは。','夕飯は、屋台をはしごで。'],
      ['こんばんは。','夜風が気持ちいいね。']
    ],
    night:[ // 22:30–02:29
      ['おやすみ。','今日は、よく歩いたね。'],
      ['おやすみ。','今日の寄り道は、ここまで。'],
      ['おやすみ。','続きは、また明日。'],
      ['おやすみ。','また、朝の台北で。'],
      ['おやすみ。','コンビニの夜食は、ほどほどにね。']
    ],
    awake:[ // 02:30–04:59 (one line each)
      ['まだ寝たくないの？'],
      ['まだ起きているの？'],
      ['zzz...']
    ]
  };
  /* Time slots by minutes after midnight: [slot, start, end). The afternoon runs
     to 17:00 so that 16:30–17:00 is covered. */
  const SLOTS=[
    ['awake',150,300],['dawn',300,450],['morning',450,660],['noon',660,780],
    ['afternoon',780,1020],['evening',1020,1350]
  ]; // anything else (22:30–02:29) is night
  const STORE_KEY='tabi-hero-greeting-v2';
  const NO_REPEAT_DAYS=3;     // a greeting shown on a day is not shown again in that slot for the next 2 days
  const DAY_TURN_HOUR=5;      // 02:30–04:59 still belongs to the previous day
  const GREET_AT=1250;        // ms after the intro starts
  const LINE_GAP=600;         // ms between the starts of consecutive lines
  const FONT_WAIT=1800;       // never hold the greeting longer than this for the font
  const FONT_FAMILY='Tabi Greeting Serif';

  function slotFor(now){
    const m=now.getHours()*60+now.getMinutes();
    for(const [name,start,end] of SLOTS)if(m>=start&&m<end)return name;
    return'night';
  }
  function roundDate(now){return new Date(now.getTime()-DAY_TURN_HOUR*3600000);}
  function dayKey(now){
    const d=roundDate(now);
    return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  }
  function dayNumber(now){
    const d=roundDate(now);
    return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  }

  function choose(slot,count,now){
    const today=dayNumber(now);
    let store;
    try{
      const raw=localStorage.getItem(STORE_KEY);
      try{store=JSON.parse(raw)||{};}catch(e){store={};}
      if(typeof store!=='object'||Array.isArray(store))store={};
    }catch(e){
      // No storage (private mode etc.): a daily rotation never repeats within three days.
      return (today+Object.keys(GREETINGS).indexOf(slot))%count;
    }
    // History per slot: [{d:day number, p:pick}], newest first. Counted in
    // calendar days, so a visitor away for a week is not restricted.
    const hist=(store[slot]&&Array.isArray(store[slot].h)?store[slot].h:[])
      .filter(e=>e&&Number.isInteger(e.d)&&Number.isInteger(e.p)&&e.p>=0&&e.p<count&&e.d<=today&&today-e.d<NO_REPEAT_DAYS);
    const todays=hist.find(e=>e.d===today);
    if(todays)return todays.p;
    const blocked=hist.map(e=>e.p);
    let pool=[];
    for(let i=0;i<count;i++)if(!blocked.includes(i))pool.push(i);
    if(!pool.length)for(let i=0;i<count;i++)if(i!==blocked[0])pool.push(i);
    const pick=pool[Math.floor(Math.random()*pool.length)];
    store[slot]={h:[{d:today,p:pick}].concat(hist)};
    try{localStorage.setItem(STORE_KEY,JSON.stringify(store));}catch(e){}
    return pick;
  }

  const now=new Date();
  const slot=slotFor(now);
  const set=GREETINGS[slot];
  const lines=set[choose(slot,set.length,now)];

  greet.textContent='';
  const lineEls=lines.map((text,i)=>{
    const el=document.createElement('span');
    el.className='hero-greeting-line';
    el.textContent=text;
    const chars=Array.from(text).length;
    el.style.setProperty('--line-dur',Math.round(Math.min(1500,Math.max(850,520+chars*55)))+'ms');
    el.dataset.line=String(i);
    greet.appendChild(el);
    return el;
  });

  /* The longest line must stay on one line: shrink the greeting uniformly if needed. */
  function fit(){
    greet.style.removeProperty('--greet-fit');
    const room=greet.clientWidth;
    let scale=1;
    lineEls.forEach(el=>{
      const need=el.getBoundingClientRect().width+(parseFloat(getComputedStyle(el).marginLeft)||0);
      if(room>0&&need>room+.5)scale=Math.min(scale,room/need);
    });
    if(scale<1)greet.style.setProperty('--greet-fit',(Math.floor(scale*1000)/1000).toFixed(3));
  }
  let fitTimer=0;
  window.addEventListener('resize',()=>{clearTimeout(fitTimer);fitTimer=setTimeout(fit,120);},{passive:true});

  function fontReady(limit){
    if(!document.fonts||!document.fonts.load)return Promise.resolve();
    const text=lines.join('');
    const load=document.fonts.load('400 20px "'+FONT_FAMILY+'"',text).catch(()=>{});
    return Promise.race([load,new Promise(r=>setTimeout(r,limit))]);
  }

  function finishStatic(){
    hero.classList.add('hero--static','hero--settled','hero--greeting','hero--done');
    fit();
    fontReady(3000).then(fit);
  }

  function play(){
    const t0=performance.now();
    hero.classList.add('hero--intro');
    // Two frames: the starting layout is painted before anything moves.
    requestAnimationFrame(()=>requestAnimationFrame(()=>hero.classList.add('hero--settled')));
    fontReady(FONT_WAIT).then(()=>{
      fit();
      const base=Math.max(0,GREET_AT-(performance.now()-t0));
      let end=0;
      lineEls.forEach((el,i)=>{
        const delay=base+i*LINE_GAP;
        el.style.setProperty('--line-delay',Math.round(delay)+'ms');
        end=Math.max(end,delay+parseInt(el.style.getPropertyValue('--line-dur'),10));
      });
      hero.classList.add('hero--greeting');
      setTimeout(()=>hero.classList.add('hero--done'),end+120);
    });
  }

  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||document.documentElement.classList.contains('hero-intro-skip')){finishStatic();return;}
  if(document.visibilityState==='hidden'){
    // Opened in a background tab: keep the opening frame until it is actually seen.
    const onVisible=()=>{
      if(document.visibilityState!=='visible')return;
      document.removeEventListener('visibilitychange',onVisible);
      play();
    };
    document.addEventListener('visibilitychange',onVisible);
  }else{
    play();
  }
})();
