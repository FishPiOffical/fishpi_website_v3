import assert from 'node:assert/strict'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

async function fixture(address, mode='development') {
  const sockets=new Set(),calls=[]
  const upstream=http.createServer()
  upstream.on('upgrade',(req,socket)=>{
    sockets.add(socket);socket.once('close',()=>sockets.delete(socket))
    calls.push({path:req.url,host:req.headers.host,origin:req.headers.origin})
    const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
  })
  await new Promise((resolve,reject)=>{upstream.once('error',reject);upstream.listen(0,address,resolve)})
  const target=`http://${address==='::1'?'[::1]':address}:${upstream.address().port}`
  const reservation=http.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve))
  const site=`http://127.0.0.1:${port}`,child=spawn(process.execPath,mode==='spa'?['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort']:['server.js'],{env:{...process.env,NODE_ENV:mode==='spa'?'development':mode,PORT:String(port),VITE_API_TARGET:target,VITE_API_MODE:'v3',VITE_API_V3_TARGET:target},stdio:['ignore','pipe','pipe']})
  let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v)
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clearInterval(poll);reject(Error('Proxy startup deadline'))},20000),poll=setInterval(()=>{if(output.includes(site)){clearTimeout(timer);clearInterval(poll);resolve()}},20);child.once('exit',()=>{clearTimeout(timer);clearInterval(poll);reject(Error('Proxy exited before startup'))})})
    for(const path of ['/api/v3/realtime','/chat-room-channel']){
      const ws=new WebSocket(site.replace('http:','ws:')+path)
      try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Proxy upgrade deadline')),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Proxy WebSocket upgrade failed'))},{once:true})});assert.equal(calls.at(-1).path,path);assert.equal(calls.at(-1).host,new URL(target).host);assert.equal(calls.at(-1).origin,target)}finally{ws.close()}
    }
    console.log(`PASS websocket proxy ${address} actual ${mode} server tunnels v3 and classic upgrades with target authority/origin`)
  }finally{
    if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited}
    for(const socket of sockets)socket.destroy()
    await new Promise(resolve=>upstream.close(resolve))
  }
}
await fixture('127.0.0.1')
await fixture('::1')

await fixture('127.0.0.1','production')
await fixture('127.0.0.1','spa')
