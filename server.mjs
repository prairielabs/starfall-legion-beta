import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';

const root=resolve(import.meta.dirname,'dist');
const port=Number(process.env.PORT||8080);
const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mp3':'audio/mpeg','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.wav':'audio/wav'};

const server=http.createServer(async(request,response)=>{
 try{
  const url=new URL(request.url,'http://localhost');
  const pathname=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file=resolve(root,pathname);
  if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403);response.end('Forbidden');return;}
  const body=await readFile(file);
  response.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; media-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
  response.end(body);
 }catch(error){response.writeHead(error?.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'});response.end(error?.code==='ENOENT'?'Not found':'Server error');}
});

server.listen(port,'127.0.0.1',()=>console.log(`Starfall Legion: http://localhost:${port}`));
