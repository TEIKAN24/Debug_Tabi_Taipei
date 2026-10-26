/* TAIPEI CITY GUIDE v30 — safe consolidation; source scripts unchanged. */
/* v30.9.150 — align the reverse-side directory bubbles and restore adaptive scroll hints.
   v30.9.113 — data files revalidate (cache:'no-cache') instead of re-downloading.
   v30.9.118 — back-to-top button removed.
   v30.9.148 — route horizontal gestures inside bubble panels and preserve food drawer swipe.
   v30.9.147 — active difficulty chip, drawer-close reset and keyboard-safe search clear.
   v30.9.146 — keep drawer steady when common-character / difficulty chips are tapped.
   v30.9.145 — common-keyword selection and tag/synonym lookup repairs; compact 2×2 difficulty filters.
   v30.9.144 — compact floating window; the page behind stays put (blur + dim); browser bars keep the page colour.
   v30.9.143 — the food dictionary is a floating window pulled in from the right; 常用字リスト panel.
   v30.9.142 — 名物 tiles open the food dictionary drawer with that dish.
   v30.9.134 — 注目の街歩きエリア lists show six complete rows in every district.
   v30.9.133 — five chapters (01–05) with one heading set; the sights chapter follows グルメ; snap targets the chapter number lines.
   v30.9.129 — nested menus keep their own title at the top of the open menu (no pinned copy).
   v30.9.121 — 🥢 食べる・飲む is an always-open section (no accordion) holding おすすめ ⇄ 一覧. */

/* =================== JS 01: behavior-1 =================== */
;
(() => {
  "use strict";
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const firstLevel={
    sights:'3f56bda0-4caa-8046-a491-c25321b680c1',
    areas:'3f66bda0-4caa-800d-95db-dea98f822273',
    experiences:'3f76bda0-4caa-80d2-8841-c76e1f8f749a',
    souvenirs:'3f66bda0-4caa-8038-8328-e8b12e95336f'
  };
  // One open accordion per sibling group, including area subcategories whose
  // Notion-exported <details> do not carry the old .toggle class.
  function closeBranch(detail) {
    detail.querySelectorAll('details[open]').forEach(child => { child.open = false; });
    detail.open = false;
  }
  function closePeerAccordions(detail) {
    if (!detail?.parentElement) return;
    for (const peer of detail.parentElement.children) {
      if (peer !== detail && peer.tagName === 'DETAILS' && peer.open) {
        closeBranch(peer);
      }
    }
  }
  function openAccordion(detail) {
    if (!detail) return;
    closePeerAccordions(detail);
    detail.open = true;
  }
  // Keep the newly opened summary in view after the previous (possibly very
  // long) sibling panel has collapsed. Only user-triggered opens scroll:
  // programmatic initialisation and the homepage navigation keep their own logic.
  function scrollOpenedSummaryIntoView(detail) {
    const summary = detail.querySelector(':scope > summary');
    if (!summary) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!detail.open || summary.getClientRects().length === 0) return;
      summary.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
    }));
  }
  // District, drink and night-market subcategory details open in place.
  // In particular, area rows must not steal keyboard focus or auto-scroll.
  // Switching district, drinks or night-market bubbles resets only the newly
  // selected list to its beginning. The horizontal tab strip stays untouched.
  function prepareGuidedTab(panel) {
    if (!panel) return;
    panel.scrollTop = 0;
  }
  let guidedScrollRequest=0;
  function alignGuidedCategoryAtTop(detail){
    const body=detail.parentElement;
    const summary=detail.querySelector(':scope > summary');
    if(!body || !summary)return;
    const request=++guidedScrollRequest;
    // Opening height animation begins on this same click; wait one paint for
    // expanded content to establish the scroll range. Never call scrollIntoView,
    // which could also move the main document and cause unexpected refocusing.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(request!==guidedScrollRequest || !detail.open || !body.isConnected)return;
      const scrollable=body.scrollHeight>body.clientHeight+3;
      if(!scrollable)return;
      // Once the fixed heading is created, its original summary is removed
      // from layout. Align using the details row itself, not that hidden summary.
      const current=detail.getBoundingClientRect();
      const viewport=body.getBoundingClientRect();
      const wanted=Math.max(0,body.scrollTop+current.top-viewport.top);
      body.scrollTo({top:wanted,behavior:reduceMotion.matches?'instant':'smooth'});
    }));
  }
  const siteContent = document.querySelector('.site-content');
  siteContent?.addEventListener('click', event => {
    const summary = event.target.closest('summary');
    if (!summary || !siteContent.contains(summary)) return;
    const detail = summary.parentElement;
    if (detail?.tagName !== 'DETAILS') return;
    // The inline recommender owns its filter <details>; it is not a guide
    // accordion and must never trigger scrollOpenedSummaryIntoView().
    if (detail.id === 'recommend-advanced') return;
    // A link inside a summary must continue to work like a normal link.
    if (event.target.closest('a, button')) return;
    event.preventDefault(); // avoid a second native <details> toggle
    const isAreaCategory = detail.parentElement?.classList.contains('area-category-list');
    const guidedPanel = detail.closest('.venue-directory-section .tab-panel.guided-focus-panel');
    const isFoodSubcategory = Boolean(guidedPanel && detail.parentElement === guidedPanel.querySelector(':scope > .indented'));
    const isGuidedCategory = isAreaCategory || isFoodSubcategory;
    // Within the three four-row directories, never refocus or move the page
    // just because a nested heading expands. Other accordion types keep their
    // existing scroll-to-open behavior.
    if (detail.open) {
      closeBranch(detail);
    } else {
      openAccordion(detail);
      // Moving just the scrollable list keeps the bubble row, regional intro,
      // and the whole document steady. The title becomes the first visible row.
      if (isGuidedCategory) alignGuidedCategoryAtTop(detail);
      else if (!detail.classList.contains('daytrip-inline-accordion'))
        scrollOpenedSummaryIntoView(detail);
    }
  });
  // Also enforce sibling exclusivity if a detail is opened by other scripts.
  document.querySelectorAll('.site-content details:not(#recommend-advanced)').forEach(detail => {
    detail.addEventListener('toggle', () => {
      if (detail.open) closePeerAccordions(detail);
    });
  });
  function activateTab(tablist, index, moveFocus=false) {
    if(!tablist) return;
    const pills=Array.from(tablist.querySelectorAll(':scope > .tab-pill'));
    const panels=tablist.nextElementSibling?.querySelectorAll(':scope > .tab-panel');
    if(!panels||!pills.length)return;
    index=(index+pills.length)%pills.length;
    pills.forEach((pill,i)=>{
      const on=i===index;
      pill.setAttribute('aria-selected',String(on));
      pill.tabIndex=on?0:-1;
      // Returning to a bubble starts with its deeper options folded up.
      if (!on) panels[i].querySelectorAll('details[open]').forEach(closeBranch);
      panels[i].hidden=!on;
    });
    if(moveFocus) pills[index].focus({preventScroll:true});
    // Recommendation pills get their own controlled position below.
    if(tablist.closest('.venue-directory-section:not(.area-directory-section)')) return;
    // Anticipate the next category before the selected pill reaches the right edge.
    // A mostly-visible pill stays put; a pill nearing the edge moves to the left
    // fifth of the strip, leaving space to discover and tap the following pills.
    const active=pills[index];
    const maxScroll=Math.max(0,tablist.scrollWidth-tablist.clientWidth);
    if(maxScroll<=2)return;
    const strip=tablist.getBoundingClientRect();
    const pill=active.getBoundingClientRect();
    const rightThreshold=Math.min(104,Math.max(56,tablist.clientWidth*.24));
    const leftMargin=12;
    let nextScroll=null;
    if(pill.right>strip.right-rightThreshold && maxScroll-tablist.scrollLeft>2){
      const preferredLeft=Math.min(70,Math.max(30,tablist.clientWidth*.19));
      nextScroll=tablist.scrollLeft+pill.left-strip.left-preferredLeft;
      // Very wide labels must remain fully readable, even on narrow phones.
      if(pill.width>tablist.clientWidth-preferredLeft-8)
        nextScroll=tablist.scrollLeft+pill.right-strip.right+8;
    }else if(pill.left<strip.left+leftMargin && tablist.scrollLeft>2){
      nextScroll=tablist.scrollLeft+pill.left-strip.left-leftMargin;
    }
    if(nextScroll!==null){
      const clamped=Math.max(0,Math.min(maxScroll,nextScroll));
      if(Math.abs(clamped-tablist.scrollLeft)>2)
        tablist.scrollTo({left:clamped,behavior:reduceMotion.matches?'auto':'smooth'});
    }
  }
  // For the recommended-list strip, place the selected bubble in the
  // second visual slot. A half-visible preceding bubble remains at the left,
  // with the left-hand gradient indicating that the strip is scrollable.
  function alignRecommendationPill(strip,selected){
    if(!strip||!selected)return;
    const pills=[...strip.querySelectorAll(':scope > .tab-pill')];
    const index=pills.indexOf(selected);
    if(index<0)return;
    const previous=pills[index-1];
    const gap=parseFloat(getComputedStyle(strip).columnGap)||0;
    const leftSpace=previous ? Math.round(previous.offsetWidth/2+gap+2) : 2;
    const last=pills[pills.length-1];
    const followingWidth=(last.offsetLeft+last.offsetWidth)-(selected.offsetLeft+selected.offsetWidth);
    // Just enough invisible end-space for the last (or penultimate) pill to
    // sit in the second slot, rather than sticking against the right edge.
    const trailing=Math.max(0,Math.ceil(strip.clientWidth-leftSpace-selected.offsetWidth-followingWidth-12));
    strip.style.setProperty('--recommendation-tail-space',trailing+'px');
    requestAnimationFrame(()=>{
      const max=Math.max(0,strip.scrollWidth-strip.clientWidth);
      const wanted=selected.offsetLeft-strip.offsetLeft-leftSpace;
      const destination=Math.max(0,Math.min(max,wanted));
      if(Math.abs(destination-strip.scrollLeft)>2)
        strip.scrollTo({left:destination,behavior:reduceMotion.matches?'auto':'smooth'});
    });
  }
  document.querySelectorAll('.tab-pills').forEach(tablist=>{
    const pills=Array.from(tablist.querySelectorAll(':scope > .tab-pill'));
    pills.forEach((pill,index)=>{
      const isAreaTablist = Boolean(tablist.closest('.area-directory-section'));
      const isRecommendedTablist = Boolean(tablist.closest('.venue-directory-section:not(.area-directory-section)'));
      pill.addEventListener('click',()=>{
        activateTab(tablist,index);
        const panel=tablist.nextElementSibling?.children[index];
        if (isAreaTablist || isRecommendedTablist || panel?.classList.contains('guided-focus-panel')) prepareGuidedTab(panel);
        if (isRecommendedTablist) alignRecommendationPill(tablist, pill);
      });
      pill.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
        e.preventDefault();
        const next=e.key==='Home'?0:e.key==='End'?pills.length-1:index+(e.key==='ArrowRight'?1:-1);
        const normalized=(next+pills.length)%pills.length;
        activateTab(tablist,next,true);
        const panel=tablist.nextElementSibling?.children[normalized];
        if (isAreaTablist || isRecommendedTablist || panel?.classList.contains('guided-focus-panel')) prepareGuidedTab(panel);
        if (isRecommendedTablist) alignRecommendationPill(tablist, pills[normalized]);
      });
    });
  });
  function revealNavFirstLayer(id){
    const detail=document.getElementById(firstLevel[id]);
    if(detail)openAccordion(detail);
    // The first pill is the visible panel; don't open its nested accordions.
  }
  function showTarget(id){
    const node=document.getElementById(id);
    if(!node)return null;
    if(firstLevel[id])revealNavFirstLayer(id);
    // Deep links into a category select its bubble first, then reveal its parents.
    const panel=node.closest('.tab-panel');
    if(panel){
      const tablist=panel.parentElement?.previousElementSibling;
      const panels=Array.from(panel.parentElement.children);
      activateTab(tablist,panels.indexOf(panel));
    }
    let parent=node.parentElement;
    const parents=[];
    while(parent){if(parent.tagName==='DETAILS')parents.unshift(parent);parent=parent.parentElement;}
    parents.forEach(openAccordion);
    return node;
  }
  document.querySelectorAll('.nav-button[data-target], .hero-title-link[data-target], .section-jump-button[data-target]').forEach(link=>{
    link.addEventListener('click',event=>{
      const id=link.dataset.target,anchor=document.getElementById(id);
      if(!anchor)return;
      event.preventDefault();
      if (id === 'day-trips') showTarget(id);
      else revealNavFirstLayer(id);
      if (location.hash && location.protocol !== 'about:') history.replaceState(null,'',location.pathname+location.search);
      requestAnimationFrame(()=>anchor.scrollIntoView({behavior:reduceMotion.matches?'auto':'smooth',block:'start'}));
    });
  });
  function revealHash(){
    const id=decodeURIComponent(location.hash.replace(/^#/,''));
    if(!id)return;
    const target=showTarget(id);
    if(target)requestAnimationFrame(()=>target.scrollIntoView({behavior:'auto',block:'start'}));
  }
  window.addEventListener('hashchange',revealHash);
  // The browser manages history restoration; don't reset scrolling on page load,
  // pageshow or when returning from an external map. Initial deep links remain usable.
  if (location.hash) requestAnimationFrame(revealHash);
})();

/* =================== JS 02: venue-directory-script =================== */
;

/* Converts existing Notion-style entries into directory rows without changing the source list.
   To add an entry, append an <li><a href="...">店名</a>（特徴、人気）</li>
   to an existing category <ol>. Display numbers and tags are generated automatically. */
