import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const mocks = moduleUrl(`
  export const useAuthStore = () => ({isLoggedIn: true, account: {oId: 'private-owner'}});
  export const getAuthContextVersion = () => 0;
  export const onAccessTokenChange = () => () => {};
  export default {render() {return null}};
`)
const { descriptor } = parse(fs.readFileSync('src/components/sidebar/SidebarTabs.vue', 'utf8'))
const compiled = compileScript(descriptor, { id: 'sidebar-ssr', inlineTemplate: true, templateOptions: { ssr: true } }).content
const js = ts.transpileModule(compiled, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, path) =>
  `from '${path.startsWith('vue') ? import.meta.resolve(path) : mocks}'`)
const { default: SidebarTabs } = await import(moduleUrl(js))

let mountedPanels = 0
// 模拟浏览器已保存其他标签；SSR 不能读取本机设置，更不能挂载本人模块。
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get() { throw new Error('SSR 不得访问 localStorage') },
})
try {
  for (const modules of [[], [{ id: 'profile', title: '我的资料' }], [{ id: 'checkin', title: '签到' }, { id: 'income', title: '上下班时间' }]]) {
    const html = await renderToString(createSSRApp({ render: () => h(SidebarTabs, {
      modules, section: 'pageSidebar', ariaLabel: '内页侧栏模块',
    }, { default: () => { mountedPanels++; return h('p', 'private-data') } }) }))
    assert.match(html, /sidebar-placeholder/)
    assert.doesNotMatch(html, /private-data|private-owner|role="tab"|role="tabpanel"/)
  }
  assert.equal(mountedPanels, 0)
  console.log('PASS 侧栏 SSR：空配置、默认配置和私人配置均输出统一准备态，不读取存储或挂载私人面板')
} finally {
  delete globalThis.localStorage
}
