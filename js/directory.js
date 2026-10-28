/* v30.9.185 — 03 Sights / 05 Experiences & Souvenirs data source.
   Data schema: data/{sights,experiences,souvenirs}.json.
   The original bubble groups and their panel IDs remain in index.html. */
(() => {
  'use strict';
  const TYPES = ['sights', 'experiences', 'souvenirs'];
  const ALLOWED = new Set(['A', 'BR', 'EM', 'MARK', 'STRONG', 'SPAN', 'SMALL', 'B', 'I']);
  const source = document.currentScript?.src || document.baseURI;
  const dataUrl = (type) => new URL('../data/' + type + '.json', source);

  function safeUrl(raw) {
    if (typeof raw !== 'string') return '';
    try {
      const url = new URL(raw, document.baseURI);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  // Rich legacy annotations are restricted to the few inline tags used by
  // this guide; links are rebuilt with a safe URL and noopener protection.
  function safeDetail(value) {
    const template = document.createElement('template');
    template.innerHTML = typeof value === 'string' ? value : '';
    const output = document.createDocumentFragment();
    function appendSafe(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.append(document.createTextNode(node.nodeValue));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'TEMPLATE', 'SVG'].includes(node.tagName)) return;
        if (!ALLOWED.has(node.tagName)) {
          [...node.childNodes].forEach(child => appendSafe(child, parent));
          return;
        }
        const element = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === 'A') {
          const href = safeUrl(node.getAttribute('href'));
          if (!href) {
            [...node.childNodes].forEach(child => appendSafe(child, parent));
            return;
          }
          element.href = href;
          element.target = '_blank';
          element.rel = 'noopener noreferrer';
          if (node.classList.contains('external-action-link')) element.className = 'external-action-link';
        }
        if (node.tagName === 'MARK' && node.classList.contains('highlight-gray'))
          element.className = 'highlight-gray';
        [...node.childNodes].forEach(child => appendSafe(child, element));
        parent.append(element);
      }
    }
    [...template.content.childNodes].forEach(node => appendSafe(node, output));
    return output;
  }

  function renderPanel(list, items) {
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      if (!item || typeof item.name !== 'string' || !item.name.trim()) return;
      const li = document.createElement('li');
      if (item.className === 'venue-list-item' || !('className' in item)) li.className = 'venue-list-item';
      if (typeof item.curatedTags === 'string' && item.curatedTags.trim())
        li.dataset.curatedTags = item.curatedTags.trim();
      const url = safeUrl(item.url);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = item.name;
        li.append(a);
      } else {
        const span = document.createElement('span');
        span.textContent = item.name;
        li.append(span);
      }
      li.append(safeDetail(item.detailHtml));
      fragment.append(li);
    });
    list.replaceChildren(fragment);
  }

  function showError(type, text) {
    document.querySelectorAll('[data-directory-type="' + type + '"]').forEach(el => {
      const li = document.createElement('li');
      li.className = 'directory-loading';
      li.textContent = text;
      el.replaceChildren(li);
    });
  }

  async function load(type) {
    try {
      const response = await fetch(dataUrl(type), {cache: 'no-cache'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const doc = await response.json();
      if (doc.schemaVersion !== 1 || doc.type !== type || !Array.isArray(doc.groups))
        throw new Error('Invalid directory schema');
      const categories = new Map();
      for (const group of doc.groups) {
        if (!Array.isArray(group.categories)) throw new Error('Invalid directory categories');
        for (const category of group.categories) {
          if (!category.id || !Array.isArray(category.items) || categories.has(category.id))
            throw new Error('Invalid or repeated category ID');
          categories.set(category.id, category.items);
        }
      }
      document.querySelectorAll('[data-directory-type="' + type + '"]').forEach(list => {
        const items = categories.get(list.dataset.directoryPanel);
        if (!items) throw new Error('Missing panel ' + list.dataset.directoryPanel);
        renderPanel(list, items);
      });
      window.tabiEnhanceVenueRows?.();
      // Some existing bubble-height calculations run during the first paint.
      // Refresh those calculations after the asynchronous rows are present.
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      return doc;
    } catch (error) {
      console.error('[TAIPEI CITY GUIDE] Failed to load ' + type, error);
      showError(type, '一覧を読み込めませんでした。ページを再読み込みしてください。');
      return null;
    }
  }

  // Public promise is useful for visual regression checks and future tools.
  window.tabiDirectoryReady = Promise.all(TYPES.map(load));
})();
