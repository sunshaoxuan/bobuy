import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(path.join(root,'frontend/package.json'))('@playwright/test');
let input='';for await(const part of process.stdin)input+=part;const secret=JSON.parse(input);input='';
const candidate=process.argv.includes('--candidate');
const out=path.join(root,'docs/reports/evidence/geographic-master-20261112/production/nav-'+(candidate?'candidate':'final'));await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[],failed=[],telemetry=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
page.on('requestfailed',r=>{const item={url:r.url(),error:r.failure()?.errorText};if(new URL(r.url()).pathname==='/cdn-cgi/rum'&&item.error==='net::ERR_ABORTED')telemetry.push(item);else failed.push(item);});
await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const css=(await readFile(path.join(root,'frontend/src/merchant.css'),'utf8')).split(/\r?\n/).filter(row=>row.startsWith('.merchant-sidebar>')).join('\n');
if(candidate)page.on('domcontentloaded',()=>page.addStyleTag({content:css}).catch(()=>{}));
let result;
try{
 await page.goto('https://bobuy.cc/admin');await page.locator('input[autocomplete="username"]').fill(secret.username);await page.locator('input[autocomplete="current-password"]').fill(secret.password);await page.locator('button[type="submit"]').click();await page.locator('.merchant-sidebar').waitFor();await page.waitForLoadState('networkidle');secret.username='';secret.password='';
 await page.getByRole('link',{name:'国家/地区档案',exact:true}).click();await page.getByRole('cell',{name:'東京都',exact:true}).waitFor();
 const states=[];
 for(const height of [1000,800]){
  await page.setViewportSize({width:1440,height});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  const menu=page.locator('.merchant-sidebar>.ant-menu');await menu.hover();await page.mouse.wheel(0,-10000);await page.waitForFunction(()=>document.querySelector('.merchant-sidebar>.ant-menu').scrollTop===0);
  await page.mouse.wheel(0,10000);await page.waitForFunction(()=>document.querySelector('.merchant-sidebar>.ant-menu').scrollTop>0);
  await page.getByRole('link',{name:'国家/地区档案',exact:true}).scrollIntoViewIfNeeded();
  const state=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};const side=document.querySelector('.merchant-sidebar'),menu=side.querySelector(':scope>.ant-menu'),item=menu.querySelector('.ant-menu-item-selected');return{viewport:{width:innerWidth,height:innerHeight},sidebar:rect(side),identity:rect(side.querySelector('.merchant-identity')),menu:rect(menu),selected:rect(item),scrollTop:menu.scrollTop,scrollHeight:menu.scrollHeight,clientHeight:menu.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert(state.identity.bottom<=height&&state.identity.y>=0,'Identity outside viewport');assert(state.selected.y>=state.menu.y&&state.selected.bottom<=state.menu.bottom,'Selected item clipped');assert(!state.overflow);assert(state.selected.height>=44);
  await page.mouse.move(1300,100);await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'desktop-'+height+'-whole.png'),fullPage:true});await page.locator('.merchant-sidebar').screenshot({path:path.join(out,'sidebar-'+height+'.png')});states.push(state);
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(failed.length,0,JSON.stringify(failed));result={result:'PASS',candidateCssInjected:candidate,states,errors,failed,telemetry};
}catch(error){let message=String(error);for(const value of [secret.username,secret.password].filter(Boolean))message=message.split(value).join('[redacted]');result={result:'FAIL',error:message,errors,failed,telemetry};throw new Error(message);}
finally{if(await page.locator('.merchant-header-logout').count()){await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/logout'&&r.status()===200),page.locator('.merchant-header-logout').click()]).catch(()=>{});}await writeFile(path.join(out,'acceptance.json'),JSON.stringify(result,null,2));await browser.close();}
