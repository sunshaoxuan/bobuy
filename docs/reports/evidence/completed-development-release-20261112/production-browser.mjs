import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),out=resolve(root,'docs/reports/evidence/completed-development-release-20261112');
const {chromium}=await import(pathToFileURL(resolve(root,'frontend/node_modules/playwright-core/index.mjs')).href);
const expected=JSON.parse(readFileSync(resolve(out,'frontend-files.json'),'utf8'));
const result={at:new Date().toISOString(),source:JSON.parse(readFileSync(resolve(out,'artifact.json'),'utf8')).source,console:[],network:[],blockedBusinessWrites:[],assets:{},assetErrors:[],views:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']});
const pending=[];
async function observe(ctx){
 await ctx.route('**/*',route=>{const request=route.request(),path=new URL(request.url()).pathname;if(path==='/cdn-cgi/rum')return route.fulfill({status:204,body:''});if(!['GET','HEAD','OPTIONS'].includes(request.method())){result.blockedBusinessWrites.push({method:request.method(),path});return route.abort();}return route.continue();});
 const page=await ctx.newPage();
 page.on('pageerror',e=>result.console.push(e.message));
 page.on('console',m=>{if(m.type()==='error')result.console.push(m.text());});
 page.on('response',r=>{const path=new URL(r.url()).pathname;if(r.status()>=400)result.network.push({path,status:r.status()});if(/\.(js|css)$/.test(path))pending.push(r.body().then(body=>{const hash=createHash('sha256').update(body).digest('hex');assert.equal(hash,expected[path.slice(1)],path);result.assets[path]=hash;}).catch(e=>result.assetErrors.push({path,message:e.message})));});
 return page;
}
try{
 for(const width of [1440,320]){
  const ctx=await browser.newContext({viewport:{width,height:1000}});await ctx.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
  const page=await observe(ctx);
  for(const path of ['products','recommendations']){
   await page.goto('https://bobuy.cc/'+path);const cards=page.locator('.compact-product-card');await cards.first().waitFor();
   const sort=page.locator('.product-sort').first();assert.equal(await sort.locator('option').count(),7);
   for(const value of ['price-asc','price-desc','rating-asc','rating-desc','heat-asc','heat-desc','default']){
    if(await sort.inputValue()!==value){const response=page.waitForResponse(r=>r.status()===200&&r.url().includes('sort='+value)&&r.url().includes('browse'));await sort.selectOption(value);await response;}
   }
   await page.waitForFunction(()=>[...document.querySelectorAll('.compact-product-card')].slice(0,4).every(c=>[...c.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await cards.first().locator('.ant-rate-star').count(),5);await cards.first().locator('.product-popularity').waitFor();
   await page.screenshot({path:resolve(out,`production-${path}-${width}.png`)});
   result.views.push({path,width,cards:await cards.count(),sorts:7,heat:await cards.first().locator('.product-popularity').innerText(),stars:5,noOverflow:true});
  }
  await Promise.all(pending);await ctx.close();
 }
 // Credentials remain in memory only. This uses the established normal login endpoint.
 const credentials=JSON.parse(execFileSync('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','cat /etc/bobuy-admin.json'],{encoding:'utf8'}));
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const login=await ctx.request.post('https://bobuy.cc/api/auth/login',{data:{username:credentials.username,password:credentials.password}});assert.equal(login.status(),200);const session=(await login.json()).data;assert(session.accessToken&&session.user);
 await ctx.addInitScript(s=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_access_token',s.accessToken);localStorage.setItem('bobbuy_auth_user',JSON.stringify(s.user));if(s.accessTokenExpiresAt)localStorage.setItem('bobbuy_access_token_expires_at',s.accessTokenExpiresAt);},session);
 const page=await observe(ctx);await page.goto('https://bobuy.cc/admin/products');const chooser=page.locator('.product-catalog-actions .ant-select').first();await chooser.waitFor();await chooser.click();await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();
 const drawer=page.locator('.ant-drawer-content-wrapper:visible [role=dialog]');
 await drawer.getByRole('tab',{name:'图片与来源',exact:true}).click();const group=drawer.locator('.catalog-upload-group');await group.waitFor();
 for(const width of [1440,320]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);await group.locator('button').scrollIntoViewIfNeeded();
  const native=group.locator('input[type=file]');assert.equal(await native.getAttribute('hidden'),'');
  assert.equal(await group.getByRole('button').count(),1);assert.equal(await drawer.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  const shot=resolve(out,`production-admin-gallery-${width}.png`);await page.screenshot({path:shot});
  await group.screenshot({path:resolve(out,`production-admin-gallery-crop-${width}.png`)});
  result.views.push({path:'admin/products Images & sources',width,nativeInputHidden:true,visibleUploadActions:1,noBusinessWrites:true,noOverflow:true});
 }
 await Promise.all(pending);
 const csrf=(await ctx.cookies()).find(cookie=>cookie.name==='bobbuy_csrf_token')?.value;assert(csrf);
 const logout=await ctx.request.post('https://bobuy.cc/api/auth/logout',{data:{},headers:{'X-BOBBUY-CSRF-TOKEN':decodeURIComponent(csrf),Authorization:'Bearer '+session.accessToken,Origin:'https://bobuy.cc'}});assert.equal(logout.status(),200);result.normalSessionLogout=true;await ctx.close();
 assert.deepEqual(result.console,[]);assert.deepEqual(result.network,[]);assert.deepEqual(result.blockedBusinessWrites,[]);assert.deepEqual(result.assetErrors,[]);result.result='PASS';
}finally{await browser.close();writeFileSync(resolve(out,'production-browser.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify({result:result.result,views:result.views,matchedAssets:Object.keys(result.assets).length,console:result.console,network:result.network}));
