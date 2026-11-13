import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// 三种新宠物外出动作并排预览；只合成视频，不修改游戏使用的透明素材。
const root = process.cwd()
const pets = [['momota', '摸摸獭'], ['yubingmiao', '鱼饼喵'], ['paixiaoyu', '派小鱼']]
const font = process.env.PET_FONT || '/System/Library/Fonts/STHeiti Medium.ttc'
await fs.access(font)
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-filter_complex_threads', '2']
const filters = []
for (const [index, [species, name]] of pets.entries()) {
  const file = path.join(root, `public/images/pets/animations/${species}-v1/explore.webm`)
  await fs.access(file)
  args.push('-threads', '1', '-stream_loop', '-1', '-c:v', 'libvpx-vp9', '-i', file)
  filters.push(`color=c=0xf6f7f3:s=288x304:r=24:d=6[bg${index}]`)
  filters.push(`[${index}:v]format=rgba[fg${index}]`)
  filters.push(`[bg${index}][fg${index}]overlay=16:8:shortest=1,drawtext=fontfile='${font}':text='${name}':fontsize=18:fontcolor=0x29332c:x=(w-text_w)/2:y=276[tile${index}]`)
}
filters.push('[tile0][tile1][tile2]hstack=inputs=3:shortest=1,format=yuv420p[out]')
const output = path.join(root, 'docs/pets-art/explore-walk-v2.mp4')
args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-t', '6', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart', output)
execFileSync(process.env.PET_FFMPEG || 'ffmpeg', args, { timeout: 120000, stdio: ['ignore', 'ignore', 'pipe'] })
console.log(`${output}: ${(await fs.stat(output)).size} bytes`)
