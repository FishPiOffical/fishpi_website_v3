import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import ts from 'typescript'
// Execute the actual router option, with a controlled DOM; this is not a browser layout test.
const source=await fs.readFile('src/router/index.ts','utf8'),tree=ts.createSourceFile('router.ts',source,ts.ScriptTarget.Latest,true)
let scrollMethod
function visit(node){if(ts.isMethodDeclaration(node)&&node.name?.getText(tree)==='scrollBehavior')scrollMethod=node;ts.forEachChild(node,visit)}visit(tree)
assert.ok(scrollMethod,'actual router scrollBehavior is missing')
const nodes=new Map(),lookups=[],document={documentElement:{},getElementById(id){lookups.push(id);return nodes.get(id)||null}}
const getComputedStyle=()=>({getPropertyValue(){return '58px'}})
const behavior=Function('document','getComputedStyle',`return ({${scrollMethod.getText(tree)}}).scrollBehavior`)(document,getComputedStyle)
const from={path:'/recent',hash:''},to=(hash,path='/article/101')=>({path,hash})
const saved={left:7,top:300};assert.equal(behavior(to('#%broken'),from,saved),saved)
console.log('PASS route scroll 1 actual router preserves saved history position before interpreting untrusted fragments')
const comment={id:'comment201'},heading={id:'中文标题'};nodes.set(comment.id,comment);nodes.set(heading.id,heading)
assert.deepEqual(behavior(to('#comment201'),from),{el:comment,top:70});assert.deepEqual(behavior(to('#%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98'),from),{el:heading,top:70})
console.log('PASS route scroll 2 actual comment and encoded Unicode IDs resolve by literal DOM ID with navigation offset')
for(const bad of ['#%','#%ZZ','#%E0%A4%A','#%ED%A0%80'])assert.deepEqual(behavior(to(bad),from),{top:0})
console.log('PASS route scroll 3 malformed percent/UTF8 fragments never throw during navigation and safely use page top')
assert.equal(behavior(to('#missing','/article/101'),{path:'/article/101',hash:'#old'}),false)
assert.deepEqual(behavior(to(''),from),{top:0});assert.ok(!lookups.includes('%'))
console.log('PASS route scroll 4 missing same-page fragment preserves position, ordinary navigation resets to top without decoding failures')
