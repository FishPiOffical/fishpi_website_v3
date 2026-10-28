import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
const root=process.cwd(),files=[],findings=[],seeds=[],dynamicCalls=[],servicePathChecks=[]
async function walk(dir){for(const f of await fs.readdir(dir,{withFileTypes:true})){const name=path.join(dir,f.name);if(f.isDirectory())await walk(name);else if(/\.(ts|vue)$/.test(name))files.push(name)}}
await walk('src')
function literal(n){return ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateHead(n)?n.text:ts.isTemplateExpression(n)?n.head.text:null}
for(const file of files.sort()){
 const source=await fs.readFile(file,'utf8'),scripts=file.endsWith('.vue')?(()=>{const {descriptor}=parse(source);return[descriptor.script,descriptor.scriptSetup].filter(Boolean).map(s=>({text:s.content,offset:s.loc.start.offset}))})():[{text:source,offset:0}]
 for(const script of scripts){const tree=ts.createSourceFile(file,script.text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
  function at(node){return{file,line:source.slice(0,script.offset+node.getStart(tree)).split('\n').length}}
  function visit(n){
   if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&/(?:catalog\.mock|gaps\.mock|\/catalog$|\/pageAuth$)/.test(n.moduleSpecifier.text))findings.push({...at(n),kind:'retired-import',value:n.moduleSpecifier.text})
   if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateExpression(n)){
    const v=literal(n)
    const pathnameCheck=v==='/api/v1/files'&&ts.isCallExpression(n.parent)&&ts.isPropertyAccessExpression(n.parent.expression)&&n.parent.expression.name.text==='endsWith'&&ts.isPropertyAccessExpression(n.parent.expression.expression)&&n.parent.expression.expression.name.text==='pathname'
    if(pathnameCheck)servicePathChecks.push({...at(n),prefix:v})
    if(v&&v.startsWith('/api/')&&!pathnameCheck){seeds.push({...at(n),prefix:v});if(!v.startsWith('/api/v3/'))findings.push({...at(n),kind:'legacy-api-literal',value:v})}
    if(v&&(/(?:\/__fp\/page-auth|loginWebInApiKey|fp\.pageAuth)/.test(v)))findings.push({...at(n),kind:'retired-auth-literal',value:v})
   }
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&['request','requestSvg','fetch'].includes(n.expression.text)&&n.arguments[0]&&literal(n.arguments[0])===null)dynamicCalls.push({...at(n),callee:n.expression.text,expression:n.arguments[0].getText(tree).slice(0,120)})
   ts.forEachChild(n,visit)
  }visit(tree)
 }
}
const report={scope:'src TS and Vue scripts; literal API seeds/imports only, not full runtime or permission coverage',sourceFileCount:files.length,apiSeedCount:seeds.length,findings,apiSeeds:seeds,servicePathChecks,dynamicCalls}
const i=process.argv.indexOf('--json');if(i>=0){if(!process.argv[i+1])throw Error('--json requires a path');await fs.writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({sourceFileCount:files.length,apiSeedCount:seeds.length,dynamicCallCount:dynamicCalls.length,servicePathCheckCount:servicePathChecks.length,findingCount:findings.length}));if(findings.length){console.log(JSON.stringify(findings,null,2));process.exitCode=1}
