import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { openDatabase } from '../src/db.ts'
import { createApp, rhythmVerifier } from '../src/app.ts'

test('真实HTTP身份夹具：核验、幂等、分页、投票、权限和隐藏',async()=>{
  const upstream=createServer((req,res)=>{
    assert.equal(req.url,'/api/v3/me'); assert.equal(req.headers.cookie,undefined)
    res.setHeader('Content-Type','application/json')
    const token=req.headers.authorization
    if(token==='Bearer down') {res.writeHead(503);res.end('{}');return}
    if(!['Bearer alice','Bearer bob','Bearer admin'].includes(token || '')) {res.writeHead(401);res.end('{}');return}
    const name=token!.slice(7)
    res.end(JSON.stringify({code:0,data:{id:name,userName:name,userNickname:name+'昵称'}}))
  }).listen(0,'127.0.0.1')
  await once(upstream,'listening')
  const port=(upstream.address() as {port:number}).port
  const db=openDatabase(':memory:')
  const app=createApp({db,verify:rhythmVerifier(`http://127.0.0.1:${port}`),admins:new Set(['admin']),limits:false})
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening')
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/feedback-api/v1`
  async function call(path:string, method='GET',body?:unknown, user?:string,key?:string) {
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user}:{}),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)})
    return {status:r.status,data:await r.json() as any}
  }
  try {
    assert.equal((await call('/requests')).data.total,0)
    const body={title:'希望增加夜间阅读',description:'夜间阅读时希望可以单独调整字号。',category:'feature',author_id:'spoof'}
    assert.equal((await call('/requests','POST',body)).status,401)
    assert.equal((await call('/requests','POST',body,'bad','bad-key-1')).status,401)
    assert.equal((await call('/requests','POST',body,'down','down-key-1')).status,503)
    const created=await call('/requests','POST',body,'alice','create-key-1');assert.equal(created.status,200)
    const id=created.data.id
    assert.equal((await call('/requests','POST',body,'alice','create-key-1')).data.id,id)
    assert.equal((await call('/requests','POST',{...body,title:'不同标题内容'},'alice','create-key-1')).status,409)
    assert.equal((await call('/requests/'+id)).data.authorName,'alice')
    await Promise.all(Array.from({length:10},()=>call('/requests/'+id+'/vote','PUT',{choice:'support'},'bob')))
    assert.equal((await call('/requests/'+id)).data.support,1)
    await call('/requests/'+id+'/vote','PUT',{choice:'support'},'alice')
    assert.equal((await call('/requests/'+id)).data.support,2)
    await call('/requests/'+id+'/vote','PUT',{choice:'oppose'},'bob')
    let detail=(await call('/requests/'+id)).data; assert.equal(detail.support,1);assert.equal(detail.oppose,1)
    assert.equal((await call('/requests/'+id+'/me','GET',undefined,'bob')).data.vote,'oppose')
    await call('/requests/'+id+'/vote','PUT',{choice:'none'},'bob')
    assert.equal((await call('/requests/'+id)).data.oppose,0)
    await call('/requests','POST',{...body,title:'第二条需求标题'},'alice','create-key-2')
    const list=await call('/requests?size=1&page=2');assert.equal(list.data.total,2);assert.equal(list.data.pageCount,2);assert.equal(list.data.items.length,1)
    assert.equal((await call('/requests?category=bug')).data.total,0)
    assert.equal((await call('/requests?q=夜间')).data.total,2)
    assert.equal((await call('/requests?page=0')).status,422)
    const mod={status:'planned',note:'已经排入计划',hidden:true}
    assert.equal((await call('/requests/'+id+'/moderation','PATCH',mod,'bob','moderate-1')).status,403)
    assert.equal((await call('/requests/'+id+'/moderation','PATCH',mod,'admin','moderate-1')).status,200)
    assert.equal((await call('/requests/'+id)).status,404)
    assert.equal((await call('/requests/'+id+'/vote','PUT',{choice:'support'},'bob')).status,404)
    assert.equal((await call('/requests')).data.total,1)
    assert.equal((await call('/requests/'+id+'/me','GET',undefined,'bob')).status,404)
    assert.equal((await call('/requests/'+id+'/me','GET',undefined,'admin')).data.moderation.hidden,true)
    await call('/requests/'+id+'/moderation','PATCH',{...mod,hidden:false},'admin','moderate-2')
    assert.equal((await call('/requests/'+id)).data.note,mod.note)
    assert.equal(db.prepare('SELECT count(*) n FROM moderation_log').get()!.n,2)
    const cross=await fetch(base+'/requests',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(cross.status,403)
  } finally {await new Promise<void>(r=>server.close(()=>r()));await new Promise<void>(r=>upstream.close(()=>r()));db.close()}
})
test('部署关闭和限流',async()=>{
  const db=openDatabase(':memory:')
  const verify=async()=>({id:'1',userName:'user'})
  const closed=createApp({db,verify,admins:new Set(),enabled:false}).listen(0,'127.0.0.1');await once(closed,'listening')
  const r=await fetch(`http://127.0.0.1:${(closed.address() as {port:number}).port}/feedback-api/v1/health`);assert.equal(r.status,503)
  await new Promise<void>(r=>closed.close(()=>r()))
  const server=createApp({db,verify,admins:new Set()}).listen(0,'127.0.0.1');await once(server,'listening')
  try {let status=0;for(let i=0;i<181;i++) status=(await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/feedback-api/v1/health`)).status;assert.equal(status,429)}
  finally {await new Promise<void>(r=>server.close(()=>r()));db.close()}
})