(function () {
  'use strict';

  const containers = document.querySelectorAll('.site-content .venue-directory-section');
  for (const pane of document.querySelectorAll('.site-content .venue-directory-section .tab-panel')) { pane.tabIndex = 0; }
  const HIGHLIGHT = /おすすめ|孤独のグルメ|ミシュラン|超行列|一番人気|高人気|ビブグルマン|人気老舗|人気店|行列店|エビ水餃|抹茶焼き氷|芝麻湯圓|鴨舌|水出し珈琲|目玉焼き魯肉飯/;
  const CAUTION = /八角なし|治安|注意|⚠|臭い/;
  const groupCounts = new Map();

  for (const section of containers) {
    // Both the standard .venue-list-item entries and the few legacy unclassed <li> entries.
    const entries = section.querySelectorAll('ol > li');
    for (const li of entries) {
      // Never transform nested lists or text-only list items.
      const firstLink = li.querySelector('a[href]');
      if (!firstLink || li.querySelector('ul,ol')) continue;
      if (li.classList.contains('venue-row')) continue;

      const ol = li.closest('ol');
      const nearestGroup = li.closest('details.nested-accordion, .tab-panel, details.root-accordion');
      if (!ol || !nearestGroup) continue;

      // Real subsection breaks (headings, notes, <hr>) reset numbering;
      // copied Notion `start="..."` values never need to be edited.
      const previous = ol.previousElementSibling;
      const isNewSubsection = previous && !previous.matches('ol') &&
        ol.firstElementChild === li &&
        (previous.matches('hr,h2,h3,h4,p') || previous.classList.contains('section-note'));
      const lastCount = groupCounts.get(nearestGroup) || 0;
      const num = isNewSubsection ? 1 : lastCount + 1;
      groupCounts.set(nearestGroup,num);

      // Extract the extra description from a clone so all original hyperlinks stay intact.
      const clone = li.cloneNode(true);
      const clonedFirst = clone.querySelector('a[href]');
      if (clonedFirst) clonedFirst.remove();
      clone.querySelectorAll('a[href]').forEach(a => a.remove());
      const hadLineBreak = !!li.querySelector('br');
      let trailingText = clone.textContent.replace(/\s+/g,' ').trim();
      trailingText = trailingText.replace(/🔗/g,'').replace(/^[\s、，,\/]+|[\s、，,\/]+$/g,'').trim();
      const parenthetical = trailingText.match(/^[（(]([\s\S]*?)[）)]$/);
      const candidate = parenthetical ? parenthetical[1] : (hadLineBreak ? trailingText : '');
      const parts = candidate.split(/[、，,]/).map(v => v.replace(/^[\s、，,\/]+|[\s、，,\/]+$/g,'').trim()).filter(Boolean);
      const tags = [];
      const notes = [];
      if (candidate) {
        for (const part of parts) {
          if (part.length <= 22 && !/[。！？\n]/.test(part)) tags.push(part);
          else notes.push(part);
        }
      } else if (trailingText && !/^[（）()、，,\s]+$/.test(trailingText)) {
        notes.push(trailingText);
      }

      const secondary = Array.from(li.querySelectorAll('a[href]')).filter(a => a !== firstLink);
      const outOfBandLinks = secondary.filter(a => !/^https:\/\/maps\.app\.goo\.gl\//.test(a.href));
      const otherMapLinks = secondary.filter(a => /^https:\/\/maps\.app\.goo\.gl\//.test(a.href));

      const index = document.createElement('span');
      index.className = 'venue-row-index';
      index.setAttribute('aria-hidden', 'true');
      index.textContent = String(num).padStart(2,'0');

      const body = document.createElement('div');
      body.className = 'venue-row-body';
      const nameLine = document.createElement('div');
      nameLine.className = 'venue-name-line';
      const nameLinks = document.createElement('div');
      nameLinks.className = 'venue-primary-links';
      firstLink.classList.add('venue-main-link');
      nameLinks.append(firstLink);
      for (const secondaryMap of otherMapLinks) {
        const join = document.createElement('span');
        join.className = 'venue-name-separator';
        join.textContent = '・';
        nameLinks.append(join);
        secondaryMap.classList.add('venue-main-link');
        nameLinks.append(secondaryMap);
      }
      nameLine.append(nameLinks);
      // Official-site and booking links sit on the far right of the shop name,
      // not underneath its descriptive tags. The original href is retained.
      if (outOfBandLinks.length) {
        const moreLinks = document.createElement('div');
        moreLinks.className = 'venue-secondary-links';
        for (const link of outOfBandLinks) {
          link.textContent = link.textContent.replace(/🔗/g, '').trim();
          moreLinks.append(link);
        }
        nameLine.append(moreLinks);
      }
      body.append(nameLine);

      // Evidence-backed venue labels supplied in data-curated-tags. Original remarks remain unchanged.
      // Only fill up to three visible labels; avoid repeating the existing category or a same-name tag.
      const curated = (li.dataset.curatedTags || '').split('、').map(s=>s.trim()).filter(Boolean);
      for (const value of curated) {
        if (tags.length >= 3) break;
        if (!tags.includes(value)) tags.push(value);
      }

      if (tags.length) {
        const tagList = document.createElement('div');
        tagList.className = 'venue-tag-list';
        for (const value of tags) {
          const tag = document.createElement('span');
          tag.className = 'venue-tag';
          if (CAUTION.test(value)) tag.classList.add('venue-tag--caution');
          else if (HIGHLIGHT.test(value) || (firstLink.textContent.trim()==='甜満' && value==='人気急上昇中')) tag.classList.add('venue-tag--featured');
          tag.textContent = value;
          tagList.append(tag);
        }
        body.append(tagList);
      }
      if (notes.length) {
        const extraNote = document.createElement('div');
        extraNote.className = 'venue-extra-note';
        extraNote.textContent = notes.join('、');
        body.append(extraNote);
      }
      li.replaceChildren(index, body);
      li.classList.add('venue-row');
      ol.classList.add('venue-directory-list');
    }
  }
})();


/* =================== JS 03: food-search-script =================== */
;

(function () {
const foodExplorer=document.getElementById("food-explorer");
if(!foodExplorer) return;

"use strict";
// The content is managed separately in foods.csv and synonyms.json.
// Keep both files in the same folder as this index.html on GitHub Pages.
// CSV row order is preserved within each category; categories remain in the fixed order below.
let foods = [];
let synonymGroups = [];
let normalizedGroups = [];

const cats = ["すべて", "🔰 初心者", "🏮 地元民", "⚔️ クセ強", "💀 限界突破"];
const input = foodExplorer.querySelector("#search");
const clear = foodExplorer.querySelector("#clear");
const filters = foodExplorer.querySelector("#filters");
const activeFilter = foodExplorer.querySelector("#food-active-filter");
const activeFilterLabel = foodExplorer.querySelector("#food-active-filter-label");
const results = foodExplorer.querySelector("#results");
const count = foodExplorer.querySelector("#result-count");
const scrollTip = foodExplorer.querySelector("#scroll-tip");
const scrollText = foodExplorer.querySelector("#scroll-text");
const footerCount = foodExplorer.querySelector("#total-food-count");
let selected = cats[0];

const normalized = s => String(s).normalize("NFKC").toLocaleLowerCase();

// Synonym groups are loaded from synonyms.json, then normalized for searching.
function variantsFor(term) {
  // Match every exact synonym group, not just the first one. A keyword can be
  // shared by related aliases; tags remain searchable independently below.
  const equivalent = normalizedGroups.filter(group => group.includes(term));
  return [...new Set([term, ...equivalent.flat()])];
}
function searchTerms() {
  return normalized(input.value.trim()).split(/\s+/).filter(Boolean);
}

function currentMatches() {
  const terms = searchTerms();

  return foods.filter(food => {
    // The difficulty filter still applies to all searches.
    if (selected !== cats[0] && food.category !== selected) return false;

    // Include hidden tags so partial Japanese words and emoji can be searched.
    const text = normalized(
      `${food.name} ${food.description} ${food.category} ${(food.tags || []).join(" ")}`
    );

    return terms.every(term => {
      // One pepper (or 辛い) finds all marked spicy dishes, including "maybe".
      // Two/three peppers require at least that numerical spice level.
      const peppers = term.match(/🌶️/gu) || [];
      if (peppers.length && peppers.join("") === term) {
        return peppers.length === 1
          ? Boolean(food.spice)
          : peppers.length <= 3 && Number(food.spice) >= peppers.length;
      }
      if (term === "辛い") return Boolean(food.spice);

      // Preserve the existing traditional/simplified/Japanese synonym groups.
      return variantsFor(term).some(alias => text.includes(alias));
    });
  });
}

function addHighlightedText(parent, value, terms) {
  // Uses DOM text nodes, not HTML interpolation, to keep all inputs safe.
  const original = String(value);
  const normalizedValue = normalized(original);
  let ranges = [];
  for (const term of terms) {
    if (!term) continue;
    let start = 0;
    while (start < normalizedValue.length) {
      const index = normalizedValue.indexOf(term, start);
      if (index < 0) break;
      // NFKC generally preserves positions for these CJK terms; if not, skip highlighting safely.
      if (original.slice(index, index + term.length) &&
          normalized(original.slice(index, index + term.length)) === term) {
        ranges.push([index, index + term.length]);
      }
      start = index + Math.max(term.length, 1);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let last = 0;
  for (const [start, end] of ranges) {
    if (start < last) continue;
    parent.append(document.createTextNode(original.slice(last, start)));
    const mark = document.createElement("mark");
    mark.textContent = original.slice(start, end);
    parent.append(mark);
    last = end;
  }
  parent.append(document.createTextNode(original.slice(last)));
}
function syncActiveFilter() {
  if (!activeFilter || !activeFilterLabel) return;
  const applied = selected !== cats[0];
  activeFilter.hidden = !applied;
  activeFilterLabel.textContent = applied ? selected : "";
}
function drawFilters() {
  filters.replaceChildren();
  syncActiveFilter();
  // v30.9.143: no すべて chip; tapping the active level again shows every level.
  for (const cat of cats.slice(1)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pill${selected === cat ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(selected === cat));
    const label = document.createElement("span");
    label.textContent = cat;
    const n = document.createElement("span");
    n.className = "pill-count";
    n.textContent = ` ${cat === cats[0] ? foods.length : foods.filter(f => f.category === cat).length}`;
    button.append(label, n);
    button.addEventListener("click", () => {
      selected = selected === cat ? cats[0] : cat;
      drawFilters();
      drawResults();
      // Selecting a difficulty closes the quick-search panel.
      setToolsOpen(false);
    });
    filters.append(button);
  }
}
function resizeResultViewport() {
  const rows = [...results.querySelectorAll(".result")];
  const mobile = window.matchMedia("(max-width: 600px)").matches;
  // Keep the dictionary compact: about four full rows with part of a fifth
  // visible as a scroll affordance. Fit shorter and taller phone viewports.
  const screenHeight = window.visualViewport?.height || window.innerHeight;
  const visibleRows = mobile ? (screenHeight < 740 ? 4.2 : screenHeight > 900 ? 4.75 : 4.5) : 4.75;
  const fullRows = Math.floor(visibleRows);
  const needsScroll = rows.length > fullRows;
  results.classList.toggle("scrolling", needsScroll);
  scrollText.hidden = !needsScroll;
  // Show the compact dashed-pepper explanation only when relevant.
  scrollTip.hidden = !needsScroll;
  if (!needsScroll) {
    results.style.maxHeight = "none";
    return;
  }
  // Measure actual rendered rows, including Japanese text wrapping.
  // Use measured row heights so long Japanese descriptions fit naturally.
  const fullHeight = rows.slice(0, fullRows).reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
  const nextHeight = rows[fullRows]?.getBoundingClientRect().height ?? 0;
  const fraction = visibleRows - fullRows;
  results.style.maxHeight = `${Math.ceil(fullHeight + nextHeight * fraction)}px`;
}

// Approx. fifteen visible Japanese characters; leave a few extra characters for the fade.
// Segment by grapheme so emoji and combining characters are not cut in half.
function descriptionGraphemes(value) {
  const str = String(value || "");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter("ja", {granularity:"grapheme"}).segment(str)].map(part => part.segment);
  }
  return Array.from(str);
}

// Add a deliberate break after at most 16 grapheme characters per line.
// Kinsoku: avoid leaving 、。！？ and closing brackets at the beginning of a line,
// or opening brackets at the end of the previous line. Keep the CSV text unchanged.
function wrapFoodDescription(value, limit = 16) {
  const chars = descriptionGraphemes(value);
  const forbiddenAtStart = /^[、。，．,.！!？?：:；;）)］\]｝}」』】〉》％%…]/u;
  const forbiddenAtEnd = /^[（(［\[｛{「『【〈《]/u;
  const lines = [];
  let start = 0;
  while (start < chars.length) {
    let end = Math.min(start + limit, chars.length);
    if (end < chars.length) {
      while (end > start + 1 && forbiddenAtStart.test(chars[end])) end--;
      while (end > start + 1 && forbiddenAtEnd.test(chars[end - 1])) end--;
    }
    lines.push(chars.slice(start, end).join(""));
    start = end;
  }
  return lines.join("\n");
}

// Persist the chosen dish while the food-search page is active, including
// when typing a query or changing category filters.
let expandedDishName = null;
// Measure the real Japanese description height even while max-height is zero.
// This avoids hidden full text occupying extra space in iOS Safari.
function measureFoodDescription(row) {
  const full = row?.querySelector('.food-desc-full');
  if (!full) return;
  full.style.setProperty('--food-full-height', `${Math.ceil(full.scrollHeight + 2)}px`);
}
function setFoodEntryExpanded(row, expanded) {
  if (!row || !row.classList.contains("food-entry-expandable")) return;
  const button = row.querySelector(".food-entry-toggle");
  const preview = row.querySelector(".food-desc-preview");
  const full = row.querySelector(".food-desc-full");
  if (!button || !preview || !full) return;
  row.classList.toggle("is-expanded", expanded);
  if (expanded) expandedDishName = row.dataset.dishName;
  else if (expandedDishName === row.dataset.dishName) expandedDishName = null;
  button.setAttribute("aria-expanded", String(expanded));
  button.setAttribute("aria-label", `${row.dataset.dishName}：${expanded ? "説明を閉じる" : "説明の続きを見る"}`);
  // CSS grid interpolates both rows; hiding nodes immediately would snap.
  preview.setAttribute('aria-hidden',String(expanded));
  full.setAttribute('aria-hidden',String(!expanded));
}

// Keep the next tapped dish at the same visible position while an earlier
// expanded dish above it shrinks. The browser's normal scroll anchoring is
// disabled for this scrollport, so compensate during the height transition.
let foodAnchorSequence = 0;
function stabilizeDishWhileSwitching(row) {
  const seq = ++foodAnchorSequence;
  const initialTop = row.getBoundingClientRect().top;
  const began = performance.now();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // User scrolling takes precedence over automated anchoring.
  const stop = () => { if(seq === foodAnchorSequence) ++foodAnchorSequence; };
  results.addEventListener('wheel', stop, {once:true, passive:true});
  results.addEventListener('touchstart', stop, {once:true, passive:true});
  const correct = () => {
    if(seq !== foodAnchorSequence || !row.isConnected || !results.isConnected) return;
    const difference = row.getBoundingClientRect().top - initialTop;
    if(Math.abs(difference) > 0.45) {
      const maxScroll = Math.max(0, results.scrollHeight - results.clientHeight);
      results.scrollTop = Math.min(maxScroll, Math.max(0, results.scrollTop + difference));
    }
    if(performance.now() - began < (reducedMotion ? 120 : 470)) requestAnimationFrame(correct);
  };
  requestAnimationFrame(correct);
}

// For a change of selection, animate the collapsing row's *measured height*.
// The two-grid-row description alone can hold its full height and then snap
// closed at the end of the transition. A measured outer-row height prevents
// that jump (including when the result list is already at scrollTop=0,
// where scroll-position compensation cannot move above the first row).
function collapsePreviousDishSmoothly(row) {
  if (!row?.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setFoodEntryExpanded(row, false);
    return;
  }
  const desc = row.querySelector('.food-entry-toggle .desc');
  const before = row.getBoundingClientRect().height;
  if (desc) desc.style.transition = 'none';
  setFoodEntryExpanded(row, false);
  const after = row.getBoundingClientRect().height;
  if (Math.abs(before - after) < 1) {
    if (desc) desc.style.removeProperty('transition');
    return;
  }
  row.style.height = `${before}px`;
  row.style.overflow = 'hidden';
  row.style.transition = 'none';
  row.getBoundingClientRect(); // Commit initial height before animating.
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    row.style.removeProperty('height');
    row.style.removeProperty('overflow');
    row.style.removeProperty('transition');
    if (desc) desc.style.removeProperty('transition');
    row.removeEventListener('transitionend', onEnd);
  };
  function onEnd(event) {
    if (event.target === row && event.propertyName === 'height') cleanup();
  }
  row.addEventListener('transitionend', onEnd);
  requestAnimationFrame(() => {
    if (!row.isConnected) {cleanup();return;}
    row.style.transition = 'height .34s ease-in-out';
    row.style.height = `${after}px`;
  });
}

// A description no longer closes on scroll or when it leaves the viewport.
// It remains open until another dish is selected, the same dish is manually
// closed, or the user exits the food search drawer.
const foodDrawer = document.getElementById('food-search');
foodDrawer?.addEventListener('food-search-closed', () => {
  expandedDishName = null;
  for (const row of results.querySelectorAll('.result.is-expanded')) {
    setFoodEntryExpanded(row, false);
  }
});

function drawResults() {
  const matched = currentMatches();
  count.textContent = `${matched.length} 件`;
  results.replaceChildren();
  results.style.maxHeight = "none";
  results.classList.toggle("scrolling", matched.length > (window.matchMedia("(max-width: 600px)").matches ? 2 : 3));
  const terms = searchTerms();
  // Include alternative spellings when highlighting an equivalent match.
  const highlightTerms = [...new Set(terms.flatMap(variantsFor))];
  if (!matched.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const face = document.createElement("span");
    face.className = "emoji";
    face.textContent = "🔎";
    const message = document.createElement("span");
    message.textContent = "該当する料理が見つかりません。料理名・🍜・シーフードなどで検索してください。";
    empty.append(face, message);
    results.append(empty);
  } else {
    for (const food of matched) {
      const row = document.createElement("article");
      row.className = "result";
      const left = document.createElement("div");
      left.className = "food-entry-left";
      const name = document.createElement("h3");
      name.className = "dish";
      const desc = document.createElement("p");
      desc.className = "desc";
      addHighlightedText(name, food.name, highlightTerms);
      const graphemes = descriptionGraphemes(food.description);
      const expandable = graphemes.length > 15 || Boolean(food.detail);
      if (expandable) {
        const preview = document.createElement("span");
        preview.className = "food-desc-preview";
        // Display up to ~15 characters, with the last few fading out.
        addHighlightedText(preview, graphemes.slice(0, 15).join(""), highlightTerms);
        const full = document.createElement("span");
        full.className = "food-desc-full";
        full.setAttribute('aria-hidden','true');
        addHighlightedText(full, wrapFoodDescription(food.description, 16), highlightTerms);
        if (food.detail) {
          const addition = document.createElement('span');
          addition.className = 'food-desc-addition';
          addHighlightedText(addition, food.detail, highlightTerms);
          full.append(addition);
        }
        desc.append(preview, full);
      } else {
        addHighlightedText(desc, food.description, highlightTerms);
      }
      left.append(name, desc);
      
const meta = document.createElement("div");
meta.className = "result-meta";

// 原本的等級分類
const tag = document.createElement("span");
tag.className = "tag";
tag.textContent = food.category;
meta.append(tag);

// 辣度：沒有設定就不顯示
if (food.spice) {
  const spice = document.createElement("span");

  const isMaybe = food.spice === "maybe";

  spice.className = isMaybe
    ? "spice maybe"
    : "spice";

  if (isMaybe) {
    const icon = document.createElement("img");
    icon.className = "spice-icon";
    icon.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAA90lEQVR4nK2SoRYBQRSGv3WON1AkT6AoiqIomwmyLMveQJEVhapIiqCsoCgEb6AohF+5u2fOYO0uc849O3Nn7jf/3n8C8Z9R+qH2DsiiMGgAlIEA2ABKkAXiIpCgI1ARRU1gDlScdW4VE1NxsjmCSHDIA+kapOnlp8rZI1mRn28XAb3LDwUKMj7IHVAFam/2rsA2i5J+ippEKYKxYG3N9A9N7WD/A+RmriXEyL4SXJ25BK0PkPgSXFBsaSgYWTRSfmdmdQ0XFJPHGfrVcZTW3b3YtS6wMBf2wBI4Aw9zK7TA9nov3nk3hoKV4O716SgYpKnN+o6+jifwJgi73wNeVAAAAABJRU5ErkJggg==";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    spice.append(icon);
  } else {
    spice.textContent = "🌶️".repeat(Number(food.spice));
  }

  const label = isMaybe
    ? "お店によって辛い場合があります"
    : `辛さの目安：${food.spice} / 3`;

  spice.setAttribute("aria-label", label);
  spice.title = label;

  meta.append(spice);
}

if (expandable) {
  row.classList.add("food-entry-expandable");
  row.dataset.dishName = food.name;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "food-entry-toggle";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", `${food.name}：説明の続きを見る`);
  button.append(left, meta);
  button.addEventListener("click", () => {
    const open = !row.classList.contains("is-expanded");
    const existing = [...results.querySelectorAll(".result.is-expanded")]
      .filter(other => other !== row);
    // If the currently open explanation is above the one we just tapped,
    // collapsing it must not drag the new heading away under the user's finger.
    const collapsingAbove = open && existing.some(other =>
      Boolean(other.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING));
    if (collapsingAbove) stabilizeDishWhileSwitching(row);
    else ++foodAnchorSequence;
    for (const other of existing) collapsePreviousDishSmoothly(other);
    setFoodEntryExpanded(row, open);
  });
  row.append(button);
} else {
  row.append(left, meta);
}

      results.append(row);
      // Keep this dish expanded when filtering or searching without leaving
      // the food screen. If filtered out, restore it when it reappears.
      if (expandable && food.name === expandedDishName) setFoodEntryExpanded(row, true);
    }
  }
  results.scrollTop = 0;
  // Sizes are known only after the rows join the document and wrap at the
  // current screen width. Collapsed previews now take exactly one line.
  results.querySelectorAll('.food-entry-expandable').forEach(measureFoodDescription);
  resizeResultViewport();
}
function onSearch() {
  clear.classList.toggle("visible", input.value.length > 0);
  drawResults();
  // The emoji and common-character buttons show which one is in the search box.
  foodExplorer.querySelectorAll("[data-example]").forEach(button =>
    button.setAttribute("aria-pressed", String(input.value === button.dataset.example)));
}
input.addEventListener("input", onSearch);
// Preserve tapping the search icon or empty search-shell area to focus input,
// without nesting the clear button inside a label (iOS Safari focus loop).
foodExplorer.querySelector(".search-shell")?.addEventListener("click", event => {
  if (!(event.target instanceof Element) || event.target.closest("input,button")) return;
  input.focus({preventScroll:true});
});
// v30.9.143: 常用字リスト — emoji, common characters and the level filter in a panel
// that opens over the list and stays open until toggled, tapped outside or Esc.
const toolsToggle = foodExplorer.querySelector("#food-tools-toggle");
const toolsPanel = foodExplorer.querySelector("#food-tools-panel");
activeFilter?.addEventListener("click", () => {
  selected = cats[0];
  drawFilters();
  drawResults(); // Only the difficulty is cleared; keep any typed query.
});
function setToolsOpen(open) {
  if (!toolsToggle || !toolsPanel) return;
  toolsPanel.hidden = !open;
  toolsToggle.setAttribute("aria-expanded", String(open));
}
toolsToggle?.addEventListener("click", () => setToolsOpen(toolsPanel.hidden));
document.addEventListener("pointerdown", event => {
  // Close on any outside tap, including the backdrop. Clicks inside the
  // popup are handled separately, after the selection is applied.
  if (!toolsPanel || toolsPanel.hidden) return;
  if (!(event.target instanceof Element) || !event.target.closest(".food-tools")) {
    setToolsOpen(false);
  }
});
foodExplorer.addEventListener("keydown", event => {
  if (event.key === "Escape" && toolsPanel && !toolsPanel.hidden) {
    event.preventDefault();event.stopPropagation();
    setToolsOpen(false);toolsToggle.focus({preventScroll:true});
  }
});
// A quick-list popup closing does NOT reset the active filter. Only leaving
// the entire recipe dictionary restores a clean session.
document.getElementById("food-search")?.addEventListener("food-search-closed", () => {
  setToolsOpen(false);
  if (document.activeElement === input) input.blur();
  input.value = "";
  selected = cats[0];
  drawFilters();
  onSearch();
});
// v30.9.142: a 名物 tile in 🏮 夜市 opens this dictionary with the dish searched,
// all levels shown, and the dish itself opened when its name matches exactly.
function showDishInSearch(query) {
  selected = cats[0];
  drawFilters();
  input.value = query;
  onSearch();
  // Open the dish whose name (or one of its ／ names) is the query; with a
  // single result, open that one.
  const key = normalized(query);
  const rows = [...results.querySelectorAll(".result")];
  const row = rows.find(item => normalized(item.dataset.dishName || "").split(/[／/]/).includes(key))
    || (rows.length === 1 && rows[0].classList.contains("food-entry-expandable") ? rows[0] : null);
  if (row) {
    expandedDishName = row.dataset.dishName;
    setFoodEntryExpanded(row, true);
  }
}
document.addEventListener("click", event => {
  const tile = event.target instanceof Element && event.target.closest(".nm-specialty[data-food-query]");
  if (!tile) return;
  showDishInSearch(tile.dataset.foodQuery);
  document.dispatchEvent(new CustomEvent("tabi:open-food-search"));
});
// The clear action is outside an HTML <label>. Otherwise mobile Safari can
// interpret a tap on × as a new focus on #search and reopen its keyboard.
clear.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  input.blur();
  input.value = "";
  onSearch();
});
foodExplorer.querySelectorAll("[data-example]").forEach(button => {
  button.addEventListener("click", () => {
    // A tapped emoji or character replaces the search; tapping it again clears it.
    input.value = input.value === button.dataset.example ? "" : button.dataset.example;
    onSearch();
    setToolsOpen(false);
    input.blur();
  });
});
window.addEventListener("resize", () => requestAnimationFrame(() => {
  results.querySelectorAll('.food-entry-expandable').forEach(measureFoodDescription);
  resizeResultViewport();
}));

// Minimal CSV parser: supports UTF-8 BOM, quoted commas, quotes, and newlines.
function parseCsv(text) {
  const content = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(field); field = "";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = [];
      if (char === "\r" && content[i + 1] === "\n") i++;
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new Error("CSV の引用符が閉じていません。");
  row.push(field);
  if (row.some(v => v.trim() !== "")) rows.push(row);
  if (!rows.length) throw new Error("foods.csv が空です。");
  const headers = rows.shift().map(h => h.trim().toLowerCase());
  for (const required of ["category", "name", "description"]) {
    if (!headers.includes(required)) throw new Error("foods.csv に列がありません: " + required);
  }
  return rows.map((values, position) => {
    const item = Object.fromEntries(headers.map((key, i) => [key, (values[i] || "").trim()]));
    if (!item.name || !cats.includes(item.category)) {
      throw new Error(`foods.csv の ${position + 2} 行目を確認してください。`);
    }
    return {
  category: item.category,
  name: item.name,
  description: item.description,
  detail: item.detail || '',
  
tags: (item.tags || "")
  .split("|")
  .map(tag => tag.trim())
  .filter(Boolean),

spice: ["1", "2", "3", "maybe"].includes(item.spice)
  ? item.spice
  : ""

};
  }).sort((a, b) => cats.indexOf(a.category) - cats.indexOf(b.category));
}

async function loadData() {
  try {
    const [foodResponse, synonymResponse] = await Promise.all([
      fetch("./food/foods.csv", { cache: "no-cache" }),
      fetch("./food/synonyms.json", { cache: "no-cache" })
    ]);
    if (!foodResponse.ok || !synonymResponse.ok) {
      throw new Error("foods.csv または synonyms.json が見つかりません。");
    }
    const [csvText, json] = await Promise.all([
      foodResponse.text(), synonymResponse.json()
    ]);
    const loadedFoods = parseCsv(csvText);
    if (!Array.isArray(json.groups) || !json.groups.every(group =>
        Array.isArray(group) && group.every(word => typeof word === "string"))) {
      throw new Error("synonyms.json の groups を確認してください。");
    }
    foods = loadedFoods;
    synonymGroups = json.groups;
    normalizedGroups = synonymGroups.map(group => [...new Set(group.map(normalized))]);
    footerCount.textContent = String(foods.length);
    input.disabled = false;
    drawFilters();
    onSearch();
  } catch (error) {
    console.error("TAIPEI CITY GUIDE: data load error", error);
    filters.replaceChildren();
    results.replaceChildren();
    results.classList.remove("scrolling");
    results.style.maxHeight = "none";
    scrollTip.hidden = true;
    count.textContent = "読み込みエラー";
    const notice = document.createElement("div");
    notice.className = "empty";
    notice.textContent = "データを読み込めませんでした。GitHub Pages で開き、food/foods.csv・food/synonyms.json が指定のフォルダにあるか確認してください。";
    results.append(notice);
  }
}
loadData();

})();


