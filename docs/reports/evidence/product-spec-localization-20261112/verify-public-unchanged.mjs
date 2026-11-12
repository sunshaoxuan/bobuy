import fs from 'node:fs';import crypto from 'node:crypto';
const dir='docs/reports/evidence/product-spec-localization-20261112';const before=JSON.parse(fs.readFileSync(dir+'/private/public-before.json')).items;
const after=[];for(let p=0;p<100;p++){const r=await fetch('https://bobuy.cc/api/storefront/product-catalog?page='+p);if(!r.ok)throw Error('HTTP '+r.status);const data=(await r.json()).data;after.push(...data.items);if(!data.hasNext)break;}
fs.writeFileSync(dir+'/private/public-after.json',JSON.stringify({at:new Date().toISOString(),items:after},null,2));
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const old=new Map(before.map(r=>[r.productId,r]));const different=after.filter(r=>canonical(r)!==canonical(old.get(r.productId))).map(r=>r.productId);
if(after.length!==before.length||different.length)throw Error(JSON.stringify({before:before.length,after:after.length,different}));
const receipt={at:new Date().toISOString(),result:'PASS',publicProducts:after.length,allPublicFieldsUnchanged:true,allHistoricalOffersUnchanged:true,sha256:crypto.createHash('sha256').update(canonical(after)).digest('hex')};fs.writeFileSync(dir+'/public-unchanged.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
