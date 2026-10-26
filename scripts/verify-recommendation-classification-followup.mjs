import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=new URL('../docs/reports/evidence/recommendation-classification/',import.meta.url);
const report=JSON.parse(readFileSync(new URL('local-ui.json',out),'utf8'));const id=report.postId;
assert(/^\d+$/.test(id));writeFileSync(new URL('local-ui-initial.json',out),JSON.stringify(report,null,2)+'\n');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1440,height:1000}});
let published=false;
try{
 await page.goto('http://127.0.0.1:18080/admin');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.getByRole('link',{name:'好物推荐',exact:true}).first().waitFor();
 await page.goto('http://127.0.0.1:18080/admin/recommendations?post='+id);await page.locator('#rec-title').waitFor();assert.equal(await page.locator('#rec-title').inputValue(),'[Synthetic classification acceptance]');
 if(await page.getByRole('button',{name:/撤回编辑/}).count()){await page.getByRole('button',{name:/撤回编辑/}).click();await page.getByRole('button',{name:/发表文章/}).waitFor();}
 if(!(await page.locator('.rec-classification').innerText()).includes('Synthetic Grocery UI')){
  await page.getByRole('button',{name:'维护分类',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('combobox',{name:'选择要改名的自建分类',exact:true}).fill('Synthetic Food UI');
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({hasText:'Synthetic Food UI'}).click();
  await dialog.getByLabel('名称',{exact:true}).fill('Synthetic Grocery UI');await dialog.getByRole('button',{name:'保存名称',exact:true}).click();await dialog.waitFor({state:'hidden'});
 }
 await page.getByRole('button',{name:/发表文章/}).click();await page.getByRole('button',{name:/撤回编辑/}).waitFor();published=true;
 await page.goto('http://127.0.0.1:18080/recommendations/'+id+'?category=missing');await page.getByText('此分类暂无商品，可返回全部。',{exact:true}).waitFor();
 await page.locator('.ant-empty').getByRole('button').click();assert.equal(await page.locator('.rec-pin').count(),26);
 await page.getByRole('button',{name:'Synthetic Grocery UI (25)',exact:true}).click();assert.equal(await page.locator('.rec-pin').count(),25);
 const response=await page.request.get('http://127.0.0.1:18080/api/storefront/recommendations/'+id);const items=(await response.json()).data.items;
 assert.equal(items.filter(item=>item.supplierName).length,1);assert(items.filter(item=>!item.showSupplier).every(item=>item.supplierId==null&&item.supplierName==null));
 await page.getByRole('button',{name:'全部 (26)',exact:true}).click();
 for(const path of ['/api/storefront/products','/api/storefront/trips']){const response=await page.request.get('http://127.0.0.1:18080'+path);assert.equal(response.status(),200);}
 assert.equal(await page.locator('.store-main > .ant-alert-error').count(),0);
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('customer-'+width+'.png',out)),fullPage:true,animations:'disabled'});}
 report.checks.customerCategoriesAllUnknownEmptyRepeatBackMultiAndSupplierPrivacy='PASS';report.checks.ownedCategoryNameSearchAndRename='PASS';
 report.checks.localCatalogMediaCompatibilityNoStorefrontError='PASS';
 report.followup='Reused existing synthetic post. Corrected button/combobox selectors and awaited loaded publication state before fixture cleanup; no re-import.';delete report.failure;delete report.followupFailure;report.result='PASS';
}catch(error){report.followupFailure=error.stack;report.result='FAIL';throw error;}
finally{
 if(published){await page.goto('http://127.0.0.1:18080/admin/recommendations?post='+id);await page.getByRole('button',{name:/撤回编辑/}).click();await page.getByRole('button',{name:/发表文章/}).waitFor();report.syntheticDraftWithdrawn=true;}
 writeFileSync(new URL('local-ui.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();
}
