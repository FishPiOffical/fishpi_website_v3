// 报告只根据已经落盘的结果汇总，不发请求，也不把测试类数误当作断言组数。
const cleanCell = value => String(value ?? '—').replace(/[|\r\n]/g, ' ')
const counter = value => Number.isSafeInteger(value) && value >= 0 ? value : null

export function backendMetrics(result) {
  return {
    status: result?.status,
    baseline: result?.baselineRequested === true,
    suites: counter(result?.baselineSuitesPassed),
    steps: counter(result?.sequence?.requestedSteps),
    invariantChecks: counter(result?.sequence?.invariantChecks),
    concurrency: counter(result?.sequence?.concurrencyScenarios),
  }
}

const stopLabels = {
  deadline: '正常到期',
  manual: '手动停止',
  blocked: '访问受限',
  service_error: '服务异常',
  failure: '检查失败',
  pending: '仍有待核验操作',
}

export function liveStopInfo(live) {
  if (!live) return { label: '尚未开始', issue: null }
  let kind = live.stopReason
  // 旧报告仅在明确 complete 且为旧通用结束文案时按正常到期显示；不能吞掉未知异常原因。
  if (!kind && live.status === 'complete' && live.reason === '测试时间结束或用户停止') kind = 'deadline'
  if (!kind && live.status === 'stopped') kind = 'manual'
  if (kind === 'deadline' && live.status === 'complete') return { label: '正常到期', issue: null }
  if (!live.reason && !kind && live.status === 'running') return { label: '进行中', issue: null }
  const label = stopLabels[kind] || live.status || '未知'
  const issue = live.reason || (['complete', 'running'].includes(live.status) ? null : label)
  return { label: live.reason ? `${label}：${live.reason}` : label, issue }
}

export function reportIssues(state, live) {
  return [...new Set([
    ...(state.failures || []),
    ...(state.interruptions || []).map(item => item.reason),
    ...(live?.failures || []),
    ...(live?.failedChecks || []),
    liveStopInfo(live).issue,
  ].filter(Boolean))]
}

export function suiteTable(suites) {
  return suites.map(item => {
    // 后端运行器输出的是结构化汇总，PASS 组数不适用；基线类、不变量、并发场景分别列出。
    const backend = item.name === 'backend' ? item.backend : null
    const groups = item.name === 'backend' ? '—' : cleanCell(item.passGroups)
    return `| ${cleanCell(item.name)} | ${cleanCell(item.seed)} | ${cleanCell(item.status)} | ${groups} | ${cleanCell(backend?.suites)} | ${cleanCell(backend?.invariantChecks)} | ${cleanCell(backend?.concurrency)} | ${cleanCell(item.seconds)}s | ${cleanCell(item.log)} |`
  }).join('\n')
}

