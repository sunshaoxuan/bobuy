import {chromium} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../docs/reports/evidence/shopping-categories-20261116/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const config=JSON.parse(await readFile(new URL('../../backend/src/main/resources/shopping-categories.json',import.meta.url),'utf8'));
// Explicit synthetic identities and assignments: browser coverage, never a production mapping receipt.
const roots=config.categories.filter(c=>!c.parentId).slice(0,4);
const categories=config.categories.filter(c=>roots.some(r=>r.id===c.id||r.id===c.parentId));
const leaves=categories.filter(c=>c.parentId);
const items=leaves.flatMap((c,i)=>Array.from({length:10},(_,n)=>({productId:`fixture-${i}-${n}`,merchantId:1001,name:Object.fromEntries(Object.entries(c.name).map(([k,v])=>[k,`${v} · ${n+1}`])),brand:'Bobuy',itemNumber:String(10000+i*10+n),specification:{},model:null,packaging:null,image:{id:`image-${i}`,url:`/fixture-image/${i}`,sourceUrl:null},categories:[c],markers:[],reviewedMaster:true,rating:null,reference:{amount:1298+i*100,currency:'JPY',unit:'1 pack',postId:null,itemId:null,state:'ACTIVE'}})));
const result=(params)=>{
 const query=(params.get('query')??'').toLowerCase(),category=params.get('category')??'',page=Number(params.get('page')??0);
 const scope=items.filter(p=>Object.values(p.name).some(n=>n.toLowerCase().includes(query)));
 const match=(p,id)=>p.categories[0].id===id||p.categories[0].parentId===id;
 const selected=categories.some(c=>c.id===category)?category:'';
 let rows=scope.filter(p=>!selected||match(p,selected));if(params.get('sort')==='price-desc')rows=rows.toReversed();
 const facets=categories.map(c=>({...c,count:scope.filter(p=>match(p,c.id)).length})).filter(c=>c.count);
 const shelves=leaves.some(c=>c.id===selected)?[]:facets.filter(c=>c.parentId===(selected||null)).map(c=>({category:c.id,items:rows.filter(p=>match(p,c.id)).slice(0,8),total:rows.filter(p=>match(p,c.id)).length}));
 return {items:rows.slice(page*24,page*24+24),page,size:24,scopeTotal:scope.length,matchedTotal:rows.length,hasNext:rows.length>(page+1)*24,revision:'a'.repeat(64),datasetRevision:'b'.repeat(64),categories:facets,unclassified:0,markedScopeTotal:0,shelves,selectedCategory:selected};
};
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const reports=[];
for(const [width,height] of (process.env.SHOPPING_VIEWPORTS?JSON.parse(process.env.SHOPPING_VIEWPORTS):[[1280,800],[1440,900],[390,844],[360,800]])){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768});
 await context.addInitScript(()=>{if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_store_navigation_mobile','collapsed');localStorage.setItem('bobbuy_store_navigation_desktop','collapsed');});
 const page=await context.newPage(),errors=[],requests=[];let delayCategory='',failBrowse=false;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/fixture-image/**',route=>route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" rx="20" fill="#f5f5f0"/><rect x="85" y="55" width="130" height="190" rx="18" fill="#d9b99b"/><rect x="90" y="125" width="120" height="75" fill="#fffdf6"/><text x="150" y="165" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#544c42">BOBUY</text></svg>`}));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push({method:request.method(),path:url.pathname,query:url.search});let data=[];
  if(url.pathname==='/api/storefront/product-browse'){
   if(failBrowse){await route.fulfill({status:500,json:{status:'error',message:'Synthetic temporary failure'}});return;}
   if(delayCategory&&url.searchParams.get('category')===delayCategory)await new Promise(r=>setTimeout(r,500));data=result(url.searchParams);
  }else if(url.pathname.startsWith('/api/storefront/product-browse/')){const item=items.find(p=>p.productId===url.pathname.split('/').at(-1));data={item:{...item,gallery:[item.image],description:{'zh-CN':'隔离验收商品'},referenceOffers:[]},markers:[],revision:'c'.repeat(64)};}
  else if(url.pathname.includes('popularity'))data={clicks:'128'};
  else if(url.pathname==='/api/auth/me'){await route.fulfill({status:401,json:{status:'error',message:'Unauthenticated'}});return;}
  await route.fulfill({json:{status:'success',data}});
 });
 const wait=()=>page.locator('.public-product-catalog[aria-busy="false"] .compact-product-card').first().waitFor();
 const shot=async name=>{await page.screenshot({path:out+`${width}-${name}.png`,fullPage:true});await page.locator('.shopping-navigation').screenshot({path:out+`${width}-${name}-navigation.png`});};
 if(process.env.SHOPPING_GLYPHS_ONLY){
  await page.goto('http://127.0.0.1:5173/products?category='+roots[0].id);await wait();
  await mkdir(out+'glyphs',{recursive:true});const glyphs=[];
  for(const locale of ['zh-CN','en-US']){
   await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);await page.reload();await wait();
   const buttons=page.locator('.shopping-toolbar button,.shopping-children button');
   for(let i=0;i<await buttons.count();i++){
    const button=buttons.nth(i),box=await button.boundingBox();if(!box||box.x<0||box.x+box.width>width)continue;
    const metadata=await button.evaluate(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {text:e.textContent,color:s.color,background:s.backgroundColor,radius:parseFloat(s.borderRadius)||0,width:b.width,height:b.height};});
    const file=`glyphs/${width}-${locale}-${i}.png`;await button.screenshot({path:out+file});glyphs.push({...metadata,file});
   }
  }
  await writeFile(out+`glyph-controls-${width}.json`,JSON.stringify(glyphs,null,2));await context.close();continue;
 }
 if(process.env.SHOPPING_LOCALE_ONLY){
  await page.goto('http://127.0.0.1:5173/products?category='+roots[0].id);await wait();
  for(const locale of ['en-US','ja-JP','zh-TW']){
   await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);await page.reload();await wait();
   assert.equal(await page.locator('html').getAttribute('lang'),locale);
   await page.screenshot({path:out+`${width}-parent-${locale}.png`});
   await page.locator('.shopping-navigation').screenshot({path:out+`${width}-parent-${locale}-navigation.png`});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const controls=await page.locator('.shopping-navigation button').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>({text:e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   assert.ok(controls.every(c=>c.width>=44&&c.height>=44));
   reports.push({width,height,locale,status:'PASS',controls});
  }
  await writeFile(out+`browser-locales-${width}.json`,JSON.stringify(reports.filter(r=>r.width===width),null,2));await context.close();continue;
 }
 if(process.env.SHOPPING_EXTRA_ONLY){
  await page.goto('http://127.0.0.1:5173/products?category='+roots[0].id);await wait();await shot('parent-final');
  await page.locator('.shopping-toolbar').getByRole('button',{name:/全部分类/}).click();
  await page.waitForFunction(()=>Math.abs(document.querySelector('.ant-drawer-open .ant-drawer-content-wrapper')?.getBoundingClientRect().x??-100)<1);
  assert.ok(await page.locator('.shopping-drawer').evaluate(e=>e.closest('.ant-drawer').contains(document.activeElement)));
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflowY),'hidden');
  await page.screenshot({path:out+`${width}-drawer-settled.png`});
  await page.keyboard.press('Escape');await page.locator('.shopping-drawer').waitFor({state:'hidden'});
  assert.ok(await page.locator('.shopping-toolbar button[aria-expanded]').evaluate(e=>e===document.activeElement));
  await page.evaluate(()=>window.scrollTo(0,400));await page.waitForTimeout(200);
  await page.locator('.shopping-shelf').nth(1).getByRole('button',{name:/查看全部/}).click();await wait();
  await page.goBack();await wait();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.scrollY)>200);
  // Parent navigation follows hierarchy even when arriving by a shared URL.
  await page.goto('http://127.0.0.1:5173/products?category='+leaves[0].id+'&sort=price-desc');await wait();
  await page.locator('.shopping-toolbar button').first().click();await wait();assert.equal(new URL(page.url()).searchParams.get('category'),roots[0].id);assert.equal(new URL(page.url()).searchParams.get('sort'),'price-desc');
  await page.goto('http://127.0.0.1:5173/recommendations?category='+leaves[0].id);await wait();
  assert.equal(await page.locator('.catalog-master-grid>.compact-product-card').count(),10);await shot('leaf-final');
  await page.goto('http://127.0.0.1:5173/products?category=old-source-id');await wait();await page.waitForTimeout(100);assert.equal(new URL(page.url()).searchParams.get('category'),null);
  failBrowse=true;await page.locator('.shopping-roots').getByRole('button',{name:roots[0].name['zh-CN'],exact:true}).click();await page.getByRole('alert').waitFor();
  assert.ok(await page.locator('.shopping-toolbar button[aria-expanded]').isVisible());
  failBrowse=false;await page.getByRole('alert').getByRole('button').click();await wait();
  // Use the actual visible mobile directory for overlapping category requests.
  delayCategory=roots[1].id;
  await page.locator('.shopping-toolbar button[aria-expanded]').click();await page.locator('.shopping-drawer-root').filter({hasText:roots[1].name['zh-CN']}).click();
  await page.locator('.shopping-toolbar button[aria-expanded]').click();await page.locator('.shopping-drawer-root').filter({hasText:roots[2].name['zh-CN']}).click();
  await page.waitForTimeout(800);await wait();assert.equal(new URL(page.url()).searchParams.get('category'),roots[2].id);
  for(const locale of ['en-US','ja-JP','zh-TW']){
   await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);await page.reload();await wait();
   await page.screenshot({path:out+`${width}-parent-${locale}.png`});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  const realErrors=errors.filter(e=>!e.includes('500 (Internal Server Error)'));
  assert.deepEqual(realErrors,[]);reports.push({width,height,status:'PASS',flows:['drawer focus, Escape, focus return, scroll lock','history scroll restoration','parent navigation independent of history','sort retained','recommendations alias','legacy URL canonicalization','500 retry','four languages'],errors,requests});
  await writeFile(out+`browser-extra-${width}.json`,JSON.stringify(reports,null,2));await context.close();continue;
 }
 await page.goto('http://127.0.0.1:5173/products');await wait();await shot('overview');
 await page.locator('.shopping-roots').getByRole('button',{name:roots[0].name['zh-CN'],exact:true}).click();await wait();await shot('parent');
 assert.equal(new URL(page.url()).searchParams.get('category'),roots[0].id);
 assert.equal(await page.locator('.shopping-shelf').count(),2);
 const previewIds=await page.locator('.shopping-shelf').first().locator('[data-product-id]').evaluateAll(es=>es.map(e=>e.getAttribute('data-product-id')));
 await page.locator('.shopping-shelf').first().getByRole('button',{name:/查看全部/}).click();await wait();
 const selected=leaves[0].id;assert.equal(new URL(page.url()).searchParams.get('category'),selected);
 assert.deepEqual((await page.locator('.catalog-master-grid>[data-product-id]').evaluateAll(es=>es.map(e=>e.getAttribute('data-product-id')))).slice(0,8),previewIds);
 await shot('leaf');await page.reload();await wait();assert.equal(new URL(page.url()).searchParams.get('category'),selected);
 await page.goBack();await wait();assert.equal(new URL(page.url()).searchParams.get('category'),roots[0].id);
 await page.goForward();await wait();assert.equal(new URL(page.url()).searchParams.get('category'),selected);
 await page.locator('.shopping-children').getByRole('button',{name:'全部',exact:true}).click();await wait();
 await page.locator('.shopping-children').getByRole('button',{name:leaves[0].name['zh-CN'],exact:true}).click();await wait();assert.equal(new URL(page.url()).searchParams.get('category'),selected);
 await page.locator('.shopping-toolbar').getByRole('button',{name:/全部分类/}).click();await page.locator('.shopping-drawer .ant-drawer-body').waitFor();await page.waitForFunction(()=>Math.abs(document.querySelector('.ant-drawer-open .ant-drawer-content-wrapper')?.getBoundingClientRect().x??-100)<1);await page.screenshot({path:out+`${width}-drawer.png`});
 await page.locator('.shopping-drawer-root').filter({hasText:roots[1].name['zh-CN']}).click();await wait();assert.equal(new URL(page.url()).searchParams.get('category'),roots[1].id);await page.locator('.shopping-drawer').waitFor({state:'hidden'});
 await page.locator('.browse-search input').fill('没有任何匹配结果');await page.getByText('没有匹配的商品',{exact:true}).waitFor({timeout:3000}).catch(()=>{});await page.waitForTimeout(600);assert.equal(await page.locator('.compact-product-card').count(),0);await shot('empty');
 await page.locator('.browse-search input').fill('');await wait();
 // Overlapping requests must not resurrect a previous category.
 delayCategory=roots[0].id;
 await page.evaluate(([a,b])=>{const click=(id)=>{const button=[...document.querySelectorAll('.shopping-roots button')].find(e=>e.textContent.includes(id));button?.click();};click(a);setTimeout(()=>click(b),30);},[roots[0].name['zh-CN'],roots[2].name['zh-CN']]);
 await page.waitForTimeout(900);await wait();assert.equal(new URL(page.url()).searchParams.get('category'),roots[2].id);
 assert.equal(await page.locator('.shopping-toolbar strong').textContent(),roots[2].name['zh-CN']);
 const geometry=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.shopping-navigation button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,width:b.width,height:b.height,minWidth:s.minWidth,minHeight:s.minHeight,borderRadius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,background:s.backgroundColor,boxShadow:s.boxShadow};})}));
 assert.ok(geometry.scrollWidth<=width,JSON.stringify(geometry));assert.ok(geometry.controls.every(c=>c.height>=44&&c.width>=44));
 assert.deepEqual(errors,[]);reports.push({width,height,errors,requests,geometry,status:'PASS',data:'synthetic; no production mapping claim'});await writeFile(out+(process.env.SHOPPING_VIEWPORTS?'browser-mobile-report.json':'browser-report.json'),JSON.stringify(reports,null,2));await context.close();
}
if(!process.env.SHOPPING_EXTRA_ONLY&&!process.env.SHOPPING_LOCALE_ONLY&&!process.env.SHOPPING_GLYPHS_ONLY)await writeFile(out+(process.env.SHOPPING_VIEWPORTS?'browser-mobile-report.json':'browser-report.json'),JSON.stringify(reports,null,2));await browser.close();console.log('PASS: requested synthetic browser checks; inspect screenshots before visual acceptance');
