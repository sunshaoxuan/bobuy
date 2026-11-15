import {chromium} from '../../../../frontend/node_modules/@playwright/test/index.mjs';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import fs from 'node:fs';
const exec=promisify(execFile),out='docs/reports/evidence/catalog-sort-right-20261115';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const width of [1280,390]){
 const p=await browser.newPage({viewport:{width,height:width===390?844:800}});await p.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
 await p.route('**/api/**',async route=>{const req=route.request();if(req.method()!=='GET')throw Error('Unexpected write');const url=new URL(req.url());const {stdout}=await exec('curl',['-sS','--max-time','30','-w','\n%{http_code}','https://bobuy.cc'+url.pathname+url.search],{maxBuffer:10*1024*1024});const split=stdout.lastIndexOf('\n');await route.fulfill({status:Number(stdout.slice(split+1)),body:stdout.slice(0,split),contentType:'application/json'});});
 await p.goto('http://localhost:5173/products');await p.locator('.catalog-master-heading>span').waitFor();await p.locator('.catalog-master-card').first().waitFor();await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{})));});
 await p.screenshot({path:`${out}/final-loaded-${width}.png`});await p.locator('.catalog-master-heading').screenshot({path:`${out}/final-controls-${width}.png`});await p.close();}
await browser.close();console.log('Loaded default-state captures complete');
