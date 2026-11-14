import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost/' })
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'SVGElement', 'Event']) globalThis[name] = dom.window[name]
const { createApp, computed, h, reactive, ref, nextTick } = await import('vue')
const { createPinia } = await import('pinia')
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const rewrite = (source, dependencies) => source.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
  assert.ok(dependencies[specifier], `必须明确编译依赖 ${specifier}`)
  return `from '${dependencies[specifier]}'`
})
const draftsUrl = moduleUrl(rewrite(transpile(await fs.readFile('src/composables/sidebarDrafts.ts', 'utf8')), { vue: import.meta.resolve('vue') }))
const { provideSidebarDrafts } = await import(draftsUrl)
const version = ref(1)
const operations = reactive({
  pending: null, completed: null, busy: false, confirming: false, error: '', message: '',
  capture: () => () => true, save: async () => true, retry: async () => true,
})
globalThis.__sidebarDraftFixture = { version, operations }
const authUrl = moduleUrl(`
  import { defineStore } from '${import.meta.resolve('pinia')}';
  export const useAuthStore = defineStore('draft-test-auth', {state: () => ({accessToken: 'token-one', account: {oId: 'owner-one'}})});
`)
const imports = {
  vue: import.meta.resolve('vue'), pinia: import.meta.resolve('pinia'),
  'vue-router': moduleUrl(`export const RouterLink = {render() {return null}}`),
  '@/api/http': moduleUrl(`export const getAuthContextVersion = () => globalThis.__sidebarDraftFixture.version.value`),
  '@/api/v3-breezemoons': moduleUrl(`export const trimBreezemoonInput = value => value.trim()`),
  '@/stores/auth': authUrl,
  '@/stores/v3Breezemoons': moduleUrl(`export const useV3BreezemoonStore = () => globalThis.__sidebarDraftFixture.operations`),
  '@/composables/sidebarDrafts': draftsUrl,
}
const { descriptor } = parse(await fs.readFile('src/components/breezemoons/BreezemoonComposer.vue', 'utf8'))
const Composer = (await import(moduleUrl(rewrite(transpile(compileScript(descriptor, { id: 'sidebar-drafts-test', inlineTemplate: true }).content), imports)))).default
const { useAuthStore } = await import(authUrl)
const mode = ref('tabs'), enabled = ref(true), rendered = ref(true), route = ref(true), scoped = ref(true)
let saved = 0
let auth
const Scope = {
  setup() {
    const identity = computed(() => `${version.value}:${auth.accessToken ? auth.account?.oId : 'guest'}`)
    if (scoped.value) provideSidebarDrafts(() => identity.value, () => enabled.value ? ['breezemoons'] : [])
    return () => h('div', enabled.value && rendered.value
      ? [h(mode.value === 'tabs' ? 'section' : 'article', { key: identity.value }, [h(Composer, { onSaved: () => saved++ })])]
      : [])
  },
}
const pinia = createPinia()
const app = createApp({ render: () => route.value ? h(Scope) : h('p', '其他页面') })
app.use(pinia)
auth = useAuthStore(pinia)
app.mount('#app')
const tick = async () => { await nextTick(); await Promise.resolve(); await nextTick() }
const input = () => document.querySelector('textarea')
async function type(text) {
  assert.ok(input(), '应显示可用输入框')
  input().value = text
  input().dispatchEvent(new Event('input', { bubbles: true }))
  await tick()
}
async function move() { mode.value = mode.value === 'tabs' ? 'card' : 'tabs'; await tick() }
function resetOperation() { operations.pending = null; operations.completed = null; operations.error = '' }
await tick()

try {
  await type('未发送的清风草稿')
  const oldInput = input()
  await move()
  assert.notEqual(input(), oldInput, '真实重建组件，不能依靠旧 DOM 保留输入')
  assert.equal(input().value, '未发送的清风草稿')
  await move()
  assert.equal(input().value, '未发送的清风草稿')

  auth.accessToken = 'rotated-token'
  await tick(); await move()
  assert.equal(input().value, '未发送的清风草稿', '同账号普通令牌轮换保留草稿')

  // 提交关联随模块移动保留，恢复未知结果仍使用 store 中的同一条命令。
  const command = { key: 'original-operation', operation: 'create', id: '', content: '未发送的清风草稿' }
  operations.pending = command
  await tick(); await move()
  assert.equal(operations.pending.key, command.key)
  assert.equal(operations.pending.content, command.content)
  operations.completed = { ...command }; operations.pending = null
  await tick()
  assert.equal(input().value, '')
  assert.equal(saved, 1)
  resetOperation()

  // 组件暂时卸载期间完成操作，重挂后仍只清理对应原草稿。
  await type('恢复期间完成')
  const pending = { key: 'completed-while-detached', operation: 'create', id: '', content: '恢复期间完成' }
  operations.pending = pending
  await tick()
  rendered.value = false; await tick()
  operations.completed = { ...pending }; operations.pending = null
  rendered.value = true; await tick()
  assert.equal(input().value, '')
  assert.equal(saved, 2)
  resetOperation()

  // 用户继续编辑后，旧操作完成不得抹掉已经改变的文本。
  await type('原正文')
  const previous = { key: 'old-operation', operation: 'create', id: '', content: '原正文' }
  operations.pending = previous; await tick()
  operations.pending = null; await tick()
  await type('保留更新后的正文')
  await move()
  operations.completed = { ...previous }; await tick()
  assert.equal(input().value, '保留更新后的正文')
  resetOperation()

  enabled.value = false; await tick()
  enabled.value = true; await tick()
  assert.equal(input().value, '', '关闭模块后重新打开，不恢复私人草稿')
  await type('换号前的正文')
  version.value++; auth.account = { oId: 'owner-two' }; auth.accessToken = 'owner-two-token'
  await tick(); await move()
  assert.equal(input().value, '', '换号清理并阻止旧模块状态复活')
  await type('退出前的正文')
  version.value++; auth.accessToken = ''; auth.account = null
  await tick()
  assert.equal(input(), null)
  version.value++; auth.account = { oId: 'owner-two' }; auth.accessToken = 'new-login'
  await tick(); await move()
  assert.equal(input().value, '', '退出再登录不恢复旧草稿')

  await type('离页前的正文')
  route.value = false; await tick()
  route.value = true; await tick()
  assert.equal(input().value, '', '侧栏离页销毁后不跨页面保留草稿')
  route.value = false; await tick()
  scoped.value = false; route.value = true; await tick()
  await type('普通页面草稿')
  await move()
  assert.equal(input().value, '', '非侧栏 Composer 仍保持原卸载清理行为')

  console.log('PASS 侧栏真实清风组件：切换展示保留草稿、正常换 token、未知原键关联、卸载期间完成、旧回执不抹新文本、禁用/换号/退出/离页清理及普通页面隔离')
} finally {
  app.unmount()
  delete globalThis.__sidebarDraftFixture
  dom.window.close()
}
