import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
const label=process.argv[2]||'baseline',port=process.argv[3]||'5186',runs=Number(process.env.RUNS||3),out=new URL('.',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
for(const width of [390,1440])for(const slow of [false,true])for(let run=1;run<=runs;run++){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390});const page=await context.newPage(),cdp=await context.newCDPSession(page),network=[],errors=[];
 await page.route('**/product-popularity/*/click',r=>r.fulfill({json:{data:{clicks:'0'}}}));
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(slow)await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200*1024,uploadThroughput:750000/8});
 const requests=new Map();cdp.on('Network.requestWillBeSent',e=>{const r={id:e.requestId,url:e.request.url.replace(/^https?:\/\/[^/]+/,''),start:e.timestamp*1000,priority:e.request.initialPriority,type:e.type};requests.set(e.requestId,r);network.push(r);});
 cdp.on('Network.responseReceived',e=>Object.assign(requests.get(e.requestId)||{},{response:e.timestamp*1000,status:e.response.status,timing:e.response.timing,cache:e.response.fromDiskCache}));cdp.on('Network.loadingFinished',e=>Object.assign(requests.get(e.requestId)||{},{end:e.timestamp*1000,bytes:e.encodedDataLength}));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{localStorage.bobbuy_locale='zh-CN';localStorage.bobbuy_disable_chat_websocket='true';localStorage.bobbuy_store_navigation_mobile='collapsed';localStorage.bobbuy_store_navigation_desktop='collapsed';window.__bench={};function visible(el){if(!el)return false;const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}const tick=()=>{const b=window.__bench,now=performance.now(),cards=[...document.querySelectorAll('.compact-product-card')];if(!b.card&&cards.some(visible)){b.card=now;b.initial={mounted:cards.length,visible:cards.filter(visible).length};}const im=document.querySelector('.compact-product-card img');if(!b.image&&im?.complete&&im.naturalWidth&&visible(im))b.image=now;if(b.click){if(!b.shell&&visible(document.querySelector('.ant-drawer-content')))b.shell=now;if(!b.text&&document.querySelector('.consumer-detail-info')?.textContent.trim())b.text=now;const di=document.querySelector('.rec-gallery-slide[aria-hidden=false] img');if(!b.detailImage&&di?.complete&&di.naturalWidth&&visible(di))b.detailImage=now;}requestAnimationFrame(tick);};requestAnimationFrame(tick);document.addEventListener('click',e=>{if(e.target.closest('.compact-product-card'))window.__bench.click=performance.now();},true);});
 try{
 await page.goto(`http://127.0.0.1:${port}/products?node=1000&category=shop-progressive-leaf-1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__bench.image,{timeout:45000});
 await page.waitForTimeout(300);
 const initial=await page.evaluate(()=>({timings:window.__bench,cards:document.querySelectorAll('.compact-product-card').length,images:[...document.images].filter(x=>x.closest('.compact-product-card')).map(x=>({url:x.currentSrc,complete:x.complete})),overflow:document.documentElement.scrollWidth>innerWidth}));
 // Separate cold detail media from the already displayed list image, in both versions.
 await cdp.send('Network.clearBrowserCache');
 await page.locator('[data-product-id="progressive-item-1-1"] .product-name').click();
 await page.waitForFunction(()=>window.__bench.detailImage&&window.__bench.text,{timeout:45000});
 await page.waitForTimeout(slow?3500:1000);
 const timing=await page.evaluate(()=>window.__bench);
 const result={label,width,slow,run,initial,timing,network,errors};results.push(result);
 console.log(JSON.stringify({width,slow,run,...timing,errors}));
 if(run===1)await page.screenshot({path:out+`${label}-detail-${width}-${slow?'slow':'normal'}.png`});
 }catch(error){results.push({label,width,slow,run,error:String(error),network,errors});console.log('FAILED',width,slow,run,String(error));}
 await context.close();writeFileSync(out+label+'-benchmark.json',JSON.stringify(results,null,2));
}
await browser.close();
