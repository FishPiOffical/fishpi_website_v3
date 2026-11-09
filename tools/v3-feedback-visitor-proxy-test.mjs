import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
const token='a'.repeat(43),calls=[]
const fixture=http.createServer((req,res)=>{calls.push(req.headers);res.setHeader('Content-Type','application/json');res.setHeader('Set-Cookie',[`fp_feedback_visitor=${token}; HttpOnly; Path=/feedback-api/v1; SameSite=Strict`,'fp_v3_refresh=NEVER_FORWARD; HttpOnly']);res.end('{"ok":true}')}).listen(0,'127.0.0.1');await once(fixture,'listening')
const free=http.createServer().listen(0,'127.0.0.1');await once(free,'listening');const port=free.address().port;await new Promise(r=>free.close(r))
const child=spawn(process.execPath,['server.js'],{env:{...process.env,NODE_ENV:'production',PORT:String(port),VITE_FEEDBACK_ENABLED:'true',FEEDBACK_TARGET:`http://127.0.0.1:${fixture.address().port}`},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d)
try{
 const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<100;i++){try{await(await fetch(base+'/feedback-api/v1/health')).text();ready=true;break}catch{await new Promise(r=>setTimeout(r,50))}}assert.ok(ready,output)
 const response=await fetch(base+'/feedback-api/v1/session',{method:'POST',headers:{Origin:base,Cookie:`LATKE_SESSION_ID=NEVER_FORWARD; fp_v3_refresh=NEVER_FORWARD; fp_feedback_visitor=${token}`,Authorization:'Bearer NEVER_FORWARD'}})
 assert.equal(response.status,200);assert.equal(calls.at(-1).cookie,`fp_feedback_visitor=${token}`);assert.equal(calls.at(-1).authorization,undefined)
 const cookie=response.headers.get('set-cookie');assert.ok(cookie.startsWith('fp_feedback_visitor='));assert.ok(!cookie.includes('fp_v3_refresh'))
 const admin=await fetch(base+'/feedback-api/v1/moderation/requests?visibility=hidden',{headers:{Authorization:'Bearer fixture-admin',Cookie:'fp_v3_refresh=NEVER_FORWARD'}})
 assert.equal(admin.status,200);assert.equal(calls.at(-1).authorization,'Bearer fixture-admin');assert.equal(calls.at(-1).cookie,undefined)
 console.log('PASS actual production SSR proxy forwards only feedback visitor cookie and Set-Cookie, excludes Rhythm cookies and forwards Bearer only for moderation')
}finally{const done=new Promise(r=>child.once('exit',r));child.kill();await done;await new Promise(r=>fixture.close(r))}
