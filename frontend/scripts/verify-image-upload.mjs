// Synthetic browser regression; no network, login, business data or local-file page.
import {chromium} from '@playwright/test';
import {transform} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture = name => readFile(new URL('../e2e/fixtures/'+name,import.meta.url));
const code = (await transform(await readFile(new URL('../src/imageUpload.ts',import.meta.url),'utf8'),{loader:'ts',format:'iife',globalName:'imageUpload'})).code;
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600});
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><input id="pick" type="file" accept="image/png,image/jpeg,image/webp,image/avif"><output id="result"></output>');
  assert.equal(await page.evaluate(()=>window.innerWidth),viewport.width);
  await page.addScriptTag({content:code});
  await page.addScriptTag({content:`window.outputs=[];document.querySelector('#pick').onchange=async(event)=>{try{const source=event.target.files[0];const prepared=await imageUpload.prepareImageUpload(source);const original=await createImageBitmap(source),converted=await createImageBitmap(prepared);const pixels=(image)=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);return x.getImageData(0,0,c.width,c.height).data;};const a=pixels(original),b=pixels(converted);const bytes=Array.from(new Uint8Array(await prepared.arrayBuffer()));const result={name:prepared.name,type:prepared.type,width:converted.width,height:converted.height,equal:a.length===b.length&&a.every((v,i)=>v===b[i]),bytes};window.outputs.push(result);original.close();converted.close();document.querySelector('#result').textContent='PASS';}catch(error){document.querySelector('#result').textContent=error.message;}};`});
  for(const format of ['webp','avif']){
   const buffer=await fixture('upload-synthetic.'+format);
   for(const name of ['synthetic.'+format,'renamed.'+format]){
    await page.locator('#result').evaluate(el=>el.textContent='');
    await page.locator('#pick').setInputFiles({name,mimeType:'image/'+format,buffer});
    await page.waitForFunction(()=>document.querySelector('#result').textContent!=='');
    assert.equal(await page.locator('#result').textContent(),'PASS');
   }
   const [first,second]=await page.evaluate(()=>window.outputs.slice(-2));
   assert.equal(first.type,'image/png');assert.equal(first.width,128);assert.equal(first.height,96);assert.equal(first.equal,true);assert.deepEqual(first.bytes,second.bytes);
   results.push({viewport,format,dimensions:'128x96',decodedPixelsEqual:true,renamedBytesEqual:true,bytes:first.bytes.length});
   if(viewport.width===1440&&format==='avif')await writeFile(new URL('../../backend/src/test/resources/synthetic-converted.png',import.meta.url),Buffer.from(first.bytes));
  }
  const negatives=await page.evaluate(async()=>{
   const attempt=async(file)=>{try{await imageUpload.prepareImageUpload(file);return 'UNEXPECTED_PASS';}catch(e){return e.message;}};
   const valid=new File([new Uint8Array(window.outputs[0].bytes)],'same.png',{type:'image/png'});
   const mismatch=new File([await valid.arrayBuffer()],'forged.webp',{type:'image/webp'});
   return {samePng:await imageUpload.prepareImageUpload(valid)===valid,forged:await attempt(mismatch),corrupt:await attempt(new File(['not an image'],'fake.avif',{type:'image/avif'})),oversize:await attempt(new File([new Uint8Array(8*1024*1024+1)],'large.png',{type:'image/png'}))};
  });
  assert.deepEqual(negatives,{samePng:true,forged:'gallery.invalid',corrupt:'gallery.invalid',oversize:'gallery.invalid'});
  results.push({viewport,negativeCases:negatives});await page.close();
 }
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
 await writeFile(new URL('../test-results/image-upload-browser.json',import.meta.url),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
