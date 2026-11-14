import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { parse, compileScript, compileStyleAsync } from '@vue/compiler-sfc'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = process.env.ARTICLE_PIN_OUTPUT || '/tmp/article-pin-browser'
fs.mkdirSync(output, { recursive: true })
const data = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const imports = { vue: data(fs.readFileSync('node_modules/vue/dist/vue.esm-browser.prod.js', 'utf8')) }
// 网络与身份组件隔离；列表、首页行模板、置顶状态和样式直接使用仓库源码。
imports['vue-router'] = data(`import {h} from 'vue';export const RouterLink={props:['to'],setup(p,{slots}){return()=>h('a',{href:p.to},slots.default?.())}}`)
imports['@/components/user/VipNickname.vue'] = data(`import {h} from 'vue';export default {props:['text'],setup:p=>()=>h('span',p.text)}`)
for (const name of ['articlePin', 'avatar', 'text', 'time']) {
  imports['@/utils/' + name] = data(transpile(fs.readFileSync(`src/utils/${name}.ts`, 'utf8')))
}
let css = ''
async function compile(source, file, id) {
  const { descriptor } = parse(source)
  const script = transpile(compileScript(descriptor, { id, inlineTemplate: true }).content)
  for (const style of descriptor.styles) {
    const result = await compileStyleAsync({ source: style.content, filename: file, id, scoped: !!style.scoped, preprocessLang: style.lang })
    assert.deepEqual(result.errors, [])
    css += result.code
  }
  return data(script.replace('export default', 'const component=') + `;component.__scopeId='${id}';export default component`)
}
const badgeFile = 'src/components/articles/ArticlePinBadge.vue'
imports['@/components/articles/ArticlePinBadge.vue'] = await compile(fs.readFileSync(badgeFile, 'utf8'), badgeFile, 'data-v-pin')
const feedFile = 'src/components/articles/ArticleFeed.vue'
const feed = await compile(fs.readFileSync(feedFile, 'utf8'), feedFile, 'data-v-feed')
const homeFile = 'src/views/HomeView.vue'
const homeSource = fs.readFileSync(homeFile, 'utf8')
const home = parse(homeSource).descriptor
const homeList = home.template.content.match(/<ol class="module-list">[\s\S]*?<\/ol>/)?.[0]
assert.ok(homeList, '首页最新列表模板必须真实存在')
const homeFixture = await compile(`<script setup>
import {RouterLink} from 'vue-router'
import ArticlePinBadge from '@/components/articles/ArticlePinBadge.vue'
import {articlePinKind} from '@/utils/articlePin'
import {articleTitle} from '@/utils/text'
import {avatarStyle} from '@/utils/avatar'
defineProps(['left'])
const views=a=>a.articleViewCount
</script><template><section class="home"><div class="mod"><section class="mod-body"><div class="index-head"><b>最新</b><a href="/recent">全部帖子</a></div>${homeList}</section></div></section></template>
<style scoped lang="scss">${home.styles.map(s => s.content).join('\n')}</style>`, homeFile, 'data-v-home')
const avatar = 'data:image/png;base64,' + fs.readFileSync('public/images/user-thumbnail.png').toString('base64')
const items = [
  { oId: '1', articleTitle: '摸鱼派社区指南与发帖说明', stick: { active: true, permanent: true, expiresAt: null } },
  { oId: '2', articleTitle: '周末摄影分享：一起记录生活里的小美好', stick: { active: true, permanent: false, expiresAt: 1893456000000 } },
  { oId: '3', articleTitle: '今天有什么好听的歌推荐？' },
  { oId: '4', articleTitle: '这是一个很长很长的普通帖子标题，窄屏时仍应正常省略或换行，不撑出屏幕', stick: { active: false, permanent: false, expiresAt: 0 }, articleStick: 1 },
  { oId: '5', articleTitle: '匿名置顶内容保留身份隐私', articleAnonymous: 1, stick: { active: true, permanent: false, expiresAt: 1893456000000 } },
].map(a => ({ articleAuthorName: 'tester', articleAuthorNickname: '测试鱼油', articleAuthorId: '9', articleAuthorThumbnailURL48: avatar,
  articleViewCount: 128, articleCommentCount: 16, articleTags: '生活,分享', articleCreateTimeStr: '2026-11-14 12:00:00', ...a }))
