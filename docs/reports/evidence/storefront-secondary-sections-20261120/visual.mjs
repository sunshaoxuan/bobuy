import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=new URL('.',import.meta.url),base='http://127.0.0.1:5185',root='shop-000-progressive-01',a='shop-progressive-leaf-1',b='shop-progressive-leaf-2';
const api=async(path)=>(await (await fetch(base+'/api/storefront/product-browse'+path)).json()).data;
const real=await api('/overview?sections=true&merchantId=1000&locale=zh-CN');
const sourceA=await api('?merchantId=1000&locale=zh-CN&category='+root),sourceB=await api('?merchantId=1000&locale=zh-CN&category=shop-000-progressive-02');
assert.equal(sourceA.items.length,20);assert.equal(sourceB.items.length,20);
const rowsA=[...sourceA.items,...sourceB.items.slice(0,5)],rowsB=sourceB.items.slice(5);
const categories=[{...real.categories.find(c=>c.id===root),count:40,name:{'zh-CN':'饮料','en-US':'Drinks'}},{...real.categories.find(c=>c.id===a),count:25,imageUrl:'/api/storefront/recommendation-images/icon-priority-fixture-01',name:{'zh-CN':'果汁','en-US':'Juice'}},{...real.categories.find(c=>c.id===b),parentId:root,count:15,imageUrl:'/api/storefront/recommendation-images/icon-priority-fixture-02',name:{'zh-CN':'面包谷物与抹酱','en-US':'Bread, cereals and spreads'}}];
const revision='a'.repeat(64),datasetRevision='b'.repeat(64);
const envelope=(q,items,shelves,matchedTotal=40)=>({status:'success',data:{...real,items,shelves,categories,query:'',category:q.get('category')??'',selectedCategory:q.get('category')??'',page:Number(q.get('page')??0),size:24,scopeTotal:40,matchedTotal,hasNext:(Number(q.get('page')??0)+1)*24<matchedTotal,revision,datasetRevision}});
const results=[],browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
async function stable(p){await p.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.querySelector('.catalog-dock')?.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))??[]);});}
async function geometry(p){return p.evaluate(()=>{const r=e=>{const v=e.getBoundingClientRect();return {top:v.top,bottom:v.bottom,left:v.left,right:v.right,width:v.width,height:v.height};},sections=[...document.querySelectorAll('.shopping-secondary-section')];return {y:scrollY,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,header:r(document.querySelector('.store-header')),dock:r(document.querySelector('.catalog-dock-surface')),sections:sections.map(s=>({id:s.dataset.shelfCategory,box:r(s),heading:r(s.querySelector('header')),label:r(s.querySelector('h3')),image:r(s.querySelector('.shopping-section-image')),last:s.querySelector('.catalog-master-card:last-child')?r(s.querySelector('.catalog-master-card:last-child')):null,count:s.querySelectorAll('.catalog-master-card').length,style:(()=>{const c=getComputedStyle(s.querySelector('header'));return {position:c.position,marginBottom:c.marginBottom,top:c.top,zIndex:c.zIndex,background:c.backgroundColor,border:c.borderBottom,font:getComputedStyle(s.querySelector('h3')).fontSize};})()})),asset:document.querySelector('script[type=module]').getAttribute('src')};});}
async function shot(p,name){await p.screenshot({path:new URL(name+'.png',out).pathname});const g=await geometry(p),x=g.sections[0].box.left,w=g.sections[0].box.width,y=Math.max(0,g.dock.bottom-8);await p.screenshot({path:new URL(name+'-detail.png',out).pathname,clip:{x,y,width:w,height:Math.min(220,p.viewportSize().height-y)}});}
try{
for(const [width,height]of [[360,800],[390,844],[1280,800]]){
 const c=await browser.newContext({viewport:{width,height},isMobile:width<400,hasTouch:width<400,deviceScaleFactor:1}),p=await c.newPage(),errors=[],network=[];
 await c.addInitScript(()=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_disable_chat_websocket','true');localStorage.setItem('bobbuy_store_navigation_mobile','collapsed');localStorage.setItem('bobbuy_store_navigation_desktop','collapsed');});
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({url:u.pathname+u.search,status:r.status()});});
 // Unmodified HTTP contract in the reused real Spring/PG application.
 await p.goto(base+'/products?node=1000');await p.waitForFunction(()=>document.querySelector('.shopping-secondary-section')?.querySelectorAll('.catalog-master-card').length>=8);await stable(p);
 const native=await geometry(p);assert(!native.overflow);assert.equal(native.sections[0].count,8);assert.equal(await p.locator('.shopping-root-heading img').count(),0);await shot(p,'native-overview-'+width);
 // A bounded API response fixture only: forty distinct existing synthetic records,
 // repartitioned into 25 + 15 to exercise >24 continuation without database writes.
 await p.route('**/api/storefront/product-browse**',async route=>{
  const u=new URL(route.request().url()),q=u.searchParams;if(!['/api/storefront/product-browse','/api/storefront/product-browse/overview','/api/storefront/product-browse/shelf'].includes(u.pathname))return route.continue();
  const offset=Number(q.get('page')??0)*24;let payload;
  if(u.pathname.endsWith('/overview'))payload=envelope(q,[],[{category:a,total:25,items:rowsA.slice(0,8)},{category:b,total:15,items:[]}]);
  else if(u.pathname.endsWith('/shelf')){const rows=q.get('category')===a?rowsA:rowsB;payload=envelope(q,[],[{category:q.get('category'),total:rows.length,items:rows.slice(offset,offset+24)}]);}
  else if(q.get('category')===root)payload=envelope(q,[...rowsA,...rowsB].slice(offset,offset+24),[{category:a,total:25,items:rowsA.slice(0,8)},{category:b,total:15,items:rowsB.slice(0,8)}]);
  else{const rows=q.get('category')===b?rowsB:rowsA;payload=envelope(q,rows.slice(offset,offset+24),[],rows.length);}
  await route.fulfill({json:payload});
 });
 for(const mode of ['overview','root']){console.log('START',width,mode);
  await p.goto(base+'/products?node=1000'+(mode==='root'?'&category='+root:''));await p.waitForFunction(()=>document.querySelector('.shopping-secondary-section')?.querySelectorAll('.catalog-master-card').length>=8);await p.evaluate(()=>document.fonts.ready);await stable(p);const normal=await geometry(p);await shot(p,mode+'-normal-'+width);
  // Finish the first section through its own existing load control (8 -> 24 -> 25).
  const first=p.locator('[data-shelf-category="'+a+'"]');
  for(let i=0;i<3&&(await first.locator('.catalog-master-card').count())<25;i++){
   const before=await first.locator('.catalog-master-card').count();const button=first.locator('.section-continuation button');await button.scrollIntoViewIfNeeded();await p.waitForFunction(({id,before})=>document.querySelector('[data-shelf-category="'+id+'"]')?.querySelectorAll('.catalog-master-card').length>before,{id:a,before});await stable(p);
  }
  await p.waitForFunction(id=>document.querySelector('[data-shelf-category="'+id+'"]')?.querySelectorAll('.catalog-master-card').length===25,a);
  // Force the dock into compact, then position relative to each section's natural box.
  await p.evaluate(()=>scrollTo(0,500));await stable(p);
  const position=await p.evaluate(()=>{const s=document.querySelector('.shopping-secondary-section'),d=document.querySelector('.catalog-dock-surface');return {start:s.getBoundingClientRect().top+scrollY,end:s.getBoundingClientRect().bottom+scrollY,top:d.getBoundingClientRect().bottom,h:s.querySelector('header').getBoundingClientRect().height};});
  await p.evaluate(y=>scrollTo(0,y),position.start-position.top+100);await stable(p);const sticky=await geometry(p);assert(Math.abs(sticky.sections[0].heading.top-sticky.dock.bottom)<1);assert.equal(sticky.sections[0].image.width,24);assert.equal(sticky.sections[0].style.font,width<400?'18px':'20px');await shot(p,mode+'-sticky-'+width);
  await p.evaluate(y=>scrollTo(0,y),position.end-position.top-position.h/2);await stable(p);const pushing=await geometry(p);writeFileSync(new URL('boundary-'+width+'-'+mode+'.json',out),JSON.stringify(pushing,null,2)+'\n');assert(pushing.sections[0].heading.top<pushing.dock.bottom-5);assert(Math.abs(pushing.sections[0].heading.bottom+parseFloat(pushing.sections[0].style.marginBottom)-pushing.sections[0].box.bottom)<1);await shot(p,mode+'-pushing-'+width);
  await p.locator('[data-shelf-category="'+b+'"] .catalog-master-card').first().waitFor();
  // Root previews also finish B; its 15-item height is sufficient for a real sticky interval.
  const second=p.locator('[data-shelf-category="'+b+'"]');if(await second.locator('.section-continuation button').count()){await second.locator('.section-continuation button').scrollIntoViewIfNeeded();await p.waitForFunction(id=>document.querySelector('[data-shelf-category="'+id+'"]')?.querySelectorAll('.catalog-master-card').length===15,b);}
  const yB=await second.evaluate(s=>s.getBoundingClientRect().top+scrollY);await p.evaluate(y=>scrollTo(0,y),yB-position.top+60);await stable(p);const replacement=await geometry(p);assert(Math.abs(replacement.sections[1].heading.top-replacement.dock.bottom)<1);assert(replacement.sections[0].last.bottom<=replacement.dock.bottom);assert.equal(replacement.sections[1].count,15);assert(replacement.sections[1].label.height<=60);assert(!replacement.overflow);await shot(p,mode+'-replacement-'+width);
  await p.evaluate(y=>scrollTo(0,y),position.start-position.top+100);await stable(p);const reverse=await geometry(p);assert(Math.abs(reverse.sections[0].heading.top-reverse.dock.bottom)<1);await shot(p,mode+'-reverse-'+width);
  assert.equal(await p.locator('.shopping-root-heading img').count(),0);assert.equal(await p.locator('.shopping-toolbar img').count(),0);
  results.push({width,height,mode,normal,sticky,pushing,replacement,reverse,errors:[...errors],network:[...network]});writeFileSync(new URL('visual.json',out),JSON.stringify({result:'RUNNING',native,results},null,2)+'\n');
 }
 await p.goto(base+'/products?node=1000&category='+b);await p.waitForFunction(()=>document.querySelectorAll('.shopping-selected-section .catalog-master-card').length===15);await stable(p);assert.equal(await p.locator('.shopping-selected-section>header h2').count(),1);assert.equal(await p.locator('.shopping-toolbar [aria-current]').count(),0);await p.screenshot({path:new URL('leaf-direct-'+width+'.png',out).pathname});
 assert.deepEqual(errors,[]);assert(!network.some(n=>n.status>=400));results.push({width,native,errors,network});writeFileSync(new URL('visual.json',out),JSON.stringify({result:'RUNNING',results},null,2)+'\n');await c.close();console.log('PASS',width);
}
writeFileSync(new URL('visual.json',out),JSON.stringify({result:'PASS',results},null,2)+'\n');
}finally{await browser.close();}
