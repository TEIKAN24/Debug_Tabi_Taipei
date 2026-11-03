/* 夜市マップ — 台鉄・高鉄 tracks around 北北基桃. Paste into https://overpass-turbo.eu/ ,
   Run, then Export → raw OSM data. (The build keeps only the part near the map.) */
[out:json][timeout:180];
way["railway"="rail"]["usage"~"^(main|branch)$"](24.45,120.85,25.40,122.10);
out geom;
