/* TAIPEI CITY GUIDE — chapter tabs for chapters 03, 04 and 05, v30.9.284.

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
  // v30.9.281: every motion about 1.4–1.5× slower and softer (less flashing).
  const EASE = 'cubic-bezier(.25,.8,.25,1)';
  const inner = ch => ch.roots[ch.current]?.querySelector(':scope > .indented');
  const boxH = ch => (parseFloat(ch.roots[ch.current]?.style.getPropertyValue('--ct-h')) || 520) - 2;
  function growIn(ch) {
    if (reduce.matches) return;
    ch.bar.animate([{opacity: 0, transform: 'translateY(-6px)'}, {opacity: 1, transform: 'none'}], {duration: 380, easing: EASE});
    // max-height animates (the box's height itself is an !important rule, which wins over animations)
    inner(ch)?.animate([{maxHeight: '0px', opacity: 0}, {maxHeight: boxH(ch) + 'px', opacity: 1}], {duration: 660, easing: EASE});
  }
  function slideIn(ch, dir) {
    if (reduce.matches) return;
    // Never from fully transparent: the content stays faintly in view, so nothing flashes.
    inner(ch)?.animate([{opacity: .25, transform: `translate3d(${dir * 26}px,0,0)`}, {opacity: 1, transform: 'none'}], {duration: 580, easing: EASE});
  }
  // v30.9.284: entering and folding run every part on one clock and one curve (stand-ins,
  // box, title, lead line), and the block keeps the rows' height at its start/end, so
  // nothing below jumps and the tabs and the box move together.
  const SYNC = 700, CURVE = 'cubic-bezier(.65,0,.35,1)';
  const outerTop = el => el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).marginTop) || 0);
  const outerBottom = el => el.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(el).marginBottom) || 0);
  function rememberRows(ch) {            // the folded layout, relative to the chapter's top line
    const base = ch.hr.getBoundingClientRect().top;
    ch.rowOff = ch.roots.map(r => { const b = r.getBoundingClientRect(); return {dy: b.top - base, left: b.left, width: b.width, height: b.height}; });
    ch.rowsBlock = outerBottom(ch.roots[ch.roots.length - 1]) - outerTop(ch.roots[0]);
    const sum = ch.roots[0].querySelector(':scope > summary'), h3 = sum?.querySelector('h3') || sum;
    if (h3) {
      const rb = ch.roots[0].getBoundingClientRect(), hb = h3.getBoundingClientRect(), hs = getComputedStyle(h3);
      ch.rowText = {x: hb.left - rb.left, size: hs.fontSize, weight: hs.fontWeight, spacing: hs.letterSpacing};
    }
    if (ch.lead) { const ls = getComputedStyle(ch.lead); ch.leadBox = {h: ch.lead.getBoundingClientRect().height, mt: ls.marginTop, mb: ls.marginBottom}; }
  }
  const rowTarget = (ch, i) => () => {
    const base = ch.hr.getBoundingClientRect().top, o = ch.rowOff[i];
    return {left: o.left, top: base + o.dy, width: o.width, height: o.height};
  };
  const tabBlock = ch => outerBottom(ch.roots[ch.current]) - outerTop(ch.bar);
  function leadMotion(ch, hide) {
    if (!ch.lead || !ch.leadBox) return;
    const L = ch.leadBox;
    const full = {maxHeight: L.h + 'px', opacity: 1, marginTop: L.mt, marginBottom: L.mb};
    const none = {maxHeight: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px'};
    ch.lead.getAnimations().forEach(x => x.cancel());
    ch.lead.classList.remove('ct-hidden'); ch.lead.style.overflow = 'hidden';
    const a = ch.lead.animate(hide ? [full, none] : [none, full], {duration: SYNC, easing: CURVE, fill: 'forwards'});
    a.finished.then(() => { if (hide && ch.on) ch.lead.classList.add('ct-hidden'); ch.lead.style.removeProperty('overflow'); a.cancel(); }, () => {});
  }
  // While the box opens or shuts, its content keeps its full size and is only clipped:
  // squeezing it would make maps and lists re-measure every frame (and stutter).
  function freeze(box) {
    if (!box) return () => {};
    const kids = [...box.children], hs = kids.map(k => k.getBoundingClientRect().height);
    kids.forEach((k, i) => { if (hs[i]) { k.style.setProperty('height', hs[i] + 'px', 'important'); k.style.setProperty('flex', 'none', 'important'); } });
    box.style.setProperty('overflow', 'hidden', 'important');
    return () => { kids.forEach(k => { k.style.removeProperty('height'); k.style.removeProperty('flex'); }); box.style.removeProperty('overflow'); };
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
      ch.ind.animate(kf, {duration: 760, easing: 'cubic-bezier(.3,.7,.25,1)'});
    }
    ch.ind.style.left = x1 + 'px'; ch.ind.style.width = w1 + 'px';
  }
  const indAt = ch => ch.ind && ch.current >= 0 ? {x: ch.ind.offsetLeft, w: ch.ind.offsetWidth} : null;
  // Row ⇄ tab morph: stand-ins in page coordinates. v30.9.282: their geometry is driven
  // frame by frame towards the target's *current* box (the title shrinks/grows at the same
  // time and moves the tabs or rows), so they land exactly where the real ones are.
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function morph(ch, fromRects, targets, fromLabels, toLabels, chosen, toTabs, done) {
    const sample = ch.roots[0], cs = getComputedStyle(sample), sum = sample.querySelector(':scope > summary');
    const rowLine = cs.borderTopColor, rowBg = cs.backgroundColor, rowRadius = cs.borderTopLeftRadius;
    const rt = ch.rowText || {x: 16, size: sum ? getComputedStyle(sum.querySelector('h3') || sum).fontSize : '16px', weight: '700', spacing: 'normal'};
    const hi = getComputedStyle(ch.bar).getPropertyValue('--ct-hi').trim() || '#E4E4E2';
    const ink = getComputedStyle(ch.h2).color;
    const layer = document.createElement('div');
    layer.className = 'ct-morph'; layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
    const DUR = SYNC, STAGGER = 0, sx = scrollX, sy = scrollY;
    const ghosts = fromRects.map((a, i) => {
      const g = document.createElement('div'); g.className = 'ct-ghost';
      const t0 = document.createElement('span'), t1 = document.createElement('span');
      t0.textContent = fromLabels[i]; t1.textContent = toLabels[i];
      const rowText = toTabs ? t0 : t1, tabText = toTabs ? t1 : t0;
      rowText.className = 'ct-ghost-row';
      Object.assign(rowText.style, {left: rt.x + 'px', fontSize: rt.size, fontWeight: rt.weight, letterSpacing: rt.spacing});
      tabText.className = 'ct-ghost-tab';
      tabText.style.color = getComputedStyle(ch.buttons[i]).color;   // chosen tab ink, others grey, as the real tabs
      g.append(t0, t1); g.style.color = ink; layer.append(g);
      const rowBox = {borderRadius: rowRadius, borderColor: rowLine, backgroundColor: rowBg};
      const tabBox = {borderRadius: '100px', borderColor: i === chosen ? hi : 'transparent', backgroundColor: 'transparent'};
      const delay = i * STAGGER, ease = CURVE;
      g.animate([toTabs ? rowBox : tabBox, toTabs ? tabBox : rowBox], {duration: DUR, delay, easing: ease, fill: 'both'});
      t0.animate([{opacity: 1}, {opacity: 0}], {duration: 420, delay, easing: 'ease-out', fill: 'both'});
      t1.animate([{opacity: 0}, {opacity: 1}], {duration: 460, delay: delay + 280, easing: 'ease-in-out', fill: 'both'});
      return {g, delay, from: {x: a.left + sx, y: a.top + sy, w: a.width, h: a.height}, target: targets[i]};
    });
    const place = (o, x, y, w, h) => { o.g.style.left = x + 'px'; o.g.style.top = y + 'px'; o.g.style.width = w + 'px'; o.g.style.height = h + 'px'; };
    ghosts.forEach(o => place(o, o.from.x, o.from.y, o.from.w, o.from.h));
    const t0 = performance.now();
    const step = now => {
      let running = false;
      for (const o of ghosts) {
        const k = Math.min(1, Math.max(0, (now - t0 - o.delay) / DUR)), e = easeInOut(k);
        const r = o.target(); // where the real tab / row is right now
        const to = {x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height}, f = o.from;
        place(o, f.x + (to.x - f.x) * e, f.y + (to.y - f.y) * e, f.w + (to.w - f.w) * e, f.h + (to.h - f.h) * e);
        if (k < 1) running = true;
      }
      if (running) { requestAnimationFrame(step); return; }
      // Hand over to the real elements first, drop the stand-ins on the next frame.
      done && done(); requestAnimationFrame(() => layer.remove());
    };
    requestAnimationFrame(step);
  }
  function holdTabs(ch, rects, labels, chosen) {
    const hi = getComputedStyle(ch.bar).getPropertyValue('--ct-hi').trim() || '#E4E4E2';
    const layer = document.createElement('div');
    layer.className = 'ct-morph'; layer.setAttribute('aria-hidden', 'true');
    rects.forEach((r, i) => {
      const g = document.createElement('div'); g.className = 'ct-ghost';
      const t = document.createElement('span'); t.className = 'ct-ghost-tab'; t.textContent = labels[i];
      g.append(t);
      g.style.cssText = `left:${r.left + scrollX}px;top:${r.top + scrollY}px;width:${r.width}px;height:${r.height}px;border-radius:100px;` +
        `border-color:${i === chosen ? hi : 'transparent'};color:${getComputedStyle(ch.buttons[i]).color}`;
      layer.append(g);
    });
    document.body.append(layer);
    return layer;
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
    h2.classList.add('ct-title');
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
    if (!was) rememberRows(ch);
    const fromRects = morphing ? ch.roots.map(r => r.getBoundingClientRect()) : null;
    const fromLabels = morphing ? ch.roots.map(rowLabel) : null;
    if (!ch.on) {
      ch.on = true;
      if (!ch.h2Size) ch.h2Size = parseFloat(getComputedStyle(ch.h2).fontSize) || 0;
      if (ch.h2Size) ch.h2.style.setProperty('--ct-title', (ch.h2Size * TITLE_SCALE).toFixed(2) + 'px');
      ch.h2.classList.add('ct-title-small');
      if (!morphing) ch.lead?.classList.add('ct-hidden');
      ch.bar.hidden = false;
      ch.roots.forEach(r => r.classList.add('ct-on'));
    }
    choose(ch, index);
    if (morphing) {
      window.tabiTabsBusyUntil = performance.now() + SYNC + 120;   // maps wait before their opening glide
      ch.bar.classList.add('ct-morphing');
      leadMotion(ch, true);
      // The tab row + box start exactly as tall as the rows were, then the box grows.
      const box = inner(ch), full = boxH(ch);
      const startH = Math.max(0, full - (tabBlock(ch) - ch.rowsBlock));
      const thaw = freeze(box);
      const grow = box?.animate([{maxHeight: startH + 'px', opacity: 0}, {maxHeight: full + 'px', opacity: 1}], {duration: SYNC, easing: CURVE, fill: 'backwards'});
      (grow ? grow.finished : Promise.resolve()).then(thaw, thaw);
      ch.bar.animate([{borderColor: 'transparent'}, {}], {duration: SYNC, easing: CURVE});
      morph(ch, fromRects, ch.buttons.map(b => () => b.getBoundingClientRect()), fromLabels, ch.buttons.map(b => b.textContent), index, true,
        () => ch.bar.classList.remove('ct-morphing'));
    } else if (!was && glide) growIn(ch);
    if (glide && ch.hr) {
      const go = () => window.tabiGlideTo ? window.tabiGlideTo(ch.hr, 0)
        : window.scrollTo({top: ch.hr.getBoundingClientRect().top + scrollY, behavior: reduce.matches ? 'auto' : 'smooth'});
      requestAnimationFrame(go);
    }
  }

  function choose(ch, index, from) {
    const target = ch.roots[index];
    // v30.9.283: let the map move into the new box now, in this same frame (waiting for
    // the toggle event left the new box empty for a moment).
    if (ch.current >= 0 && ch.roots[ch.current] !== target)
      document.dispatchEvent(new CustomEvent('ct-switch', {detail: {from: ch.roots[ch.current], to: target}}));
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
    if (!quiet && !reduce.matches && ch.rowOff) {
      // v30.9.284: the stand-ins fly straight to where the rows will be while the box
      // shrinks to the leftover height, title and lead line on the same clock; the real
      // rows take over exactly when everything arrives.
      ch.folding = true;
      const box = inner(ch), hNow = box ? box.getBoundingClientRect().height : 0;
      const endH = Math.max(0, hNow - (tabBlock(ch) - ch.rowsBlock));
      const tabRects = ch.buttons.map(b => { const r = b.getBoundingClientRect(); return {left: r.left, top: r.top, width: r.width, height: r.height}; });
      const chosen = ch.current, tabLabels = ch.buttons.map(b => b.textContent);
      ch.h2.classList.remove('ct-title-small');
      leadMotion(ch, false);
      const thaw = freeze(box);
      const a = box?.animate([{maxHeight: hNow + 'px', opacity: 1}, {maxHeight: endH + 'px', opacity: 0}], {duration: SYNC, easing: CURVE, fill: 'forwards'});
      if (ch.h2.getBoundingClientRect().top < 0) window.tabiGlideTo ? window.tabiGlideTo(ch.hr || ch.h2, 0) : ch.h2.scrollIntoView({block: 'start'});
      morph(ch, tabRects, ch.roots.map((r, i) => rowTarget(ch, i)), tabLabels, ch.roots.map(rowLabel), chosen, false, () => {
        if (box) { box.style.maxHeight = '0px'; box.style.opacity = '0'; }   // shut before the animation lets go
        a?.cancel();
        ch.folding = false;
        doFold(ch, true);
        thaw();
        if (box) { box.style.removeProperty('max-height'); box.style.removeProperty('opacity'); }
        ch.bar.style.visibility = '';
      });
      ch.bar.style.visibility = 'hidden';   // the stand-ins (created above) cover the tabs from this frame
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