/* =================== JS 04: guide-details-polish =================== */
;

/* Enhances the original exported content without rewriting store names, links, or travel instructions. */
(function () {
  const caution=document.querySelector('.travel-caution');
  if(caution){
    const wrapper=caution.querySelector(':scope > .indented');
    const notice=wrapper?.querySelector(':scope > ul.bulleted-list');
    if(notice){
      const alert=document.createElement('div');
      alert.className='travel-alert';
      const label=document.createElement('span');
      label.className='travel-alert-label';
      label.textContent='持ち込み禁止';
      alert.append(label);
      notice.before(alert);
      alert.append(notice);
    }
    const topics=[
      ['🧳','アメニティは持参前に確認'],
      ['🚻','場所によって利用ルールが異なる'],
      ['🚰','飲む前にチェック'],
      ['🚇','MRT・バス・歩行時のルール'],
      ['💳','現金・カード・悠遊カード'],
      ['🎟️','買い物後のレシートもチェック']
    ];
    [...wrapper.querySelectorAll(':scope > details.nested-accordion')].forEach((detail,i)=>{
      detail.classList.add('travel-topic');
      const summary=detail.querySelector(':scope > summary');
      if(!summary)return;
      const label=summary.textContent.trim();
      const icon=document.createElement('span');
      icon.className='travel-topic-icon';
      icon.setAttribute('aria-hidden','true');
      icon.textContent=(topics[i]||['💡',''])[0];
      const copy=document.createElement('span');
      copy.className='travel-topic-copy';
      const name=document.createElement('span');
      name.className='travel-topic-title';
      name.textContent=label;
      const note=document.createElement('span');
      note.className='travel-topic-subtitle';
      note.textContent=(topics[i]||['',''])[1];
      copy.append(name,note);
      summary.classList.add('travel-topic-summary');
      summary.replaceChildren(icon,copy);
      detail.querySelectorAll('aside.callout').forEach(a=>a.classList.add('travel-tip'));
    });
  }
  document.querySelectorAll('details.destination-card').forEach(detail=>{
    const body=detail.querySelector(':scope > .indented');
    if(!body)return;
    if(detail.classList.contains('destination-redesigned')) return;
    body.classList.add('destination-body');
    const tab=body.querySelector(':scope > .tab');
    if(tab){
      const label=document.createElement('p');
      label.className='destination-guide-label';
      label.textContent='交通手段を選ぶ';
      body.prepend(label);
      return;
    }
    // Keelung / Yehliu have direct text and Notion lists, so group only the
    // display wrappers and keep each original paragraph, anchor and link intact.
    const paras=[...body.children].filter(el=>el.matches('p'));
    const lists=[...body.children].filter(el=>el.matches('ol.numbered-list'));
    function group(elements, heading, cls){
      if(!elements.length)return;
      const group=document.createElement('section');
      group.className='destination-info-group '+cls;
      const title=document.createElement('h4');
      title.className='destination-info-title';
      title.textContent=heading;
      group.append(title);
      elements[0].before(group);
      elements.forEach(el=>group.append(el));
    }
    group(paras,'アクセス','destination-access');
    group(lists,'立ち寄りスポット','destination-spots');
  });
})();


/* =================== JS 05: airport-direction-switcher-behavior =================== */
;

(() => {
  'use strict';
  const switcher = document.querySelector('.site-content .airport-direction-switcher');
  if (!switcher) return;
  const buttons = [...switcher.querySelectorAll('.airport-direction-button')];
  const details = [...switcher.querySelectorAll('.airport-access')];
  const sync = () => buttons.forEach(button => {
    const detail = details.find(d => d.dataset.airportDirection === button.dataset.airportTarget);
    button.setAttribute('aria-expanded', String(Boolean(detail?.open)));
  });
  // Both directions start folded: the two choices fit side by side, with one
  // full-width route detail below only when a visitor selects a direction.
  details.forEach(detail => {
    detail.open = false;
    detail.addEventListener('toggle', sync);
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let focusFrame = 0;
  // Align the direction choices to the viewport after a panel has changed.
  // This keeps the airport tabs and the start of its route visible together,
  // even if an earlier long accordion collapses and changes the page height.
  function keepAirportInView() {
    cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        const heading = switcher.previousElementSibling;
        const anchor = heading?.classList.contains('airport-access-subheading') ? heading : switcher;
        if (!anchor.getClientRects().length) return;
        const top = Math.max(0, window.scrollY + anchor.getBoundingClientRect().top - 12);
        window.scrollTo({top, behavior: reduceMotion.matches ? 'auto' : 'smooth'});
      });
    });
  }
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const selected = details.find(d => d.dataset.airportDirection === button.dataset.airportTarget);
      if (!selected) return;
      const shouldOpen = !selected.open;
      details.forEach(d => { d.open = false; });
      if (shouldOpen) {
        // Maintain the existing one-at-a-time pattern of the travel section.
        const pageBody = switcher.closest('.page-body');
        for (const other of pageBody?.children || []) {
          if (other.tagName === 'DETAILS' && other.open) other.open = false;
        }
        selected.open = true;
        keepAirportInView();
      }
      sync();
    });
  });
  // If any other top-level section opens, fold away airport route details.
  const pageBody = switcher.closest('.page-body');
  [...(pageBody?.children || [])].filter(node => node.tagName === 'DETAILS')
    .forEach(detail => detail.addEventListener('toggle', () => {
      if (detail.open) {
        details.forEach(d => { d.open = false; });
        sync();
      }
    }));
  sync();
})();


/* =================== JS 06: daytrip-destination-button-switcher =================== */
;

/* One-of-four detail panels: default compact; clicking an active destination closes it. */
(() => {
  'use strict';
  const section=document.querySelector('#guide .sights-day-trips');
  if(!section)return;
  const buttons=[...section.querySelectorAll('.daytrip-destination-buttons > button')];
  const panels=buttons.map(b=>document.getElementById(b.getAttribute('aria-controls')));
  if(buttons.length!==4 || panels.some(p=>!p))return;
  function select(index,focus=false){
    const opened=buttons[index].getAttribute('aria-expanded')==='true';
    buttons.forEach((button,i)=>{
      const active=i===index&&!opened;
      button.setAttribute('aria-expanded',String(active));
      button.setAttribute('aria-label',`${['九份','十分','基隆','野柳'][i]}の交通案内を${active?'閉じる':'開く'}`);
      panels[i].hidden=!active;
    });
    if(focus)buttons[index].focus({preventScroll:true});
    // Keep the button row at its current position; don't jump to the new content.
  }
  const lantern=section.querySelector('.daytrip-destination-button-icon img');
  if(lantern){
    const missing=()=>lantern.parentElement.classList.add('has-missing-icon');
    lantern.addEventListener('error',missing,{once:true});
    if(lantern.complete && !lantern.naturalWidth)missing();
  }
  buttons.forEach((button,i)=>{
    button.addEventListener('click',()=>select(i));
    button.addEventListener('keydown',e=>{
      if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
      e.preventDefault();
      const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:
        (i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      buttons[next].focus({preventScroll:true});
    });
  });
})();


/* =================== JS 06b: swipe-between-bubble-content-v30.9.148 =================== */
;
(() => {
  'use strict';
  const guide=document.getElementById('guide');
  if(!guide)return;
  // Day-trip transport / airport panels already own a dedicated animated swipe
  // controller. Do not register another competing gesture handler there.
  const groups=[...guide.querySelectorAll('.tab-pills')].map(strip=>{
    if(strip.closest('.sights-day-trips, #airport-route-selector'))return null;
    const content=strip.nextElementSibling;
    if(!content?.classList.contains('tab-panels'))return null;
    const tabs=[...strip.querySelectorAll(':scope > .tab-pill')];
    const panes=[...content.querySelectorAll(':scope > .tab-panel')];
    return tabs.length>1 && tabs.length===panes.length?{strip,content,tabs,panes}:null;
  }).filter(Boolean);
  if(!groups.length)return;
  let suppressClickUntil=0;
  for(const group of groups){
    const {content,tabs,panes}=group;
    content.classList.add('bubble-swipe-content');
    let gesture=null;
    function findTouch(list,id){
      for(const t of list)if(t.identifier===id)return t;
      return null;
    }
    function index(){return Math.max(0,tabs.findIndex(tab=>tab.getAttribute('aria-selected')==='true'));}
    function ownScroller(target){
      let node=target instanceof Element?target:null;
      while(node && node!==content){
        if(node.scrollWidth>node.clientWidth+5 && /(auto|scroll|overlay)/.test(getComputedStyle(node).overflowX))return true;
        node=node.parentElement;
      }
      return false;
    }
    content.addEventListener('touchstart',event=>{
      gesture=null;
      if(event.touches.length!==1 || document.body.classList.contains('food-drawer-open') ||
        document.body.classList.contains('food-swipe-active') ||
        document.body.classList.contains('recommend-drawer-open') ||
        document.body.classList.contains('recommend-swipe-active'))return;
      const target=event.target;
      const panel=target.closest('.tab-panel');
      if(!panel || panel.hidden || !panes.includes(panel))return;
      if(target.closest('input,textarea,select,[contenteditable="true"],video,audio'))return;
      if(ownScroller(target))return;
      const t=event.touches[0];
      // Leave native iOS browser back/forward gestures at the screen edges.
      if(t.clientX<18 || t.clientX>window.innerWidth-18)return;
      gesture={id:t.identifier,startX:t.clientX,startY:t.clientY,axis:null};
    },{passive:true});
    content.addEventListener('touchmove',event=>{
      if(!gesture)return;
      const t=findTouch(event.changedTouches,gesture.id);
      if(!t)return;
      const dx=t.clientX-gesture.startX,dy=t.clientY-gesture.startY;
      if(!gesture.axis && Math.hypot(dx,dy)>12){
        if(Math.abs(dy)>Math.abs(dx)*1.12){gesture.axis='vertical';return;}
        if(Math.abs(dx)>Math.abs(dy)*1.25)gesture.axis='horizontal';
      }
      if(gesture.axis==='horizontal' && event.cancelable)event.preventDefault();
    },{passive:false});
    content.addEventListener('touchend',event=>{
      if(!gesture)return;
      const t=findTouch(event.changedTouches,gesture.id);
      if(!t)return;
      const state=gesture;gesture=null;
      if(state.axis!=='horizontal')return;
      const dx=t.clientX-state.startX,dy=t.clientY-state.startY;
      if(Math.abs(dx)<52 || Math.abs(dx)<Math.abs(dy)*1.25)return;
      const next=index()+(dx<0?1:-1);
      if(next<0||next>=tabs.length)return; // no unexpected wrap at either end
      // Reuse native click logic for ARIA, hidden panels, fold-reset, focus,
      // horizontal pill-strip alignment and section-specific click observers.
      tabs[next].click();
      // Day-trip-inspired, small directional entrance motion. The original
      // bubble click handler remains the only owner of the active state.
      const entered=panes[next];
      if(entered && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        entered.classList.remove('bubble-swipe-enter');
        entered.style.setProperty('--bubble-swipe-offset',dx<0?'22px':'-22px');
        void entered.offsetWidth;
        entered.classList.add('bubble-swipe-enter');
      }
      suppressClickUntil=performance.now()+450;
    },{passive:true});
    content.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
    content.addEventListener('animationend',e=>{
      if(e.animationName==='bubble-swipe-in')e.target.classList.remove('bubble-swipe-enter');
    });
    content.addEventListener('click',event=>{
      if(event.isTrusted && performance.now()<suppressClickUntil){
        event.preventDefault();event.stopImmediatePropagation();
      }
    },true);
  }
})();

/* =================== JS 06c: restaurant-directory-content-swipe-v30.9.150 =================== */
(() => {
  'use strict';
  // The reverse-side genre bubbles and its list are created/updated by
  // recommend.js. Click its real buttons so aria-selected, counts, scroll
  // position, and category data remain owned by the existing controller.
  const list=document.getElementById('food-directory-panel');
  const strip=document.getElementById('food-directory-tabs');
  const face=document.getElementById('food-flip-back');
  if(!list||!strip||!face)return;
  let gesture=null,suppressClickUntil=0,entryAnimation=null;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let alignFrame=0;
  // Mirror the existing recommendation bubble-strip behavior: the active
  // category settles in the second visual slot, and a clipped previous bubble
  // plus adaptive fades hint at additional categories. No chip geometry changes.
  const syncDirectoryFade=()=>{
    if(!strip.clientWidth){strip.removeAttribute('data-scroll-fade');return;}
    const remaining=strip.scrollWidth-strip.clientWidth;
    if(remaining<=3){strip.removeAttribute('data-scroll-fade');return;}
    strip.dataset.scrollFade=strip.scrollLeft<=3?'end':
      strip.scrollLeft>=remaining-3?'start':'both';
  };
  const alignDirectoryActive=()=>{
    const buttons=[...strip.querySelectorAll(':scope > button.food-directory-tab')];
    const selected=buttons.find(button=>button.getAttribute('aria-selected')==='true');
    if(!selected||!strip.clientWidth)return;
    const index=buttons.indexOf(selected);
    const gap=parseFloat(getComputedStyle(strip).columnGap)||0;
    const previous=buttons[index-1];
    const leftSpace=previous?Math.round(previous.offsetWidth/2+gap+2):2;
    const last=buttons[buttons.length-1];
    const followingWidth=last.getBoundingClientRect().right-selected.getBoundingClientRect().right;
    // Invisible scrollable tail allows the final categories to use the same
    // position as the middle ones, without moving or resizing real bubbles.
    const tail=Math.max(0,Math.ceil(strip.clientWidth-leftSpace-selected.offsetWidth-followingWidth-12));
    strip.style.setProperty('--food-directory-tail-space',tail+'px');
    const max=Math.max(0,strip.scrollWidth-strip.clientWidth);
    const wanted=strip.scrollLeft+selected.getBoundingClientRect().left-strip.getBoundingClientRect().left-leftSpace;
    const destination=Math.max(0,Math.min(max,wanted));
    if(Math.abs(destination-strip.scrollLeft)>2)
      strip.scrollTo({left:destination,behavior:reduceMotion.matches?'auto':'smooth'});
    syncDirectoryFade();
  };
  const scheduleDirectoryAlignment=()=>{
    cancelAnimationFrame(alignFrame);
    alignFrame=requestAnimationFrame(alignDirectoryActive);
  };
  // recommend.js recreates the category buttons on each selection, so watch
  // replacement as well as clicks/swipes and keyboard-based selection.
  new MutationObserver(scheduleDirectoryAlignment).observe(strip,{childList:true});
  strip.addEventListener('click',event=>{
    if(event.target.closest('button.food-directory-tab'))scheduleDirectoryAlignment();
  });
  strip.addEventListener('scroll',syncDirectoryFade,{passive:true});
  if('ResizeObserver' in window)new ResizeObserver(scheduleDirectoryAlignment).observe(strip);
  window.addEventListener('resize',scheduleDirectoryAlignment,{passive:true});
  scheduleDirectoryAlignment();
  const touchById=(touches,id)=>{
    for(const touch of touches)if(touch.identifier===id)return touch;
    return null;
  };
  list.addEventListener('touchstart',event=>{
    gesture=null;
    if(event.touches.length!==1 || face.inert || face.getAttribute('aria-hidden')==='true')return;
    const target=event.target;
    if(target.closest('input,textarea,select,[contenteditable="true"],video,audio'))return;
    // Nested horizontal lists, if added later, must keep their own gestures.
    for(let node=target instanceof Element?target:null;node&&node!==list;node=node.parentElement){
      if(node.scrollWidth>node.clientWidth+5 && /(auto|scroll|overlay)/.test(getComputedStyle(node).overflowX))return;
    }
    const touch=event.touches[0];
    // Respect iOS system back/forward gestures at the very screen edge.
    if(touch.clientX<18||touch.clientX>window.innerWidth-18)return;
    gesture={id:touch.identifier,x:touch.clientX,y:touch.clientY,axis:null};
  },{passive:true});
  list.addEventListener('touchmove',event=>{
    if(!gesture)return;
    const touch=touchById(event.changedTouches,gesture.id);
    if(!touch)return;
    const dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
    if(!gesture.axis && Math.hypot(dx,dy)>12){
      if(Math.abs(dy)>Math.abs(dx)*1.12){gesture.axis='vertical';return;}
      if(Math.abs(dx)>Math.abs(dy)*1.25)gesture.axis='horizontal';
    }
    if(gesture.axis==='horizontal'&&event.cancelable)event.preventDefault();
  },{passive:false});
  list.addEventListener('touchend',event=>{
    if(!gesture)return;
    const touch=touchById(event.changedTouches,gesture.id);
    if(!touch)return;
    const state=gesture;gesture=null;
    const dx=touch.clientX-state.x,dy=touch.clientY-state.y;
    if(state.axis!=='horizontal'||Math.abs(dx)<52||Math.abs(dx)<Math.abs(dy)*1.25)return;
    const buttons=[...strip.querySelectorAll('button.food-directory-tab')];
    const current=buttons.findIndex(button=>button.getAttribute('aria-selected')==='true');
    const next=current+(dx<0?1:-1);
    if(current<0||next<0||next>=buttons.length)return;
    // Use original category selection; do not rebuild data or rewrite bubble markup.
    buttons[next].click();
    scheduleDirectoryAlignment();
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && list.animate){
      entryAnimation?.cancel();
      entryAnimation=list.animate([
        {opacity:.76,transform:`translate3d(${dx<0?22:-22}px,0,0)`},
        {opacity:1,transform:'translate3d(0,0,0)'}
      ],{duration:220,easing:'ease-out'});
    }
    suppressClickUntil=performance.now()+450;
  },{passive:true});
  list.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
  // Swiping across a restaurant link must not accidentally open Google Maps.
  list.addEventListener('click',event=>{
    if(event.isTrusted&&performance.now()<suppressClickUntil){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
})();

/* =================== JS 07: adaptive-pill-edge-fade-script =================== */
;

(() => {
  'use strict';
  const strips = [...document.querySelectorAll('#guide .tab-pills')];
  if (!strips.length) return;
  function sync(strip) {
    if (!strip.clientWidth) {strip.removeAttribute('data-scroll-fade');return;}
    const remaining = strip.scrollWidth - strip.clientWidth;
    if (remaining <= 3) {strip.removeAttribute('data-scroll-fade');return;}
    const atStart = strip.scrollLeft <= 3;
    const atEnd = strip.scrollLeft >= remaining - 3;
    strip.dataset.scrollFade = atStart ? 'end' : (atEnd ? 'start' : 'both');
  }
  let queued = false;
  function syncAll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {queued = false;strips.forEach(sync);});
  }
  strips.forEach(strip => strip.addEventListener('scroll', () => sync(strip), {passive:true}));
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(syncAll);
    strips.forEach(strip => observer.observe(strip));
  }
  window.addEventListener('resize',syncAll,{passive:true});
  document.addEventListener('toggle',syncAll,true);
  document.addEventListener('click',syncAll,true);
  syncAll();
})();


