import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';
const out=path.resolve(process.cwd(),'../../reference-v23-acceptance');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
try{
 await page.goto('http://127.0.0.1:18080/admin/recommendations');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').tap();await page.waitForURL('**/admin/users');
 await page.goto((await fs.readFile(path.join(out,'ui-current-url.txt'),'utf8')).trim());await expect(page.locator('.rec-product')).toHaveCount(3);
 expect(await page.evaluate(()=>innerWidth)).toBe(390);expect(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches)).toBe(true);
 await page.getByRole('button',{name:/Withdraw/}).tap();const card=page.locator('.rec-product').first();await card.getByRole('button',{name:/^Edit item facts:/}).tap();await card.getByLabel('Conditions / source notes',{exact:true}).fill('SYNTHETIC mobile touch save and reopen');
 await Promise.all([page.waitForResponse(r=>r.request().method()==='PUT'&&/\/items\/\d+$/.test(new URL(r.url()).pathname)&&r.ok()),card.getByRole('button',{name:'Save item facts',exact:true}).tap()]);await page.reload();await expect(page.locator('.rec-product').first()).toContainText('SYNTHETIC mobile touch save and reopen');await expect(page.locator('.rec-product')).toHaveCount(3);
 await page.locator('.rec-product').first().getByRole('button',{name:'Reference quote revision history',exact:true}).tap();await expect(page.getByRole('dialog')).toContainText('100 JPY');await expect(page.getByRole('dialog')).toContainText('90 JPY');await page.getByRole('button',{name:'Close',exact:true}).tap();
 await page.screenshot({path:path.join(out,'app-mobile-touch.png'),fullPage:true});await fs.writeFile(path.join(out,'mobile-proof.json'),JSON.stringify({result:'PASS',width:390,height:844,isMobile:true,hasTouch:true,normalLogin:true,uiTouchSaveReopen:true,retainedHistory:true,isolatedSyntheticDatabase:true},null,2));console.log('Real mobile touch UI save/reopen and retained history PASS');
}catch(e){await fs.writeFile(path.join(out,'mobile-failure.txt'),String(e)+'\n'+(await page.locator('body').innerText()).slice(-12000));console.error(String(e));process.exitCode=1;}finally{await browser.close();}
