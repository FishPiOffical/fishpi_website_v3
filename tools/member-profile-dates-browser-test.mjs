import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { parse, compileScript } from '@vue/compiler-sfc'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const file = 'src/components/member/MemberProfileDates.vue'
const component = compile(compileScript(parse(await fs.readFile(file, 'utf8')).descriptor, { id: 'dates', inlineTemplate: true }).content)
const imports = {
  vue: moduleUrl(await fs.readFile('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8')),
  '@/stores/auth': moduleUrl('export const useAuthStore = () => window.viewer'),
  '@/utils/time': moduleUrl(compile(await fs.readFile('src/utils/time.ts', 'utf8'))),
}
const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.setContent('<main id="app"></main><script type="importmap">' + JSON.stringify({ imports }) + '</script>')
  await page.addScriptTag({ type: 'module', content: `import { createApp, h, reactive, ref } from 'vue'; import Dates from '${moduleUrl(component)}';
    window.viewer = reactive({ isLoggedIn: false, account: null });
    window.target = ref('1609459200000');
    createApp({ render: () => h(Dates, { memberId: target.value }) }).mount('#app');` })
  const labels = page.locator('dt')
  await labels.first().waitFor()
  assert.deepEqual(await labels.allTextContents(), ['注册时间'])
  assert.equal(await page.locator('time').textContent(), '2021-01-01')
  await page.evaluate(() => Object.assign(viewer, { isLoggedIn: true, account: { oId: target.value, userLatestLoginTime: 1794960000000 } }))
  await labels.nth(1).waitFor()
  assert.deepEqual(await labels.allTextContents(), ['注册时间', '最后登录时间'])
  await page.evaluate(() => { target.value = '1704067200000' })
  assert.deepEqual(await labels.allTextContents(), ['注册时间'])
  assert.equal(await page.locator('time').textContent(), '2024-01-01')
  await page.evaluate(() => { target.value = viewer.account.oId; viewer.account.userLatestLoginTime = 0 })
  assert.deepEqual(await labels.allTextContents(), ['注册时间'])
  await page.evaluate(() => { target.value = '8'; viewer.isLoggedIn = false })
  assert.equal(await labels.count(), 0)
  console.log('PASS member dates: guest, owner, other member, unavailable login and non-timestamp ID')
} finally { await browser.close() }
