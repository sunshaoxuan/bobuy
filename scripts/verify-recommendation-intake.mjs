import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=new URL('../docs/reports/evidence/recommendation-intake/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_access_token','synthetic-local-only');localStorage.setItem('bobbuy_auth_user',JSON.stringify({id:1000,username:'synthetic',name:'Synthetic merchant',roles:['AGENT']}));});
const page=await context.newPage(),writes=[];let scanCount=0;
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
let detail={post:{id:4,title:'Synthetic local intake',published:false,version:1},body:'Original article retained',items:[]};
const existing={id:'existing-fixture',merchantId:1000,name:{'ja-JP':'既存テスト商品','en-US':'Existing synthetic'},itemNumber:'00077',recordVersion:7,catalogData:{},mediaGallery:[{url:'/synthetic.png'}],basePrice:0,visibilityStatus:'DRAFTER_ONLY'};
const empty={...existing,id:'empty-fixture',name:{'ja-JP':'Empty existing fixture','en-US':'Empty existing synthetic'},itemNumber:'00088',mediaGallery:[],recordVersion:8};
await page.route('https://www.costco.co.jp/medias/**',route=>route.fulfill({status:200,contentType:'image/png',body:bytes}));
await page.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;let data=[];
 if(path==='/api/auth/me')data={id:1000,username:'synthetic',name:'Synthetic merchant',roles:['AGENT']};
 else if(path==='/api/mobile/products')data=[{product:existing},{product:empty}];
 else if(path==='/api/merchant/recommendation-taxonomy')data={categories:[],suppliers:[]};
 else if(path==='/api/merchant/recommendations/4')data=detail;
 else if(path==='/api/ai/recommendation-products/scan'){scanCount++;data={name:'合成テスト商品',itemNumber:scanCount===3?'00077':scanCount===4?'00088':'00'+(122+scanCount),specification:'2-pack',brand:'Synthetic',evidence:'Synthetic labelled ITEM, manual review required',uncertain:true};}
 else if(path==='/api/ai/recommendation-products/research'){const input=req.postDataJSON();data=[{itemNumber:input.itemNumber,name:'Synthetic official fixture',description:'',productUrl:'https://www.costco.co.jp/Synthetic/p/'+input.itemNumber,images:['https://www.costco.co.jp/medias/sys_master/images/synthetic-front.png','https://www.costco.co.jp/medias/sys_master/images/synthetic-back.png']}];}
 else if(path==='/api/merchant/recommendations/4/product-intake'){
  const body=req.postData();assert(body.includes('"reviewed":true'));const input=JSON.parse(body.match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)[1]);const hasFile=body.includes('name="file"');writes.push({input,hasFile});
  detail={...detail,post:{...detail.post,version:detail.post.version+1},items:[...detail.items,{id:writes.length,productId:'fixture-'+writes.length,...input.facts,imageUrl:'/fixture.png',gallery:[]}]};data={productId:'fixture-'+writes.length,productVersion:0,created:true,detail};
 }else if(req.method()!=='GET')throw new Error('Unexpected write: '+path);
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',data})});
});
const report={scope:'Real Chrome local UI with synthetic scan/search/save fixtures, not real AI or official search success',checks:{}};
async function start(){await page.getByRole('button',{name:'Add a product from an image',exact:true}).click();await page.locator('input[type=file]').filter({visible:true}).count();const file=page.locator('.ant-modal input[type=file]');await file.setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:bytes});await page.getByRole('button',{name:'Review product candidate',exact:true}).click();await page.locator('.rec-product-intake-modal').waitFor();}
try{
 await page.goto('http://127.0.0.1:4173/admin/recommendations?post=4');await page.locator('.rec-intake').waitFor();await start();
 let dialog=page.locator('.rec-product-intake-modal');assert(!(await dialog.getByRole('checkbox',{name:/Also use the uploaded image/}).isChecked()));
 await dialog.getByRole('button',{name:'Find exact-ITEM official gallery',exact:true}).click();await dialog.getByText('Synthetic official fixture · 00123').waitFor();assert.equal(await dialog.locator('.rec-intake-gallery img').count(),2);
 await dialog.getByRole('checkbox',{name:'Reviewed same-specification product image: use',exact:true}).first().check();await dialog.getByRole('checkbox',{name:/I reviewed the Japanese name/}).check();
 await page.screenshot({path:fileURLToPath(new URL('desktop.png',out)),animations:'disabled'});await dialog.getByRole('button',{name:'Save master and link this issue',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.equal(writes.length,1);assert.equal(writes[0].hasFile,false);assert.equal(writes[0].input.officialImages.length,1);report.checks.clueOnlyOfficialSelectionAndSave='PASS';
 await page.setViewportSize({width:390,height:844});await start();dialog=page.locator('.rec-product-intake-modal');await dialog.getByRole('checkbox',{name:/Also use the uploaded image/}).check();await dialog.getByRole('checkbox',{name:/I reviewed the Japanese name/}).check();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('mobile.png',out)),animations:'disabled'});await dialog.getByRole('button',{name:'Save master and link this issue',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(writes.length,2);assert.equal(writes[1].hasFile,true);report.checks.explicitUserImageAndMobile='PASS';
 await start();dialog=page.locator('.rec-product-intake-modal');assert(await dialog.getByRole('button',{name:'Save private incomplete master only',exact:true}).isDisabled());await dialog.getByRole('combobox',{name:'Search item code or name',exact:true}).click();await page.getByText('00077 · Existing synthetic',{exact:true}).click();await dialog.waitFor({state:'hidden'});await page.locator('.rec-from-product input[value="既存テスト商品"]').waitFor();assert.equal(writes.length,2);report.checks.existingMasterSelectionAvoidsDuplicate='PASS';assert.equal(await page.locator('#rec-body').inputValue(),'Original article retained');
 await page.setViewportSize({width:1440,height:1000});await start();dialog=page.locator('.rec-product-intake-modal');
 await dialog.getByRole('combobox',{name:'Search item code or name',exact:true}).click();await page.getByText(/00088.*Empty existing synthetic/).click();
 assert.equal(await dialog.getByRole('textbox').first().inputValue(),'Empty existing fixture');
 await dialog.getByRole('checkbox',{name:/Also use the uploaded image/}).check();await dialog.getByRole('checkbox',{name:/I reviewed the Japanese name/}).check();
 await dialog.getByRole('button',{name:'Save master and link this issue',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.equal(writes.length,3);assert.equal(writes[2].input.existingProductId,'empty-fixture');assert.equal(writes[2].input.existingProductVersion,8);report.checks.emptyMasterEnrichmentRetainsIdentityAndVersion='PASS';
 report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error);report.page=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:fileURLToPath(new URL('failure.png',out))}).catch(()=>{});throw error;}finally{writeFileSync(new URL('browser.json',out),JSON.stringify({...report,writes},null,2));await browser.close();console.log(JSON.stringify(report));}
