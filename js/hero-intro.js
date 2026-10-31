/* v30.9.213 / v30.9.225 — Top page intro.
   The wordmark settles (TAIPEI CITY GUIDE fades out, TABI / TAIPEI shrinks and
   the guide label slides out to its right), the golden horizon sinks, and a
   greeting for the current time of day fades in line by line.

   Greetings (v30.9.224): a new one every 40–60 minutes (SLOTS), kept when the
   page is reopened within that stretch; none repeats within three days, and
   each pool is dealt like a shuffled deck (see choose()). The very first
   visit says はじめまして; special days, minutes and habits have their own
   greetings (SPECIAL, pickGreeting()), and the greeting answers a double tap. Characters used here must exist in
   assets/fonts/tabi-greeting-serif.woff2 (kana and punctuation are all in it;
   a NEW kanji needs the font subset regenerated, otherwise that one character
   falls back to the system Mincho). */
(function(){
  'use strict';
  const hero=document.getElementById('top');
  const greet=document.getElementById('hero-greeting');
  if(!hero||!greet)return;

  /* Pools of greetings. An entry is [first line, second line] or [one line];
     {lines, until:'HH:MM'} shows it only before that time. {101} becomes the
     colour of Taipei 101's lighting for the weekday. The evening is two pools:
     around dinner, and after it. */
  const GREETINGS={
    dawn:[
      ['おはよう。','街は、まだ少し静か。'],
      ['おはよう。','朝ごはん屋は、もう開いてるよ。'],
      ['おはよう。','朝の空気が、気持ちいい。'],
      ['おはよう。','今日は、街よりひと足早く。'],
      ['おはよう。','早起きだね、えらい。'],
      ['おはよう。','まだ眠い？ゆっくりでいいよ。'],
      ['おはよう。','豆漿、湯気が立ってるよ。'],
      ['おはよう。','いちばん乗りだね。'],
      ['おはよう。','スズメも、もう起きてるよ。'],
      ['おはよう。','朝焼け、見られたらラッキー。'],
      ['ゆっくり伸びをして、スタート。']
    ],
    morning:[
      ['おはよう。','朝ごはん、もう食べた？'],
      ['おはよう。','蛋餅にする？それとも飯糰？'],
      ['おはよう。','通りには、もうバイクの列。'],
      ['おはよう。','さて、何から食べようか。'],
      ['おはよう。','今日も、街は忙しそう。'],
      ['おはよう。','昨日とは、違う景色を。'],
      ['おはよう。','何かいいこと、あるといいな。'],
      ['今日も台北で、いい一日を。'],
      ['おはよう。','忘れ物はない？'],
      ['おはよう。','寝ぐせ、ついてない？'],
      ['あれ？','今日って、何曜日だっけ？'],
      ['おはよう。','今日の一杯目は、何にする？'],
      ['朝ご飯屋のおばちゃん、今日も元気🔥'],
      ['おはよう。','ストローで、ぷすっと刺してね🥤'],
      ['おはよう。','今日の服、正解だと思う。'],
      ['朝からテンション、高めでいこう📈'],
      ['おはよう。','信号の小さい人、今日も走ってる。']
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
      ['こんにちは。','人の流れに、まぎれてみよう！'],
      ['こんにちは。','予定どおりにいかないのも、旅だよね。'],
      ['こんにちは。','吃飽沒？（ごはん食べた？）'],
      ['こんにちは。','お腹、鳴ってない？'],
      ['こんにちは。','迷ったら、人が多いほうへ。'],
      ['こんにちは。','お昼は、軽め？それとも全力？'],
      ['こんにちは。','水分補給、忘れずにね。'],
      ['こんにちは。','指さし注文でも、ちゃんと通じるよ。'],
      ['メニューの漢字、','読めそう？'],
      ['おやつは、','豆花かな、愛玉かな。'],
      ['こんにちは。','休んでも、旅は逃げないよ。'],
      ['こんにちは。','道に迷っても、それも思い出。'],
      ['こんにちは。','お寺の線香、いい香り。']
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
      ['今日は、何をしなくてもいいよ。'],
      ['こんにちは。','ちょっと座っていこうか。'],
      ['こんにちは。','なんだか、人が増えてきたね。'],
      ['こんにちは。','おやつの時間、だよね（？'],
      ['こんにちは。','写真、たくさん撮れた？'],
      ['こんにちは。','甘いものは、別腹！'],
      ['午後の台北は、ちょっとだけ眠い。'],
      ['ドリンクの甘さは、','今日の降水確率に委ねよう。'],
      ['こんにちは。','おみくじ、引いてみる？'],
      ['気になる路地、入ってみる？'],
      ['午後は、のんびりが正解☕️']
    ],
    dinner:[ // 17:00–19:29: dusk, going out to eat
      ['こんばんは。','街に灯りがともるころ。'],
      ['こんばんは。','夜になると、また違うね。'],
      ['こんばんは。','夜市は、これからが本番。'],
      ['こんばんは。','夕飯は、屋台をはしごで。'],
      ['こんばんは。','ゴミ収集車の音楽、聞こえた？'],
      ['こんばんは。','帰宅ラッシュ、バイクがすごいね。'],
      ['こんばんは。','夕焼け、見えた？'],
      ['こんばんは。','台湾ビールで、乾杯する？🍻'],
      ['こんばんは。','夕飯、何にしよう？'],
      ['今日の夕飯は、匂いで決めよう。'],
      ['ファミマの入店音、もう覚えた？'],
      ['こんばんは。','バイクのライトが、川みたいだね。'],
      ['こんばんは。','夜の部、はじまるよ。']
    ],
    evening:[ // 19:30–22:29: after dinner
      ['夜風が、少し気持ちいい。'],
      ['こんばんは。','気づけば、こんな時間。'],
      ['こんばんは。','この時間の街が、けっこう好き。'],
      ['あと一軒だけ、ね。'],
      ['こんばんは。','帰り道にも、寄り道がある。'],
      ['☆彡｡.:・*ﾟ☆彡｡.:・*ﾟ☆彡｡.:・*ﾟ☆彡'],
      ['こんばんは。','お腹いっぱい？'],
      ['こんばんは。','今日のいちばんは、なんだった？'],
      ['こんばんは。','コンビニのアイス、買っちゃう？'],
      ['こんばんは。','夜景、見に行く？'],
      ['こんばんは。','今日の写真、見返してる？'],
      ['こんばんは。','夜市のゲーム、勝てた？'],
      ['食べすぎた？……まあ、旅だしね。🙂‍↕️'],
      ['台湾の夜食は、','「宵夜」っていうよ。'],
      {lines:['こんばんは。','101、今日は{101}色の日だね🔮'],until:'22:00'}, // lit until about 22:00–23:00
      ['こんばんは。','夜の散歩、ちょっとだけ。'],
      ['夜の台北、','けっこう明るいね。']
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
      ['おやすみ。','あの路地は、また今度。'],
      ['おやすみ。','今日もお疲れさま。'],
      ['おやすみ。','スマホの充電、忘れずにね。'],
      ['おやすみ。','また明日、話そうね。'],
      ['おやすみ。','いい夢、見てね。'],
      ['羊が一匹、','羊が二匹……ラム串😴'],
      ['おやすみ。','明日、晴れますように。'],
      ['おやすみ。','今日の思い出、枕元に置いておこう。']
    ],
    awake:[
      ['まだ寝たくないの？'],
      ['まだ起きているの？'],
      ['そろそろ、眠らなきゃね。'],
      ['Zzz…','……すやすや。']
    ]
  };
  /* The very first visit: one of these instead of the time greeting, kept for
     the rest of that stretch, then never again (in this browser). */
  const FIRST_GREETINGS=[
    ['はじめまして。','これから数日、よろしくね。'],
    ['ようこそ、台北へ。','しばらくの間、よろしくね。'],
    ['はじめまして。','旅のあいだ、どうぞよろしく。']
  ];
  /* Special greetings (v30.9.225). Shown instead of the time greeting when
     their moment comes; see pickGreeting() for the order. */
  const SPECIAL={
    trip:{ // days since the first visit (day 1 = the first visit), once each
      2:[['旅の2日目、','台北に慣れてきた？'],['2日目だね。','昨日より、ちょっと余裕。']],
      3:[['3日目だね。','お気に入りの店、できた？']],
      4:[['すっかり、','台北の人みたい。']],
      7:[['一週間たったね。','もう「ただいま」でいいよ。']]
    },
    back:[['また会えたね👋'],['おかえり。','いい時間だった？']],  // same day, 3 h+ later, not 05:00–10:59
    visits:{10:['これで10回目だね。','いつもありがとう。'],50:['50回目！','もう、旅の相棒だね。']},
    owl:[['今日も夜ふかし？'],['夜ふかし常連さん、','いらっしゃい🌙']],  // late night, two nights running
    early:['早起き、続いてるね🐓'],                              // 05:00–05:59, two days running
    habit:['毎日この時間に会えるね☕️'],                           // within an hour of the same time, three days
    minute:{ // only during that minute
      '0:00':['日付が変わったね🌙','今日も、おつかれさま。'],
      '7:11':['7:11、','セブンの時間だね！'],
      '11:11':['11:11だ！','いいこと、ありそう✨'],
      '12:34':['12:34。','なんだか、気持ちいい時間。'],
      '22:22':['22:22だ。','ちょっとラッキー🍀']
    },
    // Small replies on the page (they show for a moment, then the greeting returns).
    replies:[['なに？👀'],['呼んだ？'],['はーい'],['ん？'],['ここにいるよ🙋']],  // double tap
    tickle:['くすぐったいよ'],                                         // three taps
    bright:['まぶしくない？🌙'],      // light mode chosen at night, the first time only
    top:['おかえり、トップへ。']      // back at the top after a long scroll, once a day
  };
  // Taipei 101's daily lighting follows the rainbow by weekday (Sunday first).
  const COLOURS_101=['紫','赤','オレンジ','黄','緑','青','藍'];
  /* Time slots in minutes after 05:00 (the day turns at 05:00, so 22:30–04:59
     is still the same night). parts splits a slot into equal stretches of
     roughly 40–60 minutes; each stretch has its own greeting, which stays put
     however often the page is opened. A pool needs at least 3 × parts
     greetings for the three-day rule below. */
  const SLOTS=[
    {pool:'dawn',      start:0,    end:150,  parts:3},  // 05:00–07:29, every 50 min
    {pool:'morning',   start:150,  end:360,  parts:4},  // 07:30–10:59, every ~52 min
    {pool:'noon',      start:360,  end:480,  parts:3},  // 11:00–12:59, every 40 min
    {pool:'afternoon', start:480,  end:720,  parts:5},  // 13:00–16:59, every 48 min
    {pool:'dinner',    start:720,  end:870,  parts:3},  // 17:00–19:29, every 50 min
    {pool:'evening',   start:870,  end:1050, parts:4},  // 19:30–22:29, every 45 min
    {pool:'night',     start:1050, end:1290, parts:4},  // 22:30–02:29, every hour
    {pool:'awake',     start:1290, end:1440, parts:1}   // 02:30–04:59
  ];
  const STORE_KEY='tabi-hero-greeting-v5';
  const NO_REPEAT_DAYS=3;     // a greeting is not shown again on the next two days
  const DAY_TURN_HOUR=5;      // 02:30–04:59 still belongs to the previous day
  const GREET_AT=1250;        // ms after the intro starts
  const LINE_GAP=600;         // ms between the starts of consecutive lines
  const FONT_WAIT=1800;       // never hold the greeting longer than this for the font
  const FONT_FAMILY='Tabi Greeting Serif';

  const entryOf=e=>Array.isArray(e)?{lines:e}:e;
  const minutesOf=text=>{const [h,m]=String(text).split(':').map(Number);return h*60+m;};
  /* Slot and its stretch for the current time. */
  function slotFor(now){
    const m=(now.getHours()*60+now.getMinutes()-DAY_TURN_HOUR*60+1440)%1440;
    const slot=SLOTS.find(x=>m>=x.start&&m<x.end)||SLOTS[0];
    const part=Math.min(slot.parts-1,Math.floor((m-slot.start)*slot.parts/(slot.end-slot.start)));
    return {slot,part};
  }
  function dayNumber(now){
    const d=new Date(now.getTime()-DAY_TURN_HOUR*3600000);
    return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  }
  function shuffle(list){
    for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
    return list;
  }
  function readStore(){
    try{
      const raw=localStorage.getItem(STORE_KEY);
      let store;try{store=JSON.parse(raw)||{};}catch(e){store={};}
      return typeof store==='object'&&!Array.isArray(store)?store:{};
    }catch(e){return null;}   // no storage (private mode etc.)
  }
  function writeStore(store){try{localStorage.setItem(STORE_KEY,JSON.stringify(store));}catch(e){}}

  /* Each pool is dealt like a shuffled deck, so every greeting comes up once
     before any comes back; on top of that, nothing shown in the last three
     days (today included) is dealt. The greeting of each stretch is
     remembered, so reopening the page keeps it. Greetings are identified by
     their text: lines added later join the deck, removed ones drop out. */
  function choose(slot,part,entries,now,store){
    const today=dayNumber(now);
    const clock=now.getHours()*60+now.getMinutes();
    const keys=entries.map(e=>e.lines.join('\n'));
    const allowed=k=>{const e=entries[keys.indexOf(k)];return !e.until||clock<minutesOf(e.until);};
    if(!store){
      // Without storage: a fixed rotation by day and stretch.
      const usable=keys.filter(allowed);
      return keys.indexOf(usable[(today*slot.parts+part)%usable.length]);
    }
    const known=new Set(keys);
    const rec=store[slot.pool]&&typeof store[slot.pool]==='object'?store[slot.pool]:{};
    const shown=(Array.isArray(rec.shown)?rec.shown:[])
      .filter(e=>e&&Number.isInteger(e.d)&&Number.isInteger(e.w)&&known.has(e.k)&&e.d<=today&&today-e.d<NO_REPEAT_DAYS);
    const current=shown.find(e=>e.d===today&&e.w===part);
    if(current&&allowed(current.k))return keys.indexOf(current.k);
    const recent=new Set(shown.map(e=>e.k));
    let deck=(Array.isArray(rec.deck)?rec.deck:[]).filter(k=>known.has(k));
    const drawn=keys.filter(k=>!deck.includes(k));
    // A brand-new greeting (never dealt) joins the deck at a random place.
    const dealt=new Set(Array.isArray(rec.dealt)?rec.dealt:[]);
    drawn.filter(k=>!dealt.has(k)).forEach(k=>deck.splice(Math.floor(Math.random()*(deck.length+1)),0,k));
    const usable=k=>!recent.has(k)&&allowed(k);
    let pick=deck.find(usable);
    if(!pick){
      // The rest of this round is blocked: deal the next round behind it.
      deck=deck.concat(shuffle(keys.filter(k=>!deck.includes(k))));
      pick=deck.find(usable);
    }
    if(!pick){
      // Pool too small for three days: the greeting seen longest ago, never today's.
      const last=new Map();shown.forEach(e=>{if(!last.has(e.k))last.set(e.k,e.d);});
      const today_=new Set(shown.filter(e=>e.d===today).map(e=>e.k));
      pick=keys.filter(k=>allowed(k)&&!today_.has(k)).sort((a,b)=>(last.get(a)??-1)-(last.get(b)??-1))[0]
        ||keys.find(allowed)||keys[0];
    }
    deck.splice(deck.indexOf(pick),1);
    store[slot.pool]={deck,dealt:keys,shown:[{d:today,w:part,k:pick}].concat(shown)};
    return keys.indexOf(pick);
  }

  const now=new Date();
  const {slot,part}=slotFor(now);
  const store=readStore();
  const today=dayNumber(now);
  const clock=now.getHours()*60+now.getMinutes();
  const sinceTurn=(clock-DAY_TURN_HOUR*60+1440)%1440;  // minutes after 05:00
  const entries=GREETINGS[slot.pool].map(entryOf);
  const pickOne=list=>list[Math.floor(Math.random()*list.length)];
  const dayList=key=>(Array.isArray(store[key])?store[key]:[]).filter(d=>Number.isInteger(d)&&today-d<7);

  /* Visits and habits (only with storage). A visit is an opening at least 30
     minutes after the previous one, so reloads in between do not count. */
  function bookkeeping(){
    const v=store.visits&&typeof store.visits==='object'?store.visits:{};
    const prevLast=Number(v.last)||0;
    const newVisit=!prevLast||now.getTime()-prevLast>=30*60000;
    const count=(Number(v.count)||0)+(newVisit?1:0);
    store.visits={count,last:now.getTime()};
    const opens=store.opens&&typeof store.opens==='object'?store.opens:{};
    const before={1:(opens[today-1]||[]).slice(),2:(opens[today-2]||[]).slice()};
    Object.keys(opens).forEach(d=>{if(!(today-Number(d)<3))delete opens[d];});
    (opens[today]=Array.isArray(opens[today])?opens[today]:[]).push(sinceTurn);
    opens[today]=opens[today].slice(-24);
    store.opens=opens;
    const nights=dayList('nights'),earlies=dayList('earlies');
    const owlYesterday=nights.includes(today-1),earlyYesterday=earlies.includes(today-1);
    if(slot.pool==='night'&&!nights.includes(today))nights.push(today);
    if(sinceTurn<60&&!earlies.includes(today))earlies.push(today);
    store.nights=nights;store.earlies=earlies;
    return {newVisit,count,prevLast,before,owlYesterday,earlyYesterday};
  }

  /* The greeting for this opening, in this order: the first visit → a special
     minute → a special greeting already shown in this stretch → visit 10 / 50
     → day 2 / 3 / 4 / 7 of the trip → a late night again → up early again →
     back the same day → the same time three days running → the time greeting.
     (The rarer ones come first, so a frequent one never takes their day.)
     Special greetings are kept for the rest of their stretch, so a reload
     shows them again; each comes once (a day, or ever for visits and days). */
  function pickGreeting(){
    const minute=SPECIAL.minute[now.getHours()+':'+String(now.getMinutes()).padStart(2,'0')];
    if(!store)return minute||entries[choose(slot,part,entries,now,null)].lines;
    const info=bookkeeping();
    const first=store.first&&typeof store.first==='object'?store.first:null;
    if(!first){
      const i=Math.floor(Math.random()*FIRST_GREETINGS.length);
      store.first={d:today,pool:slot.pool,w:part,i};
      return FIRST_GREETINGS[i];
    }
    if(first.d===today&&first.pool===slot.pool&&first.w===part&&FIRST_GREETINGS[first.i])return FIRST_GREETINGS[first.i];
    if(minute)return minute;
    const sp=store.special;
    if(sp&&sp.d===today&&sp.pool===slot.pool&&sp.w===part&&Array.isArray(sp.lines))return sp.lines;
    const once=store.once&&typeof store.once==='object'?store.once:(store.once={});
    const keep=(key,lines)=>{once[key]=today;store.special={d:today,pool:slot.pool,w:part,lines};return lines;};
    if(info.newVisit&&SPECIAL.visits[info.count]&&!once['visit'+info.count])return keep('visit'+info.count,SPECIAL.visits[info.count]);
    const tripDay=today-first.d+1;
    if(SPECIAL.trip[tripDay]&&!once['trip'+tripDay])return keep('trip'+tripDay,pickOne(SPECIAL.trip[tripDay]));
    if(slot.pool==='night'&&info.owlYesterday&&once.owl!==today)return keep('owl',pickOne(SPECIAL.owl));
    if(sinceTurn<60&&info.earlyYesterday&&once.early!==today)return keep('early',SPECIAL.early);
    if(info.prevLast&&dayNumber(new Date(info.prevLast))===today&&now.getTime()-info.prevLast>=3*3600000&&
       sinceTurn>=360&&once.back!==today)return keep('back',pickOne(SPECIAL.back));
    const near=list=>list.some(m=>Math.abs(m-sinceTurn)<=60);
    if(near(info.before[1])&&near(info.before[2])&&once.habit!==today)return keep('habit',SPECIAL.habit);
    return entries[choose(slot,part,entries,now,store)].lines;
  }
  const baseLines=pickGreeting().map(text=>text.replace('{101}',COLOURS_101[now.getDay()]));
  if(store)writeStore(store);
  let lines=baseLines;

  function makeLines(list){
    greet.textContent='';
    return list.map((text,i)=>{
      const el=document.createElement('span');
      el.className='hero-greeting-line';
      el.textContent=text;
      const chars=Array.from(text).length;
      el.style.setProperty('--line-dur',Math.round(Math.min(1500,Math.max(850,520+chars*55)))+'ms');
      el.dataset.line=String(i);
      greet.appendChild(el);
      return el;
    });
  }
  let lineEls=makeLines(lines);

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

  /* A moment's reply in place of the greeting: fade out, swap, fade in; after
     holdMs the greeting comes back the same way. */
  let swapToken=0,swapTimer=0;
  function swapTo(list,holdMs){
    if(!hero.classList.contains('hero--done'))return;
    const token=++swapToken;clearTimeout(swapTimer);
    greet.classList.add('is-swapping');
    setTimeout(()=>{
      if(token!==swapToken)return;
      lines=list;lineEls=makeLines(list);fit();
      greet.classList.remove('is-swapping');
      if(holdMs)swapTimer=setTimeout(()=>{if(token===swapToken)swapTo(baseLines,0);},holdMs);
    },280);
  }

  function setupMoments(){
    // Double tap: a short reply (never the same twice running); three taps: tickled.
    let taps=0,tapTimer=0,lastReply=null;
    greet.addEventListener('click',()=>{
      if(!hero.classList.contains('hero--done'))return;
      taps++;clearTimeout(tapTimer);
      tapTimer=setTimeout(()=>{
        const n=taps;taps=0;
        if(n>=3){swapTo(SPECIAL.tickle,2400);return;}
        if(n!==2)return;
        let reply;do{reply=pickOne(SPECIAL.replies);}while(SPECIAL.replies.length>1&&reply===lastReply);
        lastReply=reply;swapTo(reply,2000);
      },320);
    });
    if(!store)return;
    // Back at the top after a long scroll (once a day), and light mode at night
    // (the first time ever; shown when the greeting is next in view).
    let inView=true,wentFar=false,pendingBright=false;
    window.addEventListener('scroll',()=>{if(window.scrollY>window.innerHeight*2)wentFar=true;},{passive:true});
    const night=()=>{const h=new Date().getHours();return h>=18||h<5;};
    const showPending=()=>{
      if(!inView||!hero.classList.contains('hero--done'))return;
      if(pendingBright){pendingBright=false;swapTo(SPECIAL.bright,3500);wentFar=false;return;}
      const day=dayNumber(new Date());
      const once=store.once&&typeof store.once==='object'?store.once:(store.once={});
      if(wentFar&&once.top!==day){once.top=day;writeStore(store);wentFar=false;swapTo(SPECIAL.top,4000);}
    };
    if('IntersectionObserver' in window){
      new IntersectionObserver(items=>{
        const item=items[items.length-1];
        inView=item.isIntersecting&&item.intersectionRatio>=.9;
        showPending();
      },{threshold:[0,.9,1]}).observe(greet);
    }
    // Only a switch the visitor makes from dark to light counts: the theme the
    // page sets up while loading (before the intro ends) is ignored.
    let theme=document.documentElement.getAttribute('data-theme');
    new MutationObserver(()=>{
      const next=document.documentElement.getAttribute('data-theme'),prev=theme;theme=next;
      if(next===prev||!hero.classList.contains('hero--done'))return;
      if(next!=='light'||prev!=='dark'||!night()||store.bright)return;
      store.bright=true;writeStore(store);pendingBright=true;showPending();
    }).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  }
  setupMoments();

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
