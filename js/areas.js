/* v30.9.211 — 注目の街歩きエリア from data/areas.js (window.TABI_AREAS).
   Builds the hidden source markup (tab pills → area panels → category chips →
   numbered venue lists) that the area browser in guide.js reads. It runs
   before guide.js, so every module sees the finished markup on first load.
   Data schema (also used by editor/directory.html):
   {schemaVersion:1, type:'areas', groups:[{id,title,subtitle,description,tone,toneLight,
     categories:[{id,title,items:[{id,name,mapUrl,className,tags:[{text,tone}],links:[{type,label,url}]}]}]}]}
   Areas are listed in display order (two columns, row by row). */
(() => {
  'use strict';
  const root = document.querySelector('#guide details.area-directory-section:not(.night-market-section)');
  const host = root?.querySelector(':scope > .indented > .tab');
  if (!host) return;
  const doc = window.TABI_AREAS;
  const fail = text => {
    const p = document.createElement('p');
    p.className = 'directory-loading';
    p.textContent = text;
    host.replaceChildren(p);
  };
  if (!doc || doc.schemaVersion !== 1 || doc.type !== 'areas' || !Array.isArray(doc.groups) || !doc.groups.length) {
    fail('街歩きエリアを読み込めませんでした。ページを再読み込みしてください。');
    return;
  }
  const safeUrl = raw => {
    if (typeof raw !== 'string' || !raw.trim()) return '';
    try {
      const url = new URL(raw, document.baseURI);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  };
  // '#CE7A7A' → '206,122,122' (the area browser composes rgba() from it).
  const rgbTriple = hex => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '';
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  };
  const node = (tag, attrs = {}, text) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      el.setAttribute(key, value === true ? '' : String(value));
    }
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const idOf = (value, prefix, index) => (typeof value === 'string' && /^[\w-]+$/.test(value)) ? value : `${prefix}-${index}`;

  const pills = node('div', {'aria-label': 'カテゴリーを選択', class: 'tab-pills', role: 'tablist'});
  const panels = node('div', {class: 'tab-panels'});
  doc.groups.forEach((area, a) => {
    if (!area || !Array.isArray(area.categories)) return;
    const panelId = idOf(area.id, 'walk-area', a);
    const title = String(area.title || '').trim() || `エリア ${a + 1}`;
    pills.append(node('button', {
      'aria-controls': panelId, 'aria-selected': String(a === 0), class: 'tab-pill', id: `pill-${panelId}`,
      role: 'tab', tabindex: a === 0 ? 0 : -1, type: 'button',
      'data-walk-sub': String(area.subtitle || ''), 'data-walk-tone': rgbTriple(area.tone),
      'data-walk-tone-light': rgbTriple(area.toneLight)
    }, title));
    const panel = node('div', {'aria-labelledby': `pill-${panelId}`, class: 'tab-panel area-panel', hidden: a !== 0, id: panelId, role: 'tabpanel'});
    const intro = node('div', {class: 'area-intro'});
    intro.append(node('p', {class: 'area-intro-title'}, title), node('p', {class: 'area-intro-description'}, String(area.description || '')));
    const chips = node('div', {'aria-label': 'カテゴリーを選択', class: 'area-cats', role: 'tablist'});
    const panes = node('div', {class: 'area-cat-panes'});
    const categories = area.categories.filter(cat => cat && Array.isArray(cat.items));
    categories.forEach((cat, c) => {
      const paneId = idOf(cat.id, `${panelId}-cat`, c);
      const items = cat.items.filter(item => item && typeof item.name === 'string' && item.name.trim());
      const chip = node('button', {'aria-controls': paneId, 'aria-selected': String(c === 0), class: 'area-cat', id: `cat-${paneId}`,
        role: 'tab', tabindex: c === 0 ? 0 : -1, type: 'button'}, String(cat.title || ''));
      chip.append(node('span', {class: 'area-cat-count'}, String(items.length)));
      chips.append(chip);
      const pane = node('div', {'aria-labelledby': `cat-${paneId}`, class: 'area-cat-pane', id: paneId, role: 'tabpanel', hidden: c !== 0});
      items.forEach((item, i) => {
        const n = i + 1;
        const ol = node('ol', {class: n >= 10 ? 'numbered-list numbered-list-digits-2' : 'numbered-list', dir: 'auto',
          'data-directory-type': 'areas', start: n, type: '1'});
        const li = node('li', {class: item.className === '' ? false : 'venue-list-item'});
        const labels = (Array.isArray(item.tags) ? item.tags : []).filter(t => t && typeof t.text === 'string' && t.text.trim());
        if (labels.length) {
          li.dataset.directoryTagsFull = '1';
          li.dataset.curatedTags = labels.map(t => t.text.trim()).join('、');
          const colors = {};
          labels.forEach(t => { if (['neutral', 'gold', 'red'].includes(t.tone)) colors[t.text.trim()] = t.tone; });
          if (Object.keys(colors).length) li.dataset.tagColors = JSON.stringify(colors);
        }
        const href = safeUrl(item.mapUrl);
        li.append(href ? node('a', {href, rel: 'noopener noreferrer', target: '_blank'}, item.name.trim()) : node('span', {}, item.name.trim()));
        for (const link of Array.isArray(item.links) ? item.links : []) {
          const url = safeUrl(link?.url);
          if (!url || !String(link.label || '').trim()) continue;
          li.append(node('a', {class: link.type === 'map' ? false : 'external-action-link', href: url, rel: 'noopener noreferrer', target: '_blank'},
            String(link.label).trim()));
        }
        ol.append(li);
        pane.append(ol);
      });
      panes.append(pane);
    });
    panel.append(intro, chips, panes);
    panels.append(panel);
  });
  host.replaceChildren(pills, panels);
})();
