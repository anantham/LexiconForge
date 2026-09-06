import { chromium } from 'playwright';
// Run against two isolated production previews; never use a personal browser profile.
if (process.argv.length !== 4) throw new Error('Usage: reader-update-probe.mjs BEFORE_URL AFTER_URL');
const origins = { before: new URL(process.argv[2]), after: new URL(process.argv[3]) };
for (const url of Object.values(origins)) {
 if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Use loopback production previews only');
}
const text = (n,v) => Array.from({length:80}, (_,p) => `Chapter ${n} version ${v}. Paragraph ${p+1}. ` + 'A traveler reads a map beside the quiet river. '.repeat(8)).join('<br><br>');
const fixture = { metadata:{format:'lexiconforge-session',version:'2.0',exportedAt:'2026-09-05T00:00:00Z'}, novel:{id:'latency-fixture',title:'Latency Fixture'}, novelId:'latency-fixture',libraryVersionId:'v1',version:{versionId:'v1',displayName:'Fixture',style:'other',features:[]},settings:{},chapters:[1,2,3,4].map(n=>({stableId:`latency-${n}`,canonicalUrl:`lexiconforge://latency-fixture/chapter/${n}`,chapterNumber:n,title:`Chapter ${n}`,content:`Raw chapter ${n}.`,prevUrl:n>1?`lexiconforge://latency-fixture/chapter/${n-1}`:null,nextUrl:n<4?`lexiconforge://latency-fixture/chapter/${n+1}`:null,translations:[1,2].map(v=>({version:v,isActive:v===1,translatedTitle:`Chapter ${n}`,translation:text(n,v),provider:'OpenRouter',model:'synthetic-fixture'}))}))};
const browser=await chromium.launch();
try {
 for(let repeat=0;repeat<3;repeat++) for(const variant of (repeat%2?['after','before']:['before','after'])) {
  const origin=origins[variant].origin;
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(origin);await page.waitForFunction(()=>window.useAppStore?.getState().isInitialized);
  await page.evaluate(async payload=>{
   const s=window.useAppStore;s.setState({settings:{...s.getState().settings,preloadCount:0,indrasNetBaseUrl:''}});
   s.getState().setViewMode('original');s.getState().openNovel('latency-fixture','v1');await s.getState().importSessionData(payload);
   s.getState().setCurrentChapter([...s.getState().chapters.keys()][0]);s.getState().setViewMode('english');
  },fixture);
  await page.locator('[data-translation-content]').filter({hasText:'Chapter 1 version 1.'}).waitFor();
  const calls=await page.evaluate(()=>{
   const store=window.useAppStore,original=store.getState().getChapter;let count=0;
   store.setState({getChapter:(...args)=>{count++;return original(...args);}});count=0;
   const start=performance.now();for(let i=0;i<1000;i++)store.setState({latencyProbeTick:i});const elapsed=performance.now()-start;
   const result={getChapterCalls:count,updateLoopMs:Math.round(elapsed)};store.setState({getChapter:original});return result;
  });
  const timings=[];
  for(const [action,expected] of [['next','Chapter 2 version 1.'],['version2','Chapter 2 version 2.'],['next','Chapter 3 version 1.'],['previous','Chapter 2 version 2.']]) {
   await page.evaluate(expected=>{
    window.__timing={expected,start:0,done:0};const state=window.__timing;
    const begin=()=>{if(!state.start)state.start=performance.now();};document.addEventListener('click',begin,{capture:true,once:true});document.addEventListener('change',begin,{capture:true,once:true});
    const observer=new MutationObserver(()=>{if(state.start&&document.querySelector('[data-translation-content]')?.textContent.includes(expected)){
     observer.disconnect();document.removeEventListener('click',begin,true);document.removeEventListener('change',begin,true);
     requestAnimationFrame(()=>requestAnimationFrame(()=>{state.done=performance.now()-state.start;}));
    }});observer.observe(document.querySelector('#root'),{childList:true,subtree:true,characterData:true});
   },expected);
   if(action==='version2')await page.locator('select').filter({has:page.locator('option[value="2"]')}).filter({has:page.locator('option[value="1"]')}).last().selectOption('2');
   else await page.getByRole('button',{name:action==='next'?'Next →':'← Previous',exact:true}).first().click();
   await page.waitForFunction(()=>window.__timing.done>0,undefined,{timeout:15000});
   timings.push({action,paintMs:Math.round(await page.evaluate(()=>window.__timing.done))});
  }
  const unload=await page.evaluate(async()=>{
   const s=window.useAppStore,previous=s.getState().pendingTranslations;s.setState({pendingTranslations:new Set(['background-fixture-job'])});await new Promise(r=>requestAnimationFrame(r));
   const working=!window.dispatchEvent(new Event('beforeunload',{cancelable:true}));s.setState({pendingTranslations:previous});await new Promise(r=>requestAnimationFrame(r));
   const idle=window.dispatchEvent(new Event('beforeunload',{cancelable:true}));return {workingWarning:working,idleAllowed:idle};
  });
  console.log(JSON.stringify({variant,repeat,...calls,timings,unload,errors}));
  if (errors.length || !unload.workingWarning || !unload.idleAllowed) throw new Error('Reader or background-work warning regression; inspect the preceding receipt');
  await context.close();
 }
} finally {await browser.close();}
