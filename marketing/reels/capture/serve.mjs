import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2]; const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.ttf':'font/ttf','.svg':'image/svg+xml','.woff2':'font/woff2'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,p);
 if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');
 r.setHeader('content-type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(r);}).listen(8081,()=>console.log('up'));
