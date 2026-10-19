'use strict';
const q=id=>document.getElementById(id);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assetURL=p=>'/comics/the-occasion/images/'+String(p).split('/').map(encodeURIComponent).join('/');
// Compositions belong to the reading edition, separate from frozen art-production
// records. Each slot is [first column, column span, row], in canonical panel order.
const READER_PLANS={
 full:[[1,12,1]], pair:[[1,6,1],[7,6,1]], triptych:[[1,4,1],[5,4,1],[9,4,1]],
 lead:[[1,12,1],[1,6,2],[7,6,2]], reveal:[[1,6,1],[7,6,1],[1,12,2]],
 left:[[1,7,1],[8,5,1]], portrait:[[1,5,1],[6,7,1]],
 dissolve:[[1,11,1],[2,11,2]], descent:[[1,10,1],[3,10,2],[5,8,3]],
 grid:[[1,6,1],[7,6,1],[1,6,2],[7,6,2]],
 approach:[[1,5,1],[6,7,1],[1,12,2]],
 return:[[1,8,1],[1,12,2],[4,9,3]],
 'ending-phone':[[1,11,1],[1,12,2],[2,11,3]],
 'ending-tablet':[[1,7,1],[1,12,2],[4,9,3]],
 'ending-laptop':[[1,4,1],[5,8,1],[7,6,2]]
};
// Page, phone/tablet/laptop plan, pacing, and the editorial reason for grouping.
const READER_COMPOSITIONS=Object.fromEntries([
 [1,'flow','triptych','triptych','scene','Move from witness to rider to face within one equal-height row, preserving each picture’s proportions.'],
 [2,'flow','lead','lead','scene','The offer leads; accepting and riding follow.'],
 [3,'full','full','full','pause','Hold the city as a single large pattern.'],
 [4,'flow','flow','pair','scene','The same stand before and as Meera passes.'],
 [5,'flow','left','left','scene','The crossing drone leads into a narrower reaction.'],
 [6,'flow','reveal','reveal','scene','Handoff and request precede the two-phone consequence.'],
 [7,'flow','pair','pair','scene','Follow the departing rider, then turn into the room.'],
 [8,'flow','pair','pair','scene','Two ways the screens fill the room.'],
 [9,'flow','flow','flow','pause','Read the unsent conversation before the solitary window.'],
 [10,'flow','pair','pair','pause','Outside windows beside the care within one home.'],
 [11,'flow','dissolve','dissolve','pause','A downward dissolve, with room for the teller.'],
 [12,'full','full','full','pause','Give the change of time its own image.'],
 [13,'flow','lead','lead','scene','Establish the home, then the shared pot and bought bolt.'],
 [14,'flow','portrait','portrait','scene','Outside and inside the same closed door.'],
 [15,'flow','pair','pair','scene','Reading and making room for the book share weight.'],
 [16,'flow','flow','left','scene','The large promise precedes the smaller purchase.'],
 [17,'flow','left','left','pause','The borrowed pose and the narrower closed-door aftermath.'],
 [18,'flow','flow','pair','pause','The set place and the unoccupied entrance echo.'],
 [19,'flow','flow','flow','pause','Let the hopeful threshold precede the departure.'],
 [20,'flow','descent','descent','scene','Descend through the hand in three ordered steps.'],
 [21,'flow','descent','reveal','pause','From moving crowd to cell, then a held small organelle.'],
 [22,'flow','pair','pair','scene','Supply and uptake are adjacent stages of one model.'],
 [23,'flow','reveal','reveal','pause','Keep the biology pair together before returning to the phone.'],
 [24,'flow','pair','pair','scene','A separate example: adhesion targeted, then lost.'],
 [25,'flow','pair','pair','pause','Growth precedes recruited supply within a separate example.'],
 [26,'flow','flow','flow','pause','Keep the identity reveal below both stages of the ascent.'],
 [27,'flow','left','left','scene','The rider anchors the narrower mineral detail.'],
 [28,'full','full','full','pause','Let the larger body occupy one uninterrupted field.'],
 [29,'flow','flow','pair','pause','Two scale relations invite comparison at sufficient width.'],
 [30,'full','full','full','pause','Hold the return of the bowl as one gesture.'],
 [31,'full','full','full','scene','Hold provision and labor within the existing wide image.'],
 [32,'flow','pair','pair','pause','The tired body beside the renewed demand.'],
 [33,'flow','grid','grid','pause','Two ordered pairs: shelter and structure, lattice and counting.'],
 [34,'full','full','full','scene','One shared walking body needs an uninterrupted field.'],
 [35,'full','full','full','pause','Let the aftermath remain still.'],
 [36,'flow','return','return','pause','Small model, broad scale relation, then a delayed return to the room.'],
 [37,'flow','pair','pair','scene','The familiar stand leads to the accepted route.'],
 [38,'full','full','full','pause','Hold what the selected frame leaves outside.'],
 [39,'flow','approach','approach','scene','Witness and bell lead into the larger handoff.'],
 [40,'flow','pair','pair','scene','Two simultaneous demands, read in canonical order.'],
 [41,'ending-phone','ending-tablet','ending-laptop','pause','Rating first, the shared gaze dominant, the witness last.']
].map(([page,phone,tablet,laptop,pacing,reason])=>[page,{phone,tablet,laptop,pacing,reason}]));
function compositionFor(page){
 const plan=page.composition||READER_COMPOSITIONS[page.page];if(!plan)throw Error(`Missing reading composition ${page.page}`);
 for(const surface of ['phone','tablet','laptop']){
  const slots=plan[surface]==='flow'?page.panels.map((_,i)=>[1,12,i+1]):READER_PLANS[plan[surface]];
  if(!slots||slots.length!==page.panels.length)throw Error(`Invalid ${surface} composition ${page.page}`);
 }
 return plan;
}
function panelComposition(page,index){
 const plan=compositionFor(page);
 return ['phone','tablet','laptop'].map(surface=>{
  const [column,span,row]=plan[surface]==='flow'?[1,12,index+1]:READER_PLANS[plan[surface]][index];
  return `--${surface}-column:${column} / span ${span};--${surface}-row:${row}`;
 }).join(';');
}
// Shared rows match image heights unless the story explicitly calls for unequal emphasis.
const READER_ROW_EMPHASIS={
 16:{align:'end',reason:'The oversized film promise leads down to the smaller purchase; their lower edges connect the exchange.'},
 41:{align:'start',reason:'Read the small rating at the upper left, then hold the larger shared gaze. Both begin on the same top edge.'}
};
function pictureGeometry(panel,production,inventory){
 const record=production.panels[panel.id]||{},path=record.imagePath||panel.imagePath,info=path&&inventory.assets[path],crop=record.crop;
 const [width,height]=info?[info.width,info.height]:(panel.imageSize||[1536,1024]);
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error(`Invalid picture dimensions ${panel.id}`);
 if(crop&&Object.keys(panel.surfaces||{}).length)throw Error(`Cropping a lettered picture is not supported: ${panel.id}`);
 if(crop&&info&&(!Array.isArray(crop)||crop.length!==4||crop.some(n=>!Number.isFinite(n)||n<0||n>=1)))throw Error(`Invalid crop ${panel.id}`);
 const [l,t,r,b]=crop&&info?crop:[0,0,0,0],visibleWidth=1-l-r,visibleHeight=1-t-b;
 if(visibleWidth<=0||visibleHeight<=0)throw Error(`Invalid crop ${panel.id}`);
 return {record,path,info,crop,width,height,l,t,visibleWidth,visibleHeight,ratio:width*visibleWidth/(height*visibleHeight)};
}
function readingGroups(page,production,inventory){
 const composition=compositionFor(page),groups=[];
 for(const surface of ['phone','tablet','laptop']){
  const slots=composition[surface]==='flow'?page.panels.map((_,i)=>[1,12,i+1]):READER_PLANS[composition[surface]],rows=new Map();
  slots.forEach((slot,index)=>{if(!rows.has(slot[2]))rows.set(slot[2],[]);rows.get(slot[2]).push(index);});
  for(const [row,indexes] of rows){
   if(indexes.length<2)continue;
   const key=indexes.join(','),overlap=groups.find(g=>g.indexes.some(i=>indexes.includes(i)));
   if(overlap&&overlap.key!==key)throw Error(`Overlapping responsive row groups on page ${page.page}`);
   if(indexes.some((value,i)=>i&&value!==indexes[i-1]+1))throw Error(`Nonconsecutive reading row on page ${page.page}`);
   const group=overlap||{key,indexes,surfaces:{}};if(!overlap)groups.push(group);
   const emphasis=page.composition?page.rowEmphasis:READER_ROW_EMPHASIS[page.page],weights=indexes.map(i=>emphasis?slots[i][1]:pictureGeometry(page.panels[i],production,inventory).ratio),total=weights.reduce((a,b)=>a+b,0);
   const start=Math.min(...indexes.map(i=>slots[i][0])),end=Math.max(...indexes.map(i=>slots[i][0]+slots[i][1]));
   // Normalize to >= 1fr in total so even very tall images fill the available row.
   group.surfaces[surface]={row,column:`${start} / span ${end-start}`,columns:weights.map(w=>`minmax(0,${w/total*indexes.length}fr)`).join(' '),align:emphasis?.align||'start',treatment:emphasis?'emphasis':'matched',reason:emphasis?.reason||'Proportional widths preserve the selected pictures while sharing both image edges.'};
  }
 }
 return groups.sort((a,b)=>a.indexes[0]-b.indexes[0]);
}
function renderReadingPage(page,production,inventory){
 const composition=compositionFor(page),groups=readingGroups(page,production,inventory);
 const render=index=>renderPanel(page,page.panels[index],production,inventory,panelComposition(page,index));
 const pictures=page.panels.map((_,index)=>{
  const group=groups.find(g=>g.indexes.includes(index));if(!group)return render(index);if(group.indexes[0]!==index)return '';
  const attributes=Object.entries(group.surfaces).map(([surface,row])=>` data-${surface}-row="${row.treatment}"`).join('');
  const style=Object.entries(group.surfaces).flatMap(([surface,row])=>[`--${surface}-group-display:grid`,`--${surface}-group-column:${row.column}`,`--${surface}-group-row:${row.row}`,`--${surface}-group-columns:${row.columns}`,`--${surface}-group-align:${row.align}`]).join(';');
  return `<div class="sequence-row"${attributes} style="${escapeHTML(style)}">${group.indexes.map(render).join('')}</div>`;
 }).join('');
 return `<section class="comic-page" id="read-page-${page.page}" tabindex="-1" data-pacing="${composition.pacing}" data-phone="${composition.phone}" data-tablet="${composition.tablet}" data-laptop="${composition.laptop}" aria-label="Page ${page.page}: ${escapeHTML(page.title)}">${readingNote(page)}<div class="page-panels">${pictures}</div></section>`;
}
function setReaderStatus(message){q('production-state').textContent=message;q('production-state').hidden=!message;}
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw Error(`${path}: ${r.status}`);return r.json();}
function wording(panel){return window.PictureLettering.narration(panel);}
function fitReaderStage(stage,transcript){
 if(!stage||!transcript)return;
 const layer=stage.querySelector('.lettering-layer');if(!layer)return;
 const overflow=window.PictureLettering.overflowGroups(stage).length>0;
 layer.classList.toggle('lettering-hidden',overflow);
 transcript.classList.toggle('screen-only',!overflow);
}
let readerLetteringObserver;
function fitReaderLettering(){
 document.querySelectorAll('.reading-panel').forEach(panel=>fitReaderStage(panel.querySelector('.picture-window'),panel.querySelector('.reading-copy-transcript')));
 if(q('reader-image')?.open)fitReaderStage(q('full-stage').querySelector('.picture-window'),q('enlarged-copy'));
}
function observeReaderLettering(){
 if(window.ResizeObserver){
  if(!readerLetteringObserver)readerLetteringObserver=new window.ResizeObserver(fitReaderLettering);
  readerLetteringObserver.disconnect();
  document.querySelectorAll('.picture-window,.lettering-group').forEach(el=>readerLetteringObserver.observe(el));
 }
 fitReaderLettering();
}
function screenTranscript(panel,prefix='reader-screen'){
 const groups=Object.entries(panel.surfaces||{}).map(([id,surface])=>{
  const words=panel.copy.filter(c=>c.decision!=='cut'&&c.surface?.id===id).map(c=>c.text);
  return words.length?`<p><strong>${escapeHTML(surface.label||id)}:</strong> ${escapeHTML(words.join(' / '))}</p>`:'';
 }).join('');
 return `<div class="screen-transcript" id="${prefix}-${escapeHTML(panel.id)}">${groups}</div>`;
}
function readingNote(page){return page.readingNote?.text?`<p class="reading-note">${escapeHTML(page.readingNote.text)}</p>`:'';}
function renderPanel(page,panel,production,inventory,composition=''){
 const geometry=pictureGeometry(panel,production,inventory),{record,path,info,crop,l,t,visibleWidth,visibleHeight}=geometry,ready=record.status==='ready',hasImage=!!path,overlay=ready&&hasImage&&path===panel.imagePath;
 let imageStyle='',windowStyle='',windowClass='picture-window';const maxWidth=Number.isFinite(record.maxWidth)?` style="--picture-max:${Math.max(200,Math.min(1100,record.maxWidth))}px"`:'';
 if(crop&&info){windowClass+=' cropped';windowStyle=` style="aspect-ratio:${geometry.ratio}"`;imageStyle=` style="width:${100/visibleWidth}%;left:${-l/visibleWidth*100}%;top:${-t/visibleHeight*100}%"`;}
 const picture=hasImage?`<button class="picture-button" data-image="${escapeHTML(path)}" data-label="${escapeHTML(panel.scene)}" aria-describedby="reader-scene-${escapeHTML(panel.id)} reader-screen-${escapeHTML(panel.id)} reader-copy-${escapeHTML(panel.id)}" aria-label="Enlarge picture ${escapeHTML(panel.id)}"${maxWidth}><div class="${windowClass}"${windowStyle}><img src="${assetURL(path)}" alt="${escapeHTML(panel.scene)}"${imageStyle} width="${geometry.width}" height="${geometry.height}" loading="${page.page===1?'eager':'lazy'}">${path===panel.imagePath?window.PictureLettering.render(panel):''}${overlay?wording(panel):''}</div></button>`:`<div class="shot-gap"><strong>PRODUCTION GAP · ${escapeHTML(panel.id)}</strong>${escapeHTML(panel.scene)}</div>`;
 return `<figure class="reading-panel" id="panel-${escapeHTML(panel.id)}" data-panel-id="${escapeHTML(panel.id)}"${composition?` style="${escapeHTML(composition)}"`:''}><p class="screen-only" id="reader-scene-${escapeHTML(panel.id)}">${escapeHTML(panel.scene)}</p>${!ready?`<p class="panel-state">${hasImage?'Working image · production check pending':'New illustration required'}</p>`:''}<div class="picture-and-copy">${picture}${screenTranscript(panel)}<p class="reading-copy-transcript${overlay?' screen-only':''}" id="reader-copy-${escapeHTML(panel.id)}">${escapeHTML(window.PictureLettering.transcript(panel))}</p></div></figure>`;
}
function reportPictureFailure(img){
 console.error('Comic picture failed to load:',{panelId:img.closest('[data-panel-id]')?.dataset.panelId||null,path:img.getAttribute('src')});
 setReaderStatus('A picture could not load. Reload this page to try again.');
}
function initReadingControls(pages){
 const toolbar=q('reader-toolbar'),toggle=q('reader-controls-toggle'),contents=q('contents'),pagesToggle=q('contents-toggle');
 let shown=true,lastY=window.scrollY||0,travel=0,frame=0,navigationPending=false,navigationSequence=0;
 function setContents(open){contents.hidden=!open;pagesToggle.setAttribute('aria-expanded',String(open));}
 function setShown(open){
  shown=open;document.body.classList.toggle('controls-hidden',!open);toolbar.inert=!open;
  toolbar.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Hide reading controls':'Menu: show reading controls');toggle.textContent=open?'Hide':'Menu';
  if(!open)setContents(false);
 }
 function updatePosition(){
  const sections=[...document.querySelectorAll('.comic-page')];
  const current=sections.filter(section=>section.getBoundingClientRect().top<=window.innerHeight*.4).pop()||sections[0];
  if(!current)return;
  const page=Number(current.id.replace('read-page-',''));
  q('reader-position').textContent=`${page} / ${pages.length}`;
  contents.querySelectorAll('a').forEach(a=>{if(a.hash===`#read-page-${page}`)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 }
 function onScroll(){
  frame=0;const y=Math.max(0,window.scrollY),delta=y-lastY;lastY=y;
  if(navigationPending){updatePosition();return;}
  travel=Math.sign(delta)===Math.sign(travel)?travel+delta:delta;
  if(y<48)setShown(true);
  else if(travel<-32){setShown(true);travel=0;}
  else if(travel>64&&contents.hidden&&!toolbar.contains(document.activeElement)){setShown(false);travel=0;}
  updatePosition();
 }
 function settleNavigation({force=false}={}){
  const sequence=++navigationSequence;navigationPending=true;setShown(false);
  requestAnimationFrame(()=>{
   if(sequence!==navigationSequence)return;
   // Correct a near-anchor toolbar offset, without undoing a browser-restored
   // reading position farther down the same history entry.
   const anchor=q(location.hash.slice(1));
   if(anchor&&/^(read-page-|panel-)/.test(anchor.id)){
    const offset=anchor.getBoundingClientRect().top;
    if(force||Math.abs(offset-20)<=96)anchor.scrollIntoView({block:'start'});
   }
   lastY=Math.max(0,window.scrollY);travel=0;navigationPending=false;updatePosition();
  });
 }
 toggle.onclick=()=>{setShown(!shown);travel=0;};
 pagesToggle.onclick=()=>{setShown(true);setContents(contents.hidden);};
 contents.querySelectorAll('a').forEach(a=>a.onclick=()=>{settleNavigation({force:true});q(a.hash.slice(1))?.focus({preventScroll:true});});
 contents.addEventListener('focusout',event=>{const next=event.relatedTarget;if(next&&!contents.contains(next)&&next!==pagesToggle)setContents(false);});
 document.addEventListener('pointerdown',event=>{if(!contents.hidden&&!contents.contains(event.target)&&!toolbar.contains(event.target)&&event.target!==toggle)setContents(false);});
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||q('reader-image').open)return;
  if(!contents.hidden){setContents(false);pagesToggle.focus();}
  else if(shown){const restore=toolbar.contains(document.activeElement);setShown(false);if(restore)toggle.focus();}
 });
 window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(onScroll);},{passive:true});
 window.addEventListener('resize',updatePosition);
 window.addEventListener('hashchange',()=>settleNavigation());
 // The book is populated asynchronously, so a fresh load must resolve its link
 // explicitly. In-page history traversal keeps native scroll restoration above.
 if(location.hash&&q(location.hash.slice(1)))settleNavigation({force:true});
 updatePosition();
}
function selectReadingPages(book,production,inventory){
 const range=production.pageRange;
 if(!Array.isArray(range)||range.length!==2||!range.every(Number.isInteger)||range[0]<1||range[1]<range[0])throw Error('Invalid reading page range.');
 const pages=book.pages.filter(p=>p.page>=range[0]&&p.page<=range[1]);
 if(pages.length!==range[1]-range[0]+1||pages.some((p,i)=>p.page!==range[0]+i||!p.panels?.length))throw Error('The reading edition must contain every page in its range.');
 const ids=new Set();
 for(const p of pages.flatMap(page=>page.panels)){
  if(ids.has(p.id))throw Error(`Duplicate reading picture ${p.id}`);ids.add(p.id);
  const r=production.panels[p.id];if(!r)throw Error(`Missing production record ${p.id}`);
  if(r.status==='ready'&&(!r.imagePath||r.imagePath!==p.imagePath||!['production','exact'].includes(p.assetRole)))throw Error(`Unresolved production image ${p.id}`);
  const path=r.imagePath||p.imagePath,info=inventory.assets[path];
  if(path&&(!info||!(info.width>0&&info.height>0)))throw Error(`Missing image inventory ${p.id}`);
 }
 return pages;
}
async function initReader(){try{
 const production=await getJSON('/comics/the-occasion/book.json');
 const book=production,inventory={assets:production.assets};
 const pages=selectReadingPages(book,production,inventory);
 const panels=pages.flatMap(p=>p.panels),ready=panels.filter(p=>production.panels[p.id]?.status==='ready').length,complete=ready===panels.length;
 setReaderStatus(complete?'':'Some pictures are still being prepared.');
 q('comic-pages').innerHTML=pages.map(p=>{
  const arc=production.arcs?.find(a=>a.page===p.page);
  const divider=arc&&p.page!==pages[0].page?`<section class="arc-divider" aria-label="${escapeHTML(arc.label)}"><p class="kicker">${escapeHTML(arc.label)}</p><h2>${escapeHTML(arc.title)}</h2></section>`:'';
  return divider+renderReadingPage(p,production,inventory);
 }).join('');
 q('contents').innerHTML=pages.map(p=>{
  const arc=production.arcs?.find(a=>a.page===p.page);
  const chapter=production.chapters?.find(c=>c.start===p.page);
  return `${chapter?`<p class="contents-arc">${escapeHTML(chapter.title)}</p>`:''}${arc?`<p class="contents-arc">${escapeHTML(arc.label)} · ${escapeHTML(arc.title)}</p>`:''}<a href="#read-page-${p.page}">${String(p.page).padStart(2,'0')} · ${escapeHTML(p.title)}</a>`;
 }).join('');
 document.body.dataset.edition=production.id==='gods-first-v5-production'?'current':'previous';
 fitReaderLettering();initReadingControls(pages);
 document.querySelectorAll('[data-image]').forEach(button=>button.onclick=()=>{const panel=panels.find(p=>p.id===button.closest('[data-panel-id]').dataset.panelId),{ratio}=pictureGeometry(panel,production,inventory);q('full-stage').style.width=`min(86vw,${(Object.keys(panel.surfaces||{}).length?60:78)*ratio}vh)`;const stage=button.querySelector('.picture-window').cloneNode(true);stage.querySelector('img').loading='eager';q('full-stage').replaceChildren(stage);q('image-transcript').innerHTML=screenTranscript(panel,'enlarged-screen')+`<p class="reading-copy-transcript${stage.querySelector('.lettering-layer')?' screen-only':''}" id="enlarged-copy">${escapeHTML(window.PictureLettering.transcript(panel))}</p>`;q('image-label').textContent=button.dataset.label;q('reader-image').showModal();observeReaderLettering();});
 q('close-image').onclick=()=>q('reader-image').close();q('reader-image').onclick=e=>{if(e.target===q('reader-image'))q('reader-image').close();};document.querySelectorAll('.picture-window img').forEach(img=>{img.onerror=()=>reportPictureFailure(img);if(img.complete&&img.naturalWidth===0)reportPictureFailure(img);});q('reading-end').hidden=false;observeReaderLettering();window.addEventListener?.('resize',fitReaderLettering);
 }catch(error){console.error('Comic load failed:',error);setReaderStatus('The comic could not load. Reload this page to try again.');q('contents-toggle').disabled=true;q('reader-controls-toggle').hidden=true;q('reader-position').hidden=true;}}
initReader();
