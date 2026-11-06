import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { formatDateTime, formatDate, formatDisplayTime, timeISO } from '../src/utils/time.ts'
const iso='2026-11-06T08:30:45.123Z'
assert.equal(formatDateTime(iso),'2026-11-06 16:30:45')
assert.equal(formatDateTime(Date.parse(iso)),'2026-11-06 16:30:45')
assert.equal(formatDateTime('2026-11-06 16:30:45'),'2026-11-06 16:30:45')
assert.equal(formatDateTime('2026-11-06T10:30:45+02:00'),'2026-11-06 16:30:45')
assert.equal(formatDateTime('2026-11-06T16:30'),'2026-11-06 16:30:00')
assert.equal(formatDate('2026-11-06'),'2026-11-06')
assert.equal(formatDateTime(0),'1970-01-01 08:00:00')
assert.equal(formatDateTime('2026-02-30T08:00:00Z'),'时间未知');assert.equal(formatDateTime('Fri Nov 06 16:30:45 CST 2026'),'2026-11-06 16:30:45');assert.equal(formatDateTime('Fri Nov 06 08:30:45 UTC 2026'),'2026-11-06 16:30:45')
assert.equal(formatDateTime(null),'时间未知');assert.equal(formatDateTime('garbage'),'时间未知');assert.equal(formatDateTime(NaN),'时间未知');assert.equal(timeISO('bad'),undefined)
assert.equal(timeISO('2026-11-06 16:30:45'),'2026-11-06T08:30:45.000Z')
assert.equal(formatDisplayTime('3分钟前'),'3分钟前');assert.equal(formatDisplayTime('刚刚'),'刚刚');assert.equal(formatDisplayTime(''),'时间未知')
for(const tz of ['UTC','America/New_York','Asia/Shanghai']) {
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import{formatDateTime}from './src/utils/time.ts';console.log(formatDateTime('${iso}'));console.log(formatDateTime('2026-11-06 16:30:45'))`],{encoding:'utf8',env:{...process.env,TZ:tz}})
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'2026-11-06 16:30:45\n2026-11-06 16:30:45')
}
console.log('PASS shared Beijing display format, offsets/date-only/milliseconds, unknown and relative semantics, server/browser timezone determinism')
