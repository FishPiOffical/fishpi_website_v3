import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createRenderer, h, ref } from 'vue'
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,url=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`
globalThis.window={}
const dialogs=await import(url(compile(await fs.readFile('src/composables/useDialog.ts','utf8')).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`)))
const owner=new AbortController(),pending=dialogs.fpConfirm({message:'PRIVATE-CONTACT',signal:owner.signal});assert.equal(dialogs.activeDialogState.value.message,'PRIVATE-CONTACT');owner.abort();assert.equal(await pending,false);assert.equal(dialogs.activeDialogState.value,null)
const stale=new AbortController(),old=dialogs.fpConfirm({message:'OLD',signal:stale.signal}),fresh=dialogs.fpConfirm({message:'NEW'});assert.equal(await old,false);stale.abort();assert.equal(dialogs.activeDialogState.value.message,'NEW');dialogs.activeDialogState.value.resolve(true);assert.equal(await fresh,true);assert.equal(dialogs.activeDialogState.value,null)
const already=new AbortController();already.abort();assert.equal(await dialogs.fpConfirm({message:'not shown',signal:already.signal}),false)
console.log('PASS lifecycle 1 actual shared confirm abort removes only the owned dialog/contact, settles false and cannot close a later unrelated dialog')
const pendingInits=[],instances=[];window.initGeetest4=(cfg,callback)=>pendingInits.push(callback)
const helper=await import(url(compile(await fs.readFile('src/composables/useGeetest4.ts','utf8')).replace("from 'vue'",`from '${import.meta.resolve('vue')}'`)))
const renderer=createRenderer({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode(){return null},nextSibling(){return null}})
const container=ref({innerHTML:''});let api,hits=0
const app=renderer.createApp({setup(){api=helper.useGeetest4(container,()=>hits++);return()=>h('div')}});app.mount({})
function instance(){const record={appended:0,destroyed:0,resets:0,callback:null};const value={appendTo(){record.appended++;return value},onSuccess(cb){record.callback=cb;return value},getValidate(){return{test:'only'}},reset(){record.resets++},destroy(){record.destroyed++}};instances.push(record);return{value,record}}
await api.mount();api.destroy();const a=instance();pendingInits.shift()(a.value);assert.equal(a.record.appended,0);assert.equal(a.record.destroyed,1)
await api.mount();const b=instance();pendingInits.shift()(b.value);b.record.callback();assert.equal(hits,1);api.destroy();b.record.callback();assert.equal(hits,1);assert.equal(b.record.destroyed,1)
await api.mount();container.value={innerHTML:'replacement'};const c=instance();pendingInits.shift()(c.value);assert.equal(c.record.appended,0);assert.equal(c.record.destroyed,1);app.unmount()
console.log('PASS lifecycle 2 actual captcha helper rejects delayed initialization/success after destroy or target replacement and disposes old instance/timers')
delete window.initGeetest4;let script=null;globalThis.document={querySelector:()=>script,createElement:()=>{const handlers={};const result={dataset:{},addEventListener(name,fn){handlers[name]=fn},remove(){if(script===result)script=null},handlers};return result},head:{appendChild(value){script=value}}}
const another=ref({innerHTML:''});let retryApi;const retryApp=renderer.createApp({setup(){retryApi=helper.useGeetest4(another,()=>{});return()=>h('div')}});retryApp.mount({})
const failed=retryApi.mount();await Promise.resolve();assert.ok(script);script.handlers.error();await failed;assert.match(retryApi.error.value,/重试/);assert.equal(script,null)
const retried=retryApi.mount();await Promise.resolve();assert.ok(script);window.initGeetest4=(cfg,cb)=>cb(instance().value);script.handlers.load();await retried;assert.equal(retryApi.ready.value,true);retryApp.unmount()
console.log('PASS lifecycle 3 failed vendor script is removed and a later explicit mount can retry successfully; no real captcha challenge solved')