/* =================== JS 08: food-drawer-swipe-controller-v2 =================== */
;

(() => {
  'use strict';
  const drawer=document.getElementById('food-search');
  if (!drawer) return;
  const backdrop=document.querySelector('.food-drawer-backdrop');
  const body=document.body;
  const html=document.documentElement;
  let opened=false;
  let savedY=0, savedStyle=null, previousFocus=null;
  let drag=null, clickSuppressUntil=0;
  let progress=0, raf=0;
  let scheduledProgress=0;
  const width=()=>Math.min(window.innerWidth,480);
  const clamp=x=>Math.max(0,Math.min(1,x));
  function draw(p,now=false){
    scheduledProgress=clamp(p);
    if(now){
      cancelAnimationFrame(raf);raf=0;
      commitDraw();
    }else if(!raf) raf=requestAnimationFrame(commitDraw);
  }
  function commitDraw(){
    raf=0;progress=scheduledProgress;
    body.style.setProperty('--food-swipe-px',(width()*progress).toFixed(2)+'px');
    body.style.setProperty('--food-swipe-progress',progress.toFixed(4));
    // The page stays put behind the floating window (only blurred and dimmed).
    body.style.setProperty('--food-main-shift',drawer.classList.contains('is-floating')?'0px':(-26*progress).toFixed(2)+'px');
  }
  function lockPage(){
    if(savedStyle)return;
    // iOS Safari samples the page surface for its top/bottom browser chrome.
    // The search view is bright when light mode is selected.
    // The floating window leaves the page visible; the browser bars keep the page's colour.
    const theme=drawer.classList.contains('is-floating')?null:document.querySelector('meta[name="theme-color"]');
    if(theme)theme.setAttribute('content',html.dataset.theme==='light'?'#F7F8F7':'#0D0D0D');
    savedY=window.scrollY;
    savedStyle={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow};
    previousFocus=document.activeElement;
    body.style.position='fixed';body.style.top=`-${savedY}px`;
    body.style.width='100%';body.style.overflow='hidden';
  }
  function syncChrome(active){
    const meta=drawer.classList.contains('is-floating')?null:document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',active?(html.dataset.theme==='light'?'#F7F8F7':'#0D0D0D'):(html.dataset.theme==='light'?'#F7F8F7':'#111417'));
  }
  function unlockPage(){
    if(!savedStyle)return;
    for(const [k,v] of Object.entries(savedStyle))body.style[k]=v;
    savedStyle=null;
    window.scrollTo({top:savedY,behavior:'instant'});
  }
  function settle(shouldOpen){
    if(shouldOpen){
      lockPage();
      drawer.setAttribute('aria-hidden','false');
      body.classList.add('food-drawer-open');
      body.classList.add('food-swipe-active');
      if(!opened)drawer.focus({preventScroll:true});
      opened=true;
      draw(1,true);
    }else{
      // Exiting this independent page resets its open description.
      if(opened) drawer.dispatchEvent(new Event('food-search-closed'));
      body.classList.remove('food-drawer-open');
      drawer.setAttribute('aria-hidden','true');
      opened=false;
      draw(0,true);
      if(drawer.contains(document.activeElement))document.activeElement.blur();
      unlockPage();
      if(previousFocus?.isConnected && previousFocus!==document.body)
        previousFocus.focus({preventScroll:true});
      /* Keep the drawer painted just until it finishes sliding out. */
      const onEnd=event=>{
        if(event.target===drawer && event.propertyName==='transform' && !opened && !drag){
          body.classList.remove('food-swipe-active');
          syncChrome(false);
          drawer.removeEventListener('transitionend',onEnd);
        }
      };
      drawer.addEventListener('transitionend',onEnd);
      window.setTimeout(()=>{if(!opened&&!drag){body.classList.remove('food-swipe-active');syncChrome(false);}drawer.removeEventListener('transitionend',onEnd);},360);
    }
  }
  // Other parts of the page (e.g. 名物 tiles) can open the dictionary.
  document.addEventListener('tabi:open-food-search',()=>{syncChrome(true);settle(true);});
  // The floating window leaves the dimmed page visible around it: a tap there closes it.
  backdrop?.addEventListener('click',()=>{if(opened&&!drag)settle(false);});
  function blockTarget(target){
    if(!(target instanceof Element))return false;
    if(target.closest('input,textarea,select,[contenteditable="true"],video,audio'))return true;
    // Do not interpret an imprecise horizontal tap over dictionary controls
    // as a drawer-closing swipe: that shifted the whole popup mid-selection.
    // Neutral drawer space remains swipeable, preserving the existing gesture.
    // Controls outside the actual dish list keep their own tap/keyboard handling.
    // In the dish list, a deliberate RIGHT swipe closes the drawer; a TAP still
    // expands a dish and a vertical movement keeps scrolling the results.
    if(target.closest('#food-search .food-tools'))return true;
    if(target.closest('#food-search button') && !target.closest('#food-search #results'))return true;
    // The content below bubble tabs owns horizontal swipes for category changes.
    // The document-level food drawer must never steal those gestures.
    if(target.closest('#guide .tab-panels, #guide .tab-pills'))return true;
    // The reverse-side cuisine directory now owns its own horizontal swipes.
    if(target.closest('#food-directory-panel, #food-directory-tabs'))return true;
    // Interactive links should always receive taps; opening the food drawer must not cancel them.
    if(target.closest('a[href]'))return true;
    if(target.closest('#airsel-transport-tabs, #airport-route-selector .route-panel'))return true;
    if(target.closest('#guide .sights-day-trips .daytrip-destination-panel'))return true; // Daytrip owns this gesture.
    /* Horizontal scrollers own their own gestures; never swipe the whole page instead. */
    let current=target;
    while(current && current!==document.body){
      if(current.scrollWidth>current.clientWidth+5){
        const style=getComputedStyle(current);
        if(['auto','scroll','overlay'].includes(style.overflowX))return true;
      }
      current=current.parentElement;
    }
    return false;
  }
  function start(x,y,target,kind){
    if(drag || !target || body.classList.contains('recommend-drawer-open') || body.classList.contains('recommend-swipe-active'))return;
    if(blockTarget(target))return;
    drag={x,y,prevX:x,prevT:performance.now(),velocity:0,p0:opened?1:0,
      axis:'undecided',kind,activated:false};
  }
  function move(x,y,ev){
    if(!drag)return;
    const dx=x-drag.x,dy=y-drag.y;
    if(drag.axis==='undecided'){
      if(Math.hypot(dx,dy)<10)return;
      if(Math.abs(dy)>Math.abs(dx)*1.10){drag=null;return;}
      drag.axis='x';
      /* Keep the gesture directional: left opens, right closes. */
      if((!opened && dx>=0) || (opened && dx<=0)){drag=null;return;}
      drag.activated=true;
      body.classList.add('food-swipe-active','food-swipe-dragging');
      syncChrome(true);
      drawer.setAttribute('aria-hidden','false');
    }
    if(drag.axis!=='x')return;
    if(ev?.cancelable)ev.preventDefault();
    const now=performance.now();
    const dt=Math.max(1,now-drag.prevT);
    drag.velocity=0.7*drag.velocity+0.3*((x-drag.prevX)/dt);
    drag.prevX=x;drag.prevT=now;
    draw(drag.p0-dx/width());
  }
  function finish(){
    if(!drag)return;
    const state=drag;
    drag=null;
    if(!state.activated)return;
    draw(scheduledProgress,true);
    body.classList.remove('food-swipe-dragging');
    clickSuppressUntil=performance.now()+400;
    const shouldOpen=progress>0.48 || (state.velocity<-.52 && progress>.12);
    const shouldClose=progress<0.52 || (state.velocity>.52 && progress<.88);
    settle(opened?!shouldClose:shouldOpen);
  }
  let touchId=null;
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1 || drag)return;
    const touch=event.touches[0];touchId=touch.identifier;
    start(touch.clientX,touch.clientY,event.target,'touch');
  },{passive:true,capture:true});
  document.addEventListener('touchmove',event=>{
    if(!drag||drag.kind!=='touch')return;
    const touch=Array.from(event.changedTouches).find(t=>t.identifier===touchId);
    if(touch)move(touch.clientX,touch.clientY,event);
  },{passive:false,capture:true});
  document.addEventListener('touchend',event=>{
    if(!drag||drag.kind!=='touch')return;
    if(Array.from(event.changedTouches).some(t=>t.identifier===touchId)){finish();touchId=null;}
  },{passive:true,capture:true});
  document.addEventListener('touchcancel',()=>{if(drag?.kind==='touch'){finish();touchId=null;}},{passive:true,capture:true});
  /* Desktop: physically drag with the mouse; normal clicks remain unchanged. */
  document.addEventListener('mousedown',event=>{
    if(event.button!==0)return;
    start(event.clientX,event.clientY,event.target,'mouse');
  },true);
  document.addEventListener('mousemove',event=>{
    if(drag?.kind==='mouse')move(event.clientX,event.clientY,event);
  },true);
  document.addEventListener('mouseup',()=>{if(drag?.kind==='mouse')finish();},true);
  window.addEventListener('blur',()=>{if(drag)finish();});
  document.addEventListener('click',event=>{
    if(performance.now()<clickSuppressUntil){event.preventDefault();event.stopPropagation();}
  },true);
  document.addEventListener('dragstart',event=>{if(drag?.kind==='mouse')event.preventDefault();},true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&opened){event.preventDefault();settle(false);return;}
    if(!opened || event.key!=='Tab')return;
    const elements=[...drawer.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
    if(!elements.length)return;
    const first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    else if(!drawer.contains(document.activeElement)){event.preventDefault();first.focus();}
  });
  window.addEventListener('resize',()=>draw(opened?1:0,true),{passive:true});
  draw(0,true);
})();


/* =================== JS 09: airport-selector-controller =================== */
;

