import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';import {renderHome,title,description} from './prerender-home.mjs';
test('initial home HTML supplies truthful brand, canonical, structured data, H1 and crawlable public links',()=>{
 const input=fs.readFileSync('index.html','utf8'),html=renderHome(input),d=new JSDOM(html).window.document;
 assert.equal(d.title,title);assert.equal(d.querySelector('meta[name="description"]').content,description);assert.equal(d.querySelector('link[rel="canonical"]').href,'https://bobuy.cc/');assert.equal(d.querySelectorAll('h1').length,1);assert.match(d.querySelector('h1').textContent,/宝宝败 Bobuy/);
 const graph=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent)['@graph'];assert.equal(graph[0].name,'宝宝败');assert.equal(graph[0].alternateName,'Bobuy');assert.ok(!graph.some(x=>x.address||x.telephone||x.legalName));
 assert.equal(d.querySelectorAll('nav').length,1);assert.equal(d.querySelectorAll('main section nav').length,0);assert.deepEqual([...d.querySelectorAll('nav a')].map(x=>x.getAttribute('href')),['/recommendations','/products','/trips']);assert.ok(!/canonical/.test(input));assert.equal(d.querySelectorAll('script[type="module"]').length,1);
});
test('sitemap exposes only verified public entry URLs and robots advertises the real XML endpoint',()=>{
 const d=new JSDOM(fs.readFileSync('public/sitemap.xml','utf8'),{contentType:'application/xml'}).window.document;
 assert.equal(d.documentElement.namespaceURI,'http://www.sitemaps.org/schemas/sitemap/0.9');assert.deepEqual([...d.querySelectorAll('loc')].map(e=>e.textContent),['https://bobuy.cc/','https://bobuy.cc/recommendations','https://bobuy.cc/products','https://bobuy.cc/trips']);
 assert.match(fs.readFileSync('public/robots.txt','utf8'),/^Sitemap: https:\/\/bobuy.cc\/sitemap.xml$/m);
});
test('an already canonicalized SPA template is rejected instead of overwriting detail/private metadata',()=>assert.throws(()=>renderHome('<link rel="canonical" href="https://elsewhere"><div id="root"></div>')));
