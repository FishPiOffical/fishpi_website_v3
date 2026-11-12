#!/usr/bin/env node
// 本地耐久测试调度器：长期进程自行记录结果，不依赖对话持续在线。
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runs = path.join(root, '.temp/pet-soak')
const argv = process.argv.slice(2)
const action = argv.shift() || 'status'
function option(name, fallback) {
  const inline = argv.find(value => value.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = argv.indexOf(`--${name}`)
  return index < 0 ? fallback : argv[index + 1]
}
const stamp = () => new Date().toISOString()
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
function command(file, args, cwd = root) {
  return execFileSync(file, args, { cwd, encoding: 'utf8', timeout: 20_000, maxBuffer: 8_000_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
async function json(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}
async function writeJson(file, value) {
  await fs.writeFile(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  await fs.rename(file + '.tmp', file)
}
function alive(pid) {
  if (!Number.isInteger(pid) || pid < 2) return false
  try { process.kill(pid, 0); return true } catch { return false }
}
function processIdentity(pid) {
  return command('ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'comm='])
}
function listener(port) {
  const pids = [...new Set(command('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).split('\n'))]
  if (pids.length !== 1 || !/^\d+$/.test(pids[0])) throw new Error(`端口 ${port} 的进程无法唯一确认`)
  const pid = Number(pids[0])
  return { pid, identity: processIdentity(pid) }
}
function source(repository) {
  // 新增且未跟踪的源码同样参与基线，避免热更新绕过 git diff 检查。
  const paths = ['src', 'tools', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json']
  const untracked = command('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', ...paths], repository).split('\0').filter(Boolean)
  const additions = untracked.map(file => [file, digest(execFileSync('git', ['hash-object', '--', file], { cwd: repository }))])
  return { head: command('git', ['rev-parse', 'HEAD'], repository),
    changes: digest(command('git', ['diff', 'HEAD', '--', ...paths], repository) + JSON.stringify(additions)) }
}
async function resolveRun() {
  const id = option('run', (await json(path.join(runs, 'latest.json'), {})).id)
  if (!id || !/^\d{8}T\d{6}Z-[a-f0-9]{6}$/.test(id)) throw new Error('没有可用测试记录，先执行 start')
  return path.join(runs, id)
}
async function status(directory) {
  const state = await json(path.join(directory, 'state.json'), {})
  const config = await json(path.join(directory, 'config.json'), {})
  const running = alive(state.pid) && state.workerIdentity === processIdentity(state.pid)
  const stale = state.status === 'running' && (!running || Date.now() - (state.lastHeartbeat || state.updatedAt || 0) > 120_000)
  console.log(JSON.stringify({ run: path.basename(directory), status: stale ? 'interrupted-or-unresponsive' : state.status || 'starting', running, stale,
    startedAt: config.startedAt ? new Date(config.startedAt).toISOString() : null,
    plannedEnd: config.endsAt ? new Date(config.endsAt).toISOString() : null,
    suites: state.suites?.length || 0, failures: state.failures || [],
    report: path.join(directory, 'report.md'), live: await json(path.join(directory, 'live-summary.json'), null) }, null, 2))
}

if (action === 'start') {
  const hours = Number(option('hours', '8'))
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('hours 必须在0到24之间')
  const rhythm = path.resolve(option('rhythm', '/Users/ling/Documents/GitHub/rhythm'))
  const defaultFrontend = listener(5173), defaultBackend = listener(8081)
  if (!defaultFrontend.identity.includes('node') || !defaultBackend.identity.includes('java')) throw new Error('本地端口的进程类型不符合预期')
  if (command('git', ['branch', '--show-current']) !== 'pet' || command('git', ['branch', '--show-current'], rhythm) !== 'pet') throw new Error('两个仓库必须位于pet分支')
  await fs.mkdir(runs, { recursive: true, mode: 0o700 })
  const lock = path.join(runs, 'active.lock')
  try { await fs.mkdir(lock) } catch (error) {
    if (error.code === 'EEXIST') throw new Error('已有测试锁，请用 status 查看；不要同时启动多次')
    throw error
  }
  const id = stamp().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') + '-' + crypto.randomBytes(3).toString('hex')
  const directory = path.join(runs, id)
  await fs.mkdir(directory, { mode: 0o700 })
  try {
    // 凭据不在参数、源码或报告中；只为本轮创建四个普通用户。
    command('python3', [path.join(root, 'tools/pet-soak/prepare-local.py'), '--rhythm', rhythm, '--output', path.join(directory, 'accounts.private.json')])
    const startedAt = Date.now()
    const config = { id, root, rhythm, api: 'http://localhost:8081', frontend: 'http://127.0.0.1:5173',
      startedAt, endsAt: startedAt + hours * 3_600_000, durationMs: hours * 3_600_000,
      source: { frontend: source(root), backend: source(rhythm) }, processes: { frontend: defaultFrontend, backend: defaultBackend },
      intervals: { frontend: 15 * 60_000, backend: 60 * 60_000, heartbeat: 15_000, sleepGap: 120_000 },
      seeds: crypto.randomBytes(4).readUInt32LE(0), cases: 128, backendSteps: 200 }
    await writeJson(path.join(directory, 'config.json'), config)
    await writeJson(path.join(runs, 'latest.json'), { id })
    const log = await fs.open(path.join(directory, 'runner.log'), 'a', 0o600)
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'run', '--run', id], {
      cwd: root, detached: true, stdio: ['ignore', log.fd, log.fd], env: { ...process.env, PET_SOAK_RUN_ID: id },
    })
    child.unref()
    await log.close()
    await writeJson(path.join(lock, 'owner.json'), { id, pid: child.pid })
    await sleep(1500)
    await status(directory)
  } catch (error) {
    await fs.rm(lock, { recursive: true, force: true })
    throw error
  }
} else if (action === 'status') {
  await status(await resolveRun())
} else if (action === 'stop') {
  const directory = await resolveRun()
  await fs.writeFile(path.join(directory, 'STOP'), '用户请求停止\n', { mode: 0o600 })
  console.log('已写入停止指令，调度器会在15秒内停止，只保留已记录结果：' + directory)
} else if (action === 'run') {
  const directory = await resolveRun()
  const config = await json(path.join(directory, 'config.json'))
  if (process.env.PET_SOAK_RUN_ID !== config.id) throw new Error('请通过 start 启动')
  // 建号与源码摘要耗时不冒充持续观察时间，从后台工作进程就绪起计满目标时长。
  config.requestedAt = config.startedAt
  config.startedAt = Date.now()
  config.endsAt = config.startedAt + config.durationMs
  await writeJson(path.join(directory, 'config.json'), config)
  const state = { pid: process.pid, workerIdentity: processIdentity(process.pid), status: 'running', startedAt: config.startedAt, updatedAt: Date.now(),
    lastHeartbeat: Date.now(), maxHeartbeatGapMs: 0, pendingCommands: [],
    suites: [], failures: [], interruptions: [], samples: [], validElapsedMs: 0 }
  const children = new Set()
  let stop = false, lastHeartbeat = config.startedAt, heartbeatFlight = null, suiteSerial = 0
  let liveChild, liveExited = false, timer
  const terminations = new Map()
  const hardDeadline = setTimeout(() => { for (const child of children) terminate(child) }, Math.max(0, config.endsAt - Date.now()) + 15_000)
  const logEvent = async (type, detail) => fs.appendFile(path.join(directory, 'events.jsonl'), JSON.stringify({ at: stamp(), type, ...detail }) + '\n', { mode: 0o600 })
  function terminate(child) {
    if (!child?.pid) return Promise.resolve()
    if (terminations.has(child.pid)) return terminations.get(child.pid)
    const groupAlive = () => { try { process.kill(-child.pid, 0); return true } catch { return false } }
    const task = (async () => {
      if (!groupAlive()) return
      try { process.kill(-child.pid, 'SIGTERM') } catch {}
      const until = Date.now() + 5000
      while (groupAlive() && Date.now() < until) await sleep(100)
      if (groupAlive()) { try { process.kill(-child.pid, 'SIGKILL') } catch {} }
      const killedUntil = Date.now() + 2000
      while (groupAlive() && Date.now() < killedUntil) await sleep(100)
      if (groupAlive()) state.failures.push('本轮测试子进程未能停止：' + child.pid)
    })()
    terminations.set(child.pid, task)
    return task
  }
  function shutdown(reason) {
    if (stop) return
    stop = true
    state.interruptions.push({ at: stamp(), reason })
    for (const child of children) terminate(child)
  }
  process.on('SIGTERM', () => shutdown('收到停止信号'))
  process.on('SIGINT', () => shutdown('收到中断信号'))
  const monitor = process.platform === 'darwin' ? spawn('/usr/bin/caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' }) : null

  let reportFlight = Promise.resolve()
  function report() {
    reportFlight = reportFlight.then(renderReport)
    return reportFlight
  }
  async function renderReport() {
    state.updatedAt = Date.now()
    await writeJson(path.join(directory, 'state.json'), state)
    const live = await json(path.join(directory, 'live-summary.json'), null)
    const passed = state.suites.filter(x => x.status === 'passed'), failed = state.suites.filter(x => x.status === 'failed')
    const table = state.suites.map(x => `| ${x.name} | ${x.seed ?? '—'} | ${x.status} | ${x.passGroups ?? '—'} | ${x.seconds}s | ${x.log} |`).join('\n')
    const cleanCell = value => String(value ?? '—').replace(/[|\r\n]/g, ' ')
    const activities = (live?.completedActivities || []).map(item => `| ${item.actor + 1} | ${cleanCell(item.kind)} | ${cleanCell(item.name)} | ${cleanCell(item.entryId)} | ${item.rewards.experience} | ${item.rewards.coins} | ${new Date(item.verifiedAt).toISOString()} |`).join('\n')
    const resources = Object.keys(config.processes).map(name => {
      const rows = state.samples.flatMap(sample => sample.values.filter(value => value.name === name))
      if (!rows.length) return `- ${name}：等待采样。`
      const rss = rows.map(row => Number(row.rssCpu.trim().split(/\s+/)[0]) / 1024)
      const cpu = rows.map(row => Number(row.rssCpu.trim().split(/\s+/)[1]))
      const descriptors = rows.map(row => row.fileDescriptors)
      return `- ${name}：RSS ${Math.min(...rss).toFixed(1)}–${Math.max(...rss).toFixed(1)} MiB，首末差 ${(rss.at(-1) - rss[0]).toFixed(1)} MiB；CPU ${Math.min(...cpu).toFixed(1)}–${Math.max(...cpu).toFixed(1)}%；文件描述符 ${Math.min(...descriptors)}–${Math.max(...descriptors)}，${rows.length} 次采样。`
    }).join('\n')
    const text = `# 宠物本地自动检查（目标 ${(config.durationMs / 3_600_000).toFixed(3)} 小时）\n\n状态：**${state.status}**。运行编号：\`${config.id}\`。\n\n` +
      `- 开始：${new Date(config.startedAt).toISOString()}\n- 计划结束：${new Date(config.endsAt).toISOString()}\n- 最近更新：${stamp()}\n` +
      `- 累计有效心跳时间：${(state.validElapsedMs / 3_600_000).toFixed(3)} 小时 / 目标 ${(config.durationMs / 3_600_000).toFixed(3)} 小时\n` +
      `- 最大心跳间隔：${(state.maxHeartbeatGapMs / 1000).toFixed(1)} 秒；剩余待核验命令：${state.pendingCommands.length}。\n` +
      `- 代码版本：website ${config.source.frontend.head.slice(0, 8)}；Rhythm ${config.source.backend.head.slice(0, 8)}\n` +
      `- 专项轮次：${passed.length} 成功、${failed.length} 失败；进行中的轮次不会提前记为通过。\n` +
      `- 真实HTTP：${live?.status ?? '启动中'}，请求 ${live?.requests ?? 0} 次，断言 ${live?.checks ?? 0} 次。\n\n` +
      `## 问题与中断\n\n${[...state.failures, ...state.interruptions.map(x => x.reason), ...(live?.failures || []), ...(live?.reason ? [live.reason] : [])].map(x => '- ' + x).join('\n') || '尚未发现（测试结束前不能视为完整结论）。'}\n\n` +
      `## 覆盖方式\n\n` +
      `1. 前端真实API解码/Pinia/Vue组件与桌宠算法，每15分钟换种子检查；包含身份隔离、超时、断流、原键恢复、离线与额度边界。\n` +
      `2. 后端真实服务与隔离SQLite事务，首次完整回归，随后每小时不同种子运行随机状态序列。时间推进与自然等待结果分开。\n` +
      `3. 四个专用普通账号通过 localhost:8081 自然时间领养、照顾、购买、课程/工作/探索、领取、日志与刷新Cookie；全部账号共用30请求/分钟上限，已成功写入用同键核验幂等。\n` +
      `4. 每15秒核对本地服务身份、源码版本、测试进程和睡眠间隔；每5分钟采样服务RSS/CPU及文件描述符数。\n\n` +
      `## 明确未覆盖\n\n真机软键盘与触摸、真实浏览器连续8小时内存、网络运营商/CORS/CDN及生产风控、动画。` +
      `有限场景不能证明穷尽所有潜在缺陷；未在真实时间完成的活动由隔离专项验证，不能称为全部功能真实HTTP验收。` +
      `长跑未结束、进程中断、源码/服务变化、任何失败或睡眠缺口，都不能标记8小时通过。\n\n` +
      `## 专项明细\n\n| 专项 | 种子 | 结果 | PASS组数 | 耗时 | 日志 |\n|---|---|---|---|---|---|\n${table}\n\n` +
      `## 真实接口覆盖\n\n${Object.entries(live?.coverage || {}).map(([name, count]) => '- ' + name + '：' + count).join('\n') || '等待首批结果。'}\n\n` +
      `## 自然计时完成的活动\n\n${activities ? '| 测试账号 | 类型 | 名称 | 条目 | 经验 | 宠物币 | 核验时间 |\n|---|---|---|---|---|---|---|\n' + activities : '尚无自然到期并成功领取的活动。'}\n\n未列出的活动不算真实 HTTP 完成，完整目录由隔离专项分别验证。技能、工作熟练度与物品增量见 live-summary.json。\n\n` +
      `## 服务资源观察\n\n${resources}\n\nRSS 包含运行时缓存与垃圾回收波动，仅作观察，不把首末差直接判定为内存泄漏或无泄漏。\n\n` +
      `完整可复现记录见 events.jsonl、live-events.jsonl、各专项日志、state.json。账号凭据文件不属于报告，禁止上传。\n`
    await fs.writeFile(path.join(directory, 'report.md.tmp'), text, { mode: 0o600 })
    await fs.rename(path.join(directory, 'report.md.tmp'), path.join(directory, 'report.md'))
  }

  async function suite(name, executable, args, cwd, seed) {
    if (stop || Date.now() >= config.endsAt) return false
    const serial = ++suiteSerial, filename = `${String(serial).padStart(3, '0')}-${name}.log`
    const log = await fs.open(path.join(directory, filename), 'a', 0o600)
    const started = Date.now()
    await logEvent('suite-start', { name, seed, log: filename })
    const child = spawn(executable, args, { cwd, detached: true, stdio: ['ignore', log.fd, log.fd] })
    children.add(child)
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; void terminate(child) }, Math.min(8 * 60_000, Math.max(1, config.endsAt - Date.now())))
    const code = await new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('exit', (value) => resolve(value ?? -1)) })
    clearTimeout(timeout)
    if (timedOut) await terminate(child)
    children.delete(child)
    await log.close()
    const output = await fs.readFile(path.join(directory, filename), 'utf8')
    const record = { name, seed, log: filename, status: code === 0 ? 'passed' : stop || Date.now() >= config.endsAt ? 'interrupted' : 'failed',
      passGroups: (output.match(/^PASS\b/gm) || []).length, seconds: Math.round((Date.now() - started) / 1000), exitCode: code }
    if (name === 'backend') {
      const summaryPath = args[args.indexOf('--summary') + 1]
      const result = await json(summaryPath, {})
      record.backend = { status: result.status, baseline: !!result.baselineRequested, suites: result.baselineSuitesPassed,
        steps: result.sequence?.requestedSteps, invariantChecks: result.sequence?.invariantChecks, concurrency: result.sequence?.concurrencyScenarios }
      if (code === 0 && (result.status !== 'passed' || result.sequence?.status !== 'passed')) record.status = 'failed'
    }
    if (record.status === 'failed') state.failures.push(`${name} 失败，seed=${seed ?? '—'}，见 ${filename}`)
    state.suites.push(record)
    await logEvent('suite-end', record)
    await report()
    return code === 0
  }

  function heartbeat() {
    if (heartbeatFlight) return heartbeatFlight
    heartbeatFlight = checkEnvironment().finally(() => { heartbeatFlight = null })
    return heartbeatFlight
  }

  async function checkEnvironment() {
    try {
      const now = Date.now(), previousHeartbeat = lastHeartbeat, delta = now - lastHeartbeat
      lastHeartbeat = now
      state.lastHeartbeat = now
      state.maxHeartbeatGapMs = Math.max(state.maxHeartbeatGapMs, delta)
      if (delta > config.intervals.sleepGap || delta < 0) shutdown('检测到睡眠、调度或时钟异常，连续8小时条件不成立')
      else state.validElapsedMs += Math.max(0, Math.min(now, config.endsAt) - previousHeartbeat)
      if (await fs.stat(path.join(directory, 'STOP')).catch(() => false)) shutdown('用户停止测试')
      if (JSON.stringify(source(root)) !== JSON.stringify(config.source.frontend)
          || JSON.stringify(source(config.rhythm)) !== JSON.stringify(config.source.backend)) shutdown('源码版本发生变化，停止混合版本测试')
      if (listener(5173).pid !== config.processes.frontend.pid || listener(8081).pid !== config.processes.backend.pid) shutdown('本地服务监听端口已更换')
      for (const entry of Object.values(config.processes)) {
        if (!alive(entry.pid) || processIdentity(entry.pid) !== entry.identity) shutdown('本地服务已停止或被替换，停止写入')
      }
      if (!state.samples.length || now - state.samples.at(-1).at > 5 * 60_000) {
        const values = Object.entries(config.processes).map(([name, entry]) => ({ name, pid: entry.pid,
          rssCpu: command('ps', ['-p', String(entry.pid), '-o', 'rss=', '-o', '%cpu=']),
          fileDescriptors: command('lsof', ['-p', String(entry.pid), '-Ff']).split('\n').filter(x => /^f\d/.test(x)).length }))
        state.samples.push({ at: now, values })
      }
      if (liveExited) {
        const live = await json(path.join(directory, 'live-summary.json'), {})
        if (!stop && !['complete'].includes(live.status) && now < config.endsAt - 1000) {
          if (!state.failures.includes('真实HTTP测试提前结束')) state.failures.push('真实HTTP测试提前结束')
          // 真实链路失败后仍执行隔离回归，便于一次获得完整诊断；不重启登录或写入。
        }
      }
      await report()
    } catch (error) {
      shutdown('环境核对失败：' + error.message.split('\n')[0])
      await report()
    }
  }

  try {
    await report()
    const liveLog = await fs.open(path.join(directory, 'live-runner.log'), 'a', 0o600)
    liveChild = spawn('python3', [path.join(root, 'tools/pet-soak/live.py'), '--directory', directory], {
      cwd: root, detached: true, stdio: ['ignore', liveLog.fd, liveLog.fd], env: { ...process.env, PYTHONUNBUFFERED: '1' },
    })
    children.add(liveChild)
    liveChild.once('exit', () => { liveExited = true; children.delete(liveChild); void liveLog.close() })
    liveChild.once('error', () => { liveExited = true; children.delete(liveChild); void liveLog.close() })
    timer = setInterval(() => { void heartbeat() }, config.intervals.heartbeat)
    let frontDue = 0, backDue = 0, round = 0, baseline = true, finalBaseline = false
    while (!stop && Date.now() < config.endsAt) {
      if (Date.now() >= frontDue) {
        frontDue = Date.now() + config.intervals.frontend
        const seed = (config.seeds + round++ * 2654435761) >>> 0
        for (const [name, file] of [['frontend-state', 'pets-test.mjs'], ['frontend-vue', 'pets-ui-test.mjs'], ['desktop', 'pet-desktop-test.mjs']]) {
          if (stop || Date.now() >= config.endsAt) break
          await suite(name, process.execPath, [path.join(root, 'tools', file), `--seed=${seed}`, `--cases=${config.cases}`], root, seed)
        }
      }
      const closingBaseline = !finalBaseline && config.durationMs >= 3_600_000 && Date.now() >= config.endsAt - 5 * 60_000
      if (!stop && Date.now() < config.endsAt && (Date.now() >= backDue || closingBaseline)) {
        backDue = Date.now() + config.intervals.backend
        const seed = (config.seeds + round++ * 2654435761) >>> 0
        const target = path.join(directory, `backend-${seed}.json`)
        await suite('backend', process.execPath, ['tools/experiments/api-v3-pets-soak-cycle.mjs', '--seed', String(seed), '--steps', String(config.backendSteps),
          '--cache-dir', path.join(directory, 'java-cache'), '--summary', target, ...(baseline || closingBaseline ? ['--baseline'] : [])], config.rhythm, seed)
        baseline = false
        if (closingBaseline) finalBaseline = true
      }
      await sleep(Math.min(1000, Math.max(0, config.endsAt - Date.now())))
    }
    clearInterval(timer)
    // 自然截止时先给HTTP子进程机会记录结尾，再清理，仅停止本轮拥有的进程。
    if (!stop) {
      await sleep(1500)
      if (!liveExited) await terminate(liveChild)
    }
    await sleep(1000)
    // 清除计时器不代表在途心跳已结束；先等旧检查，再做截止后的最终检查。
    if (heartbeatFlight) await heartbeatFlight
    await heartbeat()
    const live = await json(path.join(directory, 'live-summary.json'), {})
    state.pendingCommands = (await fs.readdir(directory)).filter(file => /^pending-\d+\.json$/.test(file))
    const required = ['frontend-state', 'frontend-vue', 'desktop', 'backend']
    const missing = required.filter(name => !state.suites.some(x => x.name === name && x.status === 'passed'))
    const baselineCount = state.suites.filter(x => x.name === 'backend' && x.status === 'passed' && x.backend?.baseline).length
    if (missing.length) state.failures.push('未完成必需专项：' + missing.join('、'))
    if (config.durationMs >= 3_600_000 && baselineCount < 2) state.failures.push('未完成首末后端完整基线')
    if (!live.initialized) state.failures.push('四个真实账号初始化未全部完成')
    if (state.pendingCommands.length) state.failures.push('仍有待核验操作：' + state.pendingCommands.join('、'))
    if (state.suites.some(x => x.status === 'interrupted')) state.failures.push('存在中断且未完成的专项')
    const fullDuration = state.validElapsedMs >= config.durationMs - 1000
    state.status = stop || !fullDuration ? 'interrupted' : state.failures.length || live.status !== 'complete' ? 'failed' : 'completed'
    state.finishedAt = Date.now()
    await report()
  } catch (error) {
    state.status = 'failed'
    state.failures.push('运行器异常：' + error.message.split('\n')[0])
    await report()
  } finally {
    clearInterval(timer)
    clearTimeout(hardDeadline)
    if (heartbeatFlight) await heartbeatFlight
    await Promise.all([...children].map(terminate))
    await Promise.all(terminations.values())
    if (state.status === 'completed' && state.failures.length) state.status = 'failed'
    monitor?.kill()
    const lock = path.join(runs, 'active.lock')
    const owner = await json(path.join(lock, 'owner.json'), {})
    await report().catch(() => {})
    if (owner.id === config.id && !state.failures.some(x => x.startsWith('本轮测试子进程未能停止'))) await fs.rm(lock, { recursive: true, force: true })
  }
} else {
  throw new Error('用法：node tools/pets-soak.mjs start [--hours 8 --rhythm 路径] | status [--run 编号] | stop [--run 编号]')
}
