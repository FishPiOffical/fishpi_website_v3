import { ApiError, request } from './http'
export type PostFields={title:string;content:string;tags:string;type:number;rewardContent:string;rewardPoint:number;qnaOfferPoint:number;commentable:boolean;showInList:number;statement:number;columnId:string;columnTitle:string;chapterNo:string;columnCoverURL:string;anonymous:boolean;notifyFollowers:boolean;thoughtContent:string}
export type PostSource=PostFields&{id:string;status:number;editorType:number;createdAt:number;updatedAt:number}
export type DraftSummary={id:string;title:string;summary:string;tags:string;type:number;columnId:string;columnTitle:string;chapterNo:string;createdAt:number;updatedAt:number}
export type PostCommand={op:'publish'|'edit'|'draft-save'|'draft-delete';id:string;input:Record<string,unknown>;key:string}
export type PostReceipt={id:string;op:PostCommand['op']}
const bad=()=>new ApiError('文章或草稿响应不正确',502),invalid=()=>new ApiError('文章或草稿参数不合法',422)
const editKeys=['title','content','tags','type','rewardContent','rewardPoint','qnaOfferPoint','commentable','showInList','statement','columnId','columnTitle','chapterNo','columnCoverURL','notifyFollowers'] as const
const draftKeys=['title','content','thoughtContent','tags','type','columnId','columnTitle','chapterNo','rewardContent','rewardPoint','qnaOfferPoint','commentable','anonymous','notifyFollowers','showInList','statement'] as const
export const postId=(value:unknown):value is string=>typeof value==='string'&&/^[1-9][0-9]{0,18}$/.test(value)
function row(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw bad();return v as Record<string,unknown>}
function data(raw:unknown){const r=row(raw);if(r.code!==0)throw bad();return row(r.data)}
function text(v:unknown,max:number){if(typeof v!=='string'||v.length>max)throw bad();return v}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER){if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw bad();return v}
function bool(v:unknown){if(typeof v!=='boolean')throw bad();return v}
function checkedId(v:unknown){if(!postId(v))throw invalid();return v}
function type(v:unknown){return integer(v,0,6)}
export function emptyPost():PostFields{return{title:'',content:'',tags:'',type:0,rewardContent:'',rewardPoint:0,qnaOfferPoint:0,commentable:true,showInList:1,statement:0,columnId:'',columnTitle:'',chapterNo:'',columnCoverURL:'',anonymous:false,notifyFollowers:false,thoughtContent:''}}
function fields(r:Record<string,unknown>,draft=false):PostFields{return{title:text(r.title,65536),content:text(r.content,2097152),tags:text(r.tags,65536),type:type(r.type),rewardContent:text(r.rewardContent,2097152),rewardPoint:integer(r.rewardPoint,0,2147483647),qnaOfferPoint:integer(r.qnaOfferPoint,0,2147483647),commentable:bool(r.commentable),showInList:integer(r.showInList,0,1),statement:integer(r.statement,0,3),anonymous:bool(r.anonymous),notifyFollowers:draft?bool(r.notifyFollowers):false,columnId:text(r.columnId,19),columnTitle:text(r.columnTitle,65536),chapterNo:text(r.chapterNo,32),columnCoverURL:draft?'':text(r.columnCoverURL,1024),thoughtContent:draft?text(r.thoughtContent,2097152):''}}
export async function postSource(id:string):Promise<PostSource>{const r=data(await request(`/api/v3/me/articles/${checkedId(id)}/source`,{cache:'no-store'}));if(r.id!==id)throw bad();return{...fields(r),id,status:integer(r.status,0,2),editorType:integer(r.editorType),createdAt:integer(r.createdAt),updatedAt:integer(r.updatedAt)}}
function draftSummary(raw:unknown):DraftSummary{const r=row(raw);if(!postId(r.id))throw bad();return{id:r.id,title:text(r.title,65536),summary:text(r.summary,65536),tags:text(r.tags,65536),type:type(r.type),columnId:text(r.columnId,19),columnTitle:text(r.columnTitle,65536),chapterNo:text(r.chapterNo,32),createdAt:integer(r.createdAt),updatedAt:integer(r.updatedAt)}}
export async function draftPage(p=1){if(!Number.isSafeInteger(p)||p<1||p>42949672)throw invalid();const r=data(await request(`/api/v3/me/drafts?p=${p}&size=20`,{cache:'no-store'})),page=row(r.pagination),total=integer(page.total),pageCount=integer(page.pageCount);if(page.p!==p||page.size!==20||pageCount!==Math.ceil(total/20)||!Array.isArray(r.list)||r.list.length!==Math.max(0,Math.min(20,total-(p-1)*20)))throw bad();const seen=new Set<string>();const list=r.list.map(v=>{const d=draftSummary(v);if(seen.has(d.id))throw bad();seen.add(d.id);return d});return{list,pagination:{p,size:20,total,pageCount}}}
export async function draftSource(id:string){const r=data(await request(`/api/v3/me/drafts/${checkedId(id)}`,{cache:'no-store'}));if(r.id!==id)throw bad();return{...fields(r,true),id}}
const javaTrim=(v:string)=>v.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g,'')
function validate(input:Record<string,unknown>,op:PostCommand['op']){
  const keys=op==='draft-save'?draftKeys:op==='edit'?editKeys:[...editKeys,'anonymous','draftId','goodPost']
  if(!Object.keys(input).length||!Object.keys(input).every(k=>(keys as readonly string[]).includes(k)))throw invalid()
  for(const [key,v]of Object.entries(input)){
    if(['type','rewardPoint','qnaOfferPoint','statement','showInList'].includes(key)){if(typeof v!=='number'||!Number.isInteger(v)||v<0||v>2147483647||key==='type'&&(op==='draft-save'?v>6:![0,1,2,3,5,6].includes(v))||key==='statement'&&v>3||key==='showInList'&&v>1)throw invalid()}
    else if(['commentable','anonymous','notifyFollowers','goodPost'].includes(key)){if(typeof v!=='boolean')throw invalid()}
    else{
      const max=key==='content'||key==='thoughtContent'?1024000:key==='rewardContent'?102400:key==='columnTitle'?64:key==='columnCoverURL'?1024:key==='chapterNo'?32:key==='columnId'||key==='draftId'?19:255
      if(typeof v!=='string'||(key==='content'||key==='rewardContent'||key==='thoughtContent'?v:javaTrim(v)).length>max||v.includes('\0'))throw invalid()
      for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=v.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))throw invalid()}else if(c>=0xdc00&&c<=0xdfff)throw invalid()}
      if(op!=='draft-save'&&/[\u0001-\u0008\u000b\u000c\u000e-\u0017\u0019-\u001d\u007f-\u009f]/u.test(v))throw invalid()
      if(op!=='draft-save'&& !['content','rewardContent'].includes(key)&&/[\u0009\u000a\u000d\u0018\u001e\u001f]/u.test(v))throw invalid()
      if((key==='columnId'||key==='draftId')&&v!==''&&!postId(v))throw invalid()
      if(op!=='draft-save'&&key==='chapterNo'&&v!==''&&(!/^[1-9][0-9]*$/.test(v)||Number(v)>2147483647))throw invalid()
    }
  }
  if(op!=='draft-save'&&'title'in input&&typeof input.title==='string'&&!javaTrim(input.title))throw invalid()
  if(op==='publish'&&input.type===3)throw new ApiError('思绪发布功能已关闭，可保留草稿',403)
  if(op==='publish'&&(typeof input.title!=='string'||!javaTrim(input.title)||typeof input.content!=='string'||javaTrim(input.content).length<4))throw invalid()
  if(op!=='draft-save'&&input.type!==3&&typeof input.content==='string'&&(/[\u0018\u001e\u001f]/u.test(input.content)||javaTrim(input.content).length<4))throw invalid()
  if(op!=='draft-save'&&input.type===5&&typeof input.qnaOfferPoint==='number'&&input.qnaOfferPoint<20)throw invalid()
}
export function postInput(op:PostCommand['op'],full:PostFields,source:PostSource|null,draftId=''):Record<string,unknown>{
  if(op==='draft-delete')return{}
  if(op!=='draft-save'&&full.columnId)full={...full,columnTitle:''}
  const input:Record<string,unknown>={}
  if(op==='edit'){
    if(!source||source.status!==0)throw new ApiError('当前文章不能编辑',403)
    for(const key of editKeys){const baseline=key==='notifyFollowers'?false:key==='columnTitle'&&source.columnId?'':source[key];if(full[key]!==baseline)input[key]=full[key]}
    if(('columnId'in input||'columnTitle'in input)&&full.chapterNo)input.chapterNo=full.chapterNo
    if(source.type===3&&'content'in input)input.type=full.type
    if(!Object.keys(input).length)throw new ApiError('没有需要保存的修改',422)
  }else for(const key of op==='draft-save'?draftKeys:[...editKeys,'anonymous'] as const)input[key]=full[key as keyof PostFields]
  if(op!=='draft-save'&&source&&full.qnaOfferPoint<source.qnaOfferPoint)throw new ApiError('悬赏积分不能减少',422)
  if(op!=='draft-save'&&source&&source.rewardPoint>0&&full.rewardPoint===0)throw new ApiError('已启用打赏不能设为0关闭',422)
  if(op!=='draft-save'&&(full.rewardPoint>0&&(javaTrim(full.rewardContent).length<4)||full.rewardPoint===0&&full.rewardContent!==''))throw invalid()
  if(op!=='draft-save'&&full.type===5&&full.qnaOfferPoint<20)throw new ApiError('问答悬赏至少20积分',422)
  if(op==='publish'&&draftId)input.draftId=checkedId(draftId)
  validate(input,op);return input
}
export async function writePost(command:PostCommand):Promise<PostReceipt>{
  const {op,id,input,key}=command;if(typeof id!=='string'||typeof key!=='string')throw invalid();if(!['publish','edit','draft-save','draft-delete'].includes(op)||op==='publish'&&id!==''||! /^[A-Za-z0-9._:-]{1,128}$/.test(key))throw invalid()
  if(op==='edit'||op==='draft-delete'||op==='draft-save'&&id)checkedId(id)
  if(op!=='draft-delete')validate(input,op);else if(Object.keys(input).length)throw invalid()
  const article=op==='publish'||op==='edit',path=article?`/api/v3/articles${op==='edit'?'/'+id:''}`:`/api/v3/me/drafts${id?'/'+id:''}`
  const r=data(await request(path,{method:op==='draft-delete'?'DELETE':op==='publish'||!id?'POST':'PUT',headers:{'Idempotency-Key':key},...(op==='draft-delete'?{}:{body:JSON.stringify(input)})}))
  if(op==='draft-delete')return{id,op}
  if(article&&typeof r.permalink!=='string')throw bad()
  if(!postId(r.id)||op==='edit'&&r.id!==id||op==='draft-save'&&id&&r.id!==id)throw bad()
  return{id:r.id,op}
}
