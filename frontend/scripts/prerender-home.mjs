import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const title='宝宝败 Bobuy | 随行好物';
export const description='宝宝败（Bobuy）独立整理日本 Costco 商品资料与优惠资讯，提供行程购物入口。浏览好物推荐与可预订行程，认准官方网站 bobuy.cc。';
export function renderHome(index){
 if(!/<div id="root"><\/div>/.test(index)||/<link[^>]+rel=["']canonical/i.test(index))throw Error('Unexpected SPA template; do not canonicalize every route');
 const graph={'@context':'https://schema.org','@graph':[{'@type':'WebSite','@id':'https://bobuy.cc/#website',url:'https://bobuy.cc/',name:'宝宝败',alternateName:'Bobuy',publisher:{'@id':'https://bobuy.cc/#organization'}},{'@type':'Organization','@id':'https://bobuy.cc/#organization',name:'宝宝败',alternateName:'Bobuy',url:'https://bobuy.cc/'}]};
 return index.replace(/<html lang="[^"]+">/,'<html lang="zh-CN">').replace(/<title>[^<]*<\/title>/,`<title>${title}</title>`).replace('</head>',`<meta name="description" content="${description}" />\n<link rel="canonical" href="https://bobuy.cc/" />\n<script type="application/ld+json" id="bobuy-home-structured-data">${JSON.stringify(graph)}</script>\n</head>`).replace('<div id="root"></div>','<div id="root"><header><a href="/" aria-label="宝宝败 Bobuy 首页"><strong>宝宝败 Bobuy</strong><br><small>bobuy.cc</small></a></header><nav aria-label="主导航"><a href="/recommendations">浏览好物推荐</a> · <a href="/products">浏览本程好物</a> · <a href="/trips">查看可预订行程</a></nav><main></main></div>');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){fs.writeFileSync('dist/home.html',renderHome(fs.readFileSync('dist/index.html','utf8')));console.log('Generated home-only crawlable HTML; SPA detail/admin template retains no shared home canonical.');}
