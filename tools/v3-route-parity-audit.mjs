/** Static client/backend route parity; unresolved expressions remain explicit, never runtime proof. */
import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
import {parse} from '@vue/compiler-sfc'
const WILD='{*}',MAX=64,absent=Symbol('absent')
const unwrap=n=>{while(n&&(ts.isParenthesizedExpression(n)||ts.isAsExpression(n)||ts.isNonNullExpression(n)||ts.isTypeAssertionExpression(n)))n=n.expression;return n}
function binding(node,name){
 for(let p=node.parent;p;p=p.parent){
  if(ts.isFunctionLike(p)&&p.parameters.some(v=>ts.isIdentifier(v.name)&&v.name.text===name))return null
  if(ts.isBlock(p)||ts.isSourceFile(p))for(const s of p.statements){if(!ts.isVariableStatement(s))continue;for(const d of s.declarationList.declarations)if(ts.isIdentifier(d.name)&&d.name.text===name)return s.declarationList.flags&ts.NodeFlags.Const?d.initializer:null}
 }
 return absent
}
function cross(a,b){if(a.length*b.length>MAX)return null;return[...new Set(a.flatMap(x=>b.map(y=>x+y)))]}
function strings(input,seen=new Set()){
 const n=unwrap(input);if(!n)return null
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return[n.text]
 if(ts.isIdentifier(n)){if(seen.has(n.text))return null;const found=binding(n,n.text);if(found===absent||found===null)return[WILD];return strings(found,new Set([...seen,n.text]))}
 if(ts.isConditionalExpression(n)){const a=strings(n.whenTrue,seen),b=strings(n.whenFalse,seen);return a&&b&&a.length+b.length<=MAX?[...new Set([...a,...b])]:null}
 if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=strings(n.left,seen);if(a?.every(v=>v.includes('?')))return a;const b=strings(n.right,seen);return a&&b?cross(a,b):null}
 if(ts.isTemplateExpression(n)){let value=[n.head.text];for(const span of n.templateSpans){const part=strings(span.expression,seen)||[WILD];value=cross(value,part);if(!value)return null;value=value.map(v=>v+span.literal.text)}return value}
 return null
}
function object(input,seen=new Set()){
 const n=unwrap(input);if(!n)return null;if(ts.isObjectLiteralExpression(n))return n
 if(ts.isIdentifier(n)&&!seen.has(n.text)){const found=binding(n,n.text);return found&&found!==absent?object(found,new Set([...seen,n.text])):null}return null
}
function methods(call){
 if(!call.arguments[1])return['GET'];const init=object(call.arguments[1]);if(!init)return null
 let value=['GET'];for(const p of init.properties){if(ts.isSpreadAssignment(p))value=null;else if(ts.isPropertyAssignment(p)&&(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name))&&p.name.text==='method')value=strings(p.initializer)}
 return value?.every(v=>/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/.test(v))?value:null
}
const escape=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const routePattern=v=>new RegExp('^'+v.split(/\{[^}]+\}/).map(escape).join('[^/]+')+'$')
function parentExpression(n){let p=n.parent;return ts.isBinaryExpression(p)&&p.operatorToken.kind===ts.SyntaxKind.PlusToken||ts.isTemplateSpan(p)||ts.isConditionalExpression(p)&&n!==p.condition||ts.isParenthesizedExpression(p)||ts.isAsExpression(p)}
export function auditSources(sources,routes){
 const findings=[],references=[],dynamicCalls=[],otherCalls=[];const server=routes.map(r=>({...r,regex:routePattern(r.path)}))
 for(const{file,source}of sources){const scripts=file.endsWith('.vue')?(()=>{const{descriptor}=parse(source);return[descriptor.script,descriptor.scriptSetup].filter(Boolean).map(s=>({source:s.content,offset:s.loc.start.offset}))})():[{source,offset:0}]
  for(const script of scripts){const tree=ts.createSourceFile(file,script.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),at=n=>({file,line:source.slice(0,script.offset+n.getStart(tree)).split('\n').length})
   const inspect=(n,call)=>{
    const values=strings(n);if(!values||!values.some(v=>v.startsWith('/api/v3'))){if(call){const item={...at(call),expression:n.getText(tree).slice(0,180)};if(values?.every(v=>!v.includes(WILD)))otherCalls.push({...item,values});else dynamicCalls.push({...item,reason:'unresolved-transport-or-builder'})}return}
    if(call&&!methods(call))dynamicCalls.push({...at(call),expression:n.getText(tree).slice(0,180),reason:'unresolved-method'})
    const method=call?methods(call):null
    for(const raw of values){if(!raw.startsWith('/api/v3'))continue;const value=raw.split(/[?#]/)[0],wild=value.includes(WILD),prefix=value.endsWith('/')||value==='/api/v3';let matches=[]
     if(prefix&&!call){matches=server.filter(r=>r.path.startsWith(value)).map(({method,path})=>({method,path}));references.push({...at(n),value,methods:method,status:'prefix-reference',matches});continue}
     if(wild){const client=new RegExp('^'+value.split(WILD).map(escape).join('[^/]+')+'$');matches=server.filter(r=>client.test(r.path.replace(/\{[^}]+\}/g,'sample'))).map(({method,path})=>({method,path}))}
     else matches=server.filter(r=>r.regex.test(value)).map(({method,path})=>({method,path}))
     const ref={...at(n),value,methods:method,status:wild?'pattern-reference':'exact-reference',matches};references.push(ref)
     if(!matches.length){if(wild)dynamicCalls.push({...at(n),expression:n.getText(tree).slice(0,180),reason:'unresolved-route-pattern'});else findings.push({...at(n),kind:'missing-route',value,methods:method})}
     else if(method&&method.some(m=>!matches.some(r=>r.method===m)))findings.push({...at(n),kind:'method-mismatch',value,methods:method,matches})
    }
   }
   function visit(n){
    if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&['request','requestSvg','requestBinary','fetch'].includes(n.expression.text)&&n.arguments[0])inspect(n.arguments[0],n)
    else if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateExpression(n)||ts.isBinaryExpression(n)||ts.isConditionalExpression(n))&&!parentExpression(n)){
     const p=n.parent;if(!(ts.isCallExpression(p)&&p.arguments[0]===n&&ts.isIdentifier(p.expression)&&['request','requestSvg','requestBinary','fetch'].includes(p.expression.text)))inspect(n,null)
    }
    ts.forEachChild(n,visit)
   }visit(tree)
  }
 }
 const unique=items=>[...new Map(items.map(v=>[JSON.stringify(v),v])).values()]
 return{scope:'Static TS/Vue route references and direct transport methods against registered backend paths; pattern matches are candidates, unresolved builders/transport forwarders require manual review; no auth, runtime or feature-completeness claim',sourceFileCount:sources.length,registeredRouteCount:routes.length,findings:unique(findings),references:unique(references),dynamicCalls:unique(dynamicCalls),otherCalls:unique(otherCalls)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2),routeIndex=args.indexOf('--routes'),jsonIndex=args.indexOf('--json');if(routeIndex<0||!args[routeIndex+1])throw Error('--routes requires current backend contract audit JSON')
 const contract=JSON.parse(await fs.readFile(args[routeIndex+1],'utf8'));if(!Array.isArray(contract.routes)||!contract.routes.length||contract.count!==contract.routes.length||contract.routes.some(r=>typeof r.path!=='string'||!r.path.startsWith('/api/v3')||!['GET','POST','PUT','DELETE','PATCH','WEBSOCKET'].includes(r.method))||contract.missingDocs?.length||contract.missingRoutes?.length||contract.duplicates?.length||contract.problems?.length)throw Error('Backend contract audit is incomplete')
 const sources=[];async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(/\.(ts|vue)$/.test(file))sources.push({file,source:await fs.readFile(file,'utf8')})}}await walk('src');sources.sort((a,b)=>a.file.localeCompare(b.file));const report=auditSources(sources,contract.routes)
 if(jsonIndex>=0){if(!args[jsonIndex+1])throw Error('--json requires output path');await fs.writeFile(args[jsonIndex+1],JSON.stringify(report,null,2)+'\n')}
 console.log(JSON.stringify({sourceFileCount:report.sourceFileCount,registeredRouteCount:report.registeredRouteCount,references:report.references.length,dynamicCalls:report.dynamicCalls.length,otherCalls:report.otherCalls.length,findings:report.findings}));if(report.findings.length)process.exitCode=1
}
