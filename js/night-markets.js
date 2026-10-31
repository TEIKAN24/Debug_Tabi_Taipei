/* v30.9.217 — 夜市 from data/night-markets.js (window.TABI_NIGHT_MARKETS).
   Builds the night-market tabs (pills → panels) before guide.js runs, so the
   tab, swipe and food-dictionary handlers see the finished markup on first load.
   Data schema (also used by editor/directory.html, tab 🏮 夜市):
   {schemaVersion:1, type:'night-markets', markets:[{
     id, name, lead ('\n' = line break),
     access:{type:'mrt', code, color, station, exit} | {type:'text', label, text},
     hours, crowded, features:[text], specialties:[{label, query}], destination }]}
   Markets are listed in display order. */
(() => {
  'use strict';
  const host = document.getElementById('night-markets-tabs');
  if (!host) return;
  const doc = window.TABI_NIGHT_MARKETS;
  const node = (tag, attrs = {}, text) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      el.setAttribute(key, value === true ? '' : String(value));
    }
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const str = value => (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!doc || doc.schemaVersion !== 1 || doc.type !== 'night-markets' || !Array.isArray(doc.markets) || !doc.markets.length) {
    host.replaceChildren(node('p', {class: 'directory-loading'}, '夜市を読み込めませんでした。ページを再読み込みしてください。'));
    return;
  }
  const idOf = (value, index) => (typeof value === 'string' && /^[\w-]+$/.test(value)) ? value : `market-${index + 1}`;
  const color = value => /^#[0-9a-f]{6}$/i.test(str(value)) ? str(value).toUpperCase() : '#8C8C8C';
  const mapsUrl = destination => 'https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=' + encodeURIComponent(destination);

  const pills = node('div', {'aria-label': '夜市を選択', class: 'tab-pills', role: 'tablist'});
  const panels = node('div', {class: 'tab-panels'});
  const markets = doc.markets.filter(m => m && str(m.name));
  markets.forEach((m, i) => {
    const panelId = 'night-market-' + idOf(m.id, i);
    const name = str(m.name);
    pills.append(node('button', {'aria-controls': panelId, 'aria-selected': String(i === 0), class: 'tab-pill',
      id: 'pill-' + panelId, role: 'tab', tabindex: i === 0 ? 0 : -1, type: 'button'}, name));
    const panel = node('div', {'aria-labelledby': 'pill-' + panelId, class: 'tab-panel night-market-panel',
      hidden: i !== 0, id: panelId, role: 'tabpanel'});
    panel.append(node('h4', {class: 'nm-title'}, name));
    const lead = node('p', {class: 'nm-lead'});
    str(m.lead).split('\n').forEach((part, p) => { if (p) lead.append(node('br')); lead.append(part); });
    panel.append(lead);

    const info = node('dl', {class: 'nm-info'});
    const access = m.access || {};
    if (access.type === 'text') {
      const dd = node('dd');
      dd.append(node('span', {class: 'nm-access'}, str(access.text)));
      info.append(node('dt', {}, str(access.label) || 'アクセス'), dd);
    } else {
      const dd = node('dd');
      const station = node('span', {class: 'nm-station'});
      station.append(node('span', {class: 'nm-line', style: '--nm-line:' + color(access.color)}, str(access.code)), str(access.station));
      dd.append(station);
      if (str(access.exit)) {
        const exit = node('span', {class: 'nm-exit'});
        exit.append(node('span', {class: 'nm-exit-no'}, str(access.exit)), '出口');
        dd.append(exit);
      }
      info.append(node('dt', {}, '最寄り駅'), dd);
    }
    info.append(node('dt', {}, '営業時間'), node('dd', {}, str(m.hours)), node('dt', {}, '混雑時間帯'), node('dd', {}, str(m.crowded)));
    panel.append(info);

    const features = (Array.isArray(m.features) ? m.features : []).map(str).filter(Boolean);
    if (features.length) {
      const ul = node('ul', {class: 'nm-features'});
      features.forEach(text => ul.append(node('li', {}, text)));
      panel.append(node('p', {class: 'nm-feature-label'}, '特徴'), ul);
    }
    const specialties = (Array.isArray(m.specialties) ? m.specialties : []).filter(s => s && str(s.label));
    if (specialties.length) {
      const ul = node('ul', {class: 'nm-specialties'});
      specialties.forEach(s => {
        const label = str(s.label);
        const li = node('li');
        li.append(node('button', {type: 'button', class: 'nm-specialty', 'data-food-query': str(s.query) || label,
          'aria-label': label + 'を料理辞典で見る'}, label));
        ul.append(li);
      });
      panel.append(node('p', {class: 'nm-feature-label nm-specialty-label'}, '名物'), ul);
    }
    const destination = str(m.destination) || name;
    panel.append(node('a', {class: 'nm-go', href: mapsUrl(destination), rel: 'noopener noreferrer', target: '_blank'}, 'さっそく出発！'));
    panels.append(panel);
  });
  host.replaceChildren(pills, panels);
})();
