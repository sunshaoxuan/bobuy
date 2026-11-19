import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('.',import.meta.url)),base='http://127.0.0.1:5175',paths=['useProgressiveCatalog.ts','components/CategoryShortcuts.tsx','components/CategoryImage.tsx','locales/zh-CN.ts','locales/zh-TW.ts','locales/en-US.ts','locales/ja-JP.ts'];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const hashes={};
for(const variant of ['base','candidate']){const html=readFileSync('/workspace/scratch/icon-built-'+variant+'/index.html');hashes[variant]=createHash('sha256').update(html).digest('hex');}
const results=[];
// Warm server/JIT only; browser contexts and media caches remain cold for each sample.
for(const path of ['/api/storefront/category-icons','/api/storefront/product-browse/overview?merchantId=1000&locale=zh-CN']){const r=await fetch(base+path);if(!r.ok)throw Error('Runtime not ready: '+r.status);await r.arrayBuffer();}
try{
 for(const width of [1920,390])for(let round=0;round<9;round++)for(const variant of round%2?['candidate','baseline']:['baseline','candidate']){
  const ctx=await browser.newContext({viewport:{width,height:width===1920?900:844}}),page=await ctx.newPage(),errors=[],network=[];const origin=variant==='baseline'?'http://127.0.0.1:5174':base;
  // Real production bundles; no module/API/media routing or artificial delay.
  await ctx.addInitScript(()=>{
   localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_disable_chat_websocket','true');window.iconTimings={};new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.renderTime&&e.identifier)window.iconTimings[e.identifier]??=e.renderTime;}).observe({type:'element',buffered:true});
   const record=(key)=>{window.iconTimings[key]??=performance.now();};
   const sample=()=>{
    for(const [key,selector] of [['frameworkPaint','.catalog-master-heading h1'],['categoryBarPaint','.category-shortcuts a span'],['firstIconPaint','.category-shortcuts img'],['firstCardPaint','.catalog-master-card .compact-card-code-value'],['firstProductPaint','.catalog-master-card img']]){const el=document.querySelector(selector);if(el&&!el.hasAttribute('elementtiming'))el.setAttribute('elementtiming',key);}
    if(document.querySelector('.catalog-master-heading h1'))record('framework');if(document.querySelector('.category-shortcuts'))record('categoryBar');if(document.querySelector('.catalog-master-card'))record('firstCard');
    for(const [key,selector] of [['firstIcon','.category-shortcuts img'],['firstProductImage','.catalog-master-card img']]){const img=document.querySelector(selector);if(img?.complete&&img.naturalWidth>0&&!img.dataset.measured){img.dataset.measured='true';img.decode().then(()=>{if(img.isConnected)record(key);});}}
   };new MutationObserver(sample).observe(document,{subtree:true,childList:true});document.addEventListener('load',sample,true);window.addEventListener('load',sample);setInterval(sample,10);
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({path:u.pathname,status:r.status()});});
  const cdp=await ctx.newCDPSession(page),resource=[];await cdp.send('Network.enable');cdp.on('Network.requestWillBeSent',e=>{if(/priority-fixture/.test(e.request.url))resource.push({url:new URL(e.request.url).pathname,priority:e.request.initialPriority,time:e.timestamp,initiator:e.initiator.type});});
  await page.goto(origin+'/products?node=1000',{waitUntil:'domcontentloaded'});try{await page.waitForFunction(()=>window.iconTimings.firstProductImage&&window.iconTimings.firstIconPaint&&window.iconTimings.firstCardPaint);}catch(e){console.log(JSON.stringify({variant,width,errors,network,state:await page.evaluate(()=>({timings:window.iconTimings,text:document.body.innerText.slice(0,1200),images:[...document.images].slice(0,4).map(i=>({src:i.src,complete:i.complete,width:i.naturalWidth}))}))}));await page.screenshot({path:out+'diagnostic.png'});throw e;}
  const metrics=await page.evaluate(()=>({timings:window.iconTimings,overflow:document.documentElement.scrollWidth>innerWidth,icon:document.querySelector('.category-shortcuts img')?.getAttribute('src'),iconsRequested:performance.getEntriesByType('resource').filter(r=>r.name.includes('icon-priority-fixture')).map(r=>({url:new URL(r.name).pathname,start:r.startTime,end:r.responseEnd,size:r.transferSize}))}));assert(!metrics.overflow);assert.deepEqual(errors,[]);assert(!network.some(r=>r.status>=400));
  results.push({variant,width,round:round+1,...metrics,resource,errors});writeFileSync(out+'cold-final-partial.json',JSON.stringify({hashes,results},null,2)+'\n');console.log(variant,width,round+1,JSON.stringify(metrics.timings));await ctx.close();
 }
 const summary=[1920,390].map(width=>{const med=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];const selected=variant=>results.filter(r=>r.width===width&&r.variant===variant);return {width,baselineCardMedian:med(selected('baseline').map(r=>r.timings.firstCard)),candidateCardMedian:med(selected('candidate').map(r=>r.timings.firstCard)),candidateIconBeforeCard:selected('candidate').every(r=>r.timings.firstIconPaint<r.timings.firstCardPaint)};});
 writeFileSync(out+'cold-final.json',JSON.stringify({baselineCommit:'63fe871c8614fcdef1fc42754e18bbb06265916d',condition:'Fresh isolated browser context per sample, same real backend/PNG URLs, alternating order, no artificial network delays; both variants serve production builds via the same static/proxy server. HTTP cache is cold; server is warmed. DOM/decode callbacks and actual Chromium Element Timing renderTime are separately recorded; test-only elementtiming attributes added before paint do not alter app behavior.',hashes,results,summary},null,2)+'\n');console.log(JSON.stringify(summary));
}finally{await browser.close();}
