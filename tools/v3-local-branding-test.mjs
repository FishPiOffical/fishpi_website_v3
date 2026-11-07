import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'
const source = await fs.readFile('src/stores/localBranding.ts', 'utf8')
const output = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'pinia'", `from '${import.meta.resolve('pinia')}'`).replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
const {useLocalBrandingStore,normalizeBranding} = await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const storage = new Map(); let reads = 0
const disk={getItem(key){reads++;return storage.get(key)||null},setItem(key,value){storage.set(key,value)}}
globalThis.localStorage=disk
setActivePinia(createPinia());let store=useLocalBrandingStore()
assert.equal(reads,0);store.restore();assert.equal(reads,0);assert.equal(store.name,'')
globalThis.window={};store.restore();assert.equal(reads,1)
assert.equal(store.save(' 我的工作台 ','https://example.com/logo.png'),true)
assert.equal(store.name,'我的工作台')
setActivePinia(createPinia());store=useLocalBrandingStore();assert.equal(store.name,'');store.restore();assert.equal(store.name,'我的工作台');assert.equal(store.logo,'https://example.com/logo.png')
for(const logo of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','https://name:secret@example.com/logo','/relative.png'])assert.throws(()=>normalizeBranding('name',logo))
assert.throws(()=>normalizeBranding('a'.repeat(41),''));assert.throws(()=>normalizeBranding('bad\nname',''));assert.throws(()=>normalizeBranding('', 'x'.repeat(720001)))
assert.equal(normalizeBranding('', 'data:image/png;base64,aGVsbG8=').logo,'data:image/png;base64,aGVsbG8=')
globalThis.localStorage={getItem(){throw Error('read blocked')},setItem(){throw Error('storage blocked')}}
assert.equal(store.save('changed',''),false);assert.equal(store.name,'我的工作台');assert.match(store.error,/storage blocked/)
setActivePinia(createPinia());store=useLocalBrandingStore();store.restore();assert.equal(store.name,'');assert.match(store.error,/无法读取/)
globalThis.localStorage=disk;assert.equal(store.save('',''),true);setActivePinia(createPinia());store=useLocalBrandingStore();store.restore();assert.equal(store.name,'');assert.equal(store.logo,'')
console.log('PASS local branding: SSR isolation, persistence, validation, blocked storage and reset')
