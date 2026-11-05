/* TAIPEI CITY GUIDE — イベントカレンダー (chapter 03, after 撮影スポット), v30.9.268.
   Data: data/events.js (window.TABI_EVENTS, edited with editor/directory.html).

   Month carousel: one card per month, from last month to the last month with an event.
   The centred card is wide (week bars, or the month heatmap after a tap); its
   neighbours shrink to mini cards. A transparent native scroller (scroll-snap) sits on
   top and drives the drawing, so swiping keeps the phone's own momentum; the cards
   underneath are placed from its scroll position every frame.
   Week bars grow from the bottom whenever a month settles in the centre.
   Long-press (0.35 s; on the bars too, which switches to the heatmap) and drag to pick a
   day; release to show that day's events. Double-tap the centred card: back to this month,
   shown as bars.
   Status (開催中／開催予定／開催終了) is judged against today in Taipei.
   Events without announced dates (tbd) are listed in their expected months as 日程未定
   and are not counted anywhere.
   Debug: ?ec-today=2026-12-08 pretends today is that date. */
(() => {
  'use strict';
  const root = document.getElementById('event-calendar');
  if (!root) return;
  const section = root.closest('details');

  /* ---------- dates (whole days, counted from 1970-01-01 UTC) ---------- */
  const DAY = 864e5;
  const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  const YM = /^(\d{4})-(\d{2})$/;
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOf = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
  const parseDay = s => { const m = ISO.exec(String(s || '')); return m ? dayOf(+m[1], +m[2], +m[3]) : null; };
  const parseMonth = s => { const m = YM.exec(String(s || '')); return m ? +m[1] * 12 + (+m[2] - 1) : null; };
  const ymd = n => { const d = new Date(n * DAY); return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: d.getUTCDay()}; };
  function taipeiToday() {
    const forced = parseDay(new URLSearchParams(location.search).get('ec-today'));
    if (forced !== null) return forced;
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'})
        .formatToParts(new Date()).map(x => [x.type, x.value]));
      return dayOf(+p.year, +p.month, +p.day);
    } catch (_) { return Math.floor((Date.now() + 8 * 36e5) / DAY); }
  }
  const safeUrl = raw => { try { const u = new URL(raw); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } };

  /* ---------- data ---------- */
  function readEvents() {
    const list = Array.isArray(window.TABI_EVENTS?.events) ? window.TABI_EVENTS.events : [];
    return list.map(e => {
      if (!e || typeof e.name !== 'string' || !e.name.trim()) return null;
      const city = String(e.city || '').trim(), venue = String(e.venue || '').trim();
      const base = {name: e.name.trim(), city, category: String(e.category || '').trim(), venue, url: safeUrl(e.url), top: e.recommend === '高',
        mapUrl: safeUrl(e.mapUrl) || (venue ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((city + ' ' + venue).trim()) : '')};
      let start = parseDay(e.start), end = parseDay(e.end);
      if (e.tbd || start === null) {
        // Dates not announced: keep the expected months only.
        let from = parseMonth(e.expectedFrom), to = parseMonth(e.expectedTo);
        if (from === null) return null;
        if (to === null || to < from) to = from;
        return {...base, tbd: true, from, to};
      }
      if (end === null) end = start;
      if (end < start) [start, end] = [end, start];
      return {...base, tbd: false, start, end};
    }).filter(Boolean);
  }

  let today, events, months, maxWeek;
  const statusOf = e => e.end < today ? 'ended' : e.start > today ? 'upcoming' : 'ongoing';
  // Month order (v30.9.268): each event's next key date inside the month (from today in
  // the current month): its start if that falls in the month, otherwise its end. Those
  // events come first by that date, starts and ends interleaved like a timeline; events
  // that run through the whole month follow (ending soonest first); ended ones last.
  // Same day: 推薦「高」 first.
  function monthKey(e, lo, last) {
    if (e.end < today) return [3, -e.end];
    if (e.start >= lo && e.start <= last) return [0, e.start];
    if (e.end >= lo && e.end <= last) return [0, e.end];
    return [2, e.end];
  }
  const tie = (p, q) => (q.top - p.top) || p.start - q.start || p.end - q.end || p.name.localeCompare(q.name, 'ja');
  const byKey = (p, q) => p.key[0] - q.key[0] || p.key[1] - q.key[1] || tie(p, q);
  function buildMonths() {
    today = taipeiToday();
    events = readEvents();
    const t = ymd(today);
    let y = t.m === 1 ? t.y - 1 : t.y, m = t.m === 1 ? 12 : t.m - 1;          // last month
    const lastDated = ymd(events.filter(e => !e.tbd).reduce((a, e) => Math.max(a, e.end), today));
    const stopKey = Math.max(lastDated.y * 12 + lastDated.m - 1, ...events.filter(e => e.tbd).map(e => e.to));
    months = [];
    while (y * 12 + m - 1 <= stopKey && months.length < 36) {
      const key = y * 12 + m - 1;
      const first = dayOf(y, m, 1), dim = new Date(Date.UTC(y, m, 0)).getUTCDate(), last = first + dim - 1;
      const lead = new Date(first * DAY).getUTCDay();                           // weeks start on Sunday
      const inMonth = events.filter(e => !e.tbd && e.start <= last && e.end >= first);
      const days = Array.from({length: dim}, (_, i) => inMonth.reduce((n, e) => n + (e.start <= first + i && e.end >= first + i), 0));
      const weeks = [];
      for (let r = 0; r * 7 - lead < dim; r++) {
        const a = Math.max(first, first + r * 7 - lead), b = Math.min(last, first + r * 7 - lead + 6);
        weeks.push(inMonth.filter(e => e.start <= b && e.end >= a).length);
      }
      const lo = Math.max(today, first);
      const rows = inMonth.map(e => ({...e, status: statusOf(e), key: monthKey(e, lo, last)})).sort(byKey);
      const tbd = events.filter(e => e.tbd && e.from <= key && e.to >= key).map(e => ({...e, status: 'tbd'}))
        .sort((p, q) => p.from - q.from || p.to - q.to || p.name.localeCompare(q.name, 'ja'));
      months.push({y, m, first, last, dim, lead, days, weeks, rows, tbd});
      if (++m > 12) { m = 1; y++; }
    }
    maxWeek = Math.max(1, ...months.flatMap(x => x.weeks));
  }

  /* ---------- DOM helpers ---------- */
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const svgChevron = () => {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', 'M9 5l7 7-7 7'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.append(p); return s;
  };
  // Heatmap shades are scaled within the month (busiest days stand out even when long
  // exhibitions fill every day); bar heights share one scale so months compare.
  const levels = days => {
    const on = days.filter(c => c > 0), lo = Math.min(...on), hi = Math.max(...on);
    return days.map(c => c <= 0 ? 0 : hi === lo ? 2 : 1 + Math.round((c - lo) / (hi - lo) * 3));
  };
  const barHeight = v => v <= 0 ? .05 : Math.max(.16, v / maxWeek);
  const dayLabel = n => { const d = ymd(n); return d.m + '月' + d.d + '日（' + WEEK[d.w] + '）'; };

  /* ---------- build ---------- */
  const stage = el('div', 'ec-stage');
  const cardLayer = el('div', 'ec-cards'); cardLayer.setAttribute('aria-hidden', 'true');
  const pickMonth = el('span', 'ec-pick-month'); pickMonth.setAttribute('aria-hidden', 'true');
  const scroller = el('div', 'ec-scroller'); scroller.tabIndex = 0;
  scroller.setAttribute('role', 'group'); scroller.setAttribute('aria-roledescription', 'カルーセル');
  const track = el('div', 'ec-track');
  scroller.append(track); stage.append(cardLayer, pickMonth, scroller);
  const dots = el('div', 'ec-dots'); dots.setAttribute('aria-hidden', 'true');
  const summary = el('div', 'ec-summary'); summary.setAttribute('aria-live', 'polite');
  const announce = el('span', 'ec-sr'); announce.setAttribute('aria-live', 'assertive');
  // The list scrolls inside a box of fixed height (3.5 rows, the same in Safari and in
  // the home-screen app); the bottom fades while more rows are below.
  const listBox = el('div', 'ec-list-box');
  const listScroll = el('div', 'ec-list-scroll'); listScroll.tabIndex = 0; listScroll.setAttribute('role', 'region');
  const list = el('ul', 'ec-list');
  listScroll.append(list); listBox.append(listScroll);
  root.replaceChildren(stage, dots, summary, listBox, announce);
  function updateFade() {
    const canScroll = listScroll.scrollHeight > listScroll.clientHeight + 5;
    listScroll.classList.toggle('can-scroll', canScroll);
    listScroll.dataset.end = canScroll && listScroll.scrollTop + listScroll.clientHeight >= listScroll.scrollHeight - 8 ? 'true' : 'false';
  }
  listScroll.addEventListener('scroll', updateFade, {passive: true});
  // Two-line names: the date block is centred on the name block; one-line rows stay top-aligned.
  function markLines() {
    list.querySelectorAll('.ec-row').forEach(li => {
      const name = li.querySelector('.ec-name');
      if (name?.offsetHeight) li.classList.toggle('is-2line', name.offsetHeight > 30);
    });
  }
  new ResizeObserver(() => { markLines(); updateFade(); }).observe(listScroll);

  let cards = [], snaps = [];
  function buildCard(mo) {
    const card = el('div', 'ec-card');
    const full = el('div', 'ec-full');
    // Bars face
    const bars = el('div', 'ec-face ec-face-bars');
    const head = el('div', 'ec-head');
    const title = el('div', 'ec-title');
    const month = el('span', 'ec-month'); month.append(String(mo.m), el('small', '', ' 月'));
    const count = el('span', 'ec-count'); count.append(String(mo.rows.length), el('small', '', '件'));
    title.append(month, count);
    head.append(el('span', 'ec-year', String(mo.y)), title);
    const barRow = el('div', 'ec-bars');
    mo.weeks.forEach((v, i) => {
      const b = el('i'); b.style.setProperty('--h', barHeight(v).toFixed(3)); b.style.setProperty('--i', i);
      if (!v) b.className = 'is-zero'; barRow.append(b);
    });
    bars.append(head, el('span', 'ec-caption', 'イベント分布'), barRow);
    // Heatmap face
    const heat = el('div', 'ec-face ec-face-heat');
    const hhead = el('div', 'ec-heat-head');
    hhead.append(el('span', '', String(mo.y)), el('span', '', mo.m + ' 月'), el('span', '', 'イベント分布'));
    const grid = el('div', 'ec-grid');
    for (let i = 0; i < mo.lead; i++) grid.append(el('i', 'is-out'));
    const lv = levels(mo.days);
    mo.days.forEach((c, i) => {
      const cell = el('i', 'lv' + lv[i]);
      cell.dataset.day = mo.first + i;
      if (mo.first + i === today) cell.classList.add('is-today');
      grid.append(cell);
    });
    grid.append(el('span', 'ec-pick-box'));                 // sits in the picked cell's grid area
    grid.style.setProperty('--ec-gap-extra', '0px');
    heat.append(hhead, grid, el('span', 'ec-pick-date'));
    full.append(bars, heat);
    // Mini (side) face
    const mini = el('div', 'ec-mini');
    const mm = el('span', 'ec-mini-month'); mm.append(String(mo.m), el('small', '', ' 月'));
    const mc = el('span', 'ec-mini-count'); mc.append(String(mo.rows.length), el('small', '', '件'));
    const mb = el('div', 'ec-mini-bars');
    mo.weeks.forEach(v => { const b = el('i'); b.style.setProperty('--h', barHeight(v).toFixed(3)); mb.append(b); });
    mini.append(el('span', 'ec-mini-year', String(mo.y)), mm, mc, mb);
    card.append(full, mini);
    return card;
  }

  /* ---------- summary + list (a month, or one picked day) ---------- */
  let selDay = null;                         // picked day (day number) in the current month
  function rowsFor(mo) {
    if (selDay === null) return {dated: mo.rows, tbd: mo.tbd};
    // A picked day: 最終日 first, then 初日, then the rest ending soonest first.
    const rank = r => r.end === selDay ? 0 : r.start === selDay ? 1 : 2;
    return {dated: mo.rows.filter(r => r.start <= selDay && r.end >= selDay)
      .sort((p, q) => rank(p) - rank(q) || p.end - q.end || tie(p, q)), tbd: []};
  }
  function renderSummary(mo) {
    const {dated} = rowsFor(mo);
    const n = {ongoing: 0, upcoming: 0, ended: 0};
    dated.forEach(r => n[r.status]++);
    const lead = el('div', 'ec-sum-lead');
    const big = el('strong', 'ec-sum-total'); big.append(String(dated.length), el('small', '', ' イベント'));
    const extra = [];
    if (selDay === null) lead.append(el('span', 'ec-sum-month', mo.y + '／' + mo.m + '月'), big);
    else {
      const sd = ymd(selDay);
      lead.append(el('span', 'ec-sum-month', sd.m + '/' + sd.d + '（' + WEEK[sd.w] + '）'), big);
      // Floats in the empty band above the summary (where the page dots appear while
      // swiping), so showing it moves nothing.
      const back = el('button', 'ec-day-back'); back.type = 'button';
      back.append(el('span', 'ec-day-x', '×'), el('span', '', mo.m + '月の一覧へ'));
      back.setAttribute('aria-label', dayLabel(selDay) + 'の選択を解除して' + mo.m + '月の一覧に戻る');
      extra.push(back);
    }
    const stat = (label, v, cls) => { const s = el('div', 'ec-stat ' + cls); s.append(el('span', '', label), el('strong', '', String(v))); return s; };
    // A picked day: everything listed is on that day, so show how many start (初日) and
    // end (最終日) there, in the two right-hand columns.
    const stats = selDay === null
      ? [stat('開催中', n.ongoing, 'is-ongoing'), stat('開催予定', n.upcoming, 'is-upcoming'), stat('開催終了', n.ended, 'is-ended')]
      : [el('div', 'ec-stat-gap'), stat('初日', dated.filter(r => r.start === selDay).length, 'is-first'), stat('最終日', dated.filter(r => r.end === selDay).length, 'is-last')];
    summary.replaceChildren(lead, ...stats, ...extra);
  }

  const BADGE = {upcoming: '開催予定', ended: '開催終了', ongoing: ''};
  const pad = n => String(n).padStart(2, '0');
  function dateCell(r) {
    const date = el('div', 'ec-date');
    if (r.tbd) {
      const a = r.from % 12 + 1, b = r.to % 12 + 1;
      date.classList.add('is-tbd');
      date.append(el('span', 'ec-date-m', a === b && r.from === r.to ? a + '月' : a + '月–' + b + '月'), el('span', 'ec-tbd', '日程未定'));
      date.setAttribute('aria-label', '日程未定（' + (r.from === r.to ? a + '月' : a + '月から' + b + '月') + '予定）');
      return date;
    }
    const s = ymd(r.start), e = ymd(r.end), single = r.end === r.start, sameMonth = s.m === e.m && s.y === e.y;
    // Gold: the side that falls on the picked day (初日 / 最終日); in the month list, the
    // side that falls on today (本日初日 / 本日最終日).
    const goldStart = selDay !== null ? r.start === selDay : r.start === today;
    const goldEnd = selDay !== null ? r.end === selDay : r.end === today;
    const mStart = el('span', 'ec-date-m', s.m + '月'), mEnd = el('span', 'ec-date-m', single || sameMonth ? '' : e.m + '月');
    const dStart = el('span', 'ec-date-d', pad(s.d)), dEnd = el('span', 'ec-date-d ec-date-end', single ? '' : pad(e.d));
    if (goldStart || (single && goldEnd)) { mStart.classList.add('is-gold'); dStart.classList.add('is-gold'); }
    if (goldEnd && !single) { mEnd.classList.add('is-gold'); dEnd.classList.add('is-gold'); }
    date.append(mStart, mEnd, dStart, dEnd);
    if (single) date.classList.add('is-single');
    date.setAttribute('aria-label', s.m + '月' + s.d + '日' + (single ? '' : '〜' + (sameMonth ? '' : (s.y !== e.y ? e.y + '年' : '') + e.m + '月') + e.d + '日') +
      (goldStart && goldEnd ? (selDay !== null ? '（この日のみ）' : '（本日のみ）') : goldStart ? (selDay !== null ? '（初日）' : '（本日初日）') : goldEnd ? (selDay !== null ? '（最終日）' : '（本日最終日）') : ''));
    return date;
  }
  function renderList(mo) {
    list.replaceChildren();
    const {dated, tbd} = rowsFor(mo);
    if (!dated.length && !tbd.length) {
      list.append(el('li', 'ec-empty', selDay === null ? 'この月のイベント情報はまだありません。' : 'この日のイベントはありません。'));
      return;
    }
    for (const r of [...dated, ...tbd]) {
      const li = el('li', 'ec-row is-' + r.status);
      const body = el('div', 'ec-body');
      const meta = el('div', 'ec-meta');
      meta.append(el('span', 'ec-meta-text', [r.city, r.category].filter(Boolean).join('・')));
      if (BADGE[r.status]) meta.append(el('span', 'ec-badge', BADGE[r.status]));
      body.append(meta);
      if (r.url) {
        const a = el('a', 'ec-name', r.name); a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', r.name + '（公式サイトを開く）'); a.title = r.name;
        body.append(a);
      } else body.append(el('span', 'ec-name', r.name));
      li.append(dateCell(r), body);
      if (r.mapUrl) {
        const go = el('a', 'ec-map'); go.href = r.mapUrl; go.target = '_blank'; go.rel = 'noopener noreferrer';
        go.setAttribute('aria-label', (r.venue || r.name) + 'をGoogleマップで開く'); go.title = r.venue || 'Googleマップ';
        go.append(svgChevron()); li.append(go);
      } else li.append(el('span', 'ec-map is-none'));
      list.append(li);
    }
  }
  function renderBelow() {
    const mo = months[current];
    renderSummary(mo); renderList(mo);
    listScroll.scrollTop = 0;
    listScroll.setAttribute('aria-label', selDay === null ? mo.y + '年' + mo.m + '月のイベント一覧' : dayLabel(selDay) + 'のイベント一覧');
    markLines(); updateFade();
  }
  summary.addEventListener('click', ev => { if (ev.target.closest('.ec-day-back')) { clearDay(); scroller.focus({preventScroll: true}); } });

  /* ---------- geometry ---------- */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const GAP = 10, PICK_SCALE = 1.06, PICK_TALL = 1.05, SIDE_DROP = 7;
  const PADV = 16;                           // room above/below the cards so the grown card is never clipped
  let C = 0, Wf = 0, Wm = 0, S = 1, fullH = [], miniH = 0, stageH = 0, current = -1, frame = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const isHeat = () => root.classList.contains('is-heat');

  function measure() {
    C = stage.clientWidth;
    if (!C) return false;
    Wf = clamp(Math.round(C * .54), 176, 330);
    Wm = clamp(Math.round(C * .2), 66, 120);
    S = Wf / 2 + GAP + Wm / 2;
    root.style.setProperty('--ec-wf', Wf + 'px');
    root.style.setProperty('--ec-wm', Wm + 'px');
    track.style.width = ((months.length - 1) * S + C) + 'px';
    snaps.forEach((s, i) => { s.style.left = (i * S) + 'px'; });
    // Each wide card fits its own month; the stage keeps the tallest so nothing jumps while swiping.
    fullH = cards.map(c => c.firstChild.offsetHeight);
    miniH = Math.max(...cards.map(c => c.lastChild.offsetHeight));
    stageH = Math.max(...fullH) + 4;
    stage.style.height = (stageH + PADV * 2) + 'px';
    // While picking, the card grows 5% taller by opening the gaps between its weeks,
    // so the date and the bottom row move outward instead of being stretched.
    cards.forEach((c, i) => c.querySelector('.ec-grid')?.style.setProperty('--ec-gap-extra',
      (fullH[i] * (PICK_TALL - 1) / Math.max(1, months[i].weeks.length - 1)).toFixed(2) + 'px'));
    if (selDay !== null) placeBox(selDay);
    return true;
  }

  function place() {
    frame = 0;
    if (!C) return;
    const n = months.length;
    const p = clamp(scroller.scrollLeft / S, 0, n - 1);
    const k = Math.min(Math.floor(p), n - 1), f = k === n - 1 ? 0 : p - k;
    const w = months.map((_, i) => lerp(Wf, Wm, Math.min(1, Math.abs(i - p))));
    const centre = new Array(n);
    centre[k] = C / 2 - (k + 1 < n ? f * (w[k] / 2 + GAP + w[k + 1] / 2) : 0);
    for (let i = k + 1; i < n; i++) centre[i] = centre[i - 1] + w[i - 1] / 2 + GAP + w[i] / 2;
    for (let i = k - 1; i >= 0; i--) centre[i] = centre[i + 1] - w[i + 1] / 2 - GAP - w[i] / 2;
    // While a day is being picked the wide card grows a little and its neighbours step aside.
    const push = picking ? Wf * (PICK_SCALE - 1) / 2 + 8 : 0;   // neighbours also drop SIDE_DROP and dim
    cards.forEach((card, i) => {
      const d = Math.min(1, Math.abs(i - p));
      const shift = picking && i !== current ? Math.sign(i - current) * push : 0;
      const left = centre[i] - w[i] / 2 + shift;
      if (left > C + 20 || left + w[i] < -20) { card.style.visibility = 'hidden'; return; }
      const h = lerp(fullH[i], miniH, d) * (picking && i === current ? PICK_TALL : 1);
      const top = PADV + (stageH - h) / 2 + (picking && i !== current ? SIDE_DROP : 0);
      card.style.visibility = '';
      card.style.width = w[i] + 'px';
      card.style.height = h + 'px';
      card.style.transform = `translate3d(${left.toFixed(2)}px,${top.toFixed(2)}px,0)` + (picking && i === current ? ` scale(${PICK_SCALE})` : '');
      card.style.setProperty('--ec-near', (1 - d).toFixed(3));
      // The two faces never show at once: the wide one is gone before the mini one appears.
      card.firstChild.style.opacity = clamp(1 - d * 2.5, 0, 1).toFixed(3);
      card.lastChild.style.opacity = clamp((d - .45) / .4, 0, 1).toFixed(3);
      if (i === current) {
        // Small month reminder outside the card's top-left corner, clear of the finger.
        const sw = w[i] * (picking ? PICK_SCALE : 1), sh = h * (picking ? PICK_SCALE : 1);
        const s = picking ? PICK_SCALE : 1;
        pickMonth.style.transform = `translate3d(${(left - (sw - w[i]) / 2 - 8).toFixed(2)}px,${(top - (sh - h) / 2 + 8.5 * s + 1).toFixed(2)}px,0) translateX(-100%)`;
      }
    });
    const idx = Math.round(p);
    if (idx !== current && !picking) select(idx);
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };

  function select(idx) {
    current = idx;
    selDay = null; cards.forEach(c => c.classList.remove('has-sel'));
    cards.forEach((c, i) => { if (i !== idx) c.classList.remove('is-grown'); });
    const mo = months[idx];
    [...dots.children].forEach((d, i) => d.classList.toggle('is-active', i === idx));
    pickMonth.textContent = mo.m + '月';
    renderBelow();
    labelScroller();
  }
  function labelScroller() {
    const mo = months[current];
    scroller.setAttribute('aria-label', mo.y + '年' + mo.m + '月・' + mo.rows.length + '件。左右キーで月を移動、Enterで' +
      (isHeat() ? '棒グラフ表示に切り替え' : 'カレンダー表示に切り替え') + '。下キーで日付を選択、Homeで今月へ');
  }

  /* ---------- week bars grow from the bottom ---------- */
  function grow(idx) {
    const card = cards[idx];
    if (!card) return;
    cards.forEach((c, i) => { if (i !== idx) c.classList.remove('is-grown'); });
    card.classList.remove('is-grown');
    void card.offsetWidth;                   // restart the transition
    card.classList.add('is-grown');
  }

  /* ---------- page dots: only while swiping ---------- */
  let quiet = false, dotTimer = 0, settleTimer = 0;
  const settled = () => Math.abs(scroller.scrollLeft - current * S) < 3;
  scroller.addEventListener('scroll', () => {
    schedule();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (settled() && !cards[current]?.classList.contains('is-grown')) grow(current); }, 120);
    if (quiet) return;
    dots.classList.add('is-visible');
    clearTimeout(dotTimer);
    dotTimer = setTimeout(() => dots.classList.remove('is-visible'), 650);
  }, {passive: true});

  function jumpTo(idx) {                     // no animation, no dots (opening, resizing)
    quiet = true;
    scroller.scrollLeft = idx * S;
    place();
    requestAnimationFrame(() => { quiet = false; });
  }
  function goTo(idx) {
    idx = clamp(idx, 0, months.length - 1);
    scroller.scrollTo({left: idx * S, behavior: reduce.matches ? 'auto' : 'smooth'});
  }

  /* ---------- bars ⇄ heatmap ---------- */
  function animate(cls, ms) { root.classList.add(cls); clearTimeout(animate[cls]); animate[cls] = setTimeout(() => root.classList.remove(cls), ms); }
  function toggleFace() {
    const card = cards[current];
    if (isHeat() && selDay !== null) { selDay = null; card.classList.remove('has-sel'); renderBelow(); }
    animate('is-switching', 320);
    root.classList.toggle('is-heat');
    measure(); place();
    if (isHeat()) {
      if (!reduce.matches) card?.querySelector('.ec-face-heat')?.animate([{opacity: 0}, {opacity: 1}], {duration: 260, easing: 'ease-out'});
    } else grow(current);
    labelScroller();
  }

  /* ---------- picking a day on the heatmap ---------- */
  // Long-press the centred heatmap, then drag across the cells: the cells darken, a frame
  // follows the finger and the date shows top-left. Releasing confirms; long-pressing the
  // picked day again, the chip in the summary, or another month clears it.
  let picking = false, pickBy = '', pickDay = null, pending = null, suppressClick = false;
  const LONG_PRESS = 350, SLOP = 8;
  const cellsOf = idx => [...cards[idx].querySelectorAll('.ec-grid i[data-day]')];
  // The frame is an absolutely placed child of the grid with the picked cell's grid area
  // as its box, so it always lines up with the cell (also while the gaps open or close).
  function placeBox(day, glide) {
    const card = cards[current], mo = months[current];
    const box = card?.querySelector('.ec-pick-box');
    if (!box || day < mo.first || day > mo.last) return;
    const n = mo.lead + (day - mo.first);
    const before = glide && box.getClientRects().length ? box.getBoundingClientRect() : null;
    const row = Math.floor(n / 7) + 1, col = n % 7 + 1;
    box.style.gridArea = row + ' / ' + col + ' / ' + (row + 1) + ' / ' + (col + 1);   // end lines too (abs-pos)
    if (before && !reduce.matches) {
      const after = box.getBoundingClientRect(), k = after.width / (box.offsetWidth || 1) || 1;
      const dx = (before.left - after.left) / k, dy = (before.top - after.top) / k;
      if (dx || dy) box.animate([{transform: `translate(${dx}px,${dy}px)`}, {transform: 'none'}], {duration: 90, easing: 'ease-out'});
    }
  }
  function setPickDay(day) {
    if (day === pickDay) return;
    const glide = pickDay !== null;
    pickDay = day;
    placeBox(day, glide);
    const d = ymd(day);
    cards[current].querySelector('.ec-pick-date').textContent = d.d + '日(' + WEEK[d.w] + ')';
    announce.textContent = dayLabel(day);
  }
  function dayAt(x, y) {
    let best = null, dist = Infinity;
    for (const cell of cellsOf(current)) {
      const r = cell.getBoundingClientRect();
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const dd = dx * dx + dy * dy;
      if (dd < dist) { dist = dd; best = +cell.dataset.day; if (!dd) break; }
    }
    return best;
  }
  function beginPick(by, day) {
    picking = true; pickBy = by; pickDay = null;
    const card = cards[current];
    card.classList.add('is-pick');
    animate('is-switching', 280);
    root.classList.add('is-picking');
    setPickDay(day);
    place();
  }
  function endPick(commit) {
    if (!picking) return;
    const card = cards[current], day = pickDay;
    picking = false; pickBy = '';
    card.classList.remove('is-pick');
    animate('is-switching', 280);
    root.classList.remove('is-picking');
    place();
    if (commit) {
      selDay = selDay === day ? null : day;          // long-pressing the picked day again clears it
      announce.textContent = selDay === null ? months[current].m + '月の一覧' : dayLabel(selDay) + 'を選択';
      renderBelow();
    }
    card.classList.toggle('has-sel', selDay !== null);
    if (selDay !== null) placeBox(selDay);
    pickDay = null;
  }
  function clearDay() {
    if (selDay === null) return;
    selDay = null;
    cards[current]?.classList.remove('has-sel');
    renderBelow();
  }
  const cardHit = (x, y) => cards.findIndex(card => {
    if (card.style.visibility === 'hidden') return false;
    const r = card.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });

  scroller.addEventListener('pointerdown', ev => {
    if (picking || pending || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    if (cardHit(ev.clientX, ev.clientY) !== current || !settled()) return;
    const id = ev.pointerId, x = ev.clientX, y = ev.clientY;
    pending = {id, x, y, timer: setTimeout(() => {
      pending = null;
      try { scroller.setPointerCapture(id); } catch (_) {}
      if (!isHeat()) toggleFace();               // long-press on the bars: straight to picking
      beginPick('pointer', dayAt(x, y));
    }, LONG_PRESS)};
  });
  scroller.addEventListener('pointermove', ev => {
    if (pending && ev.pointerId === pending.id && Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y) > SLOP) {
      clearTimeout(pending.timer); pending = null;               // it is a swipe, not a long press
    } else if (picking && pickBy === 'pointer') setPickDay(dayAt(ev.clientX, ev.clientY));
  });
  const release = commit => ev => {
    if (pending && ev.pointerId === pending.id) { clearTimeout(pending.timer); pending = null; }
    if (picking && pickBy === 'pointer') {
      endPick(commit);
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 400);
    }
  };
  scroller.addEventListener('pointerup', release(true));
  scroller.addEventListener('pointercancel', release(false));
  // Once picking, the finger must not scroll the months or the page.
  scroller.addEventListener('touchmove', ev => { if (picking || pending) { if (picking) ev.preventDefault(); } }, {passive: false});
  scroller.addEventListener('contextmenu', ev => ev.preventDefault());

  // Taps land on the transparent scroller: find the card under the finger.
  // A tap on the centred card waits 250 ms: a second tap in that time means
  // "back to this month" (today's cell) instead of switching bars ⇄ heatmap.
  let tapTimer = 0;
  const todayIndex = () => months.findIndex(mo => today >= mo.first && today <= mo.last);
  function backToToday() {
    const i = todayIndex();
    if (i < 0) return;
    const wasHeat = isHeat();
    if (wasHeat) toggleFace();                // the heatmap (and a picked day) goes back to bars
    if (i !== current) goTo(i);
    else if (!wasHeat && !reduce.matches) cards[i]?.querySelector('.ec-bars')
      ?.animate([{transform: 'scale(1)'}, {transform: 'scale(1.12)'}, {transform: 'scale(1)'}], {duration: 360, easing: 'ease-out'});
  }
  scroller.addEventListener('click', ev => {
    if (suppressClick) { suppressClick = false; return; }
    const hit = cardHit(ev.clientX, ev.clientY);
    if (hit < 0) return;
    if (hit === current && settled()) {
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = 0; backToToday(); return; }
      tapTimer = setTimeout(() => { tapTimer = 0; toggleFace(); }, 250);
    } else goTo(hit);
  });
  scroller.addEventListener('keydown', ev => {
    const k = ev.key;
    if (picking && pickBy === 'key') {
      const mo = months[current], step = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7}[k];
      if (step) { ev.preventDefault(); setPickDay(clamp(pickDay + step, mo.first, mo.last)); }
      else if (k === 'Enter' || k === ' ') { ev.preventDefault(); endPick(true); }
      else if (k === 'Escape') { ev.preventDefault(); endPick(false); }
      return;
    }
    if (picking) return;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { ev.preventDefault(); goTo(current + (k === 'ArrowRight' ? 1 : -1)); }
    else if (k === 'Home') { ev.preventDefault(); backToToday(); }
    else if (k === 'Enter' || k === ' ') { ev.preventDefault(); toggleFace(); }
    else if ((k === 'ArrowDown' || k === 'ArrowUp') && settled()) {
      ev.preventDefault();
      if (!isHeat()) toggleFace();
      const mo = months[current];
      beginPick('key', selDay ?? (today >= mo.first && today <= mo.last ? today : mo.first));
    } else if (k === 'Escape' && selDay !== null) { ev.preventDefault(); clearDay(); }
  });

  /* ---------- (re)build ---------- */
  function build(keep) {
    const was = keep && months?.[current];
    buildMonths();
    if (!months.length) { root.hidden = true; return; }
    root.hidden = false;
    cards = months.map(buildCard);
    cardLayer.replaceChildren(...cards);
    snaps = months.map(() => el('span', 'ec-snap'));
    track.replaceChildren(...snaps);
    dots.replaceChildren(...months.map(() => el('i')));
    const t = ymd(today);
    let start = months.findIndex(mo => mo.y === t.y && mo.m === t.m);
    if (was) start = Math.max(0, months.findIndex(mo => mo.y === was.y && mo.m === was.m));
    current = -1;
    select(start < 0 ? 0 : start);
    if (measure()) jumpTo(current);
  }
  build(false);

  // Width changes (the section opening from display:none, rotation): keep the month.
  new ResizeObserver(() => {
    if (picking) return;
    const before = C;
    if (!measure()) { C = 0; return; }
    if (before !== C || !before) jumpTo(current);
  }).observe(stage);
  section?.addEventListener('toggle', () => {
    // Folding the section (or opening it again) drops a picked day.
    if (picking) endPick(false);
    clearDay();
    if (!section.open) { cards.forEach(c => c.classList.remove('is-grown')); return; }
    if (measure()) jumpTo(current);
    updateFade();
    setTimeout(() => grow(current), 180);    // let the section start opening first
  });

  // Coming back to the page on another day (the home-screen app stays open): refresh the statuses.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && taipeiToday() !== today) {
      build(true);
      if (measure()) jumpTo(current);
      if (section?.open) grow(current);
    }
  });
})();
