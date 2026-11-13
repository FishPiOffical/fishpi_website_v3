import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// 仅修补指定的本机插件脚本，不改全局 Git 配置，也不读取登录凭据。
const root = process.argv[2]
if (!root || !path.isAbsolute(root)) throw new Error('请提供 Sites 插件目录的绝对路径')
const patch = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sites-auth-compat.patch')
const script = path.join(root, 'scripts/site-workflow.mjs')
await fs.access(script)
const runGit = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' })

if (runGit(['apply', '--reverse', '--check', patch]).status === 0) {
  console.log('Sites 认证兼容补丁已应用，无需重复修改。')
} else {
  const check = runGit(['apply', '--check', patch])
  if (check.status !== 0) throw new Error('插件版本与补丁不匹配，已停止；请重新检查源码，不能强制套用。')
  const original = await fs.readFile(script)
  const backup = `${script}.before-codex-auth`
  try {
    await fs.writeFile(backup, original, { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    if (!(await fs.readFile(backup)).equals(original)) throw new Error('存在不同版本备份，已停止，未覆盖。')
  }
  const applied = runGit(['apply', patch])
  if (applied.status !== 0) throw new Error('补丁应用失败，原脚本备份仍保留。')
  const syntax = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' })
  if (syntax.status !== 0) {
    await fs.writeFile(script, original)
    throw new Error('修补后语法检查失败，已恢复原脚本。')
  }
  console.log('Sites 认证兼容补丁已应用；仍需宿主提供有效的 Sites Git 认证助手。')
}
