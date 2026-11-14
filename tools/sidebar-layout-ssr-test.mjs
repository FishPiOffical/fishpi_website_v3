import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const mocks = moduleUrl(`
  export const useAuthStore = () => ({isLoggedIn: true, account: {oId: 'private-owner'}});
  export const getAuthContextVersion = () => 0;
  export const onAccessTokenChange = () => () => {};
  export default {setup() { throw new Error('SSR 不得挂载模块标题或配置按钮') }};
`)
const utility = moduleUrl(ts.transpileModule(fs.readFileSync('src/utils/sidebarPresentation.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText)
const drafts = moduleUrl(ts.transpileModule(fs.readFileSync('src/composables/sidebarDrafts.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])vue\1/g, `from '${import.meta.resolve('vue')}'`))

function compile(file) {
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'))
  const script = compileScript(descriptor, { id: path.basename(file), inlineTemplate: true, templateOptions: { ssr: true } }).content
  const js = ts.transpileModule(script, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, specifier) => {
    let url = mocks
    if (specifier.startsWith('vue')) url = import.meta.resolve(specifier)
    else if (specifier === '@/utils/sidebarPresentation') url = utility
    else if (specifier === '@/composables/sidebarDrafts') url = drafts
    else if (specifier === './SidebarTabs.vue') url = compile('src/components/sidebar/SidebarTabs.vue')
    return `from ${JSON.stringify(url)}`
  })
  return moduleUrl(js)
}
const { default: SidebarLayout } = await import(compile('src/components/sidebar/SidebarLayout.vue'))
let slots = 0
let layoutReads = 0
let cases = 0
// 本机配置即使不可读取，公开 SSR 也只输出一致的外壳。
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get() { throw new Error('SSR 不得读取 localStorage') },
})
try {
  for (const modules of [
    [],
    [{ id: 'profile', title: '我的资料' }],
    [{ id: 'profile', title: '我的资料' }, { id: 'income', title: '上下班时间' }, { id: 'checkin', title: '今日签到' }],
    [{ id: 'income', title: '上下班时间' }, { id: 'breezemoons', title: '清风明月' }, { id: 'appearance', title: '外观' }],
  ]) {
    for (const mode of ['card', 'tabs', 'mixed']) {
      for (const section of ['pageSidebar', 'chatSidebar']) {
        for (const collapsed of [false, true]) {
          const html = await renderToString(createSSRApp({ render: () => h(SidebarLayout, {
            modules, section, ariaLabel: '侧栏测试',
            presentationOf: id => { layoutReads++; return mode === 'mixed' ? id === 'income' ? 'card' : 'tabs' : mode },
            isCollapsed: () => { layoutReads++; return collapsed },
          }, {
            default: () => { slots++; return h('p', 'private-content') },
            'header-actions': () => { slots++; return h('a', 'private-action') },
          }) }))
          assert.match(html, /正在加载侧栏/)
          assert.match(html, /role="status"/)
          assert.doesNotMatch(html, /private-content|private-action|private-owner|sidebar-card|sidebar-tablist|role="tabpanel"/)
          cases++
        }
      }
    }
  }
  assert.equal(slots, 0)
  assert.equal(layoutReads, 0)
  console.log(`PASS 侧栏混排 SSR：${cases} 种配置首帧一致，不读布局回调/存储，不挂载模块、摘要、操作区`)
} finally {
  delete globalThis.localStorage
}
