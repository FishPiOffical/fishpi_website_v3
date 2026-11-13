import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

// 使用真实临时 Git 仓库执行插件完整流程，远端操作由夹具截获，绝不请求真实服务。
const workflow = process.argv[2] || '/Users/ling/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts/site-workflow.mjs'
assert.ok(path.isAbsolute(workflow), '插件脚本必须使用绝对路径')
await fs.access(workflow)
const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim()
assert.ok(path.isAbsolute(realGit), '未找到 Git')
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sites-auth-compat-'))
const bin = path.join(directory, 'bin')
const globalConfig = path.join(directory, 'gitconfig')
const projectId = 'appgprj_sites_auth_fixture'
const remote = `https://chatgpt.com/backend-api/codex/sites/git/${projectId}`
const testToken = 'sites_fixture_token_not_a_real_credential'
const wrapper = `#!${process.execPath}
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
const args = process.argv.slice(2)
const env = { ...process.env }
const commandIndex = args.findIndex(arg => ['ls-remote', 'push', 'fetch'].includes(arg))
const isNetwork = commandIndex >= 0 && !args.includes('--get-url')
if (isNetwork) {
  const headers = args.filter(arg => arg.includes('extraHeader'))
  const auth = args.slice(0, commandIndex)
  const helper = spawnSync(env.FIXTURE_REAL_GIT, [...auth, 'config', '--get-all', 'credential.helper'], { env, encoding: 'utf8' })
  const entry = {
    command: args[commandIndex], args,
    traceKeys: Object.keys(env).filter(key => key.startsWith('GIT_TRACE') || key === 'GIT_CURL_VERBOSE'),
    hasAuthorizationEnv: !!env.SITES_GIT_AUTHORIZATION,
    authorizationMatchesFixture: env.SITES_GIT_AUTHORIZATION === 'Authorization: Bearer ' + env.FIXTURE_TOKEN,
    helperValues: helper.stdout.trimEnd().split('\\n'), headers,
  }
  fs.appendFileSync(env.FIXTURE_LOG, JSON.stringify(entry) + '\\n')
  // 未识别的远端也直接失败，测试出现缺陷时不能意外联网。
  if (!args.includes(env.FIXTURE_REMOTE)) {
    process.stderr.write('fixture rejected unknown remote\\n')
    process.exit(97)
  }
  if (env.FIXTURE_FAIL_NETWORK) {
    process.stderr.write(env.FIXTURE_FAIL_NETWORK)
    process.exit(128)
  }
  if (args[commandIndex] === 'push') {
    const head = spawnSync(env.FIXTURE_REAL_GIT, ['rev-parse', 'HEAD'], { env, encoding: 'utf8' })
    if (head.status !== 0) process.exit(head.status || 1)
    fs.writeFileSync(env.FIXTURE_REMOTE_STATE, head.stdout.trim())
  } else if (args[commandIndex] === 'ls-remote' && fs.existsSync(env.FIXTURE_REMOTE_STATE)) {
    process.stdout.write(fs.readFileSync(env.FIXTURE_REMOTE_STATE, 'utf8') + '\\trefs/heads/main\\n')
  }
  process.exit(0)
}
const result = spawnSync(env.FIXTURE_REAL_GIT, args, { env, encoding: 'utf8' })
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
process.exit(result.status ?? 1)
`