const base = fs.readFileSync('src/styles/base.css', 'utf8').replace(/@import[^;]+;/g, '').replace(/@font-face\s*\{[^}]+\}/g, '')
const light = fs.readFileSync('src/packs/themes/classic-light/style.css', 'utf8')
const dark = fs.readFileSync('src/packs/themes/classic-dark/style.css', 'utf8')
const inner = fs.readFileSync('src/styles/inner-pages.css', 'utf8')
const html = `<!doctype html><html lang="zh-CN" data-theme="classic-light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${base}${light}${dark}${inner}${css}
body{padding:24px}main{max-width:1200px;margin:auto}h1{font-size:22px;margin:0 0 24px}.samples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.sample{min-width:0}.sample h2{font-size:14px;margin:0 0 12px;color:var(--fp-muted)}.sample>.card{padding:0;overflow:hidden;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:10px}.home .mod{margin:0}@media(max-width:700px){body{padding:12px}.samples{grid-template-columns:1fr;gap:20px}}
</style><script type="importmap">${JSON.stringify({ imports })}</script><div id="app"></div><script type="module">
import {createApp,h,reactive} from 'vue';import Feed from '${feed}';import Home from '${homeFixture}';
const items=reactive(${JSON.stringify(items)});window.items=items;
createApp({setup:()=>()=>h('main',{},[h('h1',{},'置顶帖子 · 样式核对'),h('div',{class:'samples'},[
 h('section',{class:'sample',id:'home'},[h('h2',{},'首页最新模块'),h(Home,{left:items})]),
 h('section',{class:'sample',id:'compact'},[h('h2',{},'内页紧凑列表'),h('div',{class:'card'},[h(Feed,{items,compact:true})])]),
 h('section',{class:'sample',id:'full'},[h('h2',{},'内页完整列表'),h('div',{class:'card'},[h(Feed,{items:items.slice(0,3)})])]),
 h('section',{class:'sample',id:'profile'},[h('h2',{},'个人中心帖子列表'),h('div',{class:'card'},[h(Feed,{items:items.slice(0,3),hideAuthor:true})])])
])])}).mount('#app');document.documentElement.dataset.ready='true';
</script></html>`
fs.writeFileSync(output + '/index.html', html)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  const errors = [], remoteRequests = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    if (route.request().url() === 'http://pins.test/') return route.fulfill({ contentType: 'text/html', body: html })
    remoteRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto('http://pins.test/')
  await page.waitForSelector('#home .article-pin-badge')
  assert.deepEqual(errors, [])
  for (const id of ['home', 'compact']) {
    const rows = page.locator(`#${id} .article-pin-row`)
    assert.equal(await rows.nth(0).locator('.article-pin-badge').innerText(), '永久置顶')
    assert.equal(await rows.nth(1).locator('.article-pin-badge').innerText(), '限时置顶')
    assert.equal(await rows.nth(2).locator('.article-pin-badge').count(), 0)
    assert.equal(await rows.nth(3).locator('.article-pin-badge').count(), 0)
    assert.equal(await rows.nth(4).locator('a[href^="/member/"]').count(), 0)
  }
  for (const theme of ['classic-light', 'classic-dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
    await page.waitForTimeout(200)
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1050 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme}/${width} 页面溢出`)
      const rows = page.locator('#compact .article-pin-row')
      const heights = await rows.evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height))
      assert.ok(Math.abs(heights[0] - heights[2]) < 1 && Math.abs(heights[1] - heights[2]) < 1, '标签不能抬高紧凑行：' + JSON.stringify(heights))
      const title = rows.first().locator('.title')
      const color = await title.evaluate(el => getComputedStyle(el).color)
      await title.hover()
      assert.equal(await title.evaluate(el => getComputedStyle(el).color), color, '悬浮保留标题颜色')
      const titleAligned = await page.locator('#full .feed-item[data-pin] .item-title').evaluateAll(titles => titles.every(title => {
        const badge = title.querySelector('.article-pin-badge').getBoundingClientRect()
        const link = title.querySelector('.title-link').getBoundingClientRect()
        return link.top < badge.bottom && link.left >= badge.right
      }))
      assert.ok(titleAligned, '窄屏置顶标签应与长标题同起行')
      await page.mouse.move(0, 0)
      if (width === 1440 || width === 390) await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true })
    }
  }
  await page.evaluate(() => { window.items[0].stick.active = false })
  await page.waitForFunction(() => !document.querySelector('#home .article-pin-row .article-pin-badge[data-pin="permanent"]'))
  assert.deepEqual(errors, [])
  assert.deepEqual(remoteRequests, [], '隔离验证不能访问真实业务接口')
  console.log('PASS 置顶标签、取消置顶、匿名资料、标题悬浮、两种主题和四档宽度；截图：' + output)
} finally {
  await browser.close()
}
