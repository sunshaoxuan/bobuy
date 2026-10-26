import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=new URL('../docs/reports/evidence/recommendation-classification/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage(),origin='http://127.0.0.1:18080';
const report={scope:'Synthetic local normal UI only; existing shared containers',checks:{},errors:[]};let id;
page.on('pageerror',error=>report.errors.push(error.message));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRoAAAAASUVORK5CYII=','base64');
async function shot(name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true,animations:'disabled'});}
async function create(kind,name){await page.getByRole('button',{name:kind==='category'?'维护分类':'新建供应商',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('名称',{exact:true}).fill(name);await dialog.getByRole('button',{name:'保存名称',exact:true}).click();await dialog.waitFor({state:'hidden'});}
async function apply(){await page.getByRole('button',{name:'应用到已选商品',exact:true}).click();await page.locator('.ant-popconfirm-buttons .ant-btn-primary').click();await page.locator('.ant-popover:visible').waitFor({state:'hidden'});await page.getByText('已保存分类与供应商，文章公开状态未变。',{exact:true}).waitFor();}
try{
 await page.goto(origin+'/admin');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.getByRole('link',{name:'好物推荐',exact:true}).first().waitFor();
 await page.getByRole('link',{name:'好物推荐',exact:true}).first().click();await page.getByRole('button',{name:/新建推荐/}).click();await page.locator('#rec-title').waitFor();id=new URL(page.url()).searchParams.get('post');
 await page.locator('#rec-title').fill('[Synthetic classification acceptance]');await page.locator('#rec-body').fill('Synthetic local category/supplier verification only.');
 const rows=Array.from({length:26},(_,index)=>({name:(index===25?'Unknown':'Tagged')+' synthetic '+index,itemNumber:'CLASS-'+String(index).padStart(2,'0'),fileName:'class-'+index+'.png'}));
 await page.locator('input[type=file]').setInputFiles(rows.map(row=>({name:row.fileName,mimeType:'image/png',buffer:png})));
 await page.locator('#rec-batch').fill(JSON.stringify(rows));await page.getByRole('button',{name:/校验并加入预览/}).click();await page.getByRole('button',{name:/登记全部/}).click();
 await page.getByRole('button',{name:'选择全部结果（26）',exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.rec-upload-status')].every(value=>!value.textContent.includes('待登记')));
 await create('category','Synthetic Food UI');await create('category','Synthetic Home UI');await create('supplier','Synthetic Warehouse UI');
 await page.getByRole('checkbox',{name:'更新分类',exact:true}).check();await page.getByRole('checkbox',{name:'更新供应商',exact:true}).check();
 assert.equal(await page.getByRole('checkbox',{name:'向客户显示供应商',exact:true}).isChecked(),false);
 await page.getByLabel('搜索名称或商品编号',{exact:true}).fill('Tagged');await page.getByRole('button',{name:'选择全部结果（25）',exact:true}).click();
 await apply();report.checks.inlineMasterMaintenanceAndBulk25AcrossPagesDefaultHidden='PASS';
 await page.getByLabel('搜索名称或商品编号',{exact:true}).fill('CLASS-00');await page.getByRole('button',{name:'选择全部结果（1）',exact:true}).click();
 await page.getByRole('checkbox',{name:'更新分类',exact:true}).uncheck();await page.getByRole('checkbox',{name:'向客户显示供应商',exact:true}).check();await apply();
 await page.getByLabel('搜索名称或商品编号',{exact:true}).fill('');
 await page.getByRole('button',{name:/保存草稿/}).click();await page.getByText('已保存',{exact:true}).waitFor();await page.reload();await page.locator('#rec-title').waitFor();
 assert((await page.locator('.rec-classification').innerText()).includes('Synthetic Food UI'));await shot('admin-desktop');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('admin-mobile');
 await page.getByRole('button',{name:/发表文章/}).click();await page.getByRole('button',{name:/撤回编辑/}).waitFor();
 await page.goto(origin+'/recommendations/'+id);await page.locator('.rec-pin').nth(25).waitFor();
 assert.equal(await page.locator('.rec-supplier').count(),1);assert.equal(await page.locator('.rec-pin').count(),26);
 const food=page.getByRole('button',{name:'Synthetic Food UI (25)',exact:true});await food.click();assert.equal(await page.locator('.rec-pin').count(),25);await food.click();
 await page.getByRole('button',{name:'Synthetic Home UI (25)',exact:true}).click();assert.equal(await page.locator('.rec-pin').count(),25);
 await page.goBack();assert(new URL(page.url()).searchParams.get('category'));assert.equal(await page.locator('.rec-pin').count(),25);
 await page.getByRole('button',{name:'全部 (26)',exact:true}).click();await page.getByRole('button',{name:'未分类 (1)',exact:true}).click();assert.equal(await page.locator('.rec-pin').count(),1);
 await page.getByRole('button',{name:'全部 (26)',exact:true}).click();await shot('customer-mobile');
 await page.goto(origin+'/recommendations/'+id+'?category=missing');await page.getByText('此分类暂无商品，可返回全部。',{exact:true}).waitFor();await page.getByRole('button',{name:'全部',exact:true}).click();assert.equal(await page.locator('.rec-pin').count(),26);
 await page.setViewportSize({width:1440,height:1000});await shot('customer-desktop');
 const response=await context.request.get(origin+'/api/storefront/recommendations/'+id);const items=(await response.json()).data.items;
 assert.equal(items.filter(item=>item.supplierName).length,1);assert(items.filter(item=>!item.showSupplier).every(item=>item.supplierId==null&&item.supplierName==null));
 report.checks.customerCategoriesAllUnknownEmptyRepeatBackMultiAndSupplierPrivacy='PASS';assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;await shot('failure').catch(()=>{});throw error;}
finally{
 if(id){try{await page.goto(origin+'/admin/recommendations?post='+id);await page.locator('#rec-title').waitFor();if(await page.getByRole('button',{name:/撤回编辑/}).count()){await page.getByRole('button',{name:/撤回编辑/}).click();await page.getByRole('button',{name:/发表文章/}).waitFor();}report.syntheticDraftWithdrawn=true;}catch(error){report.cleanupError=error.message;}}
 report.postId=id;writeFileSync(new URL('local-ui.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();
}
