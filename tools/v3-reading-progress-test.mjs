import assert from 'node:assert/strict'
import {readChapterProgress,rememberChapter} from '../src/utils/readingProgress.ts'
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}
rememberChapter('column-one','12');assert.equal(readChapterProgress('column-one'),'12');rememberChapter('column-one','13');assert.equal(readChapterProgress('column-one'),'13');assert.equal(readChapterProgress('other'),'')
rememberChapter('column-one','javascript:evil');assert.equal(readChapterProgress('column-one'),'13');assert.ok(![...values.values()][0].includes('title'))
for(let i=1;i<=120;i++)rememberChapter('column-'+i,String(i));assert.ok(Object.keys(JSON.parse([...values.values()][0])).length<=100)
values.set('fp.reading-progress.v1','{invalid');assert.equal(readChapterProgress('column-one'),'');globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.doesNotThrow(()=>rememberChapter('one','1'));assert.equal(readChapterProgress('one'),'');delete globalThis.localStorage;assert.equal(readChapterProgress('one'),'')
console.log('PASS reading progress stores only validated chapter IDs, bounded optional local storage, invalid/blocked/SSR safe')
