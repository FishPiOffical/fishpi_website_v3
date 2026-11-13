import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// 拼接浅底动作总览便于人工快速看图，游戏实际使用的透明 WebM 保持原样。
const root = process.cwd()
const species = process.argv.slice(2).find(value => value.startsWith('--species='))?.slice('--species='.length) || 'hexiaotun'
if (!['hexiaotun', 'momota', 'yubingmiao', 'paixiaoyu'].includes(species)) throw new Error('未知的宠物种类')
const directory = path.join(root, `public/images/pets/animations/${species}-v1`)
const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'))
if (manifest.clips.length !== 10) throw new Error('十项动作齐备后再生成总览')
const font = process.env.PET_FONT || '/System/Library/Fonts/STHeiti Medium.ttc'
await fs.access(font)
const filters = []
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-filter_complex_threads', '2']
// 显式使用支持 Alpha 的 VP9 解码器，避免预览合成时透明区变黑。
for (const [index, clip] of manifest.clips.entries()) {
  args.push('-threads', '1', '-stream_loop', '-1', '-c:v', 'libvpx-vp9', '-i', path.join(directory, clip.file))
  filters.push(`color=c=0xf6f7f3:s=224x244:r=24:d=8[bg${index}]`)
  filters.push(`[${index}:v]format=rgba,scale=192:192[fg${index}]`)
  filters.push(`[bg${index}][fg${index}]overlay=16:8:shortest=1,drawtext=fontfile='${font}':text='${clip.name}':fontsize=16:fontcolor=0x29332c:x=(w-text_w)/2:y=212[tile${index}]`)
}
const layout = manifest.clips.map((_, index) => `${index % 5 * 224}_${Math.floor(index / 5) * 244}`).join('|')
filters.push(`${manifest.clips.map((_, index) => `[tile${index}]`).join('')}xstack=inputs=10:layout=${layout}:shortest=1,format=yuv420p[out]`)
const output = path.join(root, `docs/pets-art/${species}-animations-v1/overview.mp4`)
args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-t', '8', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', output)
execFileSync(process.env.PET_FFMPEG || 'ffmpeg', args, { timeout: 120000, stdio: ['ignore', 'ignore', 'pipe'] })
console.log(`${output}: ${(await fs.stat(output)).size} bytes`)