(()=>{
'use strict';
const points={T1:{label:'桃園国際空港・第1ターミナル',station:'機場第一航廈',code:'A12',kind:'taoyuan'},T2:{label:'桃園国際空港・第2ターミナル',station:'機場第二航廈',code:'A13',kind:'taoyuan'},SONG:{label:'台北松山空港',station:'松山機場',code:'BR13',kind:'songshan'},TP:{label:'台北駅',station:'台北車站',code:'A1 / BL12',kind:'city'}};
let state={from:'',to:'',mode:'express',transport:'rail'};
let resultsOpen=false;
let airportRouteSwitching=false; // suppress timeline animation while transport switches
const root=document.getElementById('airport-route-selector');
if(!root)return;
const el=id=>root.querySelector('#airsel-'+id);
const choices=['T1','T2','SONG','TP'];
const pickerLabels={T1:'桃園空港 T1',T2:'桃園空港 T2',SONG:'台北松山空港',TP:'台北駅'};
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const focusReduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let airportFocusTimer=0,airportFocusFrame=0,airportFocusCorrect=0,airportFocusVersion=0;
// Never override a user's subsequent manual scroll with the delayed correction.
window.addEventListener('touchstart',()=>clearTimeout(airportFocusCorrect),{passive:true});
window.addEventListener('wheel',()=>clearTimeout(airportFocusCorrect),{passive:true});
function focusAirportResult(preferTabs=false){
  clearTimeout(airportFocusTimer);
  clearTimeout(airportFocusCorrect);
  cancelAnimationFrame(airportFocusFrame);
  const version=++airportFocusVersion;
  airportFocusTimer=window.setTimeout(()=>{
    airportFocusFrame=requestAnimationFrame(()=>{
      if(!resultsOpen||!validRoute()||!root.getClientRects().length)return;
      const tabs=el('transport-tabs');
      const target=preferTabs&&tabs?.getClientRects().length?tabs:el('route-disclosure');
      if(!target||!target.getClientRects().length)return;
      const desiredTop=preferTabs?118:91;
      const align=(behavior)=>{
        if(version!==airportFocusVersion||!resultsOpen||!target.getClientRects().length)return;
        const top=Math.max(0,window.scrollY+target.getBoundingClientRect().top-desiredTop);
        if(Math.abs(top-window.scrollY)>24)window.scrollTo({top,behavior});
      };
      align(focusReduceMotion.matches?'auto':'smooth');
      // Previous expanded sections may auto-fold during the smooth scroll,
      // shifting this target upward. Correct only after that reflow settles.
      airportFocusCorrect=window.setTimeout(()=>align('auto'),950);
    });
  },preferTabs?55:185);
}
function validRoute(){
 return Boolean(state.from && state.to && (state.from==='TP') !== (state.to==='TP'));
}
function updateSelectors(){
 const airports=['T1','T2','SONG'];
 const origins=state.to==='TP'?airports:state.to?['TP']:choices;
 const destinations=state.from==='TP'?airports:state.from?['TP']:choices;
 if(state.from && !origins.includes(state.from))state.from='';
 if(state.to && !destinations.includes(state.to))state.to='';
 const fill=(id,ids,placeholder,selected)=>{
   const select=el(id);
   select.innerHTML=`<option value="">${placeholder}</option>`+ids.map(key=>`<option value="${key}" title="${esc(points[key].label)}">${esc(pickerLabels[key])}</option>`).join('');
   select.value=selected;
   select.closest('.selrow').classList.toggle('is-empty',!selected);
 };
 fill('origin',origins,'出発地を選択',state.from);
 fill('destination',destinations,'目的地を選択',state.to);
 el('swap').disabled=!(state.from||state.to);
}
function setResultsOpen(open){
 resultsOpen=Boolean(open&&validRoute());
 const disclosure=el('route-disclosure');
 const clip=el('results-clip');
 disclosure.setAttribute('aria-expanded',String(resultsOpen));
 clip.classList.toggle('is-open',resultsOpen);
 clip.inert=!resultsOpen;
 if(resultsOpen){
   // Wait for the expanding results panel and its viewport focus to settle.
   queueTimelineEntrance(650);
   focusAirportResult(false);
 }else {
   clearTimeout(airportFocusTimer);
   clearTimeout(airportFocusCorrect);
   ++airportFocusVersion;
   cancelAnimationFrame(airportFocusFrame);
   const timeline=el('timeline');
   window.clearTimeout(timeline._airselAnimTimer);
   window.clearTimeout(timeline._airselCleanupTimer);
   timeline.classList.remove('airsel-timeline-animating','airsel-timeline-pending');
 }
}
function queueTimelineEntrance(delay=0){
 const timeline=el('timeline');
 if(!timeline)return;
 if(airportRouteSwitching){
   window.clearTimeout(timeline._airselAnimTimer);
   window.clearTimeout(timeline._airselCleanupTimer);
   timeline.classList.remove('airsel-timeline-animating','airsel-timeline-pending');
   return;
 }
 window.clearTimeout(timeline._airselAnimTimer);
 window.clearTimeout(timeline._airselCleanupTimer);
 timeline.classList.remove('airsel-timeline-animating');
 // Hide the fully-built route immediately, before the delayed drawing begins.
 // Without this pending state the completed line flashes during crossfades.
 timeline.classList.add('airsel-timeline-pending');
 const stops=[...timeline.querySelectorAll('.timeline-stop')];
 const legs=[...timeline.querySelectorAll('.timeline-leg')];
 if((!stops.length&&!legs.length)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){timeline.classList.remove('airsel-timeline-pending');return;}
 stops.forEach((node,index)=>node.style.setProperty('--airsel-stop-delay',`${index*248}ms`));
 // Start route drawing slightly before the last station finishes appearing,
 // creating a more continuous transition while preserving station timing.
 const lastStationFinish=Math.max(0,stops.length-1)*248+750;
 const legStart=Math.max(0,lastStationFinish-260);
 legs.forEach((node,index)=>node.style.setProperty('--airsel-leg-delay',`${legStart+index*780}ms`));
 timeline._airselAnimTimer=window.setTimeout(()=>{
   timeline.classList.remove('airsel-timeline-animating');
   void timeline.offsetWidth;
   timeline.classList.add('airsel-timeline-animating');
   timeline.classList.remove('airsel-timeline-pending');
 },Math.max(0,delay));
 const total=delay+legStart+Math.max(legs.length-1,0)*780+1200;
 timeline._airselCleanupTimer=window.setTimeout(()=>{
   timeline.classList.remove('airsel-timeline-animating','airsel-timeline-pending');
 },Math.max(0,total));
}
function refreshResultVisibility(){
 const ready=validRoute();
 el('route-disclosure').hidden=!ready;
 el('results-clip').hidden=!ready;
 if(!ready)setResultsOpen(false);
}
// In navigation results, prioritize the names travelers see on Taiwan's station signs.
// Japanese remains an unobtrusive second line only where the names differ.
const stopTranslations={
 '機場第一航廈':{zh:'機場第一航廈',ja:'桃園空港 第1ターミナル'},
 '機場第二航廈':{zh:'機場第二航廈',ja:'桃園空港 第2ターミナル'},
 '松山機場':{zh:'松山機場',ja:'台北松山空港'},
 '松山機場駅':{zh:'松山機場',ja:'台北松山空港'},
 '台北車站':{zh:'台北車站',ja:'台北駅'},
 '台北駅':{zh:'台北車站',ja:'台北駅'},
 '忠孝復興':{zh:'忠孝復興',ja:''},
 '台北駅周辺':{zh:'台北車站周邊',ja:'台北駅周辺'},
 '台北松山空港':{zh:'松山機場',ja:'台北松山空港'},
 '桃園国際空港・第1ターミナル':{zh:'桃園國際機場 第1航廈',ja:'桃園空港 第1ターミナル'},
 '桃園国際空港・第2ターミナル':{zh:'桃園國際機場 第2航廈',ja:'桃園空港 第2ターミナル'}
};
function stationContent(name){
 const item=stopTranslations[name]||{zh:name,ja:''};
 return `<span class="airsel-station-label"><span class="stop-name" lang="zh-Hant">${esc(item.zh)}</span>${item.ja?`<span class="airsel-station-ja" lang="ja">${esc(item.ja)}</span>`:''}</span>`;
}
function stop(label,name,code,cls=''){
 const codeColor=code.startsWith('BR')?'brown':code.startsWith('BL')?'blue':code.startsWith('A')?'purple':'';
 return `<div class="timeline-stop ${cls}"><span class="timeline-status ${cls==='transfer'?'timeline-status--transfer':''}">${label}</span><span class="node" aria-hidden="true"></span><div class="stop-body">${stationContent(name)}${code?`<span class="code code--${codeColor}">${code}</span>`:''}</div></div>`;
}
function leg(line,number,direction,color,note=''){
 return `<div class="timeline-leg" style="--travel-color:${color}"><div class="leg-content"><div class="leg-meta"><span class="line-name">${line}</span><span class="separator">·</span><span class="station-count">${number}駅</span></div><div class="direction">${direction}</div>${note?`<div class="direction-note">${note}</div>`:''}</div></div>`;
}
function facts(time,fare,transfers){el('facts').innerHTML=[['所要時間',time],['運賃',fare],['乗り換え',transfers]].map(([k,v])=>`<div class="fact"><span class="fact-label">${k}</span><strong class="fact-value">${v}</strong></div>`).join('');}

function groundLeg(line,direction,color,note=''){
 return `<div class="timeline-leg" style="--travel-color:${color}"><div class="leg-content"><div class="leg-meta"><span class="line-name">${line}</span></div><div class="direction">${direction}</div>${note?`<div class="direction-note">${note}</div>`:''}</div></div>`;
}
function groundMode(title,icon){
 el('rail-head-name').textContent=title;
 el('recommend-badge').hidden=true;
 el('company-img').dataset.ready='false';
 const busSvg='<svg aria-hidden="true" fill="none" width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="15" rx="2.6"></rect><path d="M5 10h14M8 14h.01M16 14h.01M7.5 18v2M16.5 18v2"></path></svg>';
 const taxiSvg='<svg aria-hidden="true" fill="none" width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 11 1.8-5h10.4L19 11M4 11h16v7H4zM7 18v2M17 18v2M7 14h.01M17 14h.01M10 6V4h4v2"></path></svg>';
 el('company-fallback').innerHTML=state.transport==='taxi'?taxiSvg:busSvg;
 el('company-fallback').classList.add('airsel-ground-icon');
}
const fallbackAirport='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true"><rect x="3.1" y="3.1" width="17.8" height="17.8" rx="5" stroke="currentColor" stroke-width="1.35"/><path d="M8.2 7.5c4.7-.5 7.5 2.5 7.5 8.9M15.8 16.5c-4.7.5-7.5-2.5-7.5-8.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.4"/></svg>';
const fallbackTaipei='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/><path d="M12 6 18 12 12 18 6 12z" stroke="currentColor" stroke-width="1.45"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.25"/></svg>';
function restoreRailLogo(song){
 const companySrc=song
   ? 'https://upload.wikimedia.org/wikipedia/en/e/ee/Taipei_Metro_Logo%28Logo_Only%29.svg'
   : 'https://www.tymetro.com.tw/tymetro-new/tw/_images/about/a-logo1.png';
 const img=el('company-img');
 const fallback=el('company-fallback');
 // Rebuild the fallback on EVERY rail selection, including when the image URL is unchanged.
 fallback.classList.remove('airsel-ground-icon');
 fallback.innerHTML=song?fallbackTaipei:fallbackAirport;
 img.dataset.ready='false';
 if(img.getAttribute('src')!==companySrc)img.src=companySrc;
 // A cached image needs no new load event; don't leave the previous transport's emoji.
 if(img.complete && img.naturalWidth>0)img.dataset.ready='true';
}

function groundUpdate(airport,toCity){
 const song=airport==='SONG',bus=state.transport==='bus';
 const city='台北車站',airportLabel=song?'松山機場':points[airport].label;
 const from=toCity?airportLabel:city,to=toCity?city:airportLabel;
 const lines=el('timeline'),details=el('ground-details');
 details.hidden=true;details.innerHTML='';
 if(bus && song){
   groundMode(toCity?'路線バス｜松山空港 → 台北駅':'路線バス｜台北駅 → 松山空港','🚌');
   const official262='https://atis.taipei.gov.tw/aspx/businfomation/presentinfo.aspx?ddlName=262%E5%8D%80&lang=zh-Hant-TW';
   const official913='https://ebus.gov.taipei/EBus/VsSimpleMap?gb=0&routeid=0400091300';
   // IMPORTANT: 262 and 262區 serve the airport on their RETURN trip, not their OUTBOUND trip.
   if(toCity){
     lines.innerHTML=stop('出発','松山機場','','start')+
       groundLeg('262・262区','台北車站（忠孝）方面','#AEB4BC','「返程」／臺北車站（忠孝）行きを確認')+
       stop('到着','台北車站','','end');
     facts('交通状況による','二段票制','なし');
     el('footnote').innerHTML='松山機場の停留所から262・262区の「返程」に乗り、臺北車站（忠孝）で下車。<a href="'+official262+'" target="_blank" rel="noopener noreferrer">262区の停留所・運行状況</a>を確認してください。運賃は乗車区間によって異なります。';
   }else{
     lines.innerHTML=stop('出発','台北車站','','start')+
       groundLeg('262・262区','民生社区方面','#AEB4BC','「去程」／臺北小巨蛋で下車')+
       stop('乗換','臺北小巨蛋','','transfer')+
       groundLeg('913 路線バス','松山機場方面','#AEB4BC','松山機場まで乗車')+
       stop('到着','松山機場','','end');
     facts('運行状況による','区間別','1回');
     el('footnote').innerHTML='台北駅から松山空港までの262・262区の直通運行はありません。臺北小巨蛋で空港方面の913に乗り換える例です。<a href="'+official262+'" target="_blank" rel="noopener noreferrer">262区</a>・<a href="'+official913+'" target="_blank" rel="noopener noreferrer">913</a>の運行方向と停留所をご確認ください。運賃は乗車区間・乗車回数によって異なります。乗換が少ないMRTがおすすめです。';
   }
   return;
 }
 if(bus){
   groundMode('国光客運｜路線バス','🚌');
   lines.innerHTML=stop('出発',toCity?airportLabel:'台北駅周辺','', 'start')+
      groundLeg('国光客運 1819／1819B',toCity?'台北車站周邊へ':'桃園國際機場へ','#AEB4BC',toCity?'台北轉運站 方面の路線。乗り場と運行方向を確認':'乗り場・運行便を事前に確認')+
      stop('到着',toCity?'台北駅周辺':airportLabel,'','end');
   if(toCity){
     // Route names already appear in the timeline. Keep the time/fare once,
     // in the same facts row used by the reverse direction and other modes.
     facts('約55〜75分','NT$133〜164','なし');
     el('footnote').textContent='時間・料金は旧ガイド掲載の参考値です。運行路線、停留所、料金は出発前に国光客運の最新案内をご確認ください。';
   }else{
     facts('要確認','要確認','なし');
     el('footnote').textContent='空港方面の乗り場、便名、時刻と料金は事前に運行会社で確認してください。';
   }
 }else{
   groundMode('タクシー','🚕');
   lines.innerHTML=stop('出発',from,'','start')+
     groundLeg('タクシー',to+'まで','#D9B65F','空港の正規タクシー乗り場を利用。道路状況によって時間が変わります')+
     stop('到着',to,'','end');
   facts(song?'約20分':'約35分','メーター制','なし');
   el('footnote').textContent='所要時間は従来のガイドに掲載した目安です。渋滞・深夜料金・乗降場所によって料金と時間が変動します。';
 }
}
function update(){
 updateSelectors();
 refreshResultVisibility();
 if(!validRoute())return;
 const airport=state.from==='TP'?state.to:state.from;
 const toCity=state.to==='TP';
 const song=airport==='SONG';
 for(const tab of el('transport-tabs').querySelectorAll('button')) tab.setAttribute('aria-selected',String(tab.dataset.transport===state.transport));
 el('transport-tabs').style.setProperty('--active-index',String(['rail','bus','taxi'].indexOf(state.transport)));
 const tabs=el('train-tabs');tabs.hidden=song||state.transport!=='rail';
 el('train-select').value=state.mode;
 el('ground-details').hidden=true;el('ground-details').innerHTML='';
 if(state.transport!=='rail'){groundUpdate(airport,toCity);if(resultsOpen)queueTimelineEntrance(120);return;}
 restoreRailLogo(song);
 el('recommend-badge').hidden=song;
 for(const tab of tabs.querySelectorAll('button'))tab.setAttribute('aria-selected',String(tab.dataset.mode===state.mode));
 if(song){
  el('rail-head-name').textContent=toCity?'文湖線 → 板南線':'板南線 → 文湖線';

  const firstStop=toCity?stop('出発','松山機場','BR13','start'):stop('出発','台北車站','BL12','start');
  const firstLeg=toCity?leg('文湖線','3','動物園 方面','#AE854E'):leg('板南線','3','南港展覧館 方面','#378BC7');
  const transfer=`<div class="timeline-stop transfer"><span class="timeline-status timeline-status--transfer">乗換</span><span class="node"></span><div class="stop-body">${stationContent('忠孝復興')}<span class="code code--brown">BR10</span><span class="code code--blue">BL15</span></div></div>`;
  const secondLeg=toCity?leg('板南線','3','頂埔・亞東醫院 方面','#378BC7'):leg('文湖線','3','南港展覧館 方面','#AE854E');
  const lastStop=toCity?stop('到着','台北車站','BL12','end'):stop('到着','松山機場','BR13','end');
  el('timeline').innerHTML=firstStop+firstLeg+transfer+secondLeg+lastStop;
  facts('約20分','NT$25','1回');
  el('footnote').textContent='所要時間は待ち時間を含む目安です。運賃は台北MRTの普通運賃。';
 } else {
  const code=points[airport].code;
  const express=state.mode==='express';
  const color=express?'#A978D5':'#478ED1';
  el('rail-head-name').textContent='空港MRT';
  const count=(airport==='T1'? (express?3:11):(express?4:12));
  const from=toCity?stop('出発',points[airport].station,code,'start'):stop('出発','台北車站','A1','start');
  const bound=toCity?'台北車站 方面':(express?'機場第二航廈・環北 方面':'機場第二航廈・老街溪 方面');
  const line=express?'直達車（急行）':'普通車（各停）';
  const note=toCity?'': '列車により運行方向が異なります';
  const dest=toCity?stop('到着','台北車站','A1','end'):stop('到着',points[airport].station,code,'end');
  el('timeline').innerHTML=from+leg(line,count,bound,color,note)+dest;
  const t=airport==='T1'?(express?'約35〜39分':'約50分'):(express?'約39〜43分':'約53分');
  facts(t,'NT$160','なし');
  el('footnote').textContent='乗車駅数は選択した航廈・列車種別に応じて表示。運行便やダイヤは出発前に公式情報をご確認ください。';
 }
 if(resultsOpen)queueTimelineEntrance(120);
}
// Let the collapsed view paint once before expanding so that CSS grid expansion animates.
let autoExpandVersion=0;
function updateAndAutoExpand(){
 const version=++autoExpandVersion;
 setResultsOpen(false);
 // Each new airport route (including reversing direction) opens at its default.
 state.transport='rail';
 state.mode='express';
 update();
 if(!validRoute())return;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(version===autoExpandVersion && validRoute())setResultsOpen(true);
 }));
}
el('origin').addEventListener('change',e=>{
 state.from=e.target.value;
 if(state.from==='TP'&&state.to==='TP')state.to='';
 if(state.from && state.from!=='TP' && state.to && state.to!=='TP')state.to='';
 updateAndAutoExpand();
});
el('destination').addEventListener('change',e=>{
 state.to=e.target.value;
 if(state.to==='TP'&&state.from==='TP')state.from='';
 if(state.to && state.to!=='TP' && state.from && state.from!=='TP')state.from='';
 updateAndAutoExpand();
});
el('swap').addEventListener('click',()=>{
 if(!state.from&&!state.to)return;
 const {from,to}=state;
 state.from=to;state.to=from;
 updateAndAutoExpand();
});
el('route-disclosure').addEventListener('click',()=>{
 setResultsOpen(!resultsOpen);
});
el('train-select').addEventListener('change',e=>{
 state.mode=e.target.value;update();
 if(resultsOpen)focusAirportResult(true);
 const panel=root.querySelector('.route-panel');
 if(resultsOpen&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  panel.animate([{opacity:.25,transform:'translate3d(0,22px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:510,easing:'cubic-bezier(.2,.8,.2,1)'});
 }
});
const transportOrder=['rail','bus','taxi'];
const swipePanel=root.querySelector('.route-panel');
const swipeSurfaces=[el('transport-tabs'),swipePanel];
let gesture=null,ignoreClickUntil=0,switching=false;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
root.addEventListener('click',e=>{
 if(performance.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();}
},true);
function resetDraggedPanel(){
 swipePanel.style.transition='';swipePanel.style.transform='';swipePanel.style.opacity='';
 root.style.userSelect='';
}
function clearAirportRouteAnimation(){
 const timeline=el('timeline');
 window.clearTimeout(timeline._airselAnimTimer);
 window.clearTimeout(timeline._airselCleanupTimer);
 timeline.classList.remove('airsel-timeline-animating','airsel-timeline-pending');
}
function changeTransport(mode,dragOffset=0){
 if(mode===state.transport || !transportOrder.includes(mode) || !validRoute() || switching)return;
 // Returning to the MRT column always starts with its default: express train.
 // This is shared by tap, keyboard, and horizontal-swipe navigation.
 state.mode='express';
 const direction=Math.sign(transportOrder.indexOf(mode)-transportOrder.indexOf(state.transport));
 clearAirportRouteAnimation();
 if(reducedMotion.matches || !resultsOpen){
  resetDraggedPanel();state.transport=mode;update();
  if(resultsOpen)focusAirportResult(true);
  return;
 }
 switching=true;
 airportRouteSwitching=true;
 root.classList.add('is-transport-switching');
 swipePanel.style.transition='none';
 const startingOpacity=dragOffset?Math.max(.64,1-Math.abs(dragOffset)*.006):1;
 const exit=swipePanel.animate([
  {opacity:startingOpacity,transform:'translate3d(0,0,0)'},
  {opacity:0,transform:'translate3d(0,0,0)'}
 ],{duration:150,easing:'ease-in',fill:'forwards'});
 const finish=()=>{
  swipePanel.getAnimations().forEach(anim=>anim.cancel());
  resetDraggedPanel();
  airportRouteSwitching=false;
  root.classList.remove('is-transport-switching');
  switching=false;
  if(resultsOpen)focusAirportResult(true);
 };
 exit.finished.then(()=>{
  // Replacing the DOM while invisible prevents any old completed route from crossing over the new one.
  swipePanel.style.opacity='0';
  exit.cancel();
  swipePanel.style.transform='';
  state.transport=mode;
  update(); // Route is built while the panel is invisible.
  airportRouteSwitching=false;
  // Set the hidden pre-animation state BEFORE starting the panel fade-in.
  // A route must never appear complete between DOM update and animation start.
  if(resultsOpen)queueTimelineEntrance(60);
  const enter=swipePanel.animate([
   {opacity:0,transform:'translate3d(0,0,0)'},
   {opacity:1,transform:'translate3d(0,0,0)'}
  ],{duration:240,easing:'ease-out',fill:'forwards'});
  enter.finished.then(finish).catch(finish);
 }).catch(finish);
}
for(const tab of root.querySelectorAll('[data-transport]')) tab.addEventListener('click',()=>changeTransport(tab.dataset.transport));
function finishGesture(cancelled=false){
 if(!gesture)return;
 const g=gesture;gesture=null;
 root.style.userSelect='';
 if(g.axis!=='x')return;
 const distance=g.lastX-g.x;
 const offset=Math.max(-108,Math.min(108,distance*.65));
 if(!cancelled && Math.abs(distance)>=50){
  const change=distance<0?1:-1;
  const next=transportOrder.indexOf(state.transport)+change;
  if(next>=0&&next<transportOrder.length&&!switching){
   ignoreClickUntil=performance.now()+320;
   changeTransport(transportOrder[next],offset);
   return;
  }
 }
 const back=swipePanel.animate([
  {transform:`translate3d(${offset}px,0,0)`,opacity:Math.max(.64,1-Math.abs(offset)*.006)},
  {transform:'translate3d(0,0,0)',opacity:1}
 ],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)'});
 back.finished.then(()=>{back.cancel();resetDraggedPanel();}).catch(resetDraggedPanel);
}
for(const surface of swipeSurfaces){
 surface.addEventListener('pointerdown',event=>{
  if(gesture||switching||!resultsOpen||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;
  if(event.target.closest('select,input,textarea,a,[contenteditable="true"]'))return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,axis:'pending'};
 });
}
window.addEventListener('pointermove',event=>{
 if(!gesture||event.pointerId!==gesture.id)return;
 const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
 gesture.lastX=event.clientX;
 if(gesture.axis==='pending'){
  if(Math.hypot(dx,dy)<10)return;
  if(Math.abs(dy)>=Math.abs(dx)*1.12){gesture=null;return;}
  gesture.axis='x';root.style.userSelect='none';
 }
 if(gesture.axis!=='x')return;
 if(event.cancelable)event.preventDefault();
 const offset=Math.max(-108,Math.min(108,dx*.65));
 swipePanel.style.transition='none';
 swipePanel.style.transform=`translate3d(${offset}px,0,0)`;
 swipePanel.style.opacity=String(Math.max(.64,1-Math.abs(offset)*.006));
},{passive:false});
window.addEventListener('pointerup',event=>{if(gesture&&event.pointerId===gesture.id)finishGesture();});
window.addEventListener('pointercancel',event=>{if(gesture&&event.pointerId===gesture.id)finishGesture(true);});
window.addEventListener('blur',()=>finishGesture(true));
el('transport-tabs').addEventListener('keydown',event=>{
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 event.preventDefault();
 const idx=transportOrder.indexOf(state.transport)+(event.key==='ArrowRight'?1:-1);
 if(idx<0||idx>=transportOrder.length)return;
 const mode=transportOrder[idx];changeTransport(mode);
 const tab=el('transport-tabs').querySelector(`[data-transport="${mode}"]`);
 if(tab)tab.focus({preventScroll:true});
});

el('company-img').addEventListener('error',function(){this.dataset.ready='false';});
el('company-img').addEventListener('load',function(){this.dataset.ready=String(state.transport==='rail' && this.naturalWidth>0);});
update();

})();


/* =================== JS 10: mobile-map-native-link-fix-v22 =================== */
;

(()=>{
  'use strict';
  const isTouchDevice=window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints>0;
  if(!isTouchDevice)return; // Desktop visitors continue to open Google Maps in a new tab.
  // Day-trip directions should not rely on a pop-up being permitted in mobile browsers.
  for(const a of document.querySelectorAll('#guide .daytrip-depart-now'))a.target='_self';
  // Mobile webviews frequently suppress new tabs. Use an ordinary navigation instead.
  for(const a of document.querySelectorAll('#guide a[href^="https://maps.app.goo.gl/"]')){
    const original=a.getAttribute('href');
    const place=(a.textContent||'').replace(/\s+/g,' ').trim();
    // Google Maps URLs without short-link redirects work better inside mobile browsers.
    // Retain the original pinpoint short link for desktop and future reference.
    if(!place)continue;
    a.dataset.originalMapsUrl=original;
    // Keep Taipei as a search qualifier for chain stores only.
    // Other venues search by their displayed name without appending 台湾.
    const item=a.closest('li');
    const tags=(item?.getAttribute('data-curated-tags')||'')+' '+(item?.textContent||'');
    const query=place+(/チェーン店/.test(tags)?' 台北':'');
    a.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
    a.target='_self';
  }
})();


/* =================== JS 11: daytrip-route-entrance-v30.3 =================== */
;
(() => {
  'use strict';
  const section=document.querySelector('#guide .sights-day-trips');
  if(!section)return;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const timelines=[...section.querySelectorAll('.daytrip-airport-reuse .timeline')];
  const activeTimers=new WeakMap();
  function isDisplayed(el){
    if(el.closest('[hidden]'))return false;
    if(!el.getClientRects().length)return false;
    const r=el.getBoundingClientRect();
    return r.bottom>0&&r.top<window.innerHeight;
  }
  function reset(el){
    const t=activeTimers.get(el);if(t)clearTimeout(t);
    activeTimers.delete(el);el.classList.remove('airsel-timeline-animating');
    el.dataset.daytripPlayed='false';
  }
  function play(el,force=false){
    if(reduceMotion.matches||!isDisplayed(el))return;
    if(!force && el.dataset.daytripPlayed==='true')return;
    reset(el);
    const stops=[...el.querySelectorAll(':scope > .timeline-stop')];
    const legs=[...el.querySelectorAll(':scope > .timeline-leg')];
    if(!stops.length||!legs.length)return;
    stops.forEach((node,i)=>node.style.setProperty('--airsel-stop-delay',`${i*248}ms`));
    const legStart=Math.max(0,(stops.length-1)*248+750-260);
    legs.forEach((node,i)=>node.style.setProperty('--airsel-leg-delay',`${legStart+i*780}ms`));
    void el.offsetWidth;
    el.classList.add('airsel-timeline-animating');
    el.dataset.daytripPlayed='true';
    const duration=legStart+(legs.length-1)*780+1250;
    activeTimers.set(el,setTimeout(()=>{
      el.classList.remove('airsel-timeline-animating');activeTimers.delete(el);
    },duration));
  }
  let scanTimer;
  function scan(force=false){
    clearTimeout(scanTimer);
    scanTimer=setTimeout(()=>{
      timelines.forEach(t=>{if(isDisplayed(t))play(t,force);});
    },95);
  }
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting)play(entry.target);});
    },{threshold:0.04,rootMargin:'0px 0px -2% 0px'});
    timelines.forEach(t=>io.observe(t));
  }
  timelines.forEach(t=>t.dataset.daytripPlayed='false');
  // Hidden tabs and destinations must restart the timeline when revisited.
  const changes=new MutationObserver(records=>{
    for(const record of records){
      if(record.attributeName==='hidden'){
        const parent=record.target;
        if(parent.hasAttribute('hidden'))parent.querySelectorAll('.daytrip-airport-reuse .timeline').forEach(reset);
      }
    }
    scan();
  });
  section.querySelectorAll('.daytrip-destination-panel, .daytrip-destination-panel .tab-panel, .daytrip-bus-route')
    .forEach(el=>changes.observe(el,{attributes:true,attributeFilter:['hidden']}));
  section.addEventListener('click',e=>{
    if(e.target.closest('.daytrip-destination-button,.daytrip-transport-tab,.daytrip-bus-route-choice')){
      // Wait for the existing tab/destination controller to finish unhiding content.
      scan(true);
    }
  });
  window.addEventListener('scroll',()=>scan(),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan();});
  // Replicate Airport Access' animated underline on each local transport tablist.
  section.querySelectorAll('.daytrip-transport').forEach(list=>{
    function update(){
      const buttons=[...list.querySelectorAll(':scope > button.tab-pill')];
      const idx=Math.max(0,buttons.findIndex(b=>b.getAttribute('aria-selected')==='true'));
      list.style.setProperty('--active-index',String(idx));
    }
    update();
    const watch=new MutationObserver(update);
    list.querySelectorAll(':scope > button.tab-pill').forEach(btn=>watch.observe(btn,{attributes:true,attributeFilter:['aria-selected']}));
  });
  // Reuse the Jiufen 965/1062 selector for each multi-route segment.
  // Scope every selector independently: Jiufen direct bus, Jiufen rail+bus, Yehliu bus.
  section.querySelectorAll('.daytrip-bus-airport-style').forEach(bus=>{
    const buttons=[...bus.querySelectorAll('.daytrip-bus-route-choice')];
    const routes=[...bus.querySelectorAll('.daytrip-bus-route')];
    const facts=[...bus.querySelectorAll('.daytrip-bus-route-facts')];
    if(buttons.length<2 || routes.length<2)return;
    // The default is read from the initial markup (965 / Ruifang bus / 1815).
    const defaultRoute=(buttons.find(btn=>btn.getAttribute('aria-pressed')==='true')||buttons[0]).dataset.route;
    // Only the Ruifang transfer panel uses a transport-specific heading.
    const ruifangTitle=bus.classList.contains('daytrip-railbus-switch')
      ? bus.querySelector('.rail-title .daytrip-canonical-head-name') : null;
    function choose(id){
      if(ruifangTitle)ruifangTitle.textContent=id==='taxi'?'瑞芳駅からタクシーへ':'瑞芳駅からバスへ';
      buttons.forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.route===id)));
      routes.forEach(el=>{
        const on=el.dataset.route===id;
        el.hidden=!on;
        if(!on)el.querySelectorAll('.timeline').forEach(reset);
      });
      facts.forEach(el=>{el.hidden=el.dataset.route!==id;});
      bus.querySelectorAll('.rail-title .daytrip-route-head-meta[data-route]').forEach(el=>{
        el.hidden=el.dataset.route!==id;
      });
      scan(true);
    }
    buttons.forEach(btn=>btn.addEventListener('click',()=>choose(btn.dataset.route)));
    bus.addEventListener('daytrip-reset-subroute',()=>{
      if(buttons.find(btn=>btn.getAttribute('aria-pressed')==='true')?.dataset.route!==defaultRoute)
        choose(defaultRoute);
    });
  });
  scan();
})();

