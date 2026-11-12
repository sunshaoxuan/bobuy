import {chromium} from './frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const base=process.argv[2]||'http://localhost:5178';const kind=base.startsWith('https')?'production':'local';
const out=path.resolve('docs/reports/evidence/home-brand-text-20261113',kind);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Users/X02851/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe',headless:true});const rows=[];
try{for(const width of [1440,360]){
 const page=await browser.newPage({viewport:{width,height:950},deviceScaleFactor:1});const errors=[],network=[],cancelled=[];
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)network.push({url:r.url(),status:r.status()});});page.on('requestfailed',r=>{const x={url:r.url(),error:r.failure()?.errorText};(x.error==='net::ERR_ABORTED'?cancelled:network).push(x);});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.browse-search').waitFor();await page.waitForLoadState('networkidle');
 await page.screenshot({path:path.join(out,`home-${width}.png`)});
 if(width===1440)await page.screenshot({path:path.join(out,'home-whole-1440.png'),fullPage:true});
 if(width===360){await page.locator('.browse-menu-toggle').click();await page.locator('.browse-drawer .browse-brand').waitFor();await page.waitForTimeout(350);await page.screenshot({path:path.join(out,'menu-360.png')});}
 const brand=page.locator(width===1440?'.browse-sidebar .browse-brand':'.browse-drawer .browse-brand');
 await brand.screenshot({path:path.join(out,`brand-${width}.png`)});
 const geometry=await brand.evaluate(el=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {link:rect(el),mark:rect(el.querySelector('.browse-brand-mark')),label:rect(el.querySelector('.browse-brand-label')),name:rect(el.querySelector('strong')),domain:rect(el.querySelector('.browse-brand-domain')),padding:getComputedStyle(el).padding,href:el.getAttribute('href'),overflow:document.documentElement.scrollWidth>innerWidth};});
 if(!geometry||geometry.domain.x<=geometry.mark.x+geometry.mark.width||geometry.domain.y<geometry.name.y+geometry.name.height||Math.abs(geometry.domain.x-geometry.name.x)>2||geometry.link.height<44||geometry.overflow)throw Error('Name-column layout failed');
 // Negative example from the rejected screenshot has domain in the whole-logo row.
 const old={...geometry,domain:{...geometry.domain,x:geometry.mark.x+28,y:geometry.mark.y+geometry.mark.height+4}};
 if(old.domain.x>old.mark.x+old.mark.width&&Math.abs(old.domain.x-old.name.x)<=2)throw Error('Old layout was not rejected');
 await brand.click();if(width===360)await page.locator('.browse-drawer').waitFor({state:'hidden'});
 if(new URL(page.url()).pathname!=='/')throw Error('Home link failed');
 const assets=[];if(kind==='production'){
  const urls=await page.locator('script[type="module"][src],link[rel="stylesheet"][href]').evaluateAll(nodes=>nodes.map(n=>n.src||n.href));
  for(const url of urls){const u=new URL(url);if(u.origin!==new URL(base).origin||!u.pathname.startsWith('/assets/'))continue;const r=await page.request.get(url);if(!r.ok())throw Error('Asset failed');const sha=createHash('sha256').update(await r.body()).digest('hex');if(sha!==createHash('sha256').update(fs.readFileSync(path.resolve('frontend/dist'+u.pathname))).digest('hex'))throw Error('Asset source mismatch');assets.push({path:u.pathname,sha256:sha});}
  if(assets.length<2)throw Error('Asset evidence missing');
 }
 rows.push({width,geometry,errors,network,cancelled,assets,brandHome:true,oldLayoutRejected:true});await page.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({base,rows},null,2));console.log(JSON.stringify(rows.map(r=>({width:r.width,errors:r.errors,network:r.network,geometry:r.geometry})),null,2));
