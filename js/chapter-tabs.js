/* TAIPEI CITY GUIDE — chapter tabs for chapters 03, 04 and 05, v30.9.280.

   Folded, a chapter lists its sections as rows (no + sign). Opening any row turns the
   chapter into "tab mode": the rows become one row of tabs side by side, the open
   section sits below in a box of fixed height (filling the screen, 420–620 px, the same
   for every tab of the chapter, content scrolls inside), the chapter's lead line hides
   and its title shrinks a little; the page glides so the chapter's top glow is at the
   top of the screen.
   Tapping the chosen tab again folds the chapter back to its rows; opening a section of
   another chapter folds it too.

   Motion (v30.9.280): entering, the rows glide up into the tab row, shrinking into tabs,
   while the box grows from nothing; folding, the box shrinks away and the tabs glide
   back down into rows. Switching, the white frame slides to the new tab with a little
   stretch (its front edge first, then the back, a small settle), and the new section
   slides in from that side — except between 夜市マップ and 街歩きエリア, where the map
   stays and only its places change (js/night-markets.js).

   The <details> blocks stay as they are (every script that works with them keeps
   working); in tab mode their own titles are hidden and only the chosen one shows. */
(() => {
  'use strict';
  const CHAPTERS = [
    {heading: 'sights-heading', tabs: ['🏛 名所・博物館', '📷 撮影スポット', '📅 イベント']},
    {heading: 'spots-heading', tabs: ['🏮 夜市マップ', '📍 街歩きエリア']},
    {heading: 'experiences-heading', tabs: ['✨ 体験', '🎁 お土産・コスメ']},
  ];
  const MIN_H = 420, MAX_H = 620, BOTTOM_AIR = 24, TITLE_SCALE = .84;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(.22,.8,.3,1)';
  const inner = ch => ch.roots[ch.current]?.querySelector(':scope > .indented');
  const boxH = ch => (parseFloat(ch.roots[ch.current]?.style.getPropertyValue('--ct-h')) || 520) - 2;
  function growIn(ch) {
    if (reduce.matches) return;
    ch.bar.animate([{opacity: 0, transform: 'translateY(-6px)'}, {opacity: 1, transform: 'none'}], {duration: 260, easing: EASE});
    // max-height animates (the box's height itself is an !important rule, which wins over animations)
    inner(ch)?.animate([{maxHeight: '0px', opacity: 0}, {maxHeight: boxH(ch) + 'px', opacity: 1}], {duration: 460, easing: EASE});
  }
  function slideIn(ch, dir) {
    if (reduce.matches) return;
    inner(ch)?.animate([{opacity: 0, transform: `translate3d(${dir * 44}px,0,0)`}, {opacity: 1, transform: 'none'}], {duration: 400, easing: EASE});
  }
  const isMapRoot = r => !!r && (r.id === 'night-markets-section' || r.classList.contains('has-area-map'));
  // The white frame of the chosen tab: slides with a stretch (front edge leads, back follows).
  function placeInd(ch, from) {
    const b = ch.buttons[ch.current];
    if (!b || !ch.ind) return;
    const x1 = b.offsetLeft, w1 = b.offsetWidth;
    if (from && !reduce.matches && Math.abs(from.x - x1) > 1) {
      const right = x1 > from.x;
      const reach = right ? x1 + w1 - from.x : from.x + from.w - x1;
      const kf = right
        ? [{left: from.x + 'px', width: from.w + 'px'}, {left: from.x + 'px', width: reach * .88 + 'px', offset: .4},
           {left: x1 - 5 + 'px', width: w1 + 7 + 'px', offset: .74}, {left: x1 + 'px', width: w1 + 'px'}]
        : [{left: from.x + 'px', width: from.w + 'px'}, {left: from.x + from.w - reach * .88 + 'px', width: reach * .88 + 'px', offset: .4},
           {left: x1 - 2 + 'px', width: w1 + 7 + 'px', offset: .74}, {left: x1 + 'px', width: w1 + 'px'}];
      ch.ind.animate(kf, {duration: 540, easing: 'cubic-bezier(.3,.7,.25,1)'});
    }
    ch.ind.style.left = x1 + 'px'; ch.ind.style.width = w1 + 'px';
  }
  const indAt = ch => ch.ind && ch.current >= 0 ? {x: ch.ind.offsetLeft, w: ch.ind.offsetWidth} : null;
  // Row ⇄ tab morph: stand-ins in page coordinates (they ride along with the page glide),
  // from one set of boxes to the other, the label cross-fading (text never stretches).
  function morph(ch, fromRects, toRects, fromLabels, toLabels, chosen, toTabs, done) {
    const sample = ch.roots[0], cs = getComputedStyle(sample), sum = sample.querySelector(':scope > summary');
    const rowLine = cs.borderTopColor, rowBg = cs.backgroundColor, rowRadius = cs.borderTopLeftRadius;
    const rowFont = sum ? getComputedStyle(sum.querySelector('h3') || sum).fontSize : '16px';
    const hi = getComputedStyle(ch.bar).getPropertyValue('--ct-hi').trim() || '#E4E4E2';
    const ink = getComputedStyle(ch.h2).color;
    const layer = document.createElement('div');
    layer.className = 'ct-morph'; layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    const anims = fromRects.map((a, i) => {
      const b = toRects[i];
      const g = document.createElement('div'); g.className = 'ct-ghost';
      const t0 = document.createElement('span'), t1 = document.createElement('span');
      t0.textContent = fromLabels[i]; t1.textContent = toLabels[i];
      const rowText = toTabs ? t0 : t1, tabText = toTabs ? t1 : t0;
      rowText.className = 'ct-ghost-row'; rowText.style.fontSize = rowFont;
      tabText.className = 'ct-ghost-tab';
      g.append(t0, t1); g.style.color = ink; layer.append(g);
      const rowBox = {r: rowRadius, line: rowLine, bg: rowBg};
      const tabBox = {r: '100px', line: i === chosen ? hi : 'transparent', bg: 'transparent'};
      const A = toTabs ? rowBox : tabBox, B = toTabs ? tabBox : rowBox;
      const at = (r, x) => ({left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', width: r.width + 'px', height: r.height + 'px',
        borderRadius: x.r, borderColor: x.line, backgroundColor: x.bg});
      const opts = {duration: 480, delay: i * 30, easing: 'cubic-bezier(.3,.75,.25,1)', fill: 'both'};
      const moves = [g.animate([at(a, A), at(b, B)], opts),
        t0.animate([{opacity: 1}, {opacity: 0}], {...opts, duration: 260}),
        t1.animate([{opacity: 0}, {opacity: 1}], {...opts, delay: opts.delay + 180, duration: 300})];
      return Promise.all(moves.map(m => m.finished.catch(() => {})));
    });
    Promise.all(anims).then(() => { layer.remove(); done && done(); });
  }
  const rowLabel = r => (r.querySelector(':scope > summary')?.textContent || '').trim().replace(/\s+/g, ' ');
  function rowsIn(ch) {
    if (reduce.matches) return;
    ch.roots.forEach((r, i) => r.animate([{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}],
      {duration: 320, delay: i * 45, easing: EASE, fill: 'backwards'}));
  }

  // Bottom safe area (home indicator), read once from a probe.
  let insetBottom = 0;
  const readInset = () => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
    document.body.append(probe); insetBottom = probe.getBoundingClientRect().height; probe.remove();
  };

  const chapters = CHAPTERS.map((cfg, ci) => {
    const h2 = document.getElementById(cfg.heading);
    if (!h2) return null;
    let hr = h2.previousElementSibling;
    while (hr && !hr.matches('hr.chapter-divider')) hr = hr.previousElementSibling;
    let lead = h2.nextElementSibling;
    while (lead && !lead.matches('p.chapter-lead') && !lead.matches('details')) lead = lead.nextElementSibling;
    if (lead && !lead.matches('p.chapter-lead')) lead = null;
    const roots = [];
    for (let n = h2.nextElementSibling; n && !n.matches('hr.chapter-divider'); n = n.nextElementSibling) {
      if (n.matches('details.root-accordion')) roots.push(n);
    }
    if (roots.length < 2) return null;
    // The tab row, before the first section.
    const bar = document.createElement('div');
    bar.className = 'ct-tabs'; bar.hidden = true;
    bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', h2.textContent.trim());
    const buttons = roots.map((root, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ct-tab'; b.dataset.i = i;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
      if (root.id) b.setAttribute('aria-controls', root.id);
      b.textContent = cfg.tabs[i] || root.querySelector(':scope > summary')?.textContent.trim() || '';
      bar.append(b);
      return b;
    });
    const ind = document.createElement('span');
    ind.className = 'ct-ind'; ind.setAttribute('aria-hidden', 'true');
    bar.prepend(ind);
    roots[0].before(bar);
    roots.forEach(r => r.classList.add('ct-root'));
    const ch = {i: ci, h2, hr, lead, roots, bar, buttons, ind, on: false, current: -1, h2Size: 0};
    bar.addEventListener('click', ev => {
      const b = ev.target.closest('.ct-tab');
      if (!b) return;
      const i = +b.dataset.i;
      if (ch.folding) return;
      if (i === ch.current) { fold(ch); return; }
      const dir = i > ch.current ? 1 : -1, prev = ch.roots[ch.current], from = indAt(ch);
      choose(ch, i, from);
      if (!(isMapRoot(prev) && isMapRoot(ch.roots[i]))) slideIn(ch, dir);
    });
    bar.addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      const i = (ch.current + (ev.key === 'ArrowRight' ? 1 : -1) + roots.length) % roots.length;
      const dir = i > ch.current ? 1 : -1, prev = ch.roots[ch.current], from = indAt(ch);
      choose(ch, i, from);
      if (!(isMapRoot(prev) && isMapRoot(ch.roots[i]))) slideIn(ch, dir);
      buttons[i].focus();
    });
    roots.forEach((root, i) => root.addEventListener('toggle', () => {
      // Opened by another script (a link, the quick menu): enter tab mode on it.
      if (root.open && !ch.on) enter(ch, i, false);
      // Folded from outside (another chapter opened): leave tab mode.
      else if (!root.open && ch.on && !roots.some(r => r.open)) fold(ch, true);
    }));
    return ch;
  }).filter(Boolean);
  if (!chapters.length) return;
  const chapterOf = details => chapters.find(ch => ch.roots.includes(details));
  // Any other section opening (chapter 01, a link…) folds a chapter in tab mode.
  document.addEventListener('toggle', ev => {
    const d = ev.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open || !d.matches('details.root-accordion') || chapterOf(d)) return;
    chapters.forEach(ch => { if (ch.on) fold(ch, true); });
  }, true);

  // A tap on a folded row enters tab mode instead of the usual accordion opening.
  document.addEventListener('click', ev => {
    const summary = ev.target.closest('summary');
    const details = summary?.parentElement;
    const ch = details && chapterOf(details);
    if (!ch || summary !== details.querySelector(':scope > summary')) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (!ch.folding) enter(ch, ch.roots.indexOf(details), true);
  }, true);

  function enter(ch, index, glide) {
    if (!insetBottom) readInset();
    // One chapter in tab mode at a time; other open sections fold, as before.
    chapters.forEach(other => { if (other !== ch && other.on) fold(other, true); });
    document.querySelectorAll('#guide details.root-accordion[open]').forEach(d => { if (!ch.roots.includes(d)) d.open = false; });
    const was = ch.on;
    const morphing = !was && glide && !reduce.matches;
    const fromRects = morphing ? ch.roots.map(r => r.getBoundingClientRect()) : null;
    const fromLabels = morphing ? ch.roots.map(rowLabel) : null;
    if (!ch.on) {
      ch.on = true;
      if (!ch.h2Size) ch.h2Size = parseFloat(getComputedStyle(ch.h2).fontSize) || 0;
      if (ch.h2Size) ch.h2.style.setProperty('--ct-title', (ch.h2Size * TITLE_SCALE).toFixed(2) + 'px');
      ch.h2.classList.add('ct-title-small');
      ch.lead?.classList.add('ct-hidden');
      ch.bar.hidden = false;
      ch.roots.forEach(r => r.classList.add('ct-on'));
    }
    choose(ch, index);
    if (morphing) {
      ch.bar.classList.add('ct-morphing');
      const toRects = ch.buttons.map(b => b.getBoundingClientRect());
      morph(ch, fromRects, toRects, fromLabels, ch.buttons.map(b => b.textContent), index, true, () => ch.bar.classList.remove('ct-morphing'));
      if (!reduce.matches) ch.bar.animate([{borderColor: 'transparent'}, {}], {duration: 480, easing: 'ease-out'});
      const box = inner(ch);
      box?.animate([{maxHeight: '0px', opacity: 0}, {maxHeight: boxH(ch) + 'px', opacity: 1}], {duration: 460, delay: 60, easing: EASE, fill: 'backwards'});
    } else if (!was && glide) growIn(ch);
    if (glide && ch.hr) {
      const go = () => window.tabiGlideTo ? window.tabiGlideTo(ch.hr, 0)
        : window.scrollTo({top: ch.hr.getBoundingClientRect().top + scrollY, behavior: reduce.matches ? 'auto' : 'smooth'});
      requestAnimationFrame(go);
    }
  }

  function choose(ch, index, from) {
    const target = ch.roots[index];
    ch.current = index;
    ch.roots.forEach((r, i) => r.classList.toggle('ct-selected', i === index));
    ch.buttons.forEach((b, i) => { b.setAttribute('aria-selected', String(i === index)); b.tabIndex = i === index ? 0 : -1; });
    placeInd(ch, from);
    // Open the new one first, so the chapter never has nothing open.
    if (!target.open) target.open = true;
    ch.roots.forEach((r, i) => { if (i !== index && r.open) r.open = false; });
    size(ch);
  }

  function fold(ch, quiet) {
    if (!ch.on || ch.folding) return;
    if (!quiet && !reduce.matches) {
      // Shrink the box away first, then bring the rows back.
      ch.folding = true;
      const box = inner(ch), h = box ? box.getBoundingClientRect().height : 0;
      const bar = ch.bar.animate([{opacity: 1}, {opacity: 0}], {duration: 220, easing: 'ease-in', fill: 'forwards'});
      const a = box?.animate([{maxHeight: h + 'px', opacity: 1}, {maxHeight: '0px', opacity: 0}], {duration: 280, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards'});
      const tabRects = ch.buttons.map(b => b.getBoundingClientRect()), chosen = ch.current;
      const tabLabels = ch.buttons.map(b => b.textContent);
      (a ? a.finished : Promise.resolve()).catch(() => {}).then(() => {
        // Stand-ins leave from where the tabs were; the rows appear when they arrive.
        const at = tabRects.map(r => ({left: r.left, top: r.top, width: r.width, height: r.height}));
        ch.folding = false;
        doFold(ch, false);
        bar.cancel(); a?.cancel();
        const rowRects = ch.roots.map(r => r.getBoundingClientRect());
        ch.roots.forEach(r => { r.style.visibility = 'hidden'; });
        morph(ch, at, rowRects, tabLabels, ch.roots.map(rowLabel), chosen, false, () => ch.roots.forEach(r => { r.style.visibility = ''; }));
      });
      return;
    }
    doFold(ch, quiet);
  }
  function doFold(ch, quiet) {
    ch.on = false; ch.current = -1;
    ch.roots.forEach(r => { r.classList.remove('ct-on', 'ct-selected'); r.style.removeProperty('--ct-h'); });
    ch.roots.forEach(r => { if (r.open) r.open = false; });
    ch.h2.classList.remove('ct-title-small');
    ch.lead?.classList.remove('ct-hidden');
    ch.bar.hidden = true;
    ch.buttons.forEach(b => { b.setAttribute('aria-selected', 'false'); b.tabIndex = 0; });
    if (!quiet && ch.h2.getBoundingClientRect().top < 0) {
      window.tabiGlideTo ? window.tabiGlideTo(ch.hr || ch.h2, 0) : ch.h2.scrollIntoView({block: 'start'});
    }
  }

  // The box height: from the box's top (with the chapter glow at the top of the screen)
  // down to the bottom of the screen, within MIN_H–MAX_H; the same for every tab.
  function size(ch) {
    const box = ch.roots[ch.current];
    if (!box || !ch.hr) return;
    const top = box.getBoundingClientRect().top - ch.hr.getBoundingClientRect().top;
    const h = Math.round(Math.min(MAX_H, Math.max(MIN_H, window.innerHeight - top - BOTTOM_AIR - insetBottom)));
    ch.roots.forEach(r => r.style.setProperty('--ct-h', h + 'px'));
    requestAnimationFrame(() => {
      window.tabiSyncTeasers?.();                      // venue lists fill the box
      window.tabiFitLists?.();
      window.dispatchEvent(new Event('ct-resize'));   // maps re-measure
    });
  }
  window.addEventListener('resize', () => chapters.forEach(ch => { if (ch.on) { size(ch); placeInd(ch); } }));
})();
