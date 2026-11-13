#!/usr/bin/env node
// 纯报告回归不启动服务、不写测试账号，也不改动历史长跑记录。
import assert from 'node:assert/strict'
import { backendMetrics, liveStopInfo, reportIssues, renderSoakReport, suiteTable } from './report.mjs'

let groups = 0
function test(name, check) {
  check()
  groups += 1
  console.log('PASS ' + name)
}
const state = {
  status: 'completed', suites: [], failures: [], interruptions: [], samples: [],
  pendingCommands: [], validElapsedMs: 28_800_000, maxHeartbeatGapMs: 15_007,
}
const config = {
  durationMs: 28_800_000, startedAt: 1_700_000_000_000, endsAt: 1_700_028_800_000,
  id: 'test-report', source: { frontend: { head: 'frontend123' }, backend: { head: 'backend123' } },
  processes: { frontend: {}, backend: {} },
}
const backend = {
  status: 'passed', baselineRequested: true, baselineSuitesPassed: 6,
  sequence: { status: 'passed', requestedSteps: 200, invariantChecks: 202, concurrencyScenarios: 5 },
}

test('后端指标直接使用结构化字段，分别保留基线类、不变量和并发场景', () => {
  assert.deepEqual(backendMetrics(backend), {
    status: 'passed', baseline: true, suites: 6, steps: 200, invariantChecks: 202, concurrency: 5,
  })
  assert.equal(backendMetrics({ ...backend, baselineRequested: false, baselineSuitesPassed: 0 }).suites, 0)
})

test('缺失或非法计数保持未知，不制造零次通过', () => {
  assert.equal(backendMetrics({}).suites, null)
  assert.equal(backendMetrics({ baselineSuitesPassed: '6' }).suites, null)
  assert.equal(backendMetrics({ sequence: { invariantChecks: -1, concurrencyScenarios: 1.5 } }).invariantChecks, null)
  assert.equal(backendMetrics({ sequence: { concurrencyScenarios: 1.5 } }).concurrency, null)
})

test('历史后端 PASS=0 不再显示成零组，前端仍保留实际 PASS 组数', () => {
  const table = suiteTable([
    { name: 'backend', seed: 12, status: 'passed', passGroups: 0, backend: backendMetrics(backend), seconds: 10, log: 'backend.log' },
    { name: 'frontend-state', seed: 12, status: 'passed', passGroups: 42, seconds: 1, log: 'frontend.log' },
  ])
  assert.match(table, /backend \| 12 \| passed \| — \| 6 \| 202 \| 5 \|/)
  assert.match(table, /frontend-state \| 12 \| passed \| 42 \| — \| — \| — \|/)
})

test('正常到期独立展示，不进入问题与中断', () => {
  const live = { status: 'complete', stopReason: 'deadline', reason: '预定测试时间已结束', failures: [] }
  assert.deepEqual(liveStopInfo(live), { label: '正常到期', issue: null })
  assert.deepEqual(reportIssues(state, live), [])
  const report = renderSoakReport(config, state, live, config.endsAt)
  assert.match(report, /真实 HTTP 结束说明：正常到期/)
  assert.match(report, /## 问题与中断\n\n本次记录中未发现失败或异常中断。/)
})

test('旧长跑通用结束文案仅在 complete 时兼容为正常到期', () => {
  const reason = '测试时间结束或用户停止'
  assert.deepEqual(reportIssues(state, { status: 'complete', reason }), [])
  assert.equal(liveStopInfo({ status: 'stopped', reason }).label, '手动停止：' + reason)
  assert.deepEqual(reportIssues(state, { status: 'stopped', reason }), [reason])
})

test('手动停止与访问受限、服务异常、断言失败、待核验保留不同原因', () => {
  for (const [kind, status, label] of [
    ['manual', 'stopped', '手动停止'],
    ['blocked', 'blocked', '访问受限'],
    ['service_error', 'failed', '服务异常'],
    ['failure', 'failed', '检查失败'],
    ['pending', 'incomplete', '仍有待核验操作'],
  ]) {
    const live = { status, stopReason: kind, reason: '本例原因' }
    assert.equal(liveStopInfo(live).label, `${label}：本例原因`)
    assert.deepEqual(reportIssues(state, live), ['本例原因'])
  }
})

test('未知错误及上层中断不能被正常截止掩盖，并去除重复问题', () => {
  assert.deepEqual(reportIssues(state, { status: 'complete', reason: '未知子进程异常' }), ['未知子进程异常'])
  assert.deepEqual(reportIssues({ ...state, failures: ['待核验'], interruptions: [{ reason: '服务被替换' }] }, {
    status: 'complete', stopReason: 'deadline', reason: '预定测试时间已结束', failures: ['待核验'],
    failedChecks: ['冻结口粮与材料准确到账'],
  }), ['待核验', '服务被替换', '冻结口粮与材料准确到账'])
})

test('进行中不提前下结论，历史报告重渲染不改变原始对象', () => {
  const live = { status: 'running', requests: 3, checks: 8 }
  const snapshot = JSON.stringify({ config, state, live })
  const report = renderSoakReport(config, { ...state, status: 'running' }, live, config.startedAt)
  assert.match(report, /测试结束前不能视为完整结论/)
  assert.match(report, /真实 HTTP 结束说明：进行中/)
  assert.equal(JSON.stringify({ config, state, live }), snapshot)
})
console.log(`SUMMARY ${groups} groups passed`)
