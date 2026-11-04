/* TAIPEI CITY GUIDE — イベントカレンダー (chapter 03, after 撮影スポット), v30.9.262.
   Data: data/events.js (window.TABI_EVENTS, edited with editor/directory.html).

   Month carousel: one card per month, from last month to the last month with an event.
   The centred card is wide (week bars, or the month heatmap after a tap); its
   neighbours shrink to mini cards. A transparent native scroller (scroll-snap) sits on
   top and drives the drawing, so swiping keeps the phone's own momentum; the cards
   underneath are placed from its scroll position every frame.
   Status (開催中／開催予定／開催終了) is judged against today in Taipei.
   Debug: ?ec-today=2026-12-08 pretends today is that date. */
(() => {
  'use strict';
  const root = document.getElementById('event-calendar');
  if (!root) return;
  const section = root.closest('details');

  /* ---------- dates (whole days, counted from 1970-01-01 UTC) ---------- */
  const DAY = 864e5;
  const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dayOf = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
  const parseDay = s => { const m = ISO.exec(String(s || '')); return m ? dayOf(+m[1], +m[2], +m[3]) : null; };
  const ymd = n => { const d = new Date(n * DAY); return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate()}; };
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
      let start = parseDay(e?.start), end = parseDay(e?.end);
      if (!e || typeof e.name !== 'string' || !e.name.trim() || start === null) return null;
      if (end === null) end = start;
      if (end < start) [start, end] = [end, start];
      const city = String(e.city || '').trim(), venue = String(e.venue || '').trim();
      const mapUrl = safeUrl(e.mapUrl) || (venue ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((city + ' ' + venue).trim()) : '');
      return {name: e.name.trim(), city, category: String(e.category || '').trim(), venue, start, end, url: safeUrl(e.url), mapUrl};
    }).filter(Boolean);
  }

  let today, events, months, maxWeek;
  function buildMonths() {
    today = taipeiToday();
    events = readEvents();
    const t = ymd(today);
    let y = t.m === 1 ? t.y - 1 : t.y, m = t.m === 1 ? 12 : t.m - 1;          // last month
    const lastEnd = events.reduce((a, e) => Math.max(a, e.end), today);
    const stop = ymd(lastEnd), stopKey = stop.y * 12 + stop.m;
    months = [];
    while (y * 12 + m <= stopKey && months.length < 36) {
      const first = dayOf(y, m, 1), dim = new Date(Date.UTC(y, m, 0)).getUTCDate(), last = first + dim - 1;
      const lead = new Date(first * DAY).getUTCDay();                           // weeks start on Sunday
      const inMonth = events.filter(e => e.start <= last && e.end >= first);
      const days = Array.from({length: dim}, (_, i) => inMonth.reduce((n, e) => n + (e.start <= first + i && e.end >= first + i), 0));
      const weeks = [];
      for (let r = 0; r * 7 - lead < dim; r++) {
        const a = Math.max(first, first + r * 7 - lead), b = Math.min(last, first + r * 7 - lead + 6);
        weeks.push(inMonth.filter(e => e.start <= b && e.end >= a).length);
      }
      const status = e => e.end < today ? 'ended' : e.start > today ? 'upcoming' : 'ongoing';
      const order = {ongoing: 0, upcoming: 0, ended: 1};
      const rows = inMonth.map(e => ({...e, status: status(e)}))
        .sort((p, q) => order[p.status] - order[q.status] || p.start - q.start || p.end - q.end || p.name.localeCompare(q.name, 'ja'));
      months.push({y, m, first, last, dim, lead, days, weeks, rows});
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

  /* ---------- build ---------- */
  const stage = el('div', 'ec-stage');
  const cardLayer = el('div', 'ec-cards'); cardLayer.setAttribute('aria-hidden', 'true');
  const scroller = el('div', 'ec-scroller'); scroller.tabIndex = 0;
  scroller.setAttribute('role', 'group'); scroller.setAttribute('aria-roledescription', 'カルーセル');
  const track = el('div', 'ec-track');
  scroller.append(track); stage.append(cardLayer, scroller);
  const dots = el('div', 'ec-dots'); dots.setAttribute('aria-hidden', 'true');
  const summary = el('div', 'ec-summary'); summary.setAttribute('aria-live', 'polite');
  // The list scrolls inside a box of fixed height (the section keeps its size whatever
  // the month holds); the bottom fades while more rows are below, like the other lists.
  const listBox = el('div', 'ec-list-box');
  const listScroll = el('div', 'ec-list-scroll'); listScroll.tabIndex = 0; listScroll.setAttribute('role', 'region');
  const list = el('ul', 'ec-list');
  listScroll.append(list); listBox.append(listScroll);
  root.replaceChildren(stage, dots, summary, listBox);
  function updateFade() {
    const canScroll = listScroll.scrollHeight > listScroll.clientHeight + 5;
    listScroll.classList.toggle('can-scroll', canScroll);
    listScroll.dataset.end = canScroll && listScroll.scrollTop + listScroll.clientHeight >= listScroll.scrollHeight - 8 ? 'true' : 'false';
  }
  listScroll.addEventListener('scroll', updateFade, {passive: true});
  new ResizeObserver(updateFade).observe(listScroll);

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
    mo.weeks.forEach(v => { const b = el('i'); b.style.setProperty('--h', barHeight(v).toFixed(3)); if (!v) b.className = 'is-zero'; barRow.append(b); });
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
      if (mo.first + i === today) cell.classList.add('is-today');
      grid.append(cell);
    });
    heat.append(hhead, grid);
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

  function renderSummary(mo) {
    const n = {ongoing: 0, upcoming: 0, ended: 0};
    mo.rows.forEach(r => n[r.status]++);
    const lead = el('div', 'ec-sum-lead');
    const big = el('strong', 'ec-sum-total'); big.append(String(mo.rows.length), el('small', '', ' イベント'));
    lead.append(el('span', 'ec-sum-month', mo.y + '／' + mo.m + '月'), big);
    const stat = (label, v, cls) => { const s = el('div', 'ec-stat ' + cls); s.append(el('span', '', label), el('strong', '', String(v))); return s; };
    summary.replaceChildren(lead, stat('開催中', n.ongoing, 'is-ongoing'), stat('開催予定', n.upcoming, 'is-upcoming'), stat('開催終了', n.ended, 'is-ended'));
  }

  const STATUS_LABEL = {ongoing: '', upcoming: '開催予定', ended: '開催終了'};
  function renderList(mo) {
    list.replaceChildren();
    if (!mo.rows.length) { list.append(el('li', 'ec-empty', 'この月のイベント情報はまだありません。')); return; }
    for (const r of mo.rows) {
      const li = el('li', 'ec-row is-' + r.status);
      const s = ymd(r.start), e = ymd(r.end);
      const date = el('div', 'ec-date');
      const pad = n => String(n).padStart(2, '0');
      date.append(el('span', 'ec-date-m', s.m + '月'), el('span', 'ec-date-m', r.end === r.start || s.m === e.m && s.y === e.y ? '' : e.m + '月'),
        el('span', 'ec-date-d', pad(s.d)), el('span', 'ec-date-d ec-date-end', r.end === r.start ? '' : pad(e.d)));
      if (r.end === r.start) date.classList.add('is-single');
      date.setAttribute('aria-label', s.m + '月' + s.d + '日' + (r.end === r.start ? '' : '〜' + (s.m === e.m && s.y === e.y ? '' : (s.y !== e.y ? e.y + '年' : '') + e.m + '月') + e.d + '日'));
      const status = el('span', 'ec-status', STATUS_LABEL[r.status]);
      const body = el('div', 'ec-body');
      body.append(el('span', 'ec-meta', [r.city, r.category].filter(Boolean).join('・')));
      if (r.url) {
        const a = el('a', 'ec-name', r.name); a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', r.name + '（公式サイトを開く）');
        body.append(a);
      } else body.append(el('span', 'ec-name', r.name));
      li.append(date, status, body);
      if (r.mapUrl) {
        const go = el('a', 'ec-map'); go.href = r.mapUrl; go.target = '_blank'; go.rel = 'noopener noreferrer';
        go.setAttribute('aria-label', (r.venue || r.name) + 'をGoogleマップで開く'); go.title = r.venue || 'Googleマップ';
        go.append(svgChevron()); li.append(go);
      } else li.append(el('span', 'ec-map is-none'));
      list.append(li);
    }
  }

  /* ---------- geometry ---------- */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const GAP = 10;
  let C = 0, Wf = 0, Wm = 0, S = 1, fullH = [], miniH = 0, stageH = 0, current = -1, frame = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

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
    stage.style.height = stageH + 'px';
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
    cards.forEach((card, i) => {
      const d = Math.min(1, Math.abs(i - p));
      const left = centre[i] - w[i] / 2;
      if (left > C + 20 || left + w[i] < -20) { card.style.visibility = 'hidden'; return; }
      const h = lerp(fullH[i], miniH, d);
      card.style.visibility = '';
      card.style.width = w[i] + 'px';
      card.style.height = h + 'px';
      card.style.transform = `translate3d(${left.toFixed(2)}px,${((stageH - h) / 2).toFixed(2)}px,0)`;
      card.style.setProperty('--ec-near', (1 - d).toFixed(3));
      // The two faces never show at once: the wide one is gone before the mini one appears.
      card.firstChild.style.opacity = clamp(1 - d * 2.5, 0, 1).toFixed(3);
      card.lastChild.style.opacity = clamp((d - .45) / .4, 0, 1).toFixed(3);
    });
    const idx = Math.round(p);
    if (idx !== current) select(idx);
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };

  function select(idx) {
    current = idx;
    const mo = months[idx];
    [...dots.children].forEach((d, i) => d.classList.toggle('is-active', i === idx));
    renderSummary(mo); renderList(mo);
    listScroll.scrollTop = 0;                // a new month starts at its first event
    listScroll.setAttribute('aria-label', mo.y + '年' + mo.m + '月のイベント一覧');
    updateFade();
    scroller.setAttribute('aria-label', mo.y + '年' + mo.m + '月・' + mo.rows.length + '件。左右キーで月を移動、Enterで' + (root.classList.contains('is-heat') ? '棒グラフ' : 'カレンダー') + '表示に切り替え');
  }

  /* ---------- page dots: only while swiping ---------- */
  let quiet = false, dotTimer = 0;
  scroller.addEventListener('scroll', () => {
    schedule();
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
  function toggleFace() {
    const card = cards[current];
    root.classList.add('is-switching');
    root.classList.toggle('is-heat');
    measure(); place();
    if (!reduce.matches) {
      card?.querySelector(root.classList.contains('is-heat') ? '.ec-face-heat' : '.ec-face-bars')
        ?.animate([{opacity: 0}, {opacity: 1}], {duration: 260, easing: 'ease-out'});
    }
    setTimeout(() => root.classList.remove('is-switching'), 320);
    select(current);
  }

  // Taps land on the transparent scroller: find the card under the finger.
  scroller.addEventListener('click', ev => {
    const hit = cards.findIndex(card => {
      if (card.style.visibility === 'hidden') return false;
      const r = card.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    });
    if (hit < 0) return;
    if (hit === current && Math.abs(scroller.scrollLeft - current * S) < 4) toggleFace();
    else goTo(hit);
  });
  scroller.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); goTo(current + (ev.key === 'ArrowRight' ? 1 : -1)); }
    else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleFace(); }
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
    const before = C;
    if (!measure()) { C = 0; return; }
    if (before !== C || !before) jumpTo(current);
  }).observe(stage);
  section?.addEventListener('toggle', () => { if (section.open && measure()) jumpTo(current); if (section.open) updateFade(); });

  // Coming back to the page on another day (the home-screen app stays open): refresh the statuses.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && taipeiToday() !== today) { build(true); if (measure()) jumpTo(current); }
  });
})();
