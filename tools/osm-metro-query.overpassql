/* 夜市マップ MRT layer — paste into https://overpass-turbo.eu/ , Run, then Export → raw OSM data.
   北北基桃の捷運・輕軌（route relation ごとの線形と駅）。
   板南線 is named without 捷運/輕軌 in OSM, so it is matched by its ref (BL) as well. */
[out:json][timeout:180];
(
  relation["type"="route"]["route"~"^(subway|light_rail|monorail|train)$"]["name"~"捷運|輕軌"](24.60,120.95,25.35,122.05);
  relation["type"="route"]["route"~"^(subway|light_rail)$"]["ref"~"^(BL|BR|R|G|O|Y|V|K|LB|A)$"](24.60,120.95,25.35,122.05);
  relation["type"="route"]["route"~"^(subway|light_rail)$"]["name"~"板南"](24.60,120.95,25.35,122.05);
);
out geom;
