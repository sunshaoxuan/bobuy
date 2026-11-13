import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('frontend/dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
http.createServer((req,res)=>{
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/media/')){
  const remote=https.get('https://bobuy.cc'+req.url,{headers:{'Accept-Language':req.headers['accept-language']??'zh-CN'}},upstream=>{res.writeHead(upstream.statusCode,{'Content-Type':upstream.headers['content-type']??'application/json','Cache-Control':'no-store'});upstream.pipe(res);});
  remote.on('error',()=>{res.writeHead(502);res.end();});return;
 }
 const candidate=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!candidate.startsWith(root+path.sep)&&candidate!==root){res.writeHead(403);res.end();return;}
 const file=fs.existsSync(candidate)&&fs.statSync(candidate).isFile()?candidate:path.join(root,'index.html');
 res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(4193,'127.0.0.1',()=>console.log('Candidate read-only server: http://127.0.0.1:4193'));
