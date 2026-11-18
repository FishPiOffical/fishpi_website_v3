import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { build } from 'vite'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const result = await build({ configFile: false, logLevel: 'error', resolve: { alias: { '@': resolve('src') } }, build: {
  write: false, lib: { entry: resolve('src/utils/articleCode.ts'), name: 'articleCode', formats: ['iife'] },
} })
const output = (Array.isArray(result) ? result[0] : result).output
const script = output.find(file => file.type === 'chunk').code
const css = output.find(file => file.fileName.endsWith('.css')).source
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const [width, theme] of [[1280, 'classic-light'], [390, 'classic-dark']]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    const line = 'const example = "<img src=x>";' + ' '.repeat(160) + '// end'
    const html = '<p>使用 <code>example</code></p><pre><code>' + line.replace('<', '&lt;').replace('>', '&gt;') + '\n</code></pre><pre><code class="language-unknown">custom output</code></pre>'
    await page.setContent(`<html data-theme="${theme}"><main id="app"><article class="fp-article-prose">${html}</article></main></html>`)
    await page.addStyleTag({ content: css })
    await page.addScriptTag({ path: resolve('node_modules/vue/dist/vue.global.prod.js') })
    await page.addScriptTag({ content: script })
    await page.evaluate(({ html, line }) => {
      const { createSSRApp, h, ref, withDirectives } = Vue
      const body = ref(html)
      window.replacePost = () => { body.value = '<pre><code class="language-python">def greet(): pass</code></pre>' }
      createSSRApp({ setup: () => () => withDirectives(h('article', { class: 'fp-article-prose', innerHTML: body.value }), [
        [articleCode.vArticleCode, [body.value, '```js\n' + line + '\n```']],
      ]) }).mount('#app')
    }, { html, line })
    const keyword = page.locator('pre .hljs-keyword').first()
    await keyword.waitFor()
    assert.equal(await keyword.textContent(), 'const')
    assert.equal(await page.locator('pre code').first().textContent(), line + '\n')
    assert.equal(await page.locator('img, p .hljs, .language-unknown.hljs').count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await page.locator('pre').first().evaluate(el => el.scrollWidth > el.clientWidth))
    await page.evaluate(() => window.replacePost())
    await page.waitForFunction(() => document.querySelector('.language-python .hljs-keyword')?.textContent === 'def')
    const groupMarkdown = ':::code-group\n\n```js\nrun()\n```\n\n```python\nrun()\n```\n\n:::'
    await page.evaluate(markdown => {
      const region = document.createElement('article')
      const pair = '<pre><code>run()\n</code></pre>'.repeat(2)
      region.innerHTML = '<p>:::code-group</p>' + pair + '<p>:::</p>' + '<pre><code>plain</code></pre>'
        + '<p>:::code-group</p><pre><code>unfinished</code></pre>'
      document.body.append(region)
      articleCode.renderArticleCode(region, markdown)
      articleCode.renderArticleCode(region, markdown)
    }, groupMarkdown)
    const tabs = page.getByRole('tab'), visiblePanel = page.getByRole('tabpanel')
    assert.deepEqual(await tabs.allTextContents(), ['js', 'python'])
    assert.equal(await visiblePanel.count(), 1)
    assert.equal(await page.locator('article > pre').count(), 3)
    await tabs.last().click()
    assert.equal(await visiblePanel.getAttribute('aria-labelledby'), await tabs.last().getAttribute('id'))
    await tabs.last().press('ArrowRight')
    assert.equal(await tabs.first().getAttribute('aria-selected'), 'true')
    await tabs.first().press('End')
    assert.equal(await tabs.last().getAttribute('aria-selected'), 'true')
    await page.close()
    console.log(`PASS ${width}px ${theme}: hydration, inline code, fenced language, escaped markup, overflow, post replacement`)
  }
} finally { await browser.close() }
