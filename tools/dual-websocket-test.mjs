import assert from 'node:assert/strict'
import http from 'node:http'
import {once} from 'node:events'
import {handleApiUpgrade} from '../server/api-mode.ts'
const peers=new Set(),calls=[]
async function upstream(mode){const s=http.createServer();s.on('upgrade',(req,socket)=>{peers.add(socket);socket.on('close',()=>peers.delete(socket));calls.push({mode,path:req.url,headers:req.headers});socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')});s.listen(0,'127.0.0.1');await once(s,'listening');return s}
const v1=await upstream('v1'),v3=await upstream('v3'),env={VITE_API_V1_TARGET:`http://127.0.0.1:${v1.address().port}`,VITE_API_V3_TARGET:`http://127.0.0.1:${v3.address().port}`}
const proxy=http.createServer();proxy.on('upgrade',(req,socket,head)=>handleApiUpgrade(req,socket,head,env));proxy.listen(0,'127.0.0.1');await once(proxy,'listening')
async function upgrade(path,mode){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:proxy.address().port,path,headers:{Upgrade:'websocket',Connection:'Upgrade',Cookie:`fp.apiMode=${mode}; fp_v3_refresh=synthetic-refresh; other=1`,Authorization:'Bearer synthetic-v3'}});req.setTimeout(3000,()=>req.destroy(Error('timeout')));req.on('upgrade',(res,socket)=>{socket.destroy();resolve(res.statusCode)});req.on('response',res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end()})}
try{
 assert.equal(await upgrade('/user-channel?apiKey=synthetic-v1','v1'),101)
 assert.equal(calls.at(-1).mode,'v1');assert.equal(calls.at(-1).headers.authorization,undefined);assert.equal(calls.at(-1).headers.cookie,'other=1')
 assert.equal(await upgrade('/api/v3/realtime','v3'),101)
 assert.equal(calls.at(-1).mode,'v3');assert.equal(calls.at(-1).headers.authorization,'Bearer synthetic-v3');assert.match(calls.at(-1).headers.cookie,/fp_v3_refresh=synthetic-refresh/)
 const count=calls.length
 assert.equal(await upgrade('/api/v3/realtime','v1'),400)
 assert.equal(await upgrade('/api/v3/realtime?ticket=forbidden','v3'),400);assert.equal(calls.length,count)
 console.log('PASS shared upgrade proxy selects fixed mode target, isolates credentials, retains exact legacy path and rejects v3 query credentials')
}finally{for(const peer of peers)peer.destroy();await Promise.all([v1,v3,proxy].map(s=>new Promise(r=>s.close(r))))}