/* =================== JS 12: guide-auto-fold-outside-viewport-v29 =================== */
;

/* Fold expanded blocks only after the entire visible block has left the viewport.
   Preserve unvisited, newly opened offscreen panels; do not interfere with nested
   directory scrollports or the food-search overlay. */
(() => {
  'use strict';
  const guide=document.getElementById('guide');
  if(!guide)return;
  // Only the travel-preparation accordions auto-fold when leaving the
  // viewport. Airport access, all dining/area/experience sections and nearby
  // destinations remain open until an actual user selection closes them.
  const foodRoot=guide.querySelector('#food-recommend-section');
  const detailBlocks=[...guide.querySelectorAll('details')]
    .filter(detail=>foodRoot && !!(detail.compareDocumentPosition(foodRoot) & Node.DOCUMENT_POSITION_FOLLOWING));
  const dayTripPanels=[];
  const airportClip=null;
  const tracked=new Map();

  function expanded(element,kind){
    if(!element.isConnected)return false;
    if(kind==='details')return element.open && !element.closest('[hidden]');
    if(kind==='daytrip')return !element.hidden && !element.closest('[hidden]');
    return element===airportClip && element.classList.contains('is-open') && !element.hidden;
  }
  function intersectsVisibleArea(element){
    if(element.closest('[hidden]'))return false;
    const rect=element.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return false;
    const viewport=window.visualViewport;
    let top=viewport?.offsetTop||0;
    let left=viewport?.offsetLeft||0;
    let bottom=top+(viewport?.height||window.innerHeight);
    let right=left+(viewport?.width||window.innerWidth);
    // Observe real scroll clipping, including category lists nested within tabs.
    for(let ancestor=element.parentElement;ancestor;ancestor=ancestor.parentElement){
      if(ancestor.hasAttribute('hidden'))return false;
      const css=getComputedStyle(ancestor);
      if(css.display==='none'||css.visibility==='hidden')return false;
      if(/auto|scroll|hidden|clip/.test(css.overflowY)){
        const box=ancestor.getBoundingClientRect();
        top=Math.max(top,box.top);
        bottom=Math.min(bottom,box.bottom);
      }
      if(/auto|scroll|hidden|clip/.test(css.overflowX)){
        const box=ancestor.getBoundingClientRect();
        left=Math.max(left,box.left);
        right=Math.min(right,box.right);
      }
    }
    return rect.bottom>top+1 && rect.top<bottom-1 && rect.right>left+1 && rect.left<right-1;
  }
  const watcher=('IntersectionObserver' in window)?new IntersectionObserver(entries=>{
    for(const entry of entries){
      const info=tracked.get(entry.target);
      if(!info)continue;
      if(!expanded(entry.target,info.kind)){untrack(entry.target);continue;}
      if(entry.isIntersecting && intersectsVisibleArea(entry.target)){
        info.seen=true;
      }else if(info.seen){
        maybeFold(entry.target,info);
      }
    }
  },{root:null,threshold:0}):null;

  function track(element,kind){
    if(!expanded(element,kind)||tracked.has(element))return;
    const info={kind,seen:false};
    tracked.set(element,info);
    watcher?.observe(element);
    // The content can be visible immediately when the visitor expands it.
    requestAnimationFrame(()=>{
      if(tracked.get(element)===info && expanded(element,kind) && intersectsVisibleArea(element))info.seen=true;
    });
  }
  function untrack(element){
    tracked.delete(element);
    watcher?.unobserve(element);
  }
  function fold(element,kind){
    if(kind==='details'){
      // Keep parent/child accordion states consistent with the site's own behavior.
      element.querySelectorAll('details[open]').forEach(child=>{child.open=false;});
      element.open=false;
    }else if(kind==='daytrip'){
      const button=guide.querySelector('.daytrip-destination-buttons > button[aria-controls="'+CSS.escape(element.id)+'"]');
      if(button){
        button.setAttribute('aria-expanded','false');
        const name=['九份','十分','基隆','野柳'][dayTripPanels.indexOf(element)];
        if(name)button.setAttribute('aria-label',name+'の交通案内を開く');
      }
      element.hidden=true;
    }else if(kind==='airport'){
      const disclosure=guide.querySelector('#airsel-route-disclosure');
      if(disclosure?.getAttribute('aria-expanded')==='true')disclosure.click();
    }
  }
  function maybeFold(element,info){
    requestAnimationFrame(()=>{
      if(tracked.get(element)!==info||!info.seen)return;
      if(!expanded(element,info.kind)){untrack(element);return;}
      if(document.body.classList.contains('food-drawer-open'))return;
      if(intersectsVisibleArea(element))return;
      untrack(element);
      fold(element,info.kind);
    });
  }

  detailBlocks.forEach(detail=>{
    detail.addEventListener('toggle',()=>{
      if(detail.open)track(detail,'details');
      else untrack(detail);
    });
    if(detail.open)track(detail,'details');
  });
  function syncPanel(panel,kind){
    if(expanded(panel,kind))track(panel,kind);
    else untrack(panel);
  }
  const changes=new MutationObserver(records=>{
    for(const record of records){
      const element=record.target;
      syncPanel(element,element===airportClip?'airport':'daytrip');
    }
  });
  dayTripPanels.forEach(panel=>{
    changes.observe(panel,{attributes:true,attributeFilter:['hidden']});
    syncPanel(panel,'daytrip');
  });
  if(airportClip){
    changes.observe(airportClip,{attributes:true,attributeFilter:['class','hidden']});
    syncPanel(airportClip,'airport');
  }
  // Fallback for old browsers without IntersectionObserver. The same test also
  // catches changes caused by scrollbars inside directory/category panels.
  if(!watcher){
    let queued=false;
    const inspect=()=>{
      queued=false;
      for(const [element,info] of tracked){
        if(intersectsVisibleArea(element))info.seen=true;
        else if(info.seen)maybeFold(element,info);
      }
    };
    const enqueue=()=>{if(!queued){queued=true;requestAnimationFrame(inspect);}};
    window.addEventListener('scroll',enqueue,{passive:true,capture:true});
    window.addEventListener('resize',enqueue,{passive:true});
    guide.addEventListener('scroll',enqueue,{passive:true,capture:true});
  }
})();





/* =================== JS 13: daytrip-mobile-transitions-v30.6 =================== */
(()=>{
  'use strict';
  const section=document.querySelector('#guide .sights-day-trips');
  if(!section)return;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  section.querySelectorAll('.daytrip-transport').forEach(list=>{
    const tabs=[...list.querySelectorAll(':scope > button.tab-pill')];
    const content=list.nextElementSibling;
    if(!content || !content.classList.contains('tab-panels'))return;
    const panels=[...content.querySelectorAll(':scope > .tab-panel')];
    if(tabs.length<2||panels.length!==tabs.length)return;
    let prior=Math.max(0,tabs.findIndex(x=>x.getAttribute('aria-selected')==='true'));
    let enterFrame=0,gesture=null,blockNativeClickUntil=0;
    function selected(){return Math.max(0,tabs.findIndex(x=>x.getAttribute('aria-selected')==='true'));}
    function animateSelection(){
      const now=selected();
      if(now===prior)return;
      const old=prior;prior=now;
      const panel=panels[now];
      const previous=panels[old];
      cancelAnimationFrame(enterFrame);
      panels.forEach(p=>p.classList.remove('daytrip-switch-enter'));
      const silentReset=list.dataset.daytripSilentReset==='true';
      delete list.dataset.daytripSilentReset;
      const canAnimate=!silentReset&&!reduceMotion.matches&&!panel.hidden&&!!list.getClientRects().length;
      if(!canAnimate)return;
      const wrap=content;
      const oldGhost=wrap.querySelector(':scope > .daytrip-switch-ghost');
      if(oldGhost)oldGhost.remove();
      const oldHeight=(previous&&previous.scrollHeight)||0;
      const newHeight=panel.scrollHeight||0;
      if(oldHeight||newHeight)wrap.style.minHeight=Math.max(oldHeight,newHeight)+'px';
      if(previous){
        const ghost=previous.cloneNode(true);
        ghost.removeAttribute('id');
        ghost.removeAttribute('hidden');
        ghost.removeAttribute('aria-labelledby');
        ghost.removeAttribute('role');
        ghost.setAttribute('aria-hidden','true');
        ghost.classList.remove('daytrip-switch-enter');
        ghost.classList.add('daytrip-switch-ghost');
        ghost.style.setProperty('--daytrip-exit-to',now>old?'-56px':'56px');
        wrap.classList.add('is-switching');
        wrap.appendChild(ghost);
        const clearGhost=()=>{
          ghost.remove();
          if(!wrap.querySelector('.daytrip-switch-ghost')){
            wrap.classList.remove('is-switching');
            wrap.style.minHeight='';
          }
        };
        ghost.addEventListener('animationend',clearGhost,{once:true});
        window.setTimeout(clearGhost,420);
      }
      panel.style.setProperty('--daytrip-enter-from',now>old?'68px':'-68px');
      // Newly unhidden panels must be painted once before entrance begins on iOS.
      enterFrame=requestAnimationFrame(()=>{
        if(panel.hidden)return;
        void panel.offsetWidth;
        panel.classList.add('daytrip-switch-enter');
      });
      const clearMinHeight=(e)=>{
        if(e.target!==panel||e.animationName!=='daytrip-slide-enter')return;
        panel.removeEventListener('animationend',clearMinHeight);
        if(!wrap.querySelector('.daytrip-switch-ghost'))wrap.style.minHeight='';
      };
      panel.addEventListener('animationend',clearMinHeight);
      window.setTimeout(()=>{
        if(!wrap.querySelector('.daytrip-switch-ghost'))wrap.style.minHeight='';
      },560);
    }
    const observer=new MutationObserver(animateSelection);
    tabs.forEach(t=>observer.observe(t,{attributes:true,attributeFilter:['aria-selected']}));
    panels.forEach(p=>p.addEventListener('animationend',e=>{
      if(e.target===p && e.animationName==='daytrip-slide-enter')p.classList.remove('daytrip-switch-enter');
    }));
    function switchBy(delta){
      const next=selected()+delta;
      if(next<0||next>=tabs.length)return false;
      // Reuse site's original controller: ARIA, panel visibility and tab underline stay in sync.
      tabs[next].click();
      return true;
    }
    function onStart(e){
      if(e.touches.length!==1){gesture=null;return;}
      const t=e.touches[0];
      gesture={id:t.identifier,x:t.clientX,y:t.clientY,lastX:t.clientX,lastY:t.clientY,
        horizontal:false,vertical:false};
    }
    function onMove(e){
      if(!gesture)return;
      const t=[...e.changedTouches].find(x=>x.identifier===gesture.id);
      if(!t)return;
      const dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
      gesture.lastX=t.clientX;gesture.lastY=t.clientY;
      if(gesture.vertical)return;
      if(!gesture.horizontal&&Math.hypot(dx,dy)>10){
        if(Math.abs(dy)>Math.abs(dx)*1.12){gesture.vertical=true;return;}
        if(Math.abs(dx)>Math.abs(dy)*1.15)gesture.horizontal=true;
      }
      // Claim horizontal drags early instead of waiting until Safari cancels touchend.
      if(gesture.horizontal&&e.cancelable)e.preventDefault();
    }
    function onEnd(e){
      if(!gesture)return;
      const t=[...e.changedTouches].find(x=>x.identifier===gesture.id);
      if(!t)return;
      const current=gesture;gesture=null;
      const dx=t.clientX-current.x,dy=t.clientY-current.y;
      if(current.vertical || Math.abs(dx)<44 || Math.abs(dx)<Math.abs(dy)*1.2)return;
      const changed=switchBy(dx<0?1:-1);
      if(changed)blockNativeClickUntil=performance.now()+500;
    }
    function onCancel(){gesture=null;}
    // Both tab bar and route content allow direct horizontal gestures. Using touchmove
    // with passive:false prevents browser back-swipe and horizontal overflow conflicts.
    for(const surface of [list,content]){
      surface.addEventListener('touchstart',onStart,{passive:true});
      surface.addEventListener('touchmove',onMove,{passive:false});
      surface.addEventListener('touchend',onEnd,{passive:true});
      surface.addEventListener('touchcancel',onCancel,{passive:true});
      // A gesture beginning on a link/button must not activate it on touch release.
      surface.addEventListener('click',e=>{
        if(e.isTrusted && performance.now()<blockNativeClickUntil){
          e.preventDefault();e.stopImmediatePropagation();
        }
      },true);
    }
  });
})();


