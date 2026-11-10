// Isolated real-component UI fixture; no backend, auth, source images or network.
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{I18nProvider}from'./src/i18n';import{FactsForm,OfferInfo}from'./src/components/RecommendationFacts';function App(){const[f,set]=React.useState({name:'SYNTHETIC',itemNumber:'FIXTURE',referencePrice:100,offerEnd:'2026-11-08'});return <I18nProvider><FactsForm facts={f} onChange={set}/><div id="proof"><OfferInfo facts={f} today="2026-11-03"/></div></I18nProvider>};createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const browser=await chromium.launch({headless:true,channel:'msedge'});const results=[];
try{for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
 const page=await browser.newPage({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});let network=0;
 await page.route('**/*',async route=>{if(route.request().url()==='https://bobuy-ui-fixture.invalid/')await route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'});else{network++;await route.abort();}});
 await page.goto('https://bobuy-ui-fixture.invalid/');await page.evaluate(()=>localStorage.setItem('bobbuy_locale','en-US'));await page.addScriptTag({content:bundle.outputFiles[0].text});
 assert.equal(await page.evaluate(()=>innerWidth),viewport.width);
 await page.getByText('Quote source and campaign window',{exact:true}).click();
 await page.getByLabel('Campaign start date',{exact:true}).fill('2026-11-02');
 await page.getByLabel('Date evidence URL',{exact:true}).fill('https://www.costco.co.jp/source');
 await page.getByLabel('Original window applicability evidence',{exact:true}).fill('Header explicitly applies to this item');
 await page.getByRole('checkbox',{name:'I verified this campaign window explicitly applies to this item',exact:true}).check();
 await page.locator('#proof').getByText(/2026-11-02/).waitFor();assert.match(await page.locator('#proof').innerText(),/2026-11-08/);
 await page.getByLabel('Offer starts',{exact:true}).count().then(async count=>{if(count)await page.getByLabel('Offer starts',{exact:true}).fill('2026-11-04');else await page.locator('input[type=date]').first().fill('2026-11-04');});
 await page.locator('#proof').getByText(/2026-11-04/).waitFor();
 await page.locator('input[type=date]').first().fill('');await page.getByRole('checkbox',{name:'I verified this campaign window explicitly applies to this item',exact:true}).uncheck();
 await page.getByRole('checkbox',{name:'Item, campaign header and footnotes checked; no start evidence found',exact:true}).check();
 assert.match(await page.locator('#proof').innerText(),/？/);assert.equal(network,0);
 results.push({viewport,actualWidth:await page.evaluate(()=>innerWidth),inherited:true,itemWins:true,unknownQuestionMark:true,networkRequests:network});
 await page.close();
 }await mkdir('test-results',{recursive:true});await writeFile('test-results/reference-window-browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
