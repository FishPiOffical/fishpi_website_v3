// Actual nickname SFC with an explicit style-cache adapter for host-component tests.
// Transport, visibility batching, expiry and identity fencing are tested separately against the real composable.
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
export const nicknameFixtureCalls=[]
export const nicknameFixtureStyles=new Map()
globalThis.__hostNicknameFixture={calls:nicknameFixtureCalls,styles:nicknameFixtureStyles}
const mode=url("export const getApiMode=()=> 'v3'")
const cache=url(`import{ref}from'${import.meta.resolve('vue')}';export const vipNameRevision=ref(0);export function cachedVipName(id,name){const f=globalThis.__hostNicknameFixture;f.calls.push({id:String(id||''),name:name||''});return f.styles.get(String(id||''))}export async function loadVipName(){}export function vipNameClass(config){return config?.class}export function vipNameStyle(config){return config?.style}`)
const source=await fs.readFile(new URL('../../src/components/user/VipNickname.vue',import.meta.url),'utf8')
const script=compileScript(parse(source).descriptor,{id:'host-nickname-fixture',inlineTemplate:true}).content
const compiled=ts.transpileModule(script,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
export const nicknameFixtureURL=url(compiled.replaceAll("from 'vue'",`from '${import.meta.resolve('vue')}'`).replaceAll('from "vue"',`from '${import.meta.resolve('vue')}'`).replace("from '@/composables/useVipNickname'",`from '${cache}'`).replace("from '@/api/mode'",`from '${mode}'`))
