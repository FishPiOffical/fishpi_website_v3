import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(fs.readFileSync('src/utils/chatConnectionOwners.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {createChatConnectionOwners}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
let starts=0,stops=0
const wait=()=>new Promise(resolve=>setTimeout(resolve,35))
const owners=createChatConnectionOwners(()=>starts++,()=>stops++,20)
owners.acquire('home');owners.acquire('home');assert.equal(starts,1)
owners.release('home');owners.acquire('room');await wait();assert.equal(stops,0);assert.equal(starts,1)
owners.acquire('floating');owners.release('room');await wait();assert.equal(stops,0)
owners.acquire('home');owners.release('floating');await wait();assert.equal(stops,0)
owners.release('home');await wait();assert.equal(stops,1)
owners.acquire('room');assert.equal(starts,2)
owners.release('unknown');await wait();assert.equal(stops,1)
owners.release('room');owners.dispose();await wait();assert.equal(stops,2)
console.log('PASS 首页→聊天室无重连，浮窗共享、关闭单一入口不误断、无人使用释放、重新进入、销毁计时器')
