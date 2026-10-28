import {test,expect,devices} from '@playwright/test';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCz0AAAAASUVORK5CYII=';
const item=(id:number,name:string,end?:string)=>({id,name,imageUrl:png,offerEnd:end,referencePrice:100,priceUnit:'1 pack',gallery:[{id:'synthetic-'+id,url:png,hash:'synthetic-'+id,sourceUrl:'',assetKey:'synthetic-'+id,label:'Synthetic'}]});
const post=(id:number,title:string,items:ReturnType<typeof item>[])=>({post:{id,title,published:true,version:1,updatedAt:'2026-10-01T00:00:00',publishedAt:`2026-10-${id===3?'28':id===2?'20':'01'}T00:00:00Z`,merchantId:1000},body:'Read-only browser fixture. No server content is saved.',items});
const fixtures=[post(1,'Past fixture',[item(1,'Past synthetic item','2026-10-01')]),post(2,'Mixed fixture',[item(2,'Ended synthetic item','2026-10-01'),item(3,'Unknown synthetic item')]),post(3,'Newest fixture',[item(4,'New synthetic item')])];
for(const mobile of [false,true])test(`history scope and ordering, ${mobile?'touch narrow':'desktop'}`,async({browser},info)=>{
 const context=await browser.newContext(mobile?{...devices['iPhone 13'],locale:'en-US'}:{viewport:{width:1440,height:1000},locale:'en-US'});const page=await context.newPage();const errors:string[]=[],writes:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.clock.setFixedTime(new Date('2026-10-28T00:00:00Z'));await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
  await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url());if(request.method()!=='GET'){writes.push(request.method()+' '+url.pathname);await route.fulfill({status:405,body:'Read-only fixture'});return;}let data:unknown=[];if(url.pathname==='/api/storefront/recommendations')data=fixtures;if(url.pathname==='/api/storefront/recommendation-nodes')data=[{id:1000,name:'Synthetic node'}];await route.fulfill({json:{status:'SUCCESS',data}});});
  await page.goto('/recommendations');await expect(page.getByRole('heading',{name:'Newest fixture'})).toBeVisible();await expect(page.locator('.rec-issue-directory a')).toHaveText(['All','Newest fixture','Mixed fixture']);await expect(page.locator('.rec-history-content')).not.toHaveAttribute('open','');
  await page.screenshot({path:info.outputPath(`history-${mobile?'mobile':'desktop'}-current.png`),fullPage:true});
  const summary=page.locator('.rec-history-topics>summary');if(mobile)await summary.tap();else await summary.click();await page.locator('.rec-history-directory a').click();await expect(page.getByRole('heading',{name:'Past fixture'})).toBeVisible();await expect(page.locator('.rec-history-note')).toBeVisible();await expect(page.getByRole('heading',{name:'Newest fixture'})).toHaveCount(0);
  await page.screenshot({path:info.outputPath(`history-${mobile?'mobile':'desktop'}-past.png`),fullPage:true});
  await page.reload();await expect(page.getByRole('heading',{name:'Past fixture'})).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'Newest fixture'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(writes).toEqual([]);expect(errors).toEqual([]);
 }finally{if(errors.length)console.log('LOCAL_FIXTURE_PAGE_ERRORS',JSON.stringify(errors));await context.close();}
});
test('history labels in four languages and wide layout',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1000});await page.clock.setFixedTime(new Date('2026-10-28T00:00:00Z'));const writes:string[]=[];
 await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url());if(request.method()!=='GET'){writes.push(request.method());await route.fulfill({status:405});return;}await route.fulfill({json:{status:'SUCCESS',data:url.pathname==='/api/storefront/recommendations'?fixtures:url.pathname==='/api/storefront/recommendation-nodes'?[{id:1000,name:'Synthetic node'}]:[]}});});
 await page.goto('/recommendations');await expect(page.locator('.rec-feed-heading')).toBeVisible();
 for(const [locale,label] of [['en-US','Past issues'],['zh-CN','历史期次'],['zh-TW','歷史期次'],['ja-JP','過去の特集']]){
  await page.evaluate(value=>localStorage.setItem('bobbuy_locale',value),locale);await page.reload();await expect(page.locator('.rec-history-topics>summary')).toContainText(label);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(locale==='en-US'){await page.screenshot({path:info.outputPath('history-wide-current.png'),fullPage:true});await page.locator('.rec-history-topics>summary').click();await page.locator('.rec-history-directory a').click();await expect(page.locator('.rec-history-note')).toBeVisible();await page.screenshot({path:info.outputPath('history-wide-past.png'),fullPage:true});await page.goto('/recommendations');}
 }expect(writes).toEqual([]);
});
