/* v30.9.213 — Top page intro.
   The wordmark settles (TAIPEI CITY GUIDE fades out, TABI / TAIPEI shrinks and
   the guide label slides out to its right), the golden horizon sinks, and a
   greeting for the current time of day fades in line by line.

   Greetings: chosen at random per time slot (see SLOTS below): morning,
   evening and late night change during the slot, never repeating within the
   day; a greeting shown earlier is kept out of the draw for a few days where
   the slot asks for it. Characters used here must exist in
   assets/fonts/tabi-greeting-serif.woff2 (kana and punctuation are all in it;
   a NEW kanji needs the font subset regenerated, otherwise that one character
   falls back to the system Mincho). */
(function(){
  'use strict';
  const hero=document.getElementById('top');
  const greet=document.getElementById('hero-greeting');
  if(!hero||!greet)return;

  const GREETINGS={
    dawn:[
      ['おはよう。','街は、まだ少し静か。'],
      ['おはよう。','朝ごはん屋は、もう開いてるよ。'],
      ['おはよう。','朝の空気が、気持ちいい。'],
      ['おはよう。','今日は、街よりひと足早く。']
    ],
    morning:[
      ['おはよう。','朝ごはん、もう食べた？'],
      ['おはよう。','蛋餅にする？それとも飯糰？'],
      ['おはよう。','通りには、もうバイクの列。'],
      ['おはよう。','さて、何から食べようか。'],
      ['おはよう。','今日も、街は忙しそう。'],
      ['おはよう。','昨日とは、違う景色を。'],
      ['おはよう。','何かいいこと、あるといいな。'],
      ['今日も台北で、いい一日を。']
    ],
    noon:[
      ['こんにちは。','今日はどこを歩く？'],
      ['こんにちは。','お腹がすいたら、路地の奥へ。'],
      ['こんにちは。','行列のできてる店、気になるね。'],
      ['こんにちは。','お昼は、魯肉飯でいこうか。'],
      ['こんにちは。','街の音に、耳をすませて。'],
      ['こんにちは。','今日は、どんな景色に出会えるかな。'],
      ['こんにちは。','今日は、少し冒険してみよう。'],
      ['何気ない景色が、案外好きだ。'],
      ['こんにちは。','人の流れに、まぎれてみよう！']
    ],
    afternoon:[
      ['こんにちは。','そろそろ、タピオカでひと休み。'],
      ['こんにちは。','夕立がきたら、カフェで雨宿り。'],
      ['こんにちは。','少し遠回りしてみよう。'],
      ['こんにちは。','豆花は、いかが？'],
      ['こんにちは。','夕暮れまで、もうひと歩き。'],
      ['こんにちは。','気づけば、もうこんな時間。'],
      ['こんにちは。','もう少し、ここにいよう。'],
      ['こんにちは。','日が暮れるまで、あと少し。'],
      ['今日は、何をしなくてもいいよ。']
    ],
    evening:[
      ['こんばんは。','街に灯りがともるころ。'],
      ['こんばんは。','夜市は、これからが本番。'],
      ['こんばんは。','夕飯は、屋台をはしごで。'],
      ['こんばんは。','夜風が気持ちいいね。'],
      ['夜風が、少し気持ちいい。'],
      ['こんばんは。','気づけば、こんな時間。'],
      ['こんばんは。','この時間の街が、けっこう好き。'],
      ['☆彡｡.:・*ﾟ☆彡｡.:・*ﾟ☆彡｡.:・*ﾟ☆彡']
    ],
    night:[
      ['おやすみ。','今日は、よく歩いたね。'],
      ['おやすみ。','今日の寄り道は、ここまで。'],
      ['おやすみ。','続きは、また明日。'],
      ['おやすみ。','また、朝の台北で。'],
      ['おやすみ。','コンビニの夜食は、ほどほどにね。'],
      ['おやすみ。','今日も、いい一日だった？'],
      ['今日は、ここまでにしよう。'],
      ['おやすみ。','ゆっくり休んでね。'],
      ['おやすみ。','あの路地は、また今度。']
    ],
    awake:[
      ['まだ寝たくないの？'],
      ['まだ起きているの？'],
      ['そろそろ、眠らなきゃね。'],
      ['Zzz…','……すやすや。']
    ]
  };
  /* Time slots, in minutes after 05:00 (the day turns at 05:00, so 22:30–04:59
     is still the same night). perDay splits a slot into equal parts with a
     different greeting each; noRepeat keeps greetings shown on the previous two
     days out of the draw (as far as at least two candidates remain). */
  const SLOTS=[
    {name:'dawn',     start:0,    end:150,  perDay:1, noRepeat:true },  // 05:00–07:29
    {name:'morning',  start:150,  end:360,  perDay:2, noRepeat:true },  // 07:30–10:59 (switches 09:15)
    {name:'noon',     start:360,  end:480,  perDay:1, noRepeat:false},  // 11:00–12:59
    {name:'afternoon',start:480,  end:720,  perDay:1, noRepeat:false},  // 13:00–16:59
    {name:'evening',  start:720,  end:1050, perDay:3, noRepeat:true },  // 17:00–22:29 (18:50 / 20:40)
    {name:'night',    start:1050, end:1290, perDay:2, noRepeat:true },  // 22:30–02:29 (00:30)
    {name:'awake',    start:1290, end:1440, perDay:1, noRepeat:true }   // 02:30–04:59
  ];
  const STORE_KEY='tabi-hero-greeting-v3';
  const HISTORY_DAYS=3;       // today and the two days before
  const MIN_POOL=2;           // the no-repeat rule never narrows the draw below this
  const DAY_TURN_HOUR=5;      // 02:30–04:59 still belongs to the previous day
  const GREET_AT=1250;        // ms after the intro starts
  const LINE_GAP=600;         // ms between the starts of consecutive lines
  const FONT_WAIT=1800;       // never hold the greeting longer than this for the font
  const FONT_FAMILY='Tabi Greeting Serif';

  /* Slot and its part for the current time. */
  function slotFor(now){
    const m=(now.getHours()*60+now.getMinutes()-DAY_TURN_HOUR*60+1440)%1440;
    const slot=SLOTS.find(x=>m>=x.start&&m<x.end)||SLOTS[0];
    const part=Math.min(slot.perDay-1,Math.floor((m-slot.start)*slot.perDay/(slot.end-slot.start)));
    return {slot,part};
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

  function choose(slot,part,count,now){
    const today=dayNumber(now);
    let store;
    try{
      const raw=localStorage.getItem(STORE_KEY);
      try{store=JSON.parse(raw)||{};}catch(e){store={};}
      if(typeof store!=='object'||Array.isArray(store))store={};
    }catch(e){
      // No storage (private mode etc.): a plain daily rotation.
      return (today*slot.perDay+part+SLOTS.indexOf(slot))%count;
    }
    // History per slot, newest first: [{d:day number, w:part of the day, p:pick}].
    const hist=(store[slot.name]&&Array.isArray(store[slot.name].h)?store[slot.name].h:[])
      .filter(e=>e&&Number.isInteger(e.d)&&Number.isInteger(e.w)&&Number.isInteger(e.p)
        &&e.p>=0&&e.p<count&&e.d<=today&&today-e.d<HISTORY_DAYS);
    const current=hist.find(e=>e.d===today&&e.w===part);
    if(current)return current.p;
    // Never twice on the same day; with noRepeat, also not on the previous days
    // (yesterday first), as long as at least MIN_POOL candidates are left.
    let blocked=new Set(hist.filter(e=>e.d===today).map(e=>e.p));
    if(slot.noRepeat){
      for(let back=1;back<HISTORY_DAYS;back++){
        const more=new Set(blocked);
        hist.filter(e=>e.d===today-back).forEach(e=>more.add(e.p));
        if(count-more.size<MIN_POOL)break;
        blocked=more;
      }
    }
    let pool=[];
    for(let i=0;i<count;i++)if(!blocked.has(i))pool.push(i);
    if(!pool.length)for(let i=0;i<count;i++)pool.push(i);
    const pick=pool[Math.floor(Math.random()*pool.length)];
    store[slot.name]={h:[{d:today,w:part,p:pick}].concat(hist)};
    try{localStorage.setItem(STORE_KEY,JSON.stringify(store));}catch(e){}
    return pick;
  }

  const now=new Date();
  const {slot,part}=slotFor(now);
  const set=GREETINGS[slot.name];
  const lines=set[choose(slot,part,set.length,now)];

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
    const room=greet.parentElement.clientWidth;
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
