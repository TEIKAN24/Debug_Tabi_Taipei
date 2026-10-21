(() => {'use strict';
const $=id=>document.getElementById(id);
const source=JSON.parse($('restaurant-data').textContent);
const catalog=source.restaurants;
const byKey=new Map(catalog.map(x=>[x.key,x]));
const fields={name:$('restaurant-name'),displayType:$('restaurant-type'),category:$('restaurant-category'),shortNote:$('restaurant-note')};
const storageKey='taipei-restaurant-editor-v30.9.98';
let changes={};
try{let data=JSON.parse(localStorage.getItem(storageKey)||'{}');if(data&&data.schemaVersion===1&&data.records)changes=data.records;}catch(_){}
let active=catalog[0].key;let filter='all';let working=null;let previewReady=false;
function original(key){const r=byKey.get(key);return {name:r.name,displayType:r.displayType||'グルメ',category:r.category||'meal',shortNote:r.shortNote||'',michelinStars:r.michelinStars||0,tags:structuredClone(r.tags||[])};}
function current(key){return {...original(key),...(changes[key]||{}),tags:structuredClone(changes[key]?.tags||original(key).tags)};}
function setStatus(message,good=false){$('save-status').textContent=message;$('save-status').classList.toggle('good',good);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({schemaVersion:1,records:changes}));}catch(_){setStatus('草稿無法儲存在此瀏覽器；請立即匯出 JSON');}}
function changed(k){return Object.hasOwn(changes,k);}
function list(){const q=$('search').value.trim().toLowerCase();const subset=catalog.filter(x=>{if(filter==='curated'&&!x.curated)return false;if(filter==='modified'&&!changed(x.key))return false;return !q||[x.name,x.displayType,x.address,x.specialty,changes[x.key]?.name,changes[x.key]?.displayType].some(v=>String(v||'').toLowerCase().includes(q));});$('count').textContent=`${subset.length} / ${catalog.length}`;const cont=$('restaurant-list');cont.replaceChildren();const fragment=document.createDocumentFragment();for(const r of subset.slice(0,250)){const b=document.createElement('button');b.className='shop'+(r.key===active?' active':'');b.type='button';b.dataset.key=r.key;const title=document.createElement('strong');title.textContent=changes[r.key]?.name||r.name;const sub=document.createElement('span');sub.textContent=`${changes[r.key]?.displayType||r.displayType||'グルメ'} · ${r.address||'地址未登錄'}`;b.append(title,sub);if(changed(r.key)){let flag=document.createElement('em');flag.textContent='● 已編輯';b.append(flag);}b.addEventListener('click',()=>select(r.key));fragment.append(b);}cont.append(fragment);if(subset.length>250){let d=document.createElement('p');d.className='hint';d.style.padding='12px';d.textContent='只顯示前 250 間，請輸入店名縮小範圍。';cont.append(d);}}
function renderTags(){const root=$('tag-list');root.replaceChildren();if(!working.tags.length){const hint=document.createElement('span');hint.className='hint';hint.textContent='目前沒有標籤';root.append(hint);return;}working.tags.forEach((tag,i)=>{const outer=document.createElement('span');outer.className='edit-tag '+(tag.tone||'normal');outer.textContent=tag.text;const btn=document.createElement('button');btn.textContent='×';btn.type='button';btn.setAttribute('aria-label','移除 '+tag.text);btn.addEventListener('click',()=>{working.tags.splice(i,1);renderTags();update();});outer.append(btn);root.append(outer);});}
function starsUI(){document.querySelectorAll('#star-controls button').forEach(b=>{const yes=Number(b.dataset.stars)===working.michelinStars;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));});}
function renderForm(){fields.name.value=working.name;fields.displayType.value=working.displayType;fields.category.value=working.category;fields.shortNote.value=working.shortNote;starsUI();renderTags();$('edit-marker').textContent=changed(active)?'此店已修改':'';updatePreview();}
function select(k){active=k;working=current(k);renderForm();list();}
function previewItem(){return {...working};}
function updatePreview(){const f=$('card-iframe');if(previewReady&&f.contentWindow)f.contentWindow.postMessage({type:'taipei-preview',item:previewItem()},'*');}
window.addEventListener('message',e=>{if(e.data?.type==='taipei-preview-ready'){previewReady=true;updatePreview();}});
$('card-iframe').addEventListener('load',()=>{previewReady=true;updatePreview();});
function update(){const obj={name:working.name,displayType:working.displayType,category:working.category,shortNote:working.shortNote,michelinStars:working.michelinStars,tags:working.tags};
changes[active]=structuredClone(obj);persist();setStatus(`${Object.keys(changes).length} 間有草稿`,true);$('edit-marker').textContent='草稿未匯出';updatePreview();}
for(const [field,el] of Object.entries(fields))el.addEventListener('input',()=>{working[field]=el.value;update();});
$('restaurant-category').addEventListener('change',()=>{working.category=fields.category.value;update();});
$('star-controls').addEventListener('click',event=>{const btn=event.target.closest('[data-stars]');if(!btn)return;working.michelinStars=Number(btn.dataset.stars);starsUI();update();});
function addTag(text,tone='normal'){text=String(text).trim();if(!text)return;if(working.tags.some(t=>t.text===text))return;working.tags.push({text,tone});renderTags();update();}
$('add-tag-form').addEventListener('submit',e=>{e.preventDefault();addTag($('new-tag').value,$('tag-tone').value);$('new-tag').value='';$('new-tag').focus();});
$('quick-tags').addEventListener('click',e=>{const btn=e.target.closest('button[data-tag]');if(btn)addTag(btn.dataset.tag,btn.dataset.tone||'normal');});
$('save-current').addEventListener('click',()=>{update();list();setStatus(`「${working.name}」已存草稿；請匯出以更新網站`,true);});
$('reset-current').addEventListener('click',()=>{if(!confirm('還原這間餐廳的全部編輯？'))return;delete changes[active];persist();select(active);setStatus('已還原這間店');});
$('search').addEventListener('input',list);
for(const [id,value] of [['filter-all','all'],['filter-curated','curated'],['filter-modified','modified']])$(id).addEventListener('click',()=>{filter=value;document.querySelectorAll('.filter-row button').forEach(x=>x.classList.toggle('selected',x.id===id));list();});
function fileDownload(name,data){const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').addEventListener('click',()=>{if(!Object.keys(changes).length){setStatus('目前沒有變更可匯出');return;}fileDownload('recommend_overrides.json',{schemaVersion:1,records:changes});setStatus(`已下載 ${Object.keys(changes).length} 間修改；請覆蓋 food/recommend_overrides.json`,true);});
$('import-json').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.schemaVersion!==1||!data.records||typeof data.records!=='object')throw Error('格式不符');const good={};for(const [k,v] of Object.entries(data.records)){if(byKey.has(k)&&v&&typeof v==='object')good[k]=v;}changes=good;persist();select(active);setStatus(`成功匯入 ${Object.keys(good).length} 間修改`,true);}catch(err){setStatus('無法匯入：'+err.message);}e.target.value='';});
select(active);
if(Object.keys(changes).length)setStatus(`已載入 ${Object.keys(changes).length} 間草稿`,true);
})();
