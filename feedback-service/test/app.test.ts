import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { openDatabase } from '../src/db.ts'
import { createApp } from '../src/app.ts'

test('独立访客真实HTTP：Cookie、身份隔离、昵称、投票去重、幂等、管理与隐藏',async()=>{
 const db=openDatabase(':memory:'),admins=new Set<string>(),server=createApp({db,admins,limits:false}).listen(0,'127.0.0.1');await once(server,'listening')
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`,api=base+'/feedback-api/v1'
 async function call(path:string,method='GET',body?:unknown,cookie='',key='') {
  const r=await fetch(api+path,{method,headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  return{status:r.status,data:await r.json() as any,cookie:r.headers.get('set-cookie')}
 }
 try{
  assert.equal((await call('/health')).data.ok,true)
  const a=await call('/session','POST',{}),b=await call('/session','POST',{}),ca=a.cookie!.split(';')[0]!,cb=b.cookie!.split(';')[0]!
  assert.match(a.data.id,/^guest:/);assert.notEqual(a.data.id,b.data.id);assert.match(a.cookie!,/HttpOnly/);assert.match(a.cookie!,/Secure/);assert.match(a.cookie!,/SameSite=Strict/);assert.match(a.cookie!,/Path=\/feedback-api\/v1/)
  assert.equal((await call('/session','POST',{},ca)).data.id,a.data.id)
  const raw=ca.split('=')[1]!;assert.equal(db.prepare('SELECT token_hash FROM visitor_sessions WHERE id=?').get(a.data.id)!.token_hash===raw,false)
  const body={title:'希望增加夜间阅读',description:'夜间阅读时希望可以单独调整字号。',category:'feature',displayName:'自选昵称',author_id:b.data.id}
  assert.equal((await call('/requests','POST',body,'','key-none')).status,401)
  const spoof=await fetch(api+'/requests',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Authorization:'Bearer spoof','Idempotency-Key':'spoof-key'},body:JSON.stringify(body)});assert.equal(spoof.status,401)
  const made=await call('/requests','POST',body,ca,'create-key-1');assert.equal(made.status,200);const id=made.data.id
  assert.equal((await call('/requests','POST',body,ca,'create-key-1')).data.id,id)
  assert.equal((await call('/requests','POST',{...body,title:'修改后的不同标题'},ca,'create-key-1')).status,409)
  const detail=(await call('/requests/'+id)).data;assert.equal(detail.authorNickname,'自选昵称');assert.equal(db.prepare('SELECT author_id FROM requests WHERE id=?').get(id)!.author_id,a.data.id)
  await Promise.all(Array.from({length:10},()=>call('/requests/'+id+'/vote','PUT',{choice:'support'},cb)))
  assert.equal((await call('/requests/'+id)).data.support,1)
  await call('/requests/'+id+'/vote','PUT',{choice:'support'},ca);assert.equal((await call('/requests/'+id)).data.support,2)
  await call('/requests/'+id+'/vote','PUT',{choice:'oppose'},cb);assert.equal((await call('/requests/'+id)).data.oppose,1)
  assert.equal((await call('/requests/'+id+'/me','GET',undefined,cb)).data.vote,'oppose')
  await call('/requests/'+id+'/vote','PUT',{choice:'none'},cb);assert.equal((await call('/requests/'+id)).data.oppose,0)
  const mod={status:'planned',note:'排入计划',hidden:true};assert.equal((await call('/requests/'+id+'/moderation','PATCH',mod,ca,'moderate-1')).status,403)
  admins.add(a.data.id);assert.equal((await call('/requests/'+id+'/me','GET',undefined,ca)).data.canModerate,true)
  assert.equal((await call('/requests/'+id+'/moderation','PATCH',mod,ca,'moderate-1')).status,200)
  assert.equal((await call('/requests/'+id)).status,404);assert.equal((await call('/requests/'+id+'/me','GET',undefined,cb)).status,404)
  assert.equal((await call('/requests/'+id+'/me','GET',undefined,ca)).data.moderation.hidden,true)
  await call('/requests/'+id+'/moderation','PATCH',{...mod,hidden:false},ca,'moderate-2')
  await call('/requests','POST',{...body,title:'第二条不同需求标题'},ca,'create-key-2')
  assert.equal((await call('/requests?size=1&page=2')).data.items.length,1);assert.equal((await call('/requests?q=不存在')).data.total,0);assert.equal((await call('/requests?page=0')).status,422)
  const cross=await fetch(api+'/session',{method:'POST',headers:{Origin:'https://evil.example'}});assert.equal(cross.status,403)
  assert.equal((await fetch(api+'/session',{method:'POST'})).status,403)
  assert.equal((await call('/session','POST',{},'fp_feedback_visitor=forged')).status,200)
  assert.equal((await call('/requests/'+id+'/me','GET',undefined,'fp_feedback_visitor=forged')).status,401)
  db.prepare('UPDATE visitor_sessions SET expires_at=0 WHERE id=?').run(b.data.id)
  assert.equal((await call('/requests/'+id+'/me','GET',undefined,cb)).status,401)
  const replacement=await call('/session','POST',{},cb);assert.notEqual(replacement.data.id,b.data.id)
 }finally{await new Promise<void>(r=>server.close(()=>r()));db.close()}
})
test('访客创建限流、功能关闭与旧数据兼容',async()=>{
 const db=openDatabase(':memory:')
 db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('legacy','旧需求测试标题','feature','旧说明内容','site-uid','legacy','旧昵称','pending','',0,'now','now')
 const server=createApp({db,admins:new Set(['site-uid']),cookieSecure:false}).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`
 try{const old=await(await fetch(base+'/feedback-api/v1/requests')).json() as any;assert.equal(old.items[0].authorNickname,'旧昵称');let status=0;for(let i=0;i<21;i++)status=(await fetch(base+'/feedback-api/v1/session',{method:'POST',headers:{Origin:base}})).status;assert.equal(status,429)}finally{await new Promise<void>(r=>server.close(()=>r()))}
 const closed=createApp({db,admins:new Set(),enabled:false}).listen(0,'127.0.0.1');await once(closed,'listening');assert.equal((await fetch(`http://127.0.0.1:${(closed.address() as {port:number}).port}/feedback-api/v1/health`)).status,503);await new Promise<void>(r=>closed.close(()=>r()));db.close()
})
