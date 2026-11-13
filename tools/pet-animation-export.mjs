import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// 仅规范化已绘制的连续帧并编码，不拆分身体，也不生成光流过渡帧。
const root = process.cwd()
const argumentsList = process.argv.slice(2)
const species = argumentsList.find(value => value.startsWith('--species='))?.slice('--species='.length) || 'hexiaotun'
if (!['hexiaotun', 'momota', 'yubingmiao', 'paixiaoyu'].includes(species)) throw new Error('未知的宠物种类')
const sourceDir = path.join(root, `docs/pets-art/${species}-animations-v1/sources`)
const outputDir = path.join(root, `public/images/pets/animations/${species}-v1`)
const tempDir = path.join(root, `.temp/${species}-animations-v1`)
const chrome = process.env.PET_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ffmpeg = process.env.PET_FFMPEG || 'ffmpeg'
const definitions = [
  { id: 'idle', name: '待机', mode: 'loop', holds: [12, 8, 6, 6, 6, 6, 6, 8, 12, 8, 6, 6, 6, 6, 6, 8] },
  species === 'hexiaotun'
    ? { id: 'eat', name: '吃叶子', mode: 'once', approved: true, frames: 110, duration: 110 / 24 }
    : { id: 'eat', name: species === 'paixiaoyu' ? '吃点心' : '吃小鱼', mode: 'once', holds: [10, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 6, 6, 6, 10] },
  { id: 'drink', name: '喝水', mode: 'once', holds: [10, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 6, 6, 6, 12] },
  { id: 'pet', name: '被摸摸', mode: 'once', holds: [10, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 6, 6, 6, 6, 10] },
  { id: 'play', name: '玩耍', mode: 'once', holds: Array(16).fill(6) },
  { id: 'sleep', name: '睡觉', mode: 'loop', holds: Array(16).fill(12) },
  { id: 'explore', name: '外出', mode: 'loop', holds: Array(16).fill(5) },
  { id: 'study', name: '上课', mode: 'loop', holds: Array(16).fill(8) },
  { id: 'work', name: '工作', mode: 'loop', holds: Array(16).fill(6) },
  { id: 'celebrate', name: '开心庆祝', mode: 'once', holds: [10, 6, 6, 6, 6, 6, 6, 8, 8, 6, 6, 6, 6, 6, 6, 10] },
]

const requested = argumentsList.filter(value => !value.startsWith('--species='))
if (requested.some(id => !definitions.some(item => item.id === id))) throw new Error('未知的宠物动作')
await fs.mkdir(outputDir, { recursive: true })
await fs.mkdir(tempDir, { recursive: true })

function command(binary, args, options = {}) {
  try { return execFileSync(binary, args, { timeout: 120000, maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options }) }
  catch (error) {
    // 不打印包含原始图片数据的浏览器完整输出。
    throw new Error(`${path.basename(binary)} 执行失败：${String(error.stderr || error.code || error.message).slice(-1200)}`)
  }
}

function extractInBrowser() {
  const image = new Image()
  image.src = SOURCE
  image.onload = () => {
    const frames = []
    const grid = document.createElement('canvas')
    grid.width = image.naturalWidth
    grid.height = image.naturalHeight
    grid.getContext('2d').drawImage(image, 0, 0)
    for (let index = 0; index < 16; index += 1) {
      const x = Math.round(index % 4 * grid.width / 4)
      const y = Math.round(Math.floor(index / 4) * grid.height / 4)
      const width = Math.round((index % 4 + 1) * grid.width / 4) - x
      const height = Math.round((Math.floor(index / 4) + 1) * grid.height / 4) - y
      const cell = document.createElement('canvas')
      cell.width = width
      cell.height = height
      const context = cell.getContext('2d')
      context.drawImage(grid, x, y, width, height, 0, 0, width, height)
      const data = context.getImageData(0, 0, width, height).data
      const visited = new Uint8Array(width * height)
      const queue = new Int32Array(width * height)
      let largest = null
      let transparent = 0
      const bounds = [width, height, 0, 0]
      for (let pixel = 0; pixel < width * height; pixel += 1) {
        if (data[pixel * 4 + 3] < 64) { transparent += 1; continue }
        const px = pixel % width
        const py = Math.floor(pixel / width)
        bounds[0] = Math.min(bounds[0], px)
        bounds[1] = Math.min(bounds[1], py)
        bounds[2] = Math.max(bounds[2], px + 1)
        bounds[3] = Math.max(bounds[3], py + 1)
        // 透明底的极淡色残留不能成为角色锚点；仅用实体部分定位，不改变源图透明通道。
        if (visited[pixel] || data[pixel * 4 + 3] < 128) continue
        let head = 0, tail = 1
        queue[0] = pixel
        visited[pixel] = 1
        const part = { count: 0, left: px, right: px, top: py, bottom: py }
        while (head < tail) {
          const current = queue[head++]
          const cx = current % width, cy = Math.floor(current / width)
          part.count += 1
          part.left = Math.min(part.left, cx); part.right = Math.max(part.right, cx)
          part.top = Math.min(part.top, cy); part.bottom = Math.max(part.bottom, cy)
          for (const next of [cx > 0 ? current - 1 : -1, cx + 1 < width ? current + 1 : -1, cy > 0 ? current - width : -1, cy + 1 < height ? current + width : -1]) {
            if (next >= 0 && !visited[next] && data[next * 4 + 3] >= 128) { visited[next] = 1; queue[tail++] = next }
          }
        }
        if (!largest || part.count > largest.count) largest = part
      }
      if (!largest || transparent < width * height * .08) throw new Error('源图不是可用的透明连续帧')
      frames.push({ cell, bounds, anchorX: (largest.left + largest.right + 1) / 2, anchorY: largest.bottom + 1, transparent })
    }
    // 同一动作使用同一个缩放比例，只校准角色脚下基线，避免每帧自动缩放造成呼吸式变形。
    let left = 0, right = 0, height = 0, below = 0
    for (const frame of frames) {
      left = Math.max(left, frame.anchorX - frame.bounds[0])
      right = Math.max(right, frame.bounds[2] - frame.anchorX)
      height = Math.max(height, frame.anchorY - frame.bounds[1])
      below = Math.max(below, frame.bounds[3] - frame.anchorY)
    }
    const scale = Math.min(232 / height, 116 / left, 116 / right, below > 0 ? 10 / below : Infinity)
    const result = frames.map(frame => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const context = canvas.getContext('2d')
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(frame.cell, 128 - frame.anchorX * scale, 244 - frame.anchorY * scale, frame.cell.width * scale, frame.cell.height * scale)
      return { png: canvas.toDataURL('image/png').split(',')[1], bounds: frame.bounds, anchor: [frame.anchorX, frame.anchorY], transparent: frame.transparent }
    })
    document.querySelector('pre').textContent = JSON.stringify({ width: grid.width, height: grid.height, scale, frames: result })
    document.querySelector('script').remove()
  }
  image.onerror = () => { document.querySelector('pre').textContent = 'ERROR: image decode failed'; document.querySelector('script').remove() }
}

