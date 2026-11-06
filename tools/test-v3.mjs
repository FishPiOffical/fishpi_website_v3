import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Execute the actual protocol suites in separate processes: their fixture globals must not mix.
const root = fileURLToPath(new URL('../', import.meta.url))
const files = (await readdir(join(root, 'tools')))
  .filter(name => /^v3-.+-test\.mjs$/.test(name) || ['main-v3-only-test.mjs', 'feedback-test.mjs'].includes(name))
  .sort()
if (!files.length) throw new Error('未发现接口v3 专项，拒绝空验证成功')
const directory = await mkdtemp(join(tmpdir(), 'fishpi-v3-tests-'))
const results = []
let cursor = 0
async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++]
    const log = join(directory, file + '.log')
    const started = Date.now()
    const result = await new Promise(resolve => {
      const output = createWriteStream(log)
      const child = spawn(process.execPath, [join(root, 'tools', file)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
      child.stdout.pipe(output, { end: false })
      child.stderr.pipe(output, { end: false })
      let expired = false, spawnError = ''
      const timer = setTimeout(() => { expired = true; child.kill('SIGKILL') }, 60000)
      child.on('error', error => { spawnError = error.message })
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        output.end(() => resolve({ file, code, signal, expired, spawnError, durationMs: Date.now() - started, log }))
      })
    })
    results.push(result)
    console.log(`${result.code === 0 && !result.expired && !result.spawnError ? 'PASS' : 'FAIL'} ${file}`)
  }
}
await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker))
results.sort((a, b) => a.file.localeCompare(b.file))
const failed = results.filter(result => result.code !== 0 || result.expired || result.spawnError)
await writeFile(join(directory, 'results.json'), JSON.stringify({ total: files.length, failed: failed.length, results }, null, 2) + '\n')
console.log(`v3 专项 ${files.length} 项，通过 ${files.length - failed.length} 项，失败 ${failed.length} 项。`)
console.log(`独立日志与结果：${directory}`)
for (const result of failed) console.error(`失败详情：${result.log}${result.expired ? '（超时）' : ''}`)
process.exitCode = failed.length ? 1 : 0
