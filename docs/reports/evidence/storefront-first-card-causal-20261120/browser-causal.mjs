import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=new URL('.',import.meta.url),base='http://127.0.0.1:5175';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const rows=[],arms=['off','sql-only','two','one'];
try{
 for(const width of [1920,390])for(let round=0;round<6;round++){
  const rotated=[...arms.slice(round%4),...arms.slice(0,round%4)];
  for(const arm of rotated){
   const trace=`causal-b-${width}-${round}-${arm}`,ctx=await browser.newContext({viewport:{width,height:width===1920?900:844},extraHTTPHeaders:{'X-Trace-Id':trace}}),page=await ctx.newPage(),errors=[],responses=[];
   await ctx.addInitScript(({arm})=>{
    localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_disable_chat_websocket','true');
    const native=window.fetch;
    window.fetch=async(...args)=>{
     const arg=args[0],url=new URL(arg instanceof Request?arg.url:String(arg),location.href),hint=url.pathname==='/api/storefront/category-icons';
     if(hint&&arm==='off')return new Response(JSON.stringify({status:'success',data:[],meta:null}),{status:200,headers:{'Content-Type':'application/json'}});
     const response=await native(...args);
     if(hint&&(arm==='sql-only'||arm==='one')){const body=await response.json();body.data=arm==='one'?body.data.slice(0,1):[];return new Response(JSON.stringify(body),{status:response.status,headers:response.headers});}
     return response;
    };
    window.timings={};new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.renderTime&&e.identifier)window.timings[e.identifier]??=e.renderTime;}).observe({type:'element',buffered:true});
    const record=k=>window.timings[k]??=performance.now();
    const sample=()=>{
     for(const [key,selector] of [['frameworkPaint','.catalog-master-heading h1'],['categoryBarPaint','.category-shortcuts a span'],['firstIconPaint','.category-shortcuts img'],['firstCardPaint','.catalog-master-card .compact-card-code-value']]){const el=document.querySelector(selector);if(el&&!el.hasAttribute('elementtiming'))el.setAttribute('elementtiming',key);}
     if(document.querySelector('.catalog-master-heading h1'))record('framework');if(document.querySelector('.category-shortcuts'))record('categoryBar');if(document.querySelector('.catalog-master-card'))record('firstCard');
    };new MutationObserver(sample).observe(document,{subtree:true,childList:true});document.addEventListener('load',sample,true);
   },{arm});
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const p=new URL(r.url()).pathname;if(p.startsWith('/api/'))responses.push({path:p,status:r.status()});});
   await page.goto(base+'/products?node=1000',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.timings.firstIconPaint&&window.timings.firstCardPaint);
   await page.waitForLoadState('networkidle');
   const result=await page.evaluate(()=>({timings:window.timings,resources:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/api/')).map(r=>({path:new URL(r.name).pathname,start:r.startTime,request:r.requestStart,ttfb:r.responseStart-r.requestStart,end:r.responseEnd,body:r.responseEnd-r.responseStart,bytes:r.transferSize,protocol:r.nextHopProtocol})),overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.deepEqual(errors,[]);assert(!result.overflow);assert(!responses.some(r=>r.status>=400));
   rows.push({width,round:round+1,arm,trace,...result,errors,responses});console.log(width,round+1,arm,JSON.stringify(result.timings));await ctx.close();
  }
 }
}finally{await browser.close();}
const logs=readFileSync('/workspace/icon-runtime-final.log','utf8'),costs=new Map();for(const m of logs.matchAll(/GET (\S+) status=\d+ cost=(\d+)ms trace_id=(causal-b-\S+)/g))costs.set(m[3]+' '+m[1],Number(m[2]));
for(const r of rows)for(const resource of r.resources)resource.serverMs=costs.get(r.trace+' '+resource.path);
const median=xs=>{const a=xs.toSorted((a,b)=>a-b);return (a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2;};
const summary=[1920,390].flatMap(width=>arms.map(arm=>{const rr=rows.filter(r=>r.width===width&&r.arm===arm),overview=rr.map(r=>r.resources.find(e=>e.path.endsWith('/overview')));return {width,arm,cardDOM:median(rr.map(r=>r.timings.firstCard)),cardPaint:median(rr.map(r=>r.timings.firstCardPaint)),overviewTTFB:median(overview.map(r=>r.ttfb)),overviewServer:median(overview.map(r=>r.serverMs)),overviewBody:median(overview.map(r=>r.body)),iconBeforeCard:rr.filter(r=>r.timings.firstIconPaint<r.timings.firstCardPaint).length,samples:rr.length};}));
writeFileSync(new URL('browser-causal.json',out),JSON.stringify({condition:'main 874a23cb unchanged production bundle; fresh browser contexts; loopback HTTP/1.1, no artificial delay/throttle; only hint result modified after actual native fetch for sql-only/one arms; 67KiB valid PNG payload; 465 active + 14 deleted synthetic products, 0 recommendation rows',summary,rows},null,2)+'\n');console.log(JSON.stringify(summary));
