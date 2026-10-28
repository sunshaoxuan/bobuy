import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const fixturePath=process.env.BOBUY_VISUAL_FIXTURE;
const output=process.env.BOBUY_VISUAL_OUTPUT;
const baseline=process.env.BOBUY_VISUAL_BASELINE==='1';
test.skip(!fixturePath||!output,'Local visual review requires approved image fixture and output paths');
for(const mobile of [false,true])test(`product records visual review ${mobile?'mobile':'desktop'}`,async({browser})=>{
 const fixture=JSON.parse(await readFile(fixturePath!,'utf8'));
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1100},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();const errors:string[]=[],writes:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(user=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_access_token','isolated-local-visual-fixture');localStorage.setItem('bobbuy_auth_user',JSON.stringify(user));},fixture.user);
 await page.route('**/visual-assets/**',async route=>{const file=path.basename(new URL(route.request().url()).pathname);if(!/^\d+_\d+\.png$/.test(file)){await route.abort();return;}await route.fulfill({contentType:'image/png',body:await readFile(path.join(fixture.assetRoot,file.split('_')[0],file))});});
 await page.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'){writes.push(req.method()+' '+url.pathname);await route.fulfill({status:405,json:{message:'Read-only local visual fixture'}});return;}
  let data:any=[];if(url.pathname==='/api/auth/me')data=fixture.user;if(url.pathname==='/api/mobile/products')data=fixture.products;if(url.pathname==='/api/mobile/categories')data=fixture.categories;if(url.pathname==='/api/mobile/suppliers')data=[];if(url.pathname==='/api/merchant/recommendation-taxonomy')data={categories:fixture.categories,suppliers:fixture.suppliers};if(url.pathname.startsWith('/api/merchant/product-catalog/'))data=fixture.catalogs[decodeURIComponent(url.pathname.split('/').at(-1)!)];
  if(url.pathname==='/api/merchant/product-catalog')data=[];
  await route.fulfill({json:{status:'SUCCESS',data}});
 });
 const prefix=`${baseline?'before':'after'}-${mobile?'mobile':'desktop'}`;await mkdir(output!,{recursive:true});
 await page.goto('http://127.0.0.1:5173/admin/products');await expect(page.getByRole('heading',{name:'商品档案管理',exact:true})).toBeVisible();
 if(!baseline){await expect(page.locator('.product-record-pin')).toHaveCount(9);await expect(page.locator('.record-cover img').first()).toBeVisible();await page.locator('.record-cover img').first().evaluate(e=>(e as HTMLImageElement).decode());}
 else await expect(page.locator('.ant-table-row,.stock-mobile-card').first()).toBeVisible();
 await page.screenshot({path:path.join(output!,prefix+'-collection.png'),fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 if(!baseline){
  if(mobile){await page.locator('.catalog-utility-disclosure>summary').click();await expect(page.getByRole('button',{name:'预览并批量补齐主档',exact:true})).toBeVisible();await page.locator('.catalog-utility-disclosure>summary').click();}
  else{const cover=page.locator('.record-cover').first();await cover.focus();await expect(cover).toBeFocused();expect(await cover.evaluate(e=>getComputedStyle(e).outlineWidth)).toBe('3px');await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.product-record-pin').first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');await page.emulateMedia({reducedMotion:'no-preference'});}
 }
 if(!baseline){await page.getByRole('textbox',{name:'搜索商品名称 or SKU...',exact:true}).fill('89609');await expect(page.locator('.product-record-pin')).toHaveCount(1);await page.getByRole('textbox',{name:'搜索商品名称 or SKU...',exact:true}).fill('');await expect(page.locator('.product-record-pin')).toHaveCount(9);}
 await page.goto('http://127.0.0.1:5173/admin/products?product=visual-89609');await expect(page.getByRole('dialog').getByRole('textbox',{name:'产品编号',exact:true})).toHaveValue('89609');
 if(!baseline){await expect(page.locator('.catalog-cover-preview img')).toBeVisible();await page.locator('.catalog-cover-preview img').evaluate(e=>(e as HTMLImageElement).decode());await page.getByRole('button',{name:'预览第 2 张图片',exact:true}).click();await expect(page.getByRole('button',{name:'预览第 2 张图片',exact:true})).toHaveAttribute('aria-pressed','true');expect(await page.getByRole('button',{name:'确认保存主档',exact:true}).isEnabled()).toBe(false);}
 await page.screenshot({path:path.join(output!,prefix+'-editor.png'),fullPage:false});
 if(!baseline)expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 if(!baseline){await page.getByRole('tab',{name:'English',exact:true}).click();await expect(page.getByRole('textbox',{name:'名称（纯译名，不附日文括号） en-US',exact:true})).toHaveValue(fixture.catalogs['visual-89609'].value.name['en-US']);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await page.getByText('紧凑管理',{exact:true}).click();if(mobile)await expect(page.locator('.stock-mobile-card').first()).toBeVisible();else await expect(page.getByRole('table')).toBeVisible();await page.screenshot({path:path.join(output!,prefix+'-management.png'),fullPage:false});}
 expect(writes).toEqual([]);expect(errors).toEqual([]);await context.close();
});