for (const definition of definitions.filter(item => requested.length ? requested.includes(item.id) : !item.approved)) {
  if (definition.approved) continue
  const source = await fs.readFile(path.join(sourceDir, `${definition.id}.png`))
  const dir = path.join(tempDir, definition.id)
  await fs.mkdir(dir, { recursive: true })
  const html = `<!doctype html><pre></pre><script>const SOURCE=${JSON.stringify(`data:image/png;base64,${source.toString('base64')}`)};(${extractInBrowser.toString()})()</script>`
  const htmlPath = path.join(dir, 'extract.html')
  await fs.writeFile(htmlPath, html)
  const dom = command(chrome, ['--headless=new', '--no-first-run', '--disable-background-networking', `--user-data-dir=${path.join(tempDir, 'chrome-export')}`, '--virtual-time-budget=3000', '--dump-dom', `file://${htmlPath}`]).toString()
  const match = dom.match(/<pre>([\s\S]*?)<\/pre>/)
  if (!match || !match[1].startsWith('{')) throw new Error(`${definition.id} 提取失败`)
  const extracted = JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'))
  let frameNumber = 0
  for (let index = 0; index < 16; index += 1) {
    const bytes = Buffer.from(extracted.frames[index].png, 'base64')
    for (let hold = 0; hold < definition.holds[index]; hold += 1) await fs.writeFile(path.join(dir, `${String(frameNumber++).padStart(3, '0')}.png`), bytes)
  }
  command(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(dir, '000.png'), '-c:v', 'libwebp', '-quality', '85', path.join(outputDir, `${definition.id}.webp`)])
  const filename = path.join(outputDir, `${definition.id}.webm`)
  command(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '24', '-i', path.join(dir, '%03d.png'), '-frames:v', String(frameNumber), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '35', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-row-mt', '1', '-threads', '2', '-an', filename])
  await fs.writeFile(path.join(dir, 'extraction.json'), JSON.stringify({ ...extracted, frames: extracted.frames.map(({ png, ...metadata }) => metadata) }, null, 2))
  console.log(`${definition.id}: ${frameNumber} frames, ${(frameNumber / 24).toFixed(3)} s, ${(await fs.stat(filename)).size} bytes`)
}

// 首版预览按实际存在的输出生成清单，缺少文件不能冒充已完成。
const clips = []
for (const definition of definitions) {
  const filename = path.join(outputDir, `${definition.id}.webm`)
  try {
    const stat = await fs.stat(filename)
    const frames = definition.frames || definition.holds.reduce((sum, value) => sum + value, 0)
    clips.push({ id: definition.id, name: definition.name, mode: definition.mode, file: `${definition.id}.webm`, poster: `${definition.id}.webp`, width: 256, height: 256, fps: 24, uniqueFrames: 16, frames, duration: frames / 24, bytes: stat.size, interpolated: false, approvedEatingSource: Boolean(definition.approved) })
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify({ version: 1, species, transparent: true, codec: 'vp9', previewOnly: true, totalBytes: clips.reduce((sum, clip) => sum + clip.bytes, 0), clips }, null, 2) + '\n')
