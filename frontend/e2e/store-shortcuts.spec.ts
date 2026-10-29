import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

// Existing Vite/Playwright test runner only. All API responses are isolated fixtures.
test.use({launchOptions:{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}});
const out=process.env.BOBUY_SHORTCUT_OUTPUT;
const gallery=[0,1].map(id=>({id:String(id),url:'/shortcut-fixture.svg',label:'Synthetic image '+id}));
const detail={post:{id:3,title:'Synthetic recommendation issue',published:true,merchantId:1,version:1,publishedAt:'2026-10-29T00:00:00Z'},body:'Local navigation acceptance only',items:[{id:153,name:'Synthetic item',itemNumber:'TEST-NAV-001',gallery,categoryIds:[],description:'Read-only fixture',translations:{}}]};
for(const mobile of [false,true])for(const state of ['no trips','available trip','in-progress trip'])test(`shortcuts ${mobile?'mobile touch':'desktop'} ${state}`,async({browser})=>{
 const hasTrip=state==='available trip',hasActive=state!=='no trips';
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage(),writes:string[]=[],errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
 await page.route('**/shortcut-fixture.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="1200" height="1600" fill="#ecece5"/><circle cx="600" cy="700" r="300" fill="#d2d2be"/><text x="600" y="1200" text-anchor="middle" font-size="70">LOCAL TEST IMAGE</text></svg>'}));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());if(request.method()!=='GET'){writes.push(request.method()+' '+url.pathname);await route.fulfill({status:405});return;}
  let data:unknown=[];
  if(url.pathname==='/api/storefront/trips')data=(hasTrip||(hasActive&&url.searchParams.get('includeCurrent')==='true'))?[{id:11,merchantId:1,merchantName:'Synthetic node',deliveryArea:'Test destination',deliveryDate:hasTrip?'2099-11-01':'2026-10-01'}]:[];
  if(url.pathname==='/api/storefront/products')data=hasActive?[{id:'test-product',merchantId:1,name:{'en-US':'Synthetic trip product'},description:{},brand:'Fixture',price:100,images:['/shortcut-fixture.svg'],categoryId:''}]:[];
  if(url.pathname==='/api/storefront/recommendation-nodes')data=[{id:1,name:'Synthetic node'}];
  if(url.pathname==='/api/storefront/recommendations')data=[detail];
  if(url.pathname==='/api/storefront/recommendations/3')data=detail;
  await route.fulfill({json:{status:'SUCCESS',data}});
 });
 try{
  await page.goto('/?node=1');
  if(hasActive){await expect(page.getByRole('heading',{name:'Synthetic trip product'})).toBeVisible();expect(new URL(page.url()).pathname).toBe('/');}
  else {await expect(page).toHaveURL(/\/recommendations\?node=1$/);await expect(page.locator('.rec-pin')).toHaveCount(1);}
  const shortcuts=page.getByRole('navigation',{name:'Quick navigation'});
  if(mobile){
   await expect(shortcuts).toBeVisible();await expect(shortcuts.getByRole('link')).toHaveCount(4);
   for(const link of await shortcuts.getByRole('link').all()){const box=await link.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);}
   expect((await shortcuts.boundingBox())!.y).toBeGreaterThan(700);await expect(shortcuts.locator('a[aria-current="page"]')).toHaveAttribute('href',hasActive?'/products?node=1':'/recommendations?node=1');
  }else{
   await expect(shortcuts).toBeHidden();await expect(page.locator('.browse-sidebar')).toBeVisible();
   expect(await page.locator('.browse-sidebar .browse-links>a').allTextContents()).toEqual(['Product Picks','Trip finds','Bookable trips','Executed trips','My account']);
  }
  const nav=mobile?shortcuts:page.locator('.browse-sidebar .browse-links');
  await nav.getByRole('link',{name:'Product Picks',exact:true}).click();await expect(page.locator('.rec-pin')).toHaveCount(1);
  await nav.getByRole('link',{name:'Trip finds',exact:true}).click();await expect(page).toHaveURL(/\/products\?node=1$/);await expect(page.getByRole('heading',{name:/^Trip finds/})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:/^Trip finds/})).toBeVisible();
  await nav.getByRole('link',{name:'Product Picks',exact:true}).click();await page.goBack();await expect(page).toHaveURL(/\/products\?node=1$/);await page.goForward();await expect(page).toHaveURL(/\/recommendations\?node=1$/);
  if(mobile){
   await shortcuts.getByRole('link',{name:'Cart',exact:true}).tap();await expect(page).toHaveURL(/\/cart\?node=1$/);
   await shortcuts.getByRole('link',{name:'My account',exact:true}).tap();await expect(page).toHaveURL(/\/account\?node=1$/);await expect(page.getByRole('button',{name:'Register and continue',exact:true})).toBeVisible();
   await page.reload();await expect(page).toHaveURL(/\/account\?node=1$/);await shortcuts.getByRole('link',{name:'Product Picks',exact:true}).tap();
  }
  await page.goto('/recommendations/3?node=1&item=153');await expect(page.locator('.rec-gallery-inline')).toBeVisible();
  if(mobile)await page.locator('.rec-gallery-inline').tap();else await page.locator('.rec-gallery-inline').click();
  await expect(page.locator('.rec-gallery-stage')).toHaveAttribute('data-ready','true');
  expect(await page.evaluate(()=>!!document.elementFromPoint(innerWidth/2,innerHeight-30)?.closest('.browse-mobile-shortcuts'))).toBe(false);
  await page.keyboard.press('Escape');await expect(page.locator('.rec-gallery-stage')).toBeHidden();await expect(page.locator('.rec-product-detail')).toBeVisible();
  await page.locator('.rec-product-detail .ant-drawer-close').click();await expect(page.locator('.rec-product-detail')).toBeHidden();
  if(mobile){await shortcuts.getByRole('link',{name:'Product Picks',exact:true}).tap();await shortcuts.getByRole('link',{name:'Product Picks',exact:true}).tap();await expect(page.locator('.rec-pin')).toHaveCount(1);
   const sizes=await shortcuts.locator('.anticon').evaluateAll(elements=>elements.map(e=>getComputedStyle(e).fontSize));expect(new Set(sizes)).toEqual(new Set(['22px']));
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
   expect((await page.locator('.rec-pin').last().boundingBox())!.y+(await page.locator('.rec-pin').last().boundingBox())!.height).toBeLessThan((await shortcuts.boundingBox())!.y);
   await page.evaluate(()=>window.scrollTo(0,0));
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(out){await mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,`${mobile?'mobile':'desktop'}-${state.replaceAll(' ','-')}.png`),fullPage:false});}
  expect(writes).toEqual([]);expect(errors).toEqual([]);
 }finally{await context.close();}
});
