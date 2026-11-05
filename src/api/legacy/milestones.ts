import {ApiError,request} from '../http'
import {legacyObject} from './home'
import {milestoneDto,type MilestonePage} from '../v3-milestones'
export async function legacyMilestoneSnapshot(){
 const envelope=legacyObject(await request('/api/milestones',{cache:'no-store'}));if(envelope.code!==0)throw new ApiError(typeof envelope.msg==='string'?envelope.msg:'大事记读取失败',502)
 if(!Array.isArray(envelope.data)||envelope.data.length>10000)throw new ApiError('旧大事记快照格式或大小不正确',502)
 const list=envelope.data.map(value=>{const row=legacyObject(value),media=row.media===undefined?{url:'',type:'',caption:''}:legacyObject(row.media),link=row.link===undefined?'':legacyObject(row.link).url;return milestoneDto({id:row.id,title:row.title,date:row.date,endDate:row.end_date===undefined?'':row.end_date,content:row.content,contentHtml:'',media,link})})
 if(new Set(list.map(v=>v.id)).size!==list.length)throw new ApiError('旧大事记编号重复',502)
 return list.sort((a,b)=>b.date.localeCompare(a.date)||b.id.length-a.id.length||b.id.localeCompare(a.id))
}
export async function legacyMilestonePage(p=1):Promise<MilestonePage>{if(!Number.isSafeInteger(p)||p<1||p>42949672)throw new ApiError('大事记页码不合法',422);const list=await legacyMilestoneSnapshot();return{list:list.slice((p-1)*20,p*20),p,size:20,total:list.length,pageCount:Math.ceil(list.length/20)}}
export async function legacyMilestone(id:string){const list=await legacyMilestoneSnapshot(),item=list.find(v=>v.id===id);if(!item)throw new ApiError('当前公开时间线中没有此记录',404);return item}
