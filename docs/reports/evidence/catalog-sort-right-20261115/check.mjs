import {chromium} from '../../../../frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const out='docs/reports/evidence/catalog-sort-right-20261115';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const report={production:{},candidate:[],errors:[],network:[]};
const baseline=await browser.newPage({viewport:{width:1280,height:800}});
await baseline.goto('https://bobuy.cc/products');await baseline.locator('.catalog-sort-controls').waitFor();
report.production.url=baseline.url();report.production.assets=await baseline.locator('script[src],link[rel=stylesheet]').evaluateAll(es=>es.map(e=>e.src||e.href));
for(const url of report.production.assets){const r=await baseline.evaluate(async url=>{const r=await fetch(url);return {status:r.status,body:await r.text()};},url);report.production[url]={status:r.status,sha256:crypto.createHash('sha256').update(r.body).digest('hex')};}
await baseline.screenshot({path:`${out}/production-before-1280.png`});await baseline.close();
for(const width of [1280,390,767,375])for(const locale of ['zh-CN','zh-TW','en-US','ja-JP']){
const page=await browser.newPage({viewport:{width,height:width===390?844:800}});
await page.addInitScript(l=>localStorage.setItem('bobbuy_locale',l),locale);
page.on('pageerror',e=>report.errors.push({width,locale,text:e.message}));
page.on('console',m=>{if(m.type()==='error')report.errors.push({width,locale,text:m.text()});});
page.on('response',r=>{if(r.status()>=400)report.network.push({width,locale,url:r.url(),status:r.status()});});
await page.route('**/api/**',async route=>{const req=route.request();assert.equal(req.method(),'GET');const url=new URL(req.url());const {stdout}=await exec('curl',['-sS','--max-time','30','-w','\n%{http_code}','https://bobuy.cc'+url.pathname+url.search],{maxBuffer:10*1024*1024});const split=stdout.lastIndexOf('\n');await route.fulfill({status:Number(stdout.slice(split+1)),body:stdout.slice(0,split),contentType:'application/json'});});
await page.goto('http://localhost:5173/products');await page.locator('.catalog-sort-controls').waitFor();await page.locator('.catalog-master-heading>span').waitFor({timeout:30000});
const metrics=await page.locator('.catalog-sort-controls').evaluate(el=>{
const rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,right:r.right,width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,borderRadius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,backgroundColor:s.backgroundColor,boxShadow:s.boxShadow,marginLeft:s.marginLeft};};
return {group:rect(el),heading:rect(el.parentElement),controls:[...el.children].map(rect),overflow:document.documentElement.scrollWidth>innerWidth};});
assert.equal(metrics.overflow,false);assert(Math.abs(metrics.group.right-metrics.heading.right)<1.5);for(const m of metrics.controls){assert(m.height>=44);assert(m.right<=metrics.group.right+1);assert(m.x>=metrics.group.x-1);assert.equal(m.borderRadius,'8px');}assert(metrics.controls[0].y<=metrics.controls[1].y);
const button=page.locator('.marked-first-toggle'),select=page.locator('.catalog-sort-controls select');
const initial=await button.getAttribute('aria-pressed');await button.click();await assert.equal(await button.getAttribute('aria-pressed'),initial==='true'?'false':'true');await page.waitForURL(/markedFirst=/);
await select.selectOption('rating-desc');await page.waitForURL(/sort=rating-desc/);assert.equal(await select.inputValue(),'rating-desc');
await select.focus();await page.keyboard.press('Tab');assert(await button.evaluate(e=>e===document.activeElement));
const focus=await button.evaluate(e=>({outline:getComputedStyle(e).outline,focusVisible:e.matches(':focus-visible')}));assert(focus.focusVisible);
if([1280,390].includes(width)){await page.screenshot({path:`${out}/candidate-${locale}-${width}.png`});await page.locator('.catalog-master-heading').screenshot({path:`${out}/controls-${locale}-${width}.png`});}
await button.click();await page.waitForTimeout(100);report.candidate.push({width,locale,metrics,focus,url:page.url()});await page.close();}
fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({cases:report.candidate.length,errors:report.errors,network:report.network,production:report.production},null,2));
