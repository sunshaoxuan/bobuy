import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=new URL('../docs/reports/evidence/recommendation-writing/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_access_token','synthetic-local-only');localStorage.setItem('bobbuy_auth_user',JSON.stringify({id:1000,username:'synthetic',name:'Synthetic merchant',roles:['AGENT']}));});
const page=await context.newPage(),calls=[];let writes=0;
const detail={post:{id:4,title:'Synthetic local review',published:false,version:1},body:'Original article retained',items:[]};
await page.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;let data=[];
 if(path==='/api/auth/me')data={id:1000,username:'synthetic',name:'Synthetic merchant',roles:['AGENT']};
 else if(path==='/api/merchant/recommendations/4'){data=detail;if(req.method()!=='GET')writes++;}
 else if(path==='/api/merchant/recommendation-taxonomy')data={categories:[],suppliers:[]};
 else if(path==='/api/ai/recommendation-writing'){const input=req.postDataJSON();calls.push(input);data={step:input.step,text:input.step==='intent'?'Audience: busy families. Tone: practical.':input.step==='prompt'?'Write a factual recommendation; unknown dates stay unknown.':'A synthetic recommendation for busy families.',provider:'synthetic-fixture',model:'mock'};}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',data})});
});
const report={scope:'Real local Chrome UI, synthetic API fixtures; not real AI success or production writes',checks:{}};
try{
 await page.goto('http://127.0.0.1:4173/admin/recommendations?post=4');
 const assistant=page.locator('.rec-writing-assistant');await assistant.waitFor();
 assert.equal(await page.locator('details.rec-advanced[open]').count(),0);
 await assistant.getByLabel('What would you like to recommend?').fill('Weekend groceries for families');await assistant.getByRole('button',{name:'Clarify my idea',exact:true}).click();
 await assistant.getByDisplayValue?.('Audience: busy families. Tone: practical.');
 await assistant.locator('#rec-writing-brief').waitFor();assert(await assistant.getByRole('button',{name:'Help write the prompt',exact:true}).isDisabled());
 await assistant.getByRole('checkbox',{name:'I confirm this brief',exact:true}).check();await assistant.getByRole('button',{name:'Help write the prompt',exact:true}).click();await assistant.locator('#rec-writing-prompt').waitFor();
 await assistant.getByRole('checkbox',{name:'I confirm this writing prompt',exact:true}).check();await assistant.locator('#rec-writing-prompt').fill('Edited prompt: only reviewed facts.');assert(await assistant.getByRole('button',{name:'Generate article',exact:true}).isDisabled());
 await assistant.getByRole('checkbox',{name:'I confirm this writing prompt',exact:true}).check();await assistant.getByRole('button',{name:'Generate article',exact:true}).click();await assistant.locator('#rec-writing-draft').waitFor();
 assert.equal(await page.locator('#rec-body').inputValue(),'Original article retained');
 await assistant.getByRole('button',{name:'Use in editor (not saved)',exact:true}).click();assert.equal(await page.locator('#rec-body').inputValue(),'A synthetic recommendation for busy families.');assert.equal(writes,0);assert.deepEqual(calls.map(c=>c.step),['intent','prompt','draft']);
 await assistant.scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('desktop.png',out)),animations:'disabled'});report.checks.threeConfirmationsAndNoAutosave='PASS';
 await page.setViewportSize({width:390,height:844});await assistant.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('mobile.png',out)),animations:'disabled'});report.checks.mobileNoOverflow='PASS';report.result='PASS';
}catch(e){report.result='FAIL';report.error=String(e);await page.screenshot({path:fileURLToPath(new URL('failure.png',out))}).catch(()=>{});throw e;}finally{writeFileSync(new URL('browser.json',out),JSON.stringify({...report,calls,writes},null,2));await browser.close();console.log(JSON.stringify(report));}
