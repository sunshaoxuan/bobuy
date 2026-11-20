import http from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join,extname,resolve} from 'node:path';
const roots={5178:'/workspace/scratch/mobile-compact-built'};
for(const [port,root] of Object.entries(roots))http.createServer((req,res)=>{
 if(req.url.startsWith('/api/')){const upstream=http.request({hostname:'127.0.0.1',port:18080,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:18080',origin:'http://127.0.0.1:18080',referer:'http://127.0.0.1:18080/'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;}
 let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+'/')||!existsSync(path)||!statSync(path).isFile())path=join(root,'index.html');
 res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(path));
}).listen(Number(port),'127.0.0.1',()=>console.log('Serving isolated build on',port));