export function renderSoakReport(config, state, live, updatedAt = Date.now()) {
  const passed = state.suites.filter(item => item.status === 'passed')
  const failed = state.suites.filter(item => item.status === 'failed')
  const issues = reportIssues(state, live)
  const activities = (live?.completedActivities || []).map(item => `| ${item.actor + 1} | ${cleanCell(item.kind)} | ${cleanCell(item.name)} | ${cleanCell(item.entryId)} | ${item.rewards.experience} | ${item.rewards.coins} | ${new Date(item.verifiedAt).toISOString()} |`).join('\n')
  const resources = Object.keys(config.processes).map(name => {
    const rows = state.samples.flatMap(sample => sample.values.filter(value => value.name === name))
    if (!rows.length) return `- ${name}：等待采样。`
    const rss = rows.map(row => Number(row.rssCpu.trim().split(/\s+/)[0]) / 1024)
    const cpu = rows.map(row => Number(row.rssCpu.trim().split(/\s+/)[1]))
    const descriptors = rows.map(row => row.fileDescriptors)
    return `- ${name}：RSS ${Math.min(...rss).toFixed(1)}–${Math.max(...rss).toFixed(1)} MiB，首末差 ${(rss.at(-1) - rss[0]).toFixed(1)} MiB；CPU ${Math.min(...cpu).toFixed(1)}–${Math.max(...cpu).toFixed(1)}%；文件描述符 ${Math.min(...descriptors)}–${Math.max(...descriptors)}，${rows.length} 次采样。`
  }).join('\n')
  const issueText = issues.length ? issues.map(item => '- ' + item).join('\n')
    : state.status === 'completed' ? '本次记录中未发现失败或异常中断。' : '尚未发现（测试结束前不能视为完整结论）。'
  return [
    `# 宠物本地自动检查（目标 ${(config.durationMs / 3_600_000).toFixed(3)} 小时）`,
    `状态：**${state.status}**。运行编号：\`${config.id}\`。`,
    [
      `- 开始：${new Date(config.startedAt).toISOString()}`,
      `- 计划结束：${new Date(config.endsAt).toISOString()}`,
      `- 最近更新：${new Date(updatedAt).toISOString()}`,
      `- 累计有效心跳时间：${(state.validElapsedMs / 3_600_000).toFixed(3)} 小时 / 目标 ${(config.durationMs / 3_600_000).toFixed(3)} 小时`,
      `- 最大心跳间隔：${(state.maxHeartbeatGapMs / 1000).toFixed(1)} 秒；剩余待核验命令：${state.pendingCommands.length}。`,
      `- 代码版本：website ${config.source.frontend.head.slice(0, 8)}；Rhythm ${config.source.backend.head.slice(0, 8)}`,
      `- 专项轮次：${passed.length} 成功、${failed.length} 失败；进行中的轮次不会提前记为通过。`,
      `- 真实 HTTP：${live?.status ?? '启动中'}，请求 ${live?.requests ?? 0} 次，断言 ${live?.checks ?? 0} 次。`,
      `- 真实 HTTP 结束说明：${liveStopInfo(live).label}。`,
    ].join('\n'),
    '## 问题与中断',
    issueText,
    '## 覆盖方式',
    [
      '1. 前端真实 API 解码/Pinia/Vue 组件与桌宠算法，每15分钟换种子检查；包含身份隔离、超时、断流、原键恢复、离线与额度边界。',
      '2. 后端真实服务与隔离 SQLite 事务，首次完整回归，随后每小时不同种子运行随机状态序列。时间推进与自然等待结果分开。',
      '3. 四个专用普通账号通过 localhost:8081 自然时间领养、照顾、购买、课程/工作/探索、领取、日志与刷新 Cookie；全部账号共用30请求/分钟上限，已成功写入用同键核验幂等。',
      '4. 每15秒核对本地服务身份、源码版本、测试进程和睡眠间隔；每5分钟采样服务 RSS/CPU 及文件描述符数。',
    ].join('\n'),
    '## 明确未覆盖',
    '真机软键盘与触摸、真实浏览器连续8小时内存、网络运营商/CORS/CDN及生产风控、动画。有限场景不能证明穷尽所有潜在缺陷；未在真实时间完成的活动由隔离专项验证，不能称为全部功能真实 HTTP 验收。长跑未结束、进程中断、源码/服务变化、任何失败或睡眠缺口，都不能标记8小时通过。',
    '## 专项明细',
    '后端列直接读取结构化汇总：基线为测试类数，不变量为状态检查次数，并发为场景数；这些指标不能互相相加冒充 PASS 组数。',
    '| 专项 | 种子 | 结果 | 前端 PASS 组数 | 后端基线类 | 后端不变量 | 后端并发场景 | 耗时 | 日志 |\n|---|---|---|---|---|---|---|---|---|\n' + suiteTable(state.suites),
    '## 真实接口覆盖',
    Object.entries(live?.coverage || {}).map(([name, count]) => '- ' + name + '：' + count).join('\n') || '等待首批结果。',
    '## 自然计时完成的活动',
    activities ? '| 测试账号 | 类型 | 名称 | 条目 | 经验 | 宠物币 | 核验时间 |\n|---|---|---|---|---|---|---|\n' + activities : '尚无自然到期并成功领取的活动。',
    '未列出的活动不算真实 HTTP 完成，完整目录由隔离专项分别验证。技能、工作熟练度与物品增量见 live-summary.json。',
    '## 服务资源观察',
    resources,
    'RSS 包含运行时缓存与垃圾回收波动，仅作观察，不把首末差直接判定为内存泄漏或无泄漏。',
    '完整可复现记录见 events.jsonl、live-events.jsonl、各专项日志、state.json。账号凭据文件不属于报告，禁止上传。',
  ].join('\n\n') + '\n'
}
