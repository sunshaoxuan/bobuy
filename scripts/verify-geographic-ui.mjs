// Real built UI and candidate API on an isolated local H2 runtime.
import {createRequire} from 'node:module';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'frontend/package.json'));
const {chromium}=require('@playwright/test');
const out=path.join(root,'docs/reports/evidence/geographic-master-20261112');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
const consoleErrors=[],requests=[],failed=[];
page.on('pageerror',e=>consoleErrors.push(e.message));
page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
page.on('response',r=>{requests.push({url:r.url(),status:r.status()});if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
await page.addInitScript(()=>{
 localStorage.setItem('bobbuy_test_role','AGENT');
 if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','zh-CN');
});
async function choose(field,code,label){
 const input=page.getByRole('combobox',{name:field,exact:true});
 await input.locator('xpath=ancestor::div[contains(@class,"ant-select-selector")]').click();await input.fill(code);
 await page.locator('.ant-select-dropdown:visible').getByTitle(label,{exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'));
}
const geometry=[];
async function capture(label,width){
 await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0);await page.waitForTimeout(350);
 const overflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert(overflow.scroll<=overflow.viewport,JSON.stringify(overflow));
 const pagination=await page.evaluate(()=>{
  const boxes=[...document.querySelectorAll('.geographic-master .ant-pagination>li')].map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
  return {hotAreas:boxes.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),centers:boxes.map(r=>r.y+r.height/2),gaps:boxes.slice(1).map((r,i)=>r.left-boxes[i].right)};
 });
 if(pagination.centers.length)assert(Math.max(...pagination.centers)-Math.min(...pagination.centers)<=1,'Pagination wrapped to multiple rows');
 assert(pagination.gaps.every(gap=>gap>=6),'Pagination hot-area gap below 6px');
 assert(pagination.hotAreas.every(box=>box.width>=44&&box.height>=44),'Pagination hot area below 44px');
 const whole=path.join(out,label+'-whole.png');await page.screenshot({path:whole,fullPage:true});
 await page.screenshot({path:path.join(out,label+'-viewport.png')});
 await page.locator('.geo-selectors').screenshot({path:path.join(out,label+'-selectors.png')});
 geometry.push({label,width,overflow,pagination,scrollY:await page.evaluate(()=>scrollY),controls:await page.evaluate(()=>{
  const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height});
  return [...document.querySelectorAll('.geo-selectors .ant-select,.geo-heading button,.geographic-master .ant-pagination-item,.geographic-master .ant-pagination-prev,.geographic-master .ant-pagination-next')].map(el=>{
   const inner=el.querySelector('.ant-select-selector')??el;
   const text=el.querySelector('.ant-select-selection-item,.ant-select-selection-placeholder')??(el.matches('button')?el.querySelector('span:last-child'):el.querySelector('a'));
   const style=text&&getComputedStyle(text);
   const canvas=document.createElement('canvas').getContext('2d');
   let glyph=null;
   if(canvas&&style&&text?.textContent){canvas.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const m=canvas.measureText(text.textContent);glyph={text:text.textContent,font:canvas.font,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent,left:m.actualBoundingBoxLeft,right:m.actualBoundingBoxRight};}
   const range=document.createRange();if(text)range.selectNodeContents(text);
   return {role:el.classList.contains('ant-select')?'select':'button',text:text?.textContent??'',textColor:style?.color,backgroundColor:getComputedStyle(inner).backgroundColor,hotArea:rect(el.getBoundingClientRect()),background:rect(inner.getBoundingClientRect()),textLayout:text?rect(range.getBoundingClientRect()):null,canvasGlyphMetrics:glyph};
  });
 })});
 return {label,whole,sha256:createHash('sha256').update(await readFile(whole)).digest('hex')};
}
let result,longestCountry;
try{
 await page.goto('http://127.0.0.1:14173/admin/basic-data/geographic-areas');
 await page.getByRole('heading',{name:'国家/地区档案',exact:true}).waitFor();
 await page.getByRole('cell',{name:'東京都',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'国家/地区档案',exact:true}).count(),1);
 assert.match(await page.locator('.geographic-master h2').innerText(),/47/);
 const shots=[];
 shots.push(await capture('desktop-japan',1440));
 await choose('省县','JP-13','東京都 (JP-13)');
 await page.getByRole('cell',{name:'千代田区',exact:true}).waitFor();
 await choose('市/区','JP-13101','千代田区 (JP-13101)');
 assert.match(await page.locator('.geo-selection').innerText(),/日本 \/ 東京都 \/ 千代田区/);
 shots.push(await capture('desktop-tokyo',1440));shots.push(await capture('mobile-tokyo',360));
 await choose('省县','JP-01','北海道 (JP-01)');
 await choose('市/区','JP-01101','札幌市中央区 (JP-01101)');
 assert.match(await page.locator('.geo-selection').innerText(),/北海道 \/ 札幌市中央区/);
 shots.push(await capture('mobile-ward',360));
 await page.locator('.ant-pagination-next').click();
 await page.waitForFunction(()=>document.querySelector('.ant-pagination-item-active')?.textContent==='2');
 await choose('省县','JP-19','山梨県 (JP-19)');
 await choose('市/区','JP-19430','南都留郡富士河口湖町 (JP-19430)');
 if(await page.locator('.ant-pagination-item-active').count())assert.equal(await page.locator('.ant-pagination-item-active').innerText(),'1');
 shots.push(await capture('mobile-long-municipality',360));
 await choose('国家/地区','US','美国 (US)');
 await page.getByText('该国家/地区目前仅预制国家级档案。',{exact:true}).waitFor();
 assert.equal(await page.getByRole('combobox',{name:'省县',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('combobox',{name:'市/区',exact:true}).isDisabled(),true);
 assert.doesNotMatch(await page.locator('.geo-selection').innerText(),/北海道|札幌/);
 shots.push(await capture('mobile-country-only',360));
 await page.locator('.geo-heading button').click();
 await page.getByText('该国家/地区目前仅预制国家级档案。',{exact:true}).waitFor();
 await page.reload();await page.getByRole('cell',{name:'東京都',exact:true}).waitFor();
 assert.match(await page.locator('.geo-selection').innerText(),/日本/);
 for(const [locale,field] of [['ja-JP','国・地域'],['en-US','Country/region'],['zh-TW','國家/地區']]){
  await page.evaluate(locale=>localStorage.setItem('bobbuy_locale',locale),locale);
  await page.reload();await page.getByRole('cell',{name:'東京都',exact:true}).waitFor();
  if(locale==='en-US'){
   longestCountry=await page.evaluate(async()=>{
    const rows=(await (await fetch('/api/storefront/geographic-areas')).json()).data;
    const names=new Intl.DisplayNames(['en-US'],{type:'region'}),canvas=document.createElement('canvas').getContext('2d');
    canvas.font=getComputedStyle(document.querySelector('.geo-selectors .ant-select-selection-item')).font;
    return rows.map(row=>({code:row.code,label:`${names.of(row.code)} (${row.code})`})).map(row=>({...row,width:canvas.measureText(row.label).width})).sort((a,b)=>b.width-a.width)[0];
   });
   const input=page.getByRole('combobox',{name:field,exact:true});
   await input.locator('xpath=ancestor::div[contains(@class,"ant-select-selector")]').click();await input.fill(longestCountry.code);
   await page.locator('.ant-select-dropdown:visible').getByTitle(longestCountry.label,{exact:true}).click();
   await page.getByText('Only country-level reference data is currently provided for this country/region.',{exact:true}).waitFor();
  }
  shots.push(await capture(locale+'-mobile',360));shots.push(await capture(locale+'-desktop',1440));
 }
 assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));
 assert.equal(failed.length,0,JSON.stringify(failed));
 result={result:'PASS',scope:'Local built candidate, real API, isolated H2 reference dataset; local synthetic merchant role',shots,geometry,longestCountry,functional:{japan47:true,tokyoSelection:true,wardQualified:true,parentClearsChildren:true,countryOnly:true,reload:true,refresh:true},consoleErrors,failed,requests};
}catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});result={result:'FAIL',error:String(error),consoleErrors,failed,requests,geometry};throw error;}
finally{await writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));await browser.close();}
