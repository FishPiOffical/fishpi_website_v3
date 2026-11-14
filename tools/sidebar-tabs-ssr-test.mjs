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

const { descriptor: layoutDescriptor } = parse(fs.readFileSync('src/components/sidebar/SidebarLayout.vue', 'utf8'))
const layoutCompiled = compileScript(layoutDescriptor, { id: 'sidebar-layout-ssr', inlineTemplate: true, templateOptions: { ssr: true } }).content
const presentation = moduleUrl(ts.transpileModule(fs.readFileSync('src/utils/sidebarPresentation.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText)
// 草稿作用域使用真实实现，确认 SSR 不会为侧栏读取或恢复私人草稿。
const drafts = moduleUrl(ts.transpileModule(fs.readFileSync('src/composables/sidebarDrafts.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, path) =>
  `from '${path.startsWith('vue') ? import.meta.resolve(path) : mocks}'`))
const layoutJs = ts.transpileModule(layoutCompiled, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, path) =>
  `from '${path.startsWith('vue') ? import.meta.resolve(path) : path === '@/utils/sidebarPresentation' ? presentation : path === '@/composables/sidebarDrafts' ? drafts : mocks}'`)
const { default: SidebarLayout } = await import(moduleUrl(layoutJs))

let mountedPanels = 0
let mountedActions = 0
// 模拟浏览器已保存其他标签；SSR 不能读取本机设置，更不能挂载本人模块。
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get() { throw new Error('SSR 不得访问 localStorage') },
})
try {
  for (const modules of [[], [{ id: 'checkin', title: '签到' }], [{ id: 'checkin', title: '签到' }, { id: 'income', title: '上下班时间' }]]) {
    for (const showConfigure of [undefined, true, false]) {
      const html = await renderToString(createSSRApp({ render: () => h(SidebarTabs, {
        modules, showConfigure, section: 'pageSidebar', ariaLabel: '内页侧栏模块',
      }, {
        default: () => { mountedPanels++; return h('p', 'private-data') },
        'header-actions': () => { mountedActions++; return h('a', 'private-actions') },
      }) }))
      assert.match(html, /sidebar-placeholder/)
      assert.doesNotMatch(html, /private-data|private-owner|private-actions|role="tab"|role="tabpanel"|tab-scroll/)
    }
  }
  for (const section of ['pageSidebar', 'chatSidebar']) {
    for (const modules of [[], [{id:'profile',title:'我的资料'}], [{id:'profile',title:'我的资料'},{id:'income',title:'上下班时间'},{id:'checkin',title:'签到'}]]) {
      const html = await renderToString(createSSRApp({ render: () => h(SidebarLayout, {
        modules, section, ariaLabel: '混合侧栏', presentationOf: id => id === 'checkin' ? 'tabs' : 'card', isCollapsed: () => false,
      }, {
        default: () => { mountedPanels++; return h('p', 'private-data') },
        'header-actions': () => { mountedActions++; return h('a', 'private-actions') },
      }) }))
      assert.match(html, /正在加载侧栏/)
      assert.doesNotMatch(html, /private-data|private-owner|private-actions|data-sidebar-module|role="tab"/)
    }
  }
  assert.equal(mountedPanels, 0)
  assert.equal(mountedActions, 0)
  console.log('PASS 侧栏 SSR：标签三种模块与齿轮配置、混合布局两种侧栏三种模块配置均输出准备态，不读取存储或挂载私人面板、辅助操作')
} finally {
  delete globalThis.localStorage
}
