import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(path.resolve('frontend/node_modules/@playwright/test'));
const out=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
const result={reason:'Gemini flagged content showing through fixed mobile navigation; compare unchanged baseline and scroll reachability',states:[]};
try{
 for(const [name,base] of [['baseline','https://bobuy.cc'],['candidate','http://127.0.0.1:4193']]){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});await context.route('**/api/**',route=>route.request().method()==='GET'?route.continue():route.abort());
  const page=await context.newPage();await page.goto(base+'/products');await page.locator('.compact-product-card').first().waitFor();await page.waitForFunction(()=>!document.querySelector('.catalog-progress'));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
  await page.screenshot({path:path.join(out,name+'-mobile-top.png')});
  const state=await page.evaluate(()=>({nav:[...document.querySelectorAll('nav')].map(node=>({class:node.className,background:getComputedStyle(node).background,position:getComputedStyle(node).position,rect:node.getBoundingClientRect().toJSON()})),bodyPadding:getComputedStyle(document.body).paddingBottom,scrollHeight:document.documentElement.scrollHeight}));
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(350);await page.screenshot({path:path.join(out,name+'-mobile-bottom.png')});
  result.states.push({name,...state,bottom:await page.evaluate(()=>({scrollY,nav:[...document.querySelectorAll('nav')].filter(node=>getComputedStyle(node).position==='fixed').map(node=>node.getBoundingClientRect().toJSON())}))});await context.close();
 }
 fs.writeFileSync(path.join(out,'visual-baseline.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