let passed = 0
try {
  await fs.mkdir(bin)
  await fs.writeFile(path.join(bin, 'git'), wrapper, { mode: 0o755 })
  // 显式隔离系统与用户 Git 配置，不读取宿主凭据。
  await fs.writeFile(globalConfig, '[credential]\n\thelper = fixture-sites-host-helper\n')
  const environment = {
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: globalConfig,
    GIT_AUTHOR_NAME: 'Sites fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Sites fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    FIXTURE_REAL_GIT: realGit, FIXTURE_REMOTE: remote, FIXTURE_TOKEN: testToken,
    GIT_TRACE: '1', GIT_TRACE_PACKET: '1', GIT_TRACE_CURL: '1', GIT_CURL_VERBOSE: '1',
  }

  async function run(name, credential, { publish = false, failure = '' } = {}) {
    const checkout = path.join(directory, name)
    const log = path.join(directory, `${name}.jsonl`)
    await fs.mkdir(path.join(checkout, '.openai'), { recursive: true })
    await fs.mkdir(path.join(checkout, 'dist'))
    await fs.writeFile(path.join(checkout, '.openai/hosting.json'), JSON.stringify({ project_id: projectId, static: { directory: 'dist' } }))
    await fs.writeFile(path.join(checkout, 'dist/index.html'), '<!doctype html><title>Fixture</title>Offline test')
    const archive = path.join(directory, `${name}.tar.gz`)
    const input = { credential, ...(publish ? { commands: [], archivePath: archive } : {}) }
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [workflow, '--project-id', projectId], {
        cwd: checkout,
        env: { ...environment, FIXTURE_LOG: log, FIXTURE_REMOTE_STATE: path.join(directory, `${name}.ref`), FIXTURE_FAIL_NETWORK: failure },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      let stdout = '', stderr = ''
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`${name} 执行超时`)) }, 20000)
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', error => { clearTimeout(timeout); reject(error) })
      child.on('close', code => { clearTimeout(timeout); resolve({ code, stdout, stderr }) })
      child.stdin.end(JSON.stringify(input) + '\n')
    })
    const records = await fs.readFile(log, 'utf8').then(text => text.trim().split('\n').filter(Boolean).map(JSON.parse), error => {
      if (error.code === 'ENOENT') return []
      throw error
    })
    return { ...result, records, checkout, archive }
  }

  const credential = mode => ({ auth_mode: mode, branch: 'main', remote_url: remote, ...(mode === 'http_extra_header' ? { token: testToken } : {}) })
  for (const mode of ['codex_auth', 'work_proxy', 'http_extra_header']) {
    const result = await run(`success-${mode}`, credential(mode), { publish: true })
    assert.equal(result.code, 0, `${mode}: ${result.stderr}`)
    assert.deepEqual(result.records.map(item => item.command), ['ls-remote', 'push', 'ls-remote'], `${mode} 流程或请求数量异常`)
    for (const call of result.records) {
      assert.equal(call.args.includes('credential.helper='), mode !== 'codex_auth', `${mode} 的宿主 helper 处理不正确`)
      assert.ok(call.args.includes('http.followRedirects=false'))
      assert.deepEqual(call.traceKeys, [])
      assert.equal(call.hasAuthorizationEnv, mode === 'http_extra_header')
      assert.equal(call.authorizationMatchesFixture, mode === 'http_extra_header')
      assert.ok(!call.args.some(arg => arg.includes(testToken)), '令牌不能进入 Git 命令参数')
      if (mode === 'codex_auth') assert.ok(call.helperValues.includes('fixture-sites-host-helper'))
    }
    const output = JSON.parse(result.stdout.trim().split('\n').at(-1))
    assert.equal(output.project_id, projectId)
    assert.match(output.commit_sha, /^[a-f0-9]{40}$/)
    assert.equal(output.archive, result.archive)
    assert.ok((await fs.stat(result.archive)).size > 0)
    assert.ok(!result.stdout.includes(testToken) && !result.stderr.includes(testToken))
    passed += 1
  }

  const invalidInputs = [
    ['http', { remote_url: remote.replace('https:', 'http:') }],
    ['username', { remote_url: remote.replace('https://', 'https://user@') }],
    ['password', { remote_url: remote.replace('https://', 'https://user:password@') }],
    ['query', { remote_url: `${remote}?token=fake` }],
    ['fragment', { remote_url: `${remote}#fake` }],
    ['other-host', { remote_url: remote.replace('chatgpt.com', 'example.invalid') }],
    ['other-project', { remote_url: `${remote}-different` }],
    ['unknown-mode', { auth_mode: 'unknown' }],
    ['option-branch', { branch: '--config' }],
    ['expired', { token_expires_at: '2000-01-01T00:00:00Z' }],
    ['missing-bearer', { auth_mode: 'http_extra_header' }],
    ['newline-bearer', { auth_mode: 'http_extra_header', token: 'fake\nHeader: bad' }],
  ]
  for (const [name, changes] of invalidInputs) {
    const result = await run(`invalid-${name}`, { ...credential('codex_auth'), ...changes })
    assert.notEqual(result.code, 0, `${name} 不应被接受`)
    assert.deepEqual(result.records, [], `${name} 必须在联网前拒绝`)
    passed += 1
  }

  // 一次失败只能终止当前认证流程，不能悄悄换认证方式继续请求。
  for (const mode of ['codex_auth', 'work_proxy', 'http_extra_header']) {
    const failure = mode === 'http_extra_header'
      ? `fixture failed: ${testToken}\nAuthorization: Bearer synthetic-secret\nAuthorization: Basic synthetic-basic\n`
      : 'fixture auth unavailable\nAuthorization: Bearer synthetic-secret\nAuthorization: Basic synthetic-basic\n'
    const result = await run(`failure-${mode}`, credential(mode), { failure })
    assert.equal(result.code, 128)
    assert.equal(result.records.length, 1, `${mode} 失败后不能重试或切换认证方式`)
    assert.ok(result.stderr.includes(mode === 'http_extra_header' ? 'fixture failed' : 'fixture auth unavailable'))
    for (const secret of [testToken, 'synthetic-secret', 'synthetic-basic']) {
      assert.ok(!result.stdout.includes(secret) && !result.stderr.includes(secret), `${mode} 输出未脱敏`)
    }
    passed += 1
  }
  console.log(`Sites 认证兼容回归通过：${passed} 项；三种认证、源码提交与打包、URL 拒绝、宿主 helper、日志脱敏和失败不重试均已覆盖。`)
  console.log('全部远端操作由本地夹具截获；未访问真实服务或读取用户凭据。')
} finally {
  await fs.rm(directory, { recursive: true, force: true })
}
