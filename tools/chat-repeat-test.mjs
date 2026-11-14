import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync('src/utils/chatRepeatGroups.ts', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { groupChatRepeats, repeatKey } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const line = (id, content = '摸鱼 +1', extra = {}) => ({ key: id, message: { oId: id, userName: id, content, html: `<p>${content}</p>`, ...extra } })
const a = line('a'), b = line('b'), c = line('c', '其他'), d = line('d')
assert.deepEqual(groupChatRepeats([a,b,c,d]).map(g=>g.length), [2,1,1])
assert.deepEqual(groupChatRepeats([a,{key:'notice',message:null},b]).map(g=>g.length), [1,1,1])
assert.deepEqual(groupChatRepeats([a,line('b','摸鱼 +1 ')]).map(g=>g.length), [1,1])
for (const extra of [{redPacket:{}},{card:{}},{content:undefined},{html:'<p><img src="x"></p>'},{html:'<blockquote>摸鱼</blockquote>'},{html:'<p><a href="x">摸鱼</a></p>'},{html:'<p><strong>摸鱼</strong></p>'},{html:''}]) assert.equal(repeatKey(line('x', '摸鱼 +1', extra).message), null)
assert.equal(repeatKey(line('x', '😊').message), '😊')
assert.deepEqual(groupChatRepeats([a,b]).flat(), [a,b], '保留原始消息身份、外观、表态与操作目标')
assert.deepEqual(groupChatRepeats([a,c,b]).map(g=>g.length), [1,1,1])
assert.deepEqual(groupChatRepeats([]), [])
console.log('PASS 连续分组、通知边界、精确正文、特殊内容排除、原消息保留')
