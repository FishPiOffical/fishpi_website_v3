import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createSSRApp, createRenderer, h, reactive, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = await fs.readFile('src/components/user/UserRoleBadge.vue', 'utf8')
const script = compileScript(parse(source).descriptor, { id: 'role-badge-test', inlineTemplate: true }).content
const compiled = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(compiled.replaceAll('from "vue"', `from '${import.meta.resolve('vue')}'`).replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`)).toString('base64')
const Badge = (await import(moduleUrl)).default
const render = props => renderToString(createSSRApp({ render: () => h(Badge, props) }))

for (const [name, roleId, tone] of [
  ['管理员', 'adminRole', 'admin'],
  ['OP', '1630552921050', 'operator'],
  ['纪律委员', '1630631382235', 'discipline'],
  ['超级会员', '1630553268292', 'supermember'],
  ['成员', 'memberRole', 'member'],
  ['成员', '1630553360689', 'member'],
  ['新手', 'defaultRole', 'newcomer'],
  ['游客', 'visitorRole', 'visitor'],
]) {
  const html = await render({ name, roleId })
  assert.ok(html.includes('user-role-badge--' + tone), `${name} 的颜色不正确`)
  assert.ok(html.includes('>' + name + '</span>'), `${name} 未使用服务端展示名`)
  assert.ok(!html.includes('button') && !html.includes('href'), '身份徽牌不应含管理操作')
}
assert.match(await render({ name: '管理员' }), /user-role-badge--admin/)
assert.match(await render({ name: '管理员', roleId: 'customRole' }), /user-role-badge--neutral/)
assert.match(await render({ name: '新角色 <img src=x>' }), /新角色 &lt;img src=x&gt;/)
const longName = '这是自定义的非常长的公开身份名称'
assert.ok((await render({ name: longName })).includes(`title="${longName}"`))
console.log('PASS 角色ID配色、旧服务器名称兼容、自定义角色中性色、纯文本与长名提示')

// 使用实际组件检查挂载与认证边界，能力展示不能由角色名或真值字符串推导。
const auth = reactive({ accessToken: 'private-bearer', account: { capabilities: { canAccessAdmin: true } } })
globalThis.__roleAdminAuth = auth
const dataUrl = value => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64')
const authModule = dataUrl('export const useAuthStore = () => globalThis.__roleAdminAuth')
async function adminComponent(env) {
  const source = (await fs.readFile('src/components/navigation/AdminConsoleLink.vue', 'utf8')).replaceAll('import.meta.env', JSON.stringify(env))
  const script = compileScript(parse(source).descriptor, { id: 'admin-link-test', inlineTemplate: true }).content
  const js = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return (await import(dataUrl(js.replaceAll('from "vue"', `from '${import.meta.resolve('vue')}'`).replaceAll("from 'vue'", `from '${import.meta.resolve('vue')}'`).replaceAll("from '@/stores/auth'", `from '${authModule}'`)))).default
}
const AdminLink = await adminComponent({ VITE_BROWSER_API_ORIGIN: 'https://rhythm.test/app?discard=1', VITE_API_TARGET: 'https://fallback.test' })
assert.ok(!(await renderToString(createSSRApp({ render: () => h(AdminLink) }))).includes('/admin'))
const renderer = createRenderer({
  patchProp(node, key, previous, value) { node.props[key] = value },
  insert(node, parent, anchor) { const at = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(at < 0 ? parent.children.length : at, 0, node); node.parent = parent },
  remove(node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1) },
  createElement(tag) { return { tag, props: {}, children: [] } },
  createText(text) { return { text, children: [] } }, createComment() { return { children: [] } },
  setText(node, text) { node.text = text }, setElementText(node, text) { node.children = [{ text, children: [] }] },
  parentNode: node => node.parent,
  nextSibling(node) { return node.parent?.children[node.parent.children.indexOf(node) + 1] || null },
})
const links = node => [...(node.tag === 'a' ? [node] : []), ...node.children.flatMap(links)]
const mount = component => { const root = { children: [] }; let navigations = 0; const app = renderer.createApp({ render: () => h(component, { onNavigate: () => navigations++ }) }); app.mount(root); return { root, app, navigations: () => navigations } }
let view = mount(AdminLink)
await nextTick()
assert.equal(links(view.root).length, 1)
let link = links(view.root)[0]
assert.equal(link.props.href, 'https://rhythm.test/admin')
assert.ok(!link.props.href.includes(auth.accessToken))
assert.equal(link.props.target, '_blank')
assert.equal(link.props.rel, 'noopener noreferrer')
link.props.onClick(); assert.equal(view.navigations(), 1)
for (const capabilities of [undefined, {}, { canAccessAdmin: false }, { canAccessAdmin: 'true' }]) {
  auth.account = { capabilities }
  await nextTick()
  assert.equal(links(view.root).length, 0)
}
auth.account = { capabilities: { canAccessAdmin: true } }; await nextTick()
assert.equal(links(view.root).length, 1)
auth.account.capabilities.canAccessAdmin = false; await nextTick()
assert.equal(links(view.root).length, 0)
auth.account.capabilities.canAccessAdmin = true; await nextTick()
auth.accessToken = null; await nextTick()
assert.equal(links(view.root).length, 0)
auth.account = null; await nextTick()
assert.equal(links(view.root).length, 0)
view.app.unmount()
auth.account = { capabilities: { canAccessAdmin: true } }; auth.accessToken = 'private-bearer'
view = mount(await adminComponent({ VITE_API_TARGET: 'https://fallback.test' })); await nextTick()
assert.equal(links(view.root)[0].props.href, 'https://fallback.test/admin')
view.app.unmount()
console.log('PASS 管理入口实际Vue组件：SSR隐藏、严格能力布尔、退出与撤权即时隐藏、固定无凭据Rhythm链接')

// 新鲜资料缓存仍会读取当前动态信息，角色变化也必须即时回填，不能沿用旧徽牌。
const profileFixture = globalThis.__roleProfileFixture = {
  snapshot: { id: 'fixture', userName: 'fixture', userNickname: '缓存昵称', userRole: '成员', userRoleId: 'memberRole' },
  complete: null,
  state: null,
}
const profileApi = dataUrl(`export const decodePublicUser=value=>value;export const fetchPublicUser=()=>new Promise(resolve=>{globalThis.__roleProfileFixture.complete=resolve})`)
const snapshotApi = dataUrl(`export const PUBLIC_LIST_TTL=300000;export const memberSnapshotKey=name=>'member:'+name;export const shouldInvalidatePublicSnapshot=()=>false;export const removePublicSnapshot=()=>{};export const savePublicSnapshot=()=>{};export const readPublicSnapshot=async(key,ttl,decode)=>({value:decode(globalThis.__roleProfileFixture.snapshot),fresh:true,expires:Date.now()+ttl})`)
let profileScript = ts.transpileModule((await fs.readFile('src/composables/useMemberProfile.ts', 'utf8')).replaceAll('import.meta.env.SSR', 'false'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
for (const [specifier, replacement] of [
  ['vue', import.meta.resolve('vue')], ['@/stores/auth', authModule],
  ['@/api/v3-public-user', profileApi], ['@/utils/publicSnapshots', snapshotApi],
  ['@/seo/payload', dataUrl('export const consumeMemberPayload=()=>null')],
  ['@/api/http', dataUrl('export const getAuthContextVersion=()=>1')],
]) profileScript = profileScript.replaceAll(`from '${specifier}'`, `from '${replacement}'`)
const { useMemberProfile } = await import(dataUrl(profileScript))
const { ref } = await import('vue')
const profileView = mount({ setup() { profileFixture.state = useMemberProfile(ref('fixture')); return () => h('p', profileFixture.state.profile.value?.userRole) } })
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await nextTick() }
await settle()
assert.equal(profileFixture.state.profile.value.userRoleId, 'memberRole')
profileFixture.complete({ id: 'fixture', userName: 'fixture', userNickname: '当前昵称', userRole: 'OP', userRoleId: '1630552921050' })
await settle()
assert.equal(profileFixture.state.profile.value.userNickname, '缓存昵称')
assert.equal(profileFixture.state.profile.value.userRole, 'OP')
assert.equal(profileFixture.state.profile.value.userRoleId, '1630552921050')
profileView.app.unmount()
console.log('PASS 公开资料缓存保留角色ID，后台成功读取即时替换角色名和ID，其余新鲜资料仍按既有缓存策略保留')
