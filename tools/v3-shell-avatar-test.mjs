import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
import { computed, ref, watch, effectScope, nextTick } from 'vue'
const source=await fs.readFile('src/layouts/AppShell.vue','utf8')
const start=source.indexOf('const avatarUrl ='),end=source.indexOf('const displayName =',start)
assert.ok(start>=0&&end>start)
const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const avatarCode=ts.transpileModule(await fs.readFile('src/utils/avatar.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {avatarThumbnail}=await import('data:text/javascript;base64,'+Buffer.from(avatarCode).toString('base64'))
const scope=effectScope(),account=ref({oId:'1',userAvatarURL:"https://example.test/a'b.png?sig=a%2Bb+c&x=1&x=2#literal"})
const model=scope.run(()=>new Function('account','computed','ref','watch','avatarThumbnail',`${code};return {avatarUrl,visibleAvatarUrl,onAvatarError}`)(account,computed,ref,watch,avatarThumbnail))
const original=account.value.userAvatarURL
assert.equal(model.visibleAvatarUrl.value,original)
console.log('PASS shell avatar 1 actual AppShell setup preserves complete signed URL without encoding or trimming')
const error=url=>({currentTarget:{getAttribute:name=>name==='src'?url:null}})
model.onAvatarError(error(original));assert.equal(model.visibleAvatarUrl.value,'')
for(let i=0;i<5;i++)model.onAvatarError(error(original))
assert.equal(model.visibleAvatarUrl.value,'');assert.equal(account.value.userAvatarURL,original)
console.log('PASS shell avatar 2 failed image selects existing initial placeholder, no URL rewrite, self-retry loop or account mutation')
account.value={...account.value,userAvatarURL:'https://example.test/new.png?sig=keep'};await nextTick();assert.equal(model.visibleAvatarUrl.value,account.value.userAvatarURL)
model.onAvatarError(error(original));assert.equal(model.visibleAvatarUrl.value,account.value.userAvatarURL)
model.onAvatarError({currentTarget:null});assert.equal(model.visibleAvatarUrl.value,account.value.userAvatarURL)
console.log('PASS shell avatar 3 changed avatar retries once and late previous-URL error cannot hide current image')
model.onAvatarError(error(account.value.userAvatarURL));assert.equal(model.visibleAvatarUrl.value,'')
account.value={...account.value,oId:'2'};await nextTick();assert.equal(model.visibleAvatarUrl.value,account.value.userAvatarURL)
const rhypic='https://file.fishpi.cn/f/2026/11/02/269153.png'
account.value={...account.value,userAvatarURL:rhypic};await nextTick()
assert.equal(avatarThumbnail(rhypic,20),rhypic+'?imageView2/2/w/20')
assert.equal(avatarThumbnail(rhypic+'?sig=a%2Bb',20),rhypic+'?sig=a%2Bb')
assert.equal(avatarThumbnail(rhypic+'?imageView2/1/w/48',20),rhypic+'?imageView2/1/w/48')
const gif='https://file.fishpi.cn/2025/08/max-2cc87fe1.gif'
assert.equal(avatarThumbnail(gif,20),gif)
model.onAvatarError(error(avatarThumbnail(rhypic,34)))
assert.equal(model.visibleAvatarUrl.value,'')
account.value=null;await nextTick();assert.equal(model.visibleAvatarUrl.value,'')
assert.equal((source.match(/<img v-if="visibleAvatarUrl"[^>]*@error="onAvatarError"/g)||[]).length,2)
assert.ok(source.includes('<span v-else class="avatar fallback">'))
scope.stop()
console.log('PASS shell avatar 4 account change retries even same URL; logout clears image; both actual navigation/menu images share bounded failure state')