/* =================== JS 14: airport-and-daytrip-result-focus-v30.9.18 =================== */
(() => {
  'use strict';
  const section=document.querySelector('#guide .sights-day-trips');
  if(!section)return;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let focusFrame=0,focusTimer=0,focusCorrection=0,focusVersion=0;
  const cancelCorrection=()=>{clearTimeout(focusCorrection);};
  window.addEventListener('touchstart',cancelCorrection,{passive:true});
  window.addEventListener('wheel',cancelCorrection,{passive:true});
  function focusAt(target,top=100){
    clearTimeout(focusTimer);
    cancelCorrection();
    cancelAnimationFrame(focusFrame);
    const version=++focusVersion;
    focusTimer=window.setTimeout(()=>{
      focusFrame=requestAnimationFrame(()=>{
        if(!target||!target.isConnected||!target.getClientRects().length||target.closest('[hidden]'))return;
        const align=(behavior)=>{
          if(version!==focusVersion||!target.getClientRects().length||target.closest('[hidden]'))return;
          const destination=Math.max(0,window.scrollY+target.getBoundingClientRect().top-top);
          if(Math.abs(destination-window.scrollY)>24)window.scrollTo({top:destination,behavior});
        };
        align(reduceMotion.matches?'auto':'smooth');
        // Auto-folding an earlier (large) accordion changes document height.
        // Re-align once, without a second smooth-motion sweep.
        focusCorrection=window.setTimeout(()=>align('auto'),960);
      });
    },80);
  }
  const cancelPendingFocus=()=>{
    clearTimeout(focusTimer);
    cancelCorrection();
    cancelAnimationFrame(focusFrame);
    ++focusVersion;
  };
  // Capture BEFORE the destination switcher changes aria-expanded. Previously
  // this handler ran on bubble, mistook the newly opened panel for an initial
  // opening, and scrolled the reader back to the four-place toolbar on EVERY
  // destination switch. The scroll correction could even fire 960ms later.
  section.addEventListener('click',event=>{
    const destination=event.target.closest('.daytrip-destination-buttons > .daytrip-destination-button');
    if(destination){
      const alreadyOpen=!!section.querySelector('.daytrip-destination-buttons > .daytrip-destination-button[aria-expanded="true"]');
      if(alreadyOpen){
        // Switch to a different place, or fold the current one: keep the
        // current viewport, and cancel a previous smooth/delayed alignment.
        cancelPendingFocus();
        // Stop any in-flight smooth scroll at its current position without
        // initiating a new scrolling animation.
        window.scrollTo({top:window.scrollY,behavior:'instant'});
      }else{
        // Preserve the established focus only for the FIRST route opening.
        focusAt(section.querySelector('.daytrip-destination-buttons'),100);
      }
      return;
    }
    const mode=event.target.closest('.daytrip-transport-tab');
    if(mode){
      const panel=mode.closest('.daytrip-destination-panel');
      focusAt(panel?.querySelector('.daytrip-destination-panel-heading'),94);
      return;
    }
    const route=event.target.closest('.daytrip-bus-route-choice');
    if(route){
      // v30.9.11: lower route switches must NOT pull the reader back to the
      // heading. Also cancel any delayed correction from a preceding mode
      // switch, which could otherwise scroll a moment after route selection.
      clearTimeout(focusTimer);
      cancelCorrection();
      cancelAnimationFrame(focusFrame);
      ++focusVersion;
      return;
    }
  },true);
})();


/* v30.9.8 — browser back/forward restore for Maps round-trips. */
(()=>{
  'use strict';
  const key='taipei-city-guide:reading-state:v30.9.8';
  const read=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){return null;}};
  const save=()=>{
    try{
      sessionStorage.setItem(key,JSON.stringify({
        at:Date.now(),
        y:window.scrollY,
        details:[...document.querySelectorAll('#guide details[open][id]')].map(e=>e.id),
        panels:[...document.querySelectorAll('#guide .tab-pills')].map(list=>{
          const selected=list.querySelector(':scope > button[aria-selected="true"]');
          return selected?selected.id:null;
        }).filter(Boolean),
        daytrip:document.querySelector('#guide .daytrip-destination-button[aria-expanded="true"]')?.id||null
      }));
    }catch(_){}
  };
  window.addEventListener('pagehide',save);
  // Clicks that launch Maps are saved immediately (even when the OS launches
  // the native app without issuing a reliable pagehide event).
  document.querySelectorAll('#guide a[href*="google.com/maps"],#guide a[href*="maps.app.goo.gl"]').forEach(a=>{
    a.addEventListener('click',save,{capture:true});
  });
  const navigation=performance.getEntriesByType('navigation')[0];
  if(navigation?.type!=='back_forward')return;
  const saved=read();
  if(!saved||Date.now()-saved.at>3600000)return;
  // Reopen the same category before native scrolling is restored. Existing
  // controllers remain responsible for ARIA/tab state and animations.
  // Only restore panels that differ from the saved selection.
  const restore=()=>{
    (saved.details||[]).forEach(id=>{
      const d=document.getElementById(id);
      if(d?.tagName==='DETAILS')d.open=true;
    });
    (saved.panels||[]).forEach(id=>{
      const tab=document.getElementById(id);
      if(tab && tab.getAttribute('aria-selected')!=='true')tab.click();
    });
    if(saved.daytrip){
      const button=document.getElementById(saved.daytrip);
      if(button&&button.getAttribute('aria-expanded')!=='true')button.click();
    }
    // The website's guided-focus controllers may schedule their own scroll
    // after a tab click. Settle on the actual saved reading position at the end.
    if(Number.isFinite(saved.y)&&saved.y>0){
      requestAnimationFrame(()=>window.scrollTo({top:saved.y,behavior:'instant'}));
      window.setTimeout(()=>window.scrollTo({top:saved.y,behavior:'instant'}),280);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});
  else restore();
})();


/* =================== JS 16: daytrip-compact-destination-toolbar-v30.9.17 =================== */
(()=>{
  'use strict';
  const section=document.querySelector('#guide .sights-day-trips');
  if(!section)return;
  const destinationRow=section.querySelector('.daytrip-destination-buttons');
  if(!destinationRow)return;
  const panels=[...section.querySelectorAll('.daytrip-destination-panel')];
  const activePanel=()=>panels.find(p=>!p.hidden&&!p.closest('[hidden]'))||null;
  const expand=()=>section.classList.remove('daytrip-mode-compact');
  const compact=()=>section.classList.add('daytrip-mode-compact');
  // v30.9.47: no scroll, resize, pageshow or visibility handlers here.
  // Destination toolbar changes size only when the visitor operates it
  // (or leaves the entire section through a deliberate different-section action).
  section.addEventListener('click',e=>{
    const destination=e.target.closest('.daytrip-destination-buttons > .daytrip-destination-button');
    if(destination){
      // Clicking the already-selected destination closes it: expand now.
      // Choosing a different destination must NOT expand the toolbar.
      if(destination.getAttribute('aria-expanded')==='true')expand();
      else{
        // All four destinations, including Keelung and Yehliu, compact the
        // buttons while showing their itinerary. Existing route switching
        // must not expand them again.
        compact();
      }
      return;
    }
    if(e.target.closest('.daytrip-transport-tab, .daytrip-bus-route-choice, .daytrip-railbus-choice, .daytrip-bus-rail-choice, .daytrip-railbus-route-choice')){
      compact();
    }
  },true);

  // On mobile, route panels also support horizontal swipe navigation.
  // Do not compact on an ordinary vertical page scroll.
  let gesture=null;
  section.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||!e.target.closest('.daytrip-destination-panel .tab-panels')){
      gesture=null;return;
    }
    gesture={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  section.addEventListener('touchmove',e=>{
    if(!gesture||e.touches.length!==1)return;
    const dx=e.touches[0].clientX-gesture.x;
    const dy=e.touches[0].clientY-gesture.y;
    if(Math.abs(dx)>24&&Math.abs(dx)>Math.abs(dy)*1.3){
      compact();gesture=null;
    }else if(Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx))gesture=null;
  },{passive:true});
  section.addEventListener('touchend',()=>{gesture=null;},{passive:true});
  section.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
  // Maintain the established keyboard/programmatic tab-switch behavior.
  const selectorButtons=section.querySelectorAll('.daytrip-transport > button[role="tab"]');
  const selectedObserver=new MutationObserver(records=>{
    if(records.some(r=>r.target.getAttribute('aria-selected')==='true'))compact();
  });
  selectorButtons.forEach(btn=>selectedObserver.observe(btn,{attributes:true,attributeFilter:['aria-selected']}));
})();


/* =================== JS 17: default-route-per-column-v30.9.25 =================== */
(()=>{
  'use strict';
  const section=document.querySelector('#guide .sights-day-trips');
  if(!section)return;
  const resetSubroutes=scope=>{
    scope.querySelectorAll('.daytrip-bus-airport-style').forEach(bus=>
      bus.dispatchEvent(new Event('daytrip-reset-subroute'))
    );
  };
  // Reset a destination's primary tab to the original first/default column.
  // Do not call .click(): a synthetic click would also invoke the focus handler.
  function resetDestination(panel){
    if(!panel)return;
    const list=panel.querySelector('.daytrip-transport');
    if(list){
      const tabs=[...list.querySelectorAll(':scope > button.tab-pill')];
      const container=list.nextElementSibling;
      const pages=container?.classList.contains('tab-panels')
        ? [...container.children].filter(child=>child.classList.contains('tab-panel')&&!child.classList.contains('daytrip-switch-ghost')) : [];
      if(tabs.length && tabs.length===pages.length){
        if(tabs[0].getAttribute('aria-selected')!=='true')
          list.dataset.daytripSilentReset='true';
        // Drop any in-flight clone of the old route before the destination is shown.
        container.querySelectorAll(':scope > .daytrip-switch-ghost').forEach(ghost=>ghost.remove());
        container.classList.remove('is-switching');
        container.style.minHeight='';
        pages.forEach(page=>page.classList.remove('daytrip-switch-enter'));
        tabs.forEach((tab,i)=>{
          const selected=i===0;
          tab.setAttribute('aria-selected',String(selected));
          tab.tabIndex=selected?0:-1;
          pages[i].hidden=!selected;
        });
        list.style.setProperty('--active-index','0');
      }
    }
    resetSubroutes(panel);
  }
  // Capture before the built-in destination/transport handlers update visibility.
  section.addEventListener('click',event=>{
    const destination=event.target.closest('.daytrip-destination-buttons > .daytrip-destination-button');
    if(destination){
      if(destination.getAttribute('aria-expanded')!=='true')
        resetDestination(document.getElementById(destination.getAttribute('aria-controls')));
      return;
    }
    const tab=event.target.closest('.daytrip-transport > .daytrip-transport-tab');
    if(tab){
      const panel=document.getElementById(tab.getAttribute('aria-controls'));
      if(panel)resetSubroutes(panel);
    }
  },true);
  // Keyboard arrows can activate a tab without a click. This also covers
  // externally activated tabs, while staying independent of animation timing.
  section.querySelectorAll('.daytrip-transport').forEach(list=>{
    const tabs=[...list.querySelectorAll(':scope > .daytrip-transport-tab')];
    const panels=[...list.nextElementSibling?.querySelectorAll(':scope > .tab-panel')||[]];
    if(tabs.length!==panels.length)return;
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.target.getAttribute('aria-selected')==='true'){
          const panel=panels[tabs.indexOf(record.target)];
          if(panel)resetSubroutes(panel);
        }
      }
    });
    tabs.forEach(tab=>observer.observe(tab,{attributes:true,attributeFilter:['aria-selected']}));
  });
})();


/* =================== JS 18: daytrip-supplement-exclusive-reset-v30.9.33 =================== */
(()=>{
  'use strict';
  const section=document.querySelector('#guide .sights-day-trips');
  if(!section)return;
  const folds=[...section.querySelectorAll('details.daytrip-inline-accordion')];
  const panels=[...section.querySelectorAll('.daytrip-destination-panel')];
  if(!folds.length||!panels.length)return;
  const closeFolds=scope=>{
    if(!scope)return;
    scope.querySelectorAll('details.daytrip-inline-accordion[open]').forEach(detail=>{
      detail.open=false;
    });
  };
  const closeOtherFolds=detail=>{
    const panel=detail.closest('.daytrip-destination-panel');
    if(!panel)return;
    panel.querySelectorAll('details.daytrip-inline-accordion[open]').forEach(other=>{
      if(other!==detail)other.open=false;
    });
  };
  // The two supplements reside in separate <section> wrappers, so the
  // default direct-sibling <details> rule does not make them exclusive.
  // Close the sibling before opening to avoid a height/scroll jump.
  section.addEventListener('click',event=>{
    const summary=event.target.closest('details.daytrip-inline-accordion > summary');
    if(summary && !summary.parentElement.open){
      closeOtherFolds(summary.parentElement);
    }
    // A new destination or transit tab is a new page, not the continuation
    // of the earlier supplemental text. Re-enter with every group folded.
    if(event.target.closest('.daytrip-destination-buttons > .daytrip-destination-button, .daytrip-transport > .daytrip-transport-tab')){
      closeFolds(section);
    }
  },true);
  // Keep the rule for keyboard, script-driven or restored <details> opening.
  folds.forEach(detail=>detail.addEventListener('toggle',()=>{
    if(detail.open)closeOtherFolds(detail);
  }));
  // Also close when the site changes destinations or primary tabs without
  // a mouse/touch click (swipe, keyboard and existing programmatic switches).
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.attributeName==='hidden' && record.target.hidden){
        closeFolds(record.target);
      }else if(record.attributeName==='aria-selected' && record.target.getAttribute('aria-selected')==='true'){
        closeFolds(record.target.closest('.daytrip-destination-panel'));
      }
    }
  });
  section.querySelectorAll('.daytrip-destination-panel, .daytrip-destination-panel .tab-panel').forEach(panel=>
    observer.observe(panel,{attributes:true,attributeFilter:['hidden']})
  );
  section.querySelectorAll('.daytrip-transport > .daytrip-transport-tab').forEach(tab=>
    observer.observe(tab,{attributes:true,attributeFilter:['aria-selected']})
  );
  // Leaving the main category (or using a home navigation bubble) folds the
  // supplements so they are never unexpectedly open when visitors return.
  document.addEventListener('click',event=>{
    if(event.target.closest('.quick-nav > .nav-button, #guide .root-accordion > summary')){
      closeFolds(section);
    }
  },true);
})();

/* =================== JS 19: user-gesture-major-section-near-snap-v30.9.35 =================== */
(()=>{
  'use strict';
  // Snap near top-level guide headings after *manual* viewport scrolling only.
  // Never snap scrollable drawers, inner results, tabs, or programmatic navigation.
  const selectors=[
    '#top',
    // v30.9.133: every chapter starts with its number line (01 · TRAVEL …).
    '#guide .chapter-eyebrow',
    '#guide .page-body > .sights-day-trips > h3'
  ].join(',');
  const getHeadings=()=>[...document.querySelectorAll(selectors)]
    .filter(el=>el.getClientRects().length && !el.closest('[hidden]'));
  const hasNestedScroller=target=>{
    let node=target instanceof Element?target:null;
    while(node && node!==document.body){
      if(node.matches('#food-search, #results, .tab-panel, .area-category-list')){
        const cs=getComputedStyle(node);
        if(node.scrollHeight>node.clientHeight+12 && /(auto|scroll)/.test(cs.overflowY))return true;
      }
      node=node.parentElement;
    }
    return false;
  };
  let armed=false,touching=false,moving=false,scrollTimer=0,lastGesture=0;
  let snapBusyUntil=0;
  const stop=()=>{armed=false;moving=false;clearTimeout(scrollTimer);};
  const blocked=target=>{
    if(document.body.classList.contains('food-drawer-open') ||
       document.body.classList.contains('food-swipe-active') ||
       document.body.classList.contains('recommend-drawer-open') ||
       document.body.classList.contains('recommend-swipe-active'))return true;
    const el=target instanceof Element?target:null;
    return !!(el && (el.closest('a, button, summary, input, textarea, select, [role="tab"], [contenteditable="true"]') || hasNestedScroller(el)));
  };
  function snap(){
    if(!armed || touching || performance.now()<snapBusyUntil || blocked(null))return;
    stop();
    const emergency=document.querySelector('#guide .emergency-section-title');
    const er=emergency?.getBoundingClientRect();
    if(er && er.top<innerHeight*.7 && er.bottom>=0)return;
    if(document.documentElement.scrollHeight-scrollY-innerHeight<130)return;
    const targetY=22;
    const candidates=getHeadings().map(el=>({el,rect:el.getBoundingClientRect()}))
      .filter(x=>x.rect.height>0 && x.rect.bottom>=-8 && x.rect.top<=innerHeight*.58);
    if(!candidates.length)return;
    const nearest=candidates.reduce((a,b)=>Math.abs(a.rect.top-targetY)<=Math.abs(b.rect.top-targetY)?a:b);
    // A long route or open directory is not a slide: don't jump several screens
    // back to a heading that the visitor has already finished reading.
    if(Math.abs(nearest.rect.top-targetY)>Math.min(290,Math.max(130,innerHeight*.43)))return;
    const destination=Math.max(0,scrollY+nearest.rect.top-targetY);
    if(Math.abs(destination-scrollY)<6)return;
    // Animate the short snap rather than jumping to the heading. Block
    // scroll-driven retriggers throughout the native smooth-scroll period.
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    snapBusyUntil=performance.now()+(reduceMotion?300:1050);
    scrollTo({top:destination,behavior:reduceMotion?'instant':'smooth'});
  }
  function schedule(){
    clearTimeout(scrollTimer);
    if(!armed || touching)return;
    scrollTimer=setTimeout(snap,185); // Safari fallback when scrollend is unavailable.
  }
  function enable(){
    if(performance.now()<snapBusyUntil)return;
    armed=true;moving=false;lastGesture=performance.now();
  }
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1 || blocked(event.target))return;
    touching=true;enable();
  },{passive:true,capture:true});
  document.addEventListener('touchend',()=>{
    if(!touching)return;
    touching=false;
    if(armed && moving)schedule();else stop();
  },{passive:true,capture:true});
  document.addEventListener('touchcancel',()=>{touching=false;stop();},{passive:true,capture:true});
  window.addEventListener('wheel',event=>{
    if(Math.abs(event.deltaY)<Math.abs(event.deltaX)*1.2 || blocked(event.target))return;
    enable();
  },{passive:true});
  window.addEventListener('scroll',()=>{
    if(!armed)return;
    moving=true;
    if(!touching)schedule();
  },{passive:true});
  window.addEventListener('scrollend',()=>{
    if(armed && !touching && moving){clearTimeout(scrollTimer);snap();}
  },{passive:true});
  // A direct interaction or route animation invalidates pending manual snapping.
  document.addEventListener('click',event=>{
    if(event.target.closest('a, button, summary, [role="tab"]'))stop();
  },true);
  window.addEventListener('pagehide',stop);
})();


