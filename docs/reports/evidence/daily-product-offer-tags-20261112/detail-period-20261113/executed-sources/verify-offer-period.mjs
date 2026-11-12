import {createRequire} from 'node:module';import fs from 'node:fs';const require=createRequire(new URL('../frontend/package.json',import.meta.url));const {chromium}=require('@playwright/test');
const base=process.argv[2]||'http://127.0.0.1:15175',kind=process.argv[3]||'local',out='docs/reports/evidence/daily-product-offer-tags-20261112/detail-period-20261113/'+kind;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage(),errors=[],network=[],measurements=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)network.push({url:r.url(),status:r.status()});});
try{
await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
for(const width of [1440,360]){
 await page.setViewportSize({width,height:width===360?800:1080});await page.goto(base+'/products');
 await page.locator('.compact-product-card').filter({has:page.locator('.product-marker-badge',{hasText:'惠'})}).first().locator('.product-name').click();
 const dialog=page.locator('.catalog-master-detail:visible'),period=dialog.locator('.product-marker-period');await period.waitFor();if(!(await period.innerText()).includes('JST'))throw Error('Missing canonical promotion range');
 await page.screenshot({path:out+'/detail-'+width+'.png',animations:'disabled'});await dialog.locator('.product-marker-badges').screenshot({path:out+'/period-'+width+'.png',animations:'disabled'});
 const result=await period.evaluate(e=>{const p=e.getBoundingClientRect(),b=e.closest('li').querySelector('.product-marker-badge').getBoundingClientRect(),s=getComputedStyle(e),range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();return {text:e.textContent,fontSize:s.fontSize,lineHeight:s.lineHeight,period:[p.x,p.y,p.width,p.height],badge:[b.x,b.y,b.width,b.height],textBox:[t.x,t.y,t.width,t.height],gap:p.x-b.right,centerError:Math.abs((p.y+p.height/2)-(b.y+b.height/2)),viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};});
 if(result.overflow||result.gap<8||result.centerError>2)throw Error('Period layout violates fixed budget');measurements.push({width,...result});
}
if(errors.length||network.length)throw Error(JSON.stringify({errors,network}));
fs.writeFileSync(out+'/acceptance.json',JSON.stringify({result:'PASS',data:'read-only current production catalog and canonical documents',errors,network,measurements},null,2));console.log(JSON.stringify({result:'PASS',measurements}));
}finally{await browser.close();}
