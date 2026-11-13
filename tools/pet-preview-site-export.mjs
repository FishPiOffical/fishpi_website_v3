import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { Script } from 'node:vm'
import assert from 'node:assert/strict'

// 独立白名单导出，不能把站点凭据、测试库或整个工作区上传到预览站。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await fs.readFile(path.join(root, 'docs/pets-art/preview-site.json'), 'utf8'))
const checkout = path.resolve(process.argv[2] || path.join(root, '.temp/sites/pet-preview'))
assert.notEqual(checkout, root, '请使用独立的 Sites 目录')
const hostingPath = path.join(checkout, '.openai/hosting.json')
let hosting = { project_id: config.project_id, static: { directory: 'dist' } }
try {
  const existing = JSON.parse(await fs.readFile(hostingPath, 'utf8'))
  assert.equal(existing.project_id, config.project_id, '不能覆盖其他预览站的身份')
  assert.equal(existing.static?.directory, 'dist', '现有站点不是 dist 静态托管')
  hosting = existing
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const mediaRoot = path.join(root, config.media)
const manifestText = await fs.readFile(path.join(mediaRoot, 'manifest.json'), 'utf8')
const manifest = JSON.parse(manifestText)
const assets = new Map([['manifest.json', Buffer.from(manifestText)]])
for (const clip of manifest.clips) {
  for (const name of [clip.file, clip.poster]) {
    assert.match(name, /^[a-z0-9-]+\.(webm|webp)$/)
    const bytes = await fs.readFile(path.join(mediaRoot, name))
    if (name === clip.file) assert.equal(bytes.length, clip.bytes, `素材大小与清单不符：${name}`)
    assets.set(name, bytes)
  }
}
assert.equal(manifest.clips.reduce((sum, clip) => sum + clip.bytes, 0), manifest.totalBytes)

// 媒体地址随实际内容变化，保持同一个网站地址时也不会误用上次的缓存。
const hash = createHash('sha256')
for (const [name, bytes] of assets) hash.update(name).update(bytes)
const revision = hash.digest('hex').slice(0, 12)
const assetDirectory = `assets/${manifest.species}-${revision}`
assert.match(manifest.species, /^[a-z0-9-]+$/)
let html = await fs.readFile(path.join(root, config.preview), 'utf8')
assert.ok(html.includes("const base='"), '预览页面缺少素材路径')
html = html.replace(/const base='[^']*';/, `const base='./${assetDirectory}/';`)
html = html.replace(/<title>[^<]*<\/title>/, `<title>${config.title}</title>`)
html = html.replace('</head>', `<link rel="icon" type="image/webp" href="./${assetDirectory}/${manifest.clips[0].poster}"></head>`)
assert.ok(!html.includes('../../../'), '预览不能引用站点外的本地目录')
for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(script)

const dist = path.join(checkout, 'dist')
await fs.mkdir(path.join(dist, assetDirectory), { recursive: true })
await fs.mkdir(path.dirname(hostingPath), { recursive: true })
await fs.writeFile(`${hostingPath}.tmp`, JSON.stringify(hosting, null, 2) + '\n')
await fs.rename(`${hostingPath}.tmp`, hostingPath)
for (const [name, bytes] of assets) await fs.writeFile(path.join(dist, assetDirectory, name), bytes)
await fs.writeFile(path.join(dist, 'index.html'), html)
await fs.writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
await fs.writeFile(path.join(dist, '_headers'), `/\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`)
await fs.writeFile(path.join(checkout, '.gitignore'), '*.log\n.DS_Store\n.env*\n')
await fs.writeFile(path.join(checkout, 'README.md'), `# ${config.title}\n\n固定预览站：${config.url}\n\n复用 .openai/hosting.json 的 project_id 更新同一个 Site，不要新建站点。\n\n这是独立静态预览，不连接 Rhythm，不包含账号数据。网页及素材来自 website_v3 的 tools/pet-preview-site-export.mjs 白名单导出。\n\n本次素材：${manifest.species}，${manifest.clips.length} 个动作；媒体版本 ${revision}。\n`)
console.log(JSON.stringify({ checkout, project_id: config.project_id, assetDirectory, clips: manifest.clips.length, mediaBytes: [...assets.values()].reduce((sum, bytes) => sum + bytes.length, 0) }, null, 2))
