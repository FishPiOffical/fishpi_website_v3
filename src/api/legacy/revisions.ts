import {ApiError,getAuthContextVersion,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import type {RevisionKind,RevisionMeta,RevisionPage,RevisionDetail} from '../v3-revisions'
const bad=()=>new ApiError('旧历史版本响应不正确',502)
function id(v:unknown):v is string{return typeof v==='string'&&/^[1-9][0-9]{0,18}$/.test(v)}
function time(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||!Number.isFinite(new Date(v).getTime()))throw bad();return v}
function target(kind:RevisionKind,value:string){if(!['article','comment'].includes(kind)||!id(value))throw new ApiError('历史目标不合法',422);return`/${kind}/${value}/revisions`}
async function read(path:string){const key=getLegacyKey(),context=getAuthContextVersion();if(!key)throw new ApiError('请先登录查看修订历史',401);const result=legacyObject(await request(path+'?'+new URLSearchParams({apiKey:key}),{cache:'no-store',redirect:'error'}));if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409);if(result.code!==0)throw new ApiError(typeof result.msg==='string'?result.msg:'历史读取失败',400);return result}
function rows(v:unknown){if(!Array.isArray(v)||v.length>10000)throw bad();return v.map(legacyObject)}
function plain(v:unknown,max=2097152){if(typeof v!=='string'||v.length>max)throw bad();return v}
async function snapshot(kind:RevisionKind,value:string){
 const base=target(kind,value),result=await read(base+(kind==='article'?'/list':'')),source=rows(result.revisions),seen=new Set<string>();let budget=0,previous=0
 const items=source.map((row,i):{meta:RevisionMeta;content?:string}=>{
  let meta:RevisionMeta,content:string|undefined
  if(kind==='article'){
   if(!id(row.revisionId)&&row.revisionId!=='current'||row.revisionIndex!==i+1||typeof row.current!=='boolean'||row.current!==(row.revisionId==='current'))throw bad()
   meta={id:row.revisionId as string,time:time(row.revisionTime),index:i+1,current:row.current}
  }else{
   const data=legacyObject(row.revisionData);content=plain(data.commentContent);budget+=content.length;if(budget>4*1024*1024)throw new ApiError('旧评论历史超过读取预算',503)
   if(row.oId===undefined){if(i!==source.length-1||Object.keys(row).some(key=>key!=='revisionData'))throw bad();meta={id:'current',time:null,index:i+1,current:true}}
   else{if(!id(row.oId)||row.revisionDataId!==value||row.revisionDataType!==1)throw bad();meta={id:row.oId,time:time(Number(row.oId)),index:i+1,current:false}}
  }
  if(seen.has(meta.id)||meta.current&&i!==source.length-1)throw bad();seen.add(meta.id)
  if(!meta.current){const stamp=Number(meta.id);if(!Number.isSafeInteger(stamp)||stamp<=previous)throw bad();previous=stamp}
  return{meta,...(content===undefined?{}:{content})}
 })
 return items
}
export async function legacyRevisionPage(kind:RevisionKind,value:string,page=1):Promise<RevisionPage>{
 if(!Number.isSafeInteger(page)||page<1||page>Math.floor(2147483647/50))throw new ApiError('历史页码不合法',422)
 const items=await snapshot(kind,value),total=items.length
 return{items:items.slice((page-1)*20,page*20).map(item=>item.meta),pagination:{page,size:20,total,pageCount:Math.ceil(total/20)}}
}
export async function legacyRevisionDetail(kind:RevisionKind,value:string,expected:RevisionMeta):Promise<RevisionDetail>{
 target(kind,value)
 if(!expected||!Number.isSafeInteger(expected.index)||expected.index<1||!id(expected.id)&&expected.id!=='current')throw new ApiError('历史条目不合法',422)
 if(typeof expected.current!=='boolean'||expected.current!==(expected.id==='current')||expected.time===null&&!(kind==='comment'&&expected.current))throw new ApiError('历史条目不合法',422)
 if(expected.time!==null)time(expected.time)
 const key=getLegacyKey(),context=getAuthContextVersion(),items=await snapshot(kind,value),current=items.find(item=>item.meta.id===expected.id)
 if(!current||JSON.stringify(current.meta)!==JSON.stringify({id:expected.id,time:expected.time,index:expected.index,current:expected.current}))throw new ApiError('历史列表已变化，请重新读取列表',409)
 if(kind==='comment')return{...current.meta,content:current.content!}
 if(key!==getLegacyKey()||context!==getAuthContextVersion())throw new ApiError('登录状态已变化',409)
 const result=await read(target(kind,value)+'/'+expected.id),row=legacyObject(result.revision),data=legacyObject(row.revisionData)
 if(row.revisionId!==expected.id||row.revisionTime!==expected.time)throw new ApiError('历史列表已变化，请重新读取列表',409)
 return{...current.meta,title:plain(data.articleTitle,65536),content:plain(data.articleContent)}
}
