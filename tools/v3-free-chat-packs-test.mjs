import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import {createPinia,setActivePinia,defineStore} from 'pinia'
import {ref,nextTick} from 'vue'
const packs=[]
for(const folder of ['themes','bubbles','frames'])for(const id of await fs.readdir(`src/packs/${folder}`)){
 const pack=JSON.parse(await fs.readFile(`src/packs/${folder}/${id}/pack.json`,'utf8'));packs.push(pack)
 if(['paipai-orange','fishpond-blue'].includes(id)){
  assert.equal(pack.vip,false)
  const css=await fs.readFile(`src/packs/${folder}/${id}/style.css`,'utf8')
  assert.ok(css.includes('.fp-msg.is-room'));assert.ok(css.includes("url('/logo.png')"))
  if(folder==='bubbles')assert.ok(css.includes(':not(.is-standalone)'))
 }
}
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64')
const packURL=url(`export const DEFAULT_THEME='classic-dark',DEFAULT_BUBBLE='classic',DEFAULT_FRAME='none';const packs=${JSON.stringify(packs)};export function findPack(kind,id){return packs.find(p=>p.kind===kind&&p.id===id)}`)
const useAuth=defineStore('free-pack-auth',()=>({isVip:ref(false)}));globalThis.__freePackAuth=useAuth
const authURL=url('export const useAuthStore=globalThis.__freePackAuth')
let source=ts.transpileModule((await fs.readFile('src/stores/appearance.ts','utf8')).replaceAll('import.meta.env.SSR','false'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
for(const[a,b]of [['vue',import.meta.resolve('vue')],['pinia',import.meta.resolve('pinia')],['@/packs',packURL],['./auth',authURL]])source=source.replaceAll(`from '${a}'`,`from '${b}'`)
const{useAppearanceStore}=await import(url(source));globalThis.document={documentElement:{dataset:{}}};let stored='';globalThis.localStorage={getItem(){return stored||null},setItem(key,value){stored=value}}
setActivePinia(createPinia());let appearance=useAppearanceStore()
for(const id of ['paipai-orange','fishpond-blue'])for(const kind of ['bubble','frame']){
 appearance.apply(kind,id);await nextTick();assert.equal(appearance.state[kind],id);assert.equal(document.documentElement.dataset[kind],id)
 appearance.enforceVip();assert.equal(appearance.state[kind],id)
}
appearance.apply('bubble','candy');assert.equal(appearance.state.bubble,'fishpond-blue');assert.match(appearance.notice,/VIP/)
appearance.apply('frame','gold');assert.equal(appearance.state.frame,'fishpond-blue')
setActivePinia(createPinia());appearance=useAppearanceStore();assert.equal(appearance.state.bubble,'classic');appearance.restore();assert.equal(appearance.state.bubble,'fishpond-blue');assert.equal(appearance.state.frame,'fishpond-blue')
console.log('PASS free packs: non-VIP selection, expiry enforcement, refresh, default first frame and unchanged VIP gating')
