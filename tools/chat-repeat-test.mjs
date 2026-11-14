import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
globalThis.document = new JSDOM('').window.document
const source = fs.readFileSync('src/utils/chatRepeatGroups.ts', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { groupChatRepeats, repeatKey } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const line = (id, content = '摸鱼 +1', extra = {}) => ({ key: id, message: { oId: id, userName: id, content, html: `<p>${content}</p>`, ...extra } })
const a = line('a'), b = line('b'), c = line('c', '其他'), d = line('d')
assert.deepEqual(groupChatRepeats([a,b,c,d]).map(g=>g.length), [2,1,1])
assert.deepEqual(groupChatRepeats([a,{key:'notice',message:null},b]).map(g=>g.length), [1,1,1])
assert.deepEqual(groupChatRepeats([a,line('b','摸鱼 +1 ')]).map(g=>g.length), [1,1])
for (const extra of [{redPacket:{}},{card:{}},{content:undefined},{html:'<p><img src="x"></p>'},{html:'<blockquote>摸鱼</blockquote>'},{html:'<p><a href="x">摸鱼</a></p>'},{html:'<p><strong>摸鱼</strong></p>'},{html:''}]) assert.equal(repeatKey(line('x', '摸鱼 +1', extra).message), null)
assert.equal(repeatKey(line('x', '😊').message), JSON.stringify(['text','😊']))
assert.deepEqual(groupChatRepeats([a,b]).flat(), [a,b], '保留原始消息身份、外观、表态与操作目标')
assert.deepEqual(groupChatRepeats([a,c,b]).map(g=>g.length), [1,1,1])
assert.deepEqual(groupChatRepeats([]), [])
console.log('PASS 连续分组、通知边界、精确正文、特殊内容排除、原消息保留')

const image = (id, src, text='', alt='图片') => line(id, `![${alt}](${src})${text}`, {html:`<p><img src="${src}" alt="${alt}">${text}</p>`})
const original='https://file.fishpi.cn/2026/11/fish.png'
assert.deepEqual(groupChatRepeats([image('1',original),image('2',original+'?imageView2/1/w/240/h/160','','不同描述'),image('3',original+'/w/480')]).map(g=>g.length),[3])
assert.deepEqual(groupChatRepeats([image('1',original,'摸鱼'),image('2',original+'?imageView2/2/w/200','摸鱼'),image('3',original,'摸鱼！')]).map(g=>g.length),[2,1])
assert.deepEqual(groupChatRepeats([image('1',original+'?token=a'),image('2',original+'?token=b')]).map(g=>g.length),[1,1])
assert.deepEqual(groupChatRepeats([image('1','https://example.com/a.png/w/20'),image('2','https://example.com/a.png/w/40')]).map(g=>g.length),[1,1])
assert.notEqual(repeatKey(image('1',original,' x').message),repeatKey(image('2',original,'x').message))
const multi=(id,urls)=>line(id,'多图',{html:'<p>'+urls.map(src=>`<img src="${src}">`).join('')+'</p>'})
assert.equal(repeatKey(multi('1',[original,original+'/w/20']).message),repeatKey(multi('2',[original+'/w/40',original]).message))
assert.notEqual(repeatKey(multi('1',[original,original+'?v=2']).message),repeatKey(multi('2',[original+'?v=2',original]).message))
assert.equal(repeatKey(image('1','javascript:alert(1)').message),null)
assert.equal(repeatKey(line('1','引用',{html:`<blockquote><img src="${original}"></blockquote>`}).message),null)
assert.deepEqual(groupChatRepeats([image('1',original),{key:'notice',message:null},image('2',original)]).map(g=>g.length),[1,1,1])
console.log('PASS 图片原地址、尺寸归一化、图文精确匹配、多图顺序、签名及第三方参数保留、引用隔离')