/* =================== JS 20: guided-accordion-motion-v30.9.42 =================== */
(()=>{
  'use strict';
  const root=document.getElementById('guide');
  if(!root)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const current=new WeakMap();
  const before=new WeakMap();
  const selector=[
    '.venue-directory-section details.nested-accordion',
    '.area-directory-section .area-category-list > details',
    '.sights-day-trips details.daytrip-inline-accordion'
  ].join(',');
  const selected=e=>{
    const summary=e.target.closest?.('summary');
    if(!summary)return null;
    const detail=summary.parentElement;
    return detail?.matches(selector)?detail:null;
  };
  function stop(detail){
    const old=current.get(detail);
    if(old){old.cancel();current.delete(detail);}
    detail.style.removeProperty('overflow');
  }
  function animate(detail,from,to,done){
    stop(detail);
    if(reduce.matches||Math.abs(from-to)<2||!detail.animate){done?.();return;}
    detail.style.overflow='hidden';
    const animation=detail.animate([
      {height:from+'px'}, {height:to+'px'}
    ],{duration:300,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
    current.set(detail,animation);
    const finish=()=>{
      if(current.get(detail)!==animation)return;
      current.delete(detail);
      done?.();
      detail.style.removeProperty('overflow');
      animation.cancel();
    };
    animation.finished.then(finish,finish);
  }
  // Intercept only closing interactions; the original site's detail handler
  // handles opening, sibling exclusivity and guided list positioning.
  document.addEventListener('click',e=>{
    const detail=selected(e);
    if(!detail||e.target.closest('a,button'))return;
    if(detail.open){
      e.preventDefault();e.stopPropagation();
      const from=detail.getBoundingClientRect().height;
      const summary=detail.querySelector(':scope > summary');
      const to=summary?.getBoundingClientRect().height||0;
      animate(detail,from,to,()=>{
        detail.querySelectorAll('details[open]').forEach(child=>{child.open=false;});
        detail.open=false;
      });
    }else{
      before.set(detail,detail.getBoundingClientRect().height);
    }
  },true);
  document.addEventListener('click',e=>{
    const detail=selected(e);
    if(!detail||!before.has(detail))return;
    const from=before.get(detail);before.delete(detail);
    if(detail.open)animate(detail,from,detail.getBoundingClientRect().height);
  });
  // When changing destinations, give the newly revealed itinerary a short
  // downward reveal. Does not scroll the viewport or affect transit animations.
  const trip=root.querySelector('.sights-day-trips');
  if(trip){
    const buttons=trip.querySelectorAll('.daytrip-destination-buttons > .daytrip-destination-button');
    trip.addEventListener('click',e=>{
      if(!e.target.closest('.daytrip-destination-buttons > .daytrip-destination-button'))return;
      if(reduce.matches)return;
      const visible=trip.querySelector('.daytrip-destination-panel:not([hidden])');
      if(!visible)return;
      visible.getAnimations().filter(a=>a.effect?.getTiming?.().duration===360).forEach(a=>a.cancel());
      visible.animate([
        {opacity:0,transform:'translate3d(0,-8px,0)'},
        {opacity:1,transform:'translate3d(0,0,0)'}
      ],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
    });
  }
})();


/* =================== JS 21: fixed-heading four-row directory teaser v30.9.46 =================== */
(()=>{
  'use strict';
  const root=document.querySelector('#guide');if(!root)return;
  const lists=[...root.querySelectorAll('.venue-directory-section:not(.area-directory-section) .tab-panel.guided-focus-panel, .area-directory-section .tab-panel')];
  const getBody=panel=>panel.querySelector(':scope > .indented');
  function sync(panel){
    if(panel.hidden||!panel.getClientRects().length)return;
    const body=getBody(panel);
    const rows=body?[...body.children].filter(el=>el.matches('details')):[];
    // Remove old panel constraints unconditionally. The header/intro must
    // remain outside the scrolling list, while short lists remain unmasked.
    panel.style.removeProperty('max-height');
    panel.classList.remove('teaser-can-scroll');
    panel.removeAttribute('data-teaser-end');
    if(!body)return;
    if(rows.length<2 || (rows.length<5 && !rows.some(row=>row.open))){
      panel.classList.remove('four-row-teaser');
      body.classList.remove('teaser-scroll-body','teaser-can-scroll');
      body.style.removeProperty('max-height');
      body.removeAttribute('data-teaser-end');
      return;
    }
    const gap=parseFloat(getComputedStyle(body).rowGap)||0;
    const rowHeight=el=>{
      const summary=el.querySelector(':scope > summary');if(!summary)return 0;
      const css=getComputedStyle(el);
      return summary.getBoundingClientRect().height+(parseFloat(css.marginTop)||0)+(parseFloat(css.marginBottom)||0)+gap;
    };
    // Allow more of the existing recommendation list to be read at once.
    // Five complete headings and part of the sixth are the target, while
    // actual row sizes (including tags/secondary lines) determine the height.
    // v30.9.134: 注目の街歩きエリア shows six complete rows (all of 赤峰街・中山駅,
    // down to 体験・その他) with the same rule for every district; other lists keep
    // five complete rows and part of the sixth.
    const fullRows=panel.closest('.area-directory-section')?6:5;
    const visibleCount=Math.min(rows.length,fullRows+1);
    const h=rows.slice(0,visibleCount).map(rowHeight);
    const natural=h.reduce((total,height,i)=>total+height*(i===fullRows?.48:1),0)+4;
    const cap=Math.max(260,Math.min(window.innerHeight*.72,560));
    // Expanded lists contain taller shop rows (name, tags, notes). Reserve
    // a larger inner viewport for those, without affecting page scrolling.
    const expandedTarget=rows.some(row=>row.open)
      ? Math.min(480,Math.max(275,window.innerHeight*.56))
      : 0;
    const max=Math.round(Math.min(cap,Math.max(natural,expandedTarget)));
    panel.classList.add('four-row-teaser');
    body.classList.add('teaser-scroll-body');
    if(body.style.maxHeight!==max+'px')body.style.setProperty('max-height',max+'px','important');
    updateFade(body);
  }
  function updateFade(body){
    const canScroll=body.scrollHeight>body.clientHeight+5;
    body.classList.toggle('teaser-can-scroll',canScroll);
    body.dataset.teaserEnd=canScroll && body.scrollTop+body.clientHeight>=body.scrollHeight-8 ? 'true':'false';
  }
  lists.forEach(panel=>{
    const body=getBody(panel);
    body?.addEventListener('scroll',()=>updateFade(body),{passive:true});
    panel.addEventListener('toggle',()=>requestAnimationFrame(()=>sync(panel)),true);
  });
  const observer=new MutationObserver(()=>requestAnimationFrame(()=>lists.forEach(sync)));
  root.querySelectorAll('.venue-directory-section .tab-pills button.tab-pill').forEach(tab=>observer.observe(tab,{attributes:true,attributeFilter:['aria-selected']}));
  window.addEventListener('resize',()=>lists.forEach(sync),{passive:true});
  window.addEventListener('load',()=>lists.forEach(sync),{once:true});
  requestAnimationFrame(()=>lists.forEach(sync));
})();


/* =================== JS 22: cross-section intentional folding v30.9.47 =================== */
(()=>{
  'use strict';
  const guide=document.getElementById('guide');
  if(!guide)return;
  const roots=[...guide.querySelectorAll('.page-body > details.root-accordion')];
  const airport=guide.querySelector('#airport-route-selector');
  const daytrip=guide.querySelector('.sights-day-trips');
  let folding=false;
  const findOwner=target=>{
    const element=target instanceof Element?target:null;
    if(!element)return null;
    const nav=element.closest('.quick-nav > .nav-button[data-target]');
    if(nav){
      const id=nav.dataset.target;
      if(id==='travel')return 'travel';
      if(id==='sights')return roots.find(root=>root.id==='3f56bda0-4caa-8046-a491-c25321b680c1')||null;
      return ({food:null,
               areas:roots.find(root=>root.classList.contains('area-directory-section')),
               experiences:roots.find(root=>root.id==='3f76bda0-4caa-80d2-8841-c76e1f8f749a'),
               souvenirs:roots.find(root=>root.id==='3f66bda0-4caa-8038-8328-e8b12e95336f')})[id]||null;
    }
    // The independent flip is not an accordion owner.
    if(element.closest('#guide .food-flip-section'))return null;
    const root=element.closest('#guide .page-body > details.root-accordion');
    if(root)return root;
    if(element.closest('#guide #airport-route-selector'))return airport;
    if(element.closest('#guide .sights-day-trips'))return daytrip;
    return null;
  };
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let anchorVersion=0;
  for(const kind of ['wheel','touchstart','pointerdown']){
    window.addEventListener(kind,()=>{++anchorVersion;},{passive:true,capture:true});
  }
  function foldOtherBlocks(owner){
    roots.forEach(root=>{
      if(root===owner || !root.open)return;
      root.querySelectorAll('details[open]').forEach(child=>{child.open=false;});
      root.open=false;
    });
    if(daytrip && owner!==daytrip){
      daytrip.querySelectorAll('.daytrip-destination-buttons > .daytrip-destination-button').forEach(button=>{
        if(button.getAttribute('aria-expanded')==='true'){
          button.setAttribute('aria-expanded','false');
          const dest=(button.querySelector('.daytrip-destination-button-name')?.textContent||'').trim();
          button.setAttribute('aria-label',dest+'の交通案内を開く');
        }
      });
      daytrip.querySelectorAll('.daytrip-destination-panel').forEach(panel=>{panel.hidden=true;});
      daytrip.classList.remove('daytrip-mode-compact');
    }
    if(airport && owner!==airport){
      const disclosure=airport.querySelector('#airsel-route-disclosure');
      if(disclosure?.getAttribute('aria-expanded')==='true')disclosure.click();
    }
  }
  document.addEventListener('click',event=>{
    if(folding)return;
    const owner=findOwner(event.target);
    if(!owner)return;
    // Do not mistake a tap on a non-interactive paragraph for a new selection.
    if(!event.target.closest('button, summary, a, input, select, [role="tab"]'))return;
    folding=true;
    try{
      foldOtherBlocks(owner);
    }finally{folding=false;}
  },true);
})();


/* ================= JS 23: pinned expanded directory heading v30.9.48 ================= */
(()=>{
  'use strict';
  const guide=document.getElementById('guide');
  if(!guide)return;
  // v30.9.129: the open row's own title now stays at the top of that row
  // (position:sticky in guide.css) instead of a copy pinned above every row.
  const panels=[];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const owned=new WeakMap();
  function bodyOf(panel){return panel.querySelector(':scope > .indented');}
  function getOpenRow(body){
    return [...body.children].find(child=>child.matches('details[open]'))||null;
  }
  function sync(panel,move=false){
    const body=bodyOf(panel);
    if(!body)return;
    let holder=owned.get(panel);
    const row=getOpenRow(body);
    if(!row){
      if(holder){
        body.querySelectorAll('details.guided-title-pinned').forEach(el=>el.classList.remove('guided-title-pinned'));
        holder.classList.remove('is-active');
        clearTimeout(holder._hideTimer);
        // Fade and collapse the pinned title in sync with the detail closing.
        holder._hideTimer=setTimeout(()=>{
          if(!getOpenRow(body) && owned.get(panel)===holder){
            holder.remove();owned.delete(panel);
          }
        },330);
      }
      return;
    }
    if(holder){
      clearTimeout(holder._hideTimer);
      holder._hideTimer=null;
    }
    if(!holder){
      holder=document.createElement('div');
      holder.className='guided-fixed-heading';
      const control=document.createElement('button');
      control.type='button';
      control.className='guided-fixed-heading-button';
      control.setAttribute('aria-expanded','true');
      holder.append(control);
      // The introductory neighborhood text stays above this heading,
      // and only the directory rows themselves are scrollable.
      panel.insertBefore(holder,body);
      owned.set(panel,holder);
      control.addEventListener('click',()=>{
        const active=body.querySelector('details.guided-title-pinned[open] > summary');
        active?.click();
      });
    }
    for(const other of body.querySelectorAll('details.guided-title-pinned')){
      if(other!==row)other.classList.remove('guided-title-pinned');
    }
    const summary=row.querySelector(':scope > summary');
    holder.querySelector('button').textContent=summary?.textContent.trim()||'';
    holder.dataset.area=String(panel.closest('.area-directory-section')!==null);
    row.classList.add('guided-title-pinned');
    // A pinned heading appears while the chosen option glides into position.
    if(!holder.classList.contains('is-active')){
      requestAnimationFrame(()=>{
        if(holder?.isConnected && getOpenRow(body)) holder.classList.add('is-active');
      });
    }
  }
  panels.forEach(panel=>{
    panel.addEventListener('toggle',()=>requestAnimationFrame(()=>sync(panel)),true);
  });
  // Bubble switching closes old details programmatically; synchronize both
  // old and new panes without forcing document focus or scroll.
  guide.querySelectorAll('.venue-directory-section .tab-pills button.tab-pill').forEach(button=>{
    button.addEventListener('click',()=>requestAnimationFrame(()=>panels.forEach(p=>sync(p))));
  });
  guide.addEventListener('click',event=>{
    if(!event.target.closest('.venue-directory-section .tab-panel details > summary'))return;
    requestAnimationFrame(()=>{
      panels.forEach(panel=>{
        if(panel.getClientRects().length && !panel.hidden)sync(panel,true);
      });
    });
  });
  panels.forEach(panel=>sync(panel));
})();


/* v30.9.154 — chapter-scene-transition-v154.
   Keep the existing document flow intact. Only an intentional downward page
   scroll crossing a chapter header triggers a brief editorial transition.
   Native page scrolling, in-chapter gestures and jump-navigation are preserved. */
(() => {
  'use strict';
  const headings=[...document.querySelectorAll('#guide .chapter-eyebrow')];
  if(headings.length!==5 || !('requestAnimationFrame' in window))return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const overlay=document.createElement('div');
  overlay.className='chapter-scene-curtain';
  overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML='<div class="chapter-scene-curtain__content">'
    +'<span class="chapter-scene-curtain__rule"></span>'
    +'<p class="chapter-scene-curtain__number"></p>'
    +'<p class="chapter-scene-curtain__title"></p>'
    +'<p class="chapter-scene-curtain__progress"></p></div>';
  document.body.appendChild(overlay);
  const number=overlay.querySelector('.chapter-scene-curtain__number');
  const title=overlay.querySelector('.chapter-scene-curtain__title');
  const progress=overlay.querySelector('.chapter-scene-curtain__progress');
  let previousY=window.scrollY;
  let previousTops=headings.map(node=>node.getBoundingClientRect().top);
  let scrollFrame=0,active=false,manualScrollAt=0,suspendUntil=0;
  let touchStart=null;
  const now=()=>performance.now();
  const skip=()=>reduced.matches || active || now()<suspendUntil
    || document.body.classList.contains('food-drawer-open')
    || document.body.classList.contains('food-swipe-active')
    || document.body.classList.contains('food-swipe-dragging')
    || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  const recalibrate=()=>{
    previousY=window.scrollY;
    previousTops=headings.map(node=>node.getBoundingClientRect().top);
  };
  // Ignore direct navigation and the smooth scrolling it initiates.
  document.addEventListener('click', event=>{
    if(event.target.closest('a[href^="#"],.nav-button,.section-jump-button,.hero-title-link,[data-target]')){
      suspendUntil=now()+1600;
    }
  },true);
  window.addEventListener('wheel',event=>{
    if(event.deltaY>0 && Math.abs(event.deltaY)>Math.abs(event.deltaX))manualScrollAt=now();
  },{passive:true});
  window.addEventListener('touchstart',event=>{
    if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
    else touchStart=null;
  },{passive:true});
  window.addEventListener('touchmove',event=>{
    if(!touchStart||event.touches.length!==1)return;
    const dx=event.touches[0].clientX-touchStart.x;
    const dy=event.touches[0].clientY-touchStart.y;
    if(dy < -10 && Math.abs(dy)>Math.abs(dx)*1.25)manualScrollAt=now();
  },{passive:true});
  window.addEventListener('touchend',()=>{touchStart=null;},{passive:true});
  window.addEventListener('touchcancel',()=>{touchStart=null;},{passive:true});
  window.addEventListener('keydown',event=>{
    if(['ArrowDown','PageDown',' ','End'].includes(event.key) &&
      !event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))manualScrollAt=now();
  });

  function changeChapter(index){
    if(skip())return;
    active=true;
    const eyebrow=headings[index];
    const heading=eyebrow.nextElementSibling;
    // Only text sourced from the already existing chapter headings.
    number.textContent=eyebrow.textContent.trim();
    title.textContent=heading?.matches('h2') ? heading.textContent.trim() : 'グルメ';
    progress.textContent=String(index+1).padStart(2,'0')+' / 05';
    overlay.classList.remove('is-arriving');
    overlay.classList.add('is-covering');
    // Cover the previous chapter BEFORE positioning the new one.
    window.setTimeout(()=>{
      if(!eyebrow.isConnected){overlay.classList.remove('is-covering');active=false;return;}
      // 'auto' bypasses the site's html{scroll-behavior:smooth} during the covered jump.
      const html=document.documentElement;
      const prior=html.style.scrollBehavior;
      html.style.scrollBehavior='auto';
      const target=Math.max(0,window.scrollY+eyebrow.getBoundingClientRect().top-24);
      window.scrollTo({top:target,behavior:'instant'});
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        // Top-level accordions can automatically fold when they leave view.
        // Compensate for any resulting layout shift before uncovering the scene.
        const delta=eyebrow.getBoundingClientRect().top-24;
        if(Math.abs(delta)>2){
          window.scrollTo({top:Math.max(0,window.scrollY+delta),behavior:'instant'});
        }
        html.style.scrollBehavior=prior;
        overlay.classList.remove('is-covering');
        overlay.classList.add('is-arriving');
        window.setTimeout(()=>{
          overlay.classList.remove('is-arriving');
          active=false;
          // Do not re-trigger from the subsequent scroll/resize/accordion reflow.
          suspendUntil=now()+150;
          recalibrate();
        },390);
      }));
    },200);
  }

  function scan(){
    scrollFrame=0;
    const y=window.scrollY;
    const tops=headings.map(node=>node.getBoundingClientRect().top);
    const moved=y-previousY;
    const gate=window.innerHeight*.88;
    const canTrigger=!skip() && now()-manualScrollAt<1050 && moved>1.5;
    if(canTrigger){
      // Header #1 has no preceding chapter. Switch only at the four boundaries.
      for(let i=1;i<headings.length;i++){
        if(previousTops[i]>gate && tops[i]<=gate && tops[i]>-window.innerHeight*.3){
          previousY=y;previousTops=tops;
          changeChapter(i);
          return;
        }
      }
    }
    previousY=y;
    previousTops=tops;
  }
  window.addEventListener('scroll',()=>{
    if(!scrollFrame)scrollFrame=requestAnimationFrame(scan);
  },{passive:true});
  window.addEventListener('resize',recalibrate,{passive:true});
  window.addEventListener('pageshow',recalibrate);
})();
