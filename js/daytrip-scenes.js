/* v30.9.247 — Day trips: the banner scenes come alive once.
   When a destination opens, its scene is built from layers (assets/daytrips/
   <place>/) on top of the still banner, and each moving part plays one short
   motion: a few swings or bobs that grow smaller and slower, resting after
   about 1.8 s. Lanterns in Jiufen swing from their tops one after another,
   Shifen's sky lanterns lift and settle, Keelung's boats rock, and the sea
   breeze and waves of Keelung and Yehliu drift in. Nothing moves with
   reduced motion; the still banner (the same picture) stays instead.
   Layer list: [file, motion, left %, top %, width %, height %] on the
   2019 × 366 canvas of the designs. */
(() => {
  'use strict';
  const section = document.querySelector('#guide .sights-day-trips');
  if (!section) return;
  const SCENES = {"jiufen":[["bg.webp","bg",0,0,100,100],["10_lanterns_distant.webp","sway-far",30.064,0.0,61.961,88.251],["20_s1.webp","swing",61.516,62.295,2.526,15.574],["20_s2.webp","swing",64.388,59.836,2.229,12.295],["20_s3.webp","swing",66.617,58.743,2.229,12.842],["20_s4.webp","swing",68.895,56.557,2.328,13.388],["20_s5.webp","swing",71.421,55.738,2.229,13.934],["20_s6.webp","swing",73.848,54.372,2.526,14.481],["20_s7.webp","swing",76.424,54.098,2.625,15.027],["20_s8.webp","swing",79.445,53.005,3.219,17.76],["20_s9.webp","swing",81.575,10.109,9.411,28.142],["20_s10.webp","swing",82.714,55.464,3.219,17.213],["30_lanterns_glow.webp","glow",30.064,0.0,62.06,87.978]],"shifen":[["bg.webp","bg",0,0,100,100],["10_waterfall.webp","shimmer",86.924,45.082,10.054,50.546],["20_sky_lanterns_distant.webp","float-far",45.072,1.366,48.638,46.721],["30_static.webp","static",0,0,100,100],["30_s1.webp","float",56.612,8.743,3.814,21.311],["30_s2.webp","float",66.617,0.0,2.922,18.852],["30_s3.webp","float",70.926,20.765,2.922,19.126],["30_s4.webp","float",83.11,0.0,4.804,25.956],["30_s5.webp","float",89.302,17.76,2.377,15.027],["40_people_on_platform.webp","static",5.844,66.667,27.885,17.486]],"keelung":[["bg.webp","bg",0,0,100,100],["10_boat_1.webp","bob",20.059,65.574,6.389,22.131],["10_boat_2.webp","bob",42.348,60.383,10.797,27.322],["10_boat_3.webp","bob",70.579,65.574,6.686,22.131],["20_sea_breeze.webp","breeze",31.699,0.0,50.471,45.355],["30_water_surface_ripples.webp","ripple",6.29,84.699,83.309,13.388]],"yehliu":[["bg.webp","bg",0,0,100,100],["10_ocean_wind.webp","breeze",28.628,5.738,63.992,42.896],["20_waves_distant.webp","wave-far",38.336,68.579,59.237,13.388],["30_waves_near.webp","wave",38.088,84.153,61.912,14.754]]};
  const AMPLITUDE = [1, .82, 1.12, .9, 1.04, .78, 1.08, .88, .96, .72];
  const STAGGER = {swing: 45, float: 90, bob: 110};
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const built = new Map();

  function build(banner, place) {
    const scene = document.createElement('div');
    scene.className = 'daytrip-scene';
    scene.setAttribute('aria-hidden', 'true');
    const count = {};
    const images = SCENES[place].map(([file, motion, left, top, width, height]) => {
      const n = count[motion] = (count[motion] || 0) + 1;
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.className = 'daytrip-layer daytrip-layer--' + motion;
      img.style.left = left + '%'; img.style.top = top + '%';
      img.style.width = width + '%'; img.style.height = height + '%';
      // Wide pieces (a cluster of lanterns) swing less than single ones.
      const scale = width > 5 ? .4 : 1;
      img.style.setProperty('--a', String(AMPLITUDE[(n - 1) % AMPLITUDE.length] * scale));
      img.style.setProperty('--delay', ((STAGGER[motion] || 0) * (n - 1)) + 'ms');
      img.src = 'assets/daytrips/' + place + '/' + file;
      scene.append(img);
      return img;
    });
    banner.prepend(scene);
    // Show the scene only when every layer is ready, so it never flickers.
    return Promise.all(images.map(img => (img.decode ? img.decode() : Promise.resolve()).catch(() => {})))
      .then(() => { banner.classList.add('has-scene'); return scene; });
  }
  function play(panel) {
    if (reduce.matches) return;
    const banner = panel.querySelector('.daytrip-banner');
    const place = banner && [...banner.classList].find(c => c.startsWith('daytrip-banner--'))?.slice(16);
    if (!place || !SCENES[place]) return;
    if (!built.has(place)) built.set(place, build(banner, place));
    built.get(place).then(scene => {
      if (panel.hidden) return;
      scene.classList.remove('is-playing');
      void scene.offsetWidth; // restart
      scene.classList.add('is-playing');
    });
  }
  const panels = [...section.querySelectorAll('.daytrip-destination-panel')];
  const watch = new MutationObserver(records => {
    for (const record of records) if (!record.target.hidden) play(record.target);
  });
  panels.forEach(panel => {
    watch.observe(panel, {attributes: true, attributeFilter: ['hidden']});
    if (!panel.hidden) play(panel);
  });
})();
