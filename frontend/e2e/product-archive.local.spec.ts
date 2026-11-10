import {test,expect,type Page} from '@playwright/test';
const origin='http://127.0.0.1:18080';
async function login(page:Page,role:'agent'|'customer'){
 await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
 await page.goto('/admin');await page.getByLabel('Username',{exact:true}).fill(role);await page.getByLabel('Password',{exact:true}).fill(role+'-pass');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByLabel('Username',{exact:true})).toHaveCount(0);
}
test('unifies active/deleted products, retains old links and restores through mobile UI',async({page,browser},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await login(page,'agent');
 await page.getByRole('link',{name:'Product records',exact:true}).click();await expect(page.getByRole('heading',{name:'Product records',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Product recycle bin',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Consolidated Stock',exact:true})).toHaveCount(0);
 const row=page.locator('.ant-table-row').first();await expect(row).toBeVisible();const id=(await row.getAttribute('data-row-key'))!;expect(id).toBeTruthy();
 await page.screenshot({path:info.outputPath('product-archive-desktop-active.png'),fullPage:true});
 await row.locator('button:has(.anticon-delete)').click();await expect(page.locator(`.ant-table-row[data-row-key="${id}"]`)).toHaveCount(0);
 await page.getByRole('tab',{name:'Deleted products',exact:true}).click();const removed=page.locator('.ant-table-row').filter({hasText:id});await expect(removed).toBeVisible();await expect(page).toHaveURL(/view=deleted/);
 await page.reload();await expect(page.getByRole('tab',{name:'Deleted products',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.locator('.ant-table-row').filter({hasText:id})).toBeVisible();
 await page.screenshot({path:info.outputPath('product-archive-desktop-deleted.png'),fullPage:true});
 const mobileContext=await browser.newContext({baseURL:origin,viewport:{width:390,height:844},isMobile:true,hasTouch:true,storageState:await page.context().storageState()});
 const mobile=await mobileContext.newPage();mobile.on('pageerror',error=>errors.push(error.message));await mobile.goto('/admin/deleted-products');await expect(mobile).toHaveURL(/\/admin\/products\?view=deleted$/);
 const card=mobile.locator(`[data-product-id="${id}"]`);await expect(card).toBeVisible();await mobile.screenshot({path:info.outputPath('product-archive-mobile-deleted.png'),fullPage:true});
 await card.getByRole('button',{name:'Restore product and recommendations',exact:true}).tap();await expect(card).toHaveCount(0);
 await mobile.getByRole('tab',{name:'Active products',exact:true}).tap();await expect(mobile.locator('.stock-mobile-card').first()).toBeVisible();expect(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await mobile.screenshot({path:info.outputPath('product-archive-mobile-active.png'),fullPage:true});
 // Same-page restore also refreshes the already visited active list, without a full navigation.
 await page.reload();await expect(page.locator('.ant-table-row').filter({hasText:id})).toHaveCount(0);await page.getByRole('tab',{name:'Active products',exact:true}).click();await expect(page.locator(`.ant-table-row[data-row-key="${id}"]`)).toBeVisible();
 await page.locator(`.ant-table-row[data-row-key="${id}"] button:has(.anticon-delete)`).click();await page.getByRole('tab',{name:'Deleted products',exact:true}).click();
 await page.locator('.ant-table-row').filter({hasText:id}).getByRole('button',{name:'Restore product and recommendations',exact:true}).click();
 await page.getByRole('tab',{name:'Active products',exact:true}).click();await expect(page.locator(`.ant-table-row[data-row-key="${id}"]`)).toBeVisible();
 await page.getByRole('tab',{name:'Deleted products',exact:true}).click();await page.goBack();await expect(page.getByRole('tab',{name:'Active products',exact:true})).toHaveAttribute('aria-selected','true');
 await page.goto('/admin/stock-master?view=deleted#status');await expect(page).toHaveURL(/\/admin\/products\?view=deleted#status$/);await expect(page.getByRole('tab',{name:'Deleted products',exact:true})).toHaveAttribute('aria-selected','true');
 await page.goto('/admin/basic-data/currencies');await expect(page.getByText('JPY',{exact:true}).first()).toBeVisible();
 await page.goto('/admin/products');
 for(const [locale,title] of [['zh-CN','商品档案管理'],['zh-TW','商品檔案管理'],['ja-JP','商品マスター管理'],['en-US','Product records']]){
  await page.locator('.language-switcher').click();await page.locator(`[role="menu"] [lang="${locale}"]`).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 }
 await page.screenshot({path:info.outputPath('product-archive-desktop-active.png'),fullPage:true});
 const customerContext=await browser.newContext({baseURL:origin});const customer=await customerContext.newPage();await login(customer,'customer');await customer.goto('/admin/products?view=deleted');await expect(customer).toHaveURL(origin+'/');await expect(customer.getByRole('heading',{name:'Product records',exact:true})).toHaveCount(0);
 expect(errors).toEqual([]);await customerContext.close();await mobileContext.close();
});
