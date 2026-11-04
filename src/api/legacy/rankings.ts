import {ApiError} from '../http'
import {getLegacyKey} from './auth'
import {legacyGet,legacyObject} from './home'
import {legacyPublicUser} from './public-user'
import {decodeV3RelationUser} from '../v3-user-relations'
import type {RankingType,RankingPage,RankingEntry} from '../v3-rankings'
const fields:Partial<Record<RankingType,[string,string]>>={checkin:['userCurrentCheckinStreak','streak'],online:['onlineMinute','minutes'],balance:['userPoint','points'],consumption:['userUsedPoint','points'],perfect:['userPerfectArticleCount','count'],invite:['userInviteUserCount','count'],adr:['point','points'],emoji:['point','points'],mofish:['point','points'],smallmofish:['point','points']}
const bad=()=>new ApiError('旧榜单字段缺失或格式不正确',502)
function numeric(value:unknown,decimal=false){if(typeof value==='string'&&/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value))value=Number(value);if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER||!decimal&&!Number.isSafeInteger(value))throw bad();return value}
function text(value:unknown,max=65536){if(typeof value!=='string'||value.length>max)throw bad();return value}
function profile(raw:unknown){const r=legacyObject(raw);return decodeV3RelationUser({id:r.oId,userName:r.userName,userNickname:r.userNickname,userAvatarURL:r.userAvatarURL48||r.userAvatarURL})}
function privatePath(path:string){const key=getLegacyKey();return path+(key?(path.includes('?')?'&':'?')+new URLSearchParams({apiKey:key}):'')}
export async function legacyRankingPage(type:RankingType,p:number,size:number,sub=''):Promise<RankingPage>{
 let list:unknown,summary:RankingPage['summary'];const simple=fields[type]
 if(type==='links'){const raw=await legacyGet(privatePath('/api/top/any?types=topLinks'));if(!Array.isArray(raw)||raw.length!==1)throw bad();const group=legacyObject(raw[0]);if(group.type!=='topLinks')throw bad();list=group.data}
 else{const path=`/api/top/${type}`+(['evolve','xiaoice'].includes(type)?'?'+new URLSearchParams({type:sub}):''),r=legacyObject(await legacyGet(privatePath(path)));if(r.type!==undefined&&r.type!==(['evolve','xiaoice'].includes(type)?sub:type))throw bad();list=r.list;if(type==='donate'){const total=legacyObject(r.totalData);summary={amount:numeric(total.totalAmount,true),supportedDays:numeric(total.donateMakeDays,true)};if(summary.amount<0||summary.supportedDays<0)throw bad()}}
 if(!Array.isArray(list)||list.length>10000)throw bad()
 const rows:RankingEntry[]=[],seen=new Set<string>()
 for(let offset=0;offset<list.length;offset+=4){const chunk=await Promise.all(list.slice(offset,offset+4).map(async(value,index):Promise<RankingEntry>=>{
  const r=legacyObject(value),rank=offset+index+1;let metrics:Record<string,number|string>,score:number,user:RankingEntry['user']
  if(type==='links'){const id=text(r.oId,32);if(!/^[1-9][0-9]{0,31}$/.test(id))throw bad();score=numeric(r.linkClickCnt);return{rank,score,metrics:{clickCount:score},link:{id,title:text(r.linkTitle),url:text(r.linkAddr)}}}
  if(simple){score=numeric(r[simple[0]]);metrics={[simple[1]]:score};user=profile(r)}
  else if(type==='donate'){score=numeric(r.total,true);metrics={amount:score,count:numeric(r.totalCount)};user=profile(r.profile)}
  else if(type==='evolve'){if(!['achievement','know','reset','days'].includes(sub))throw bad();const data=legacyObject(r.data),top=legacyObject(data.top),stats=legacyObject(data.stats);metrics={achievement:numeric(top.achievement,true),know:numeric(top.know,true),reset:numeric(top.reset,true),days:numeric(top.days,true),currentKnow:numeric(stats.know,true),currentDays:numeric(stats.days,true)};score=metrics[sub] as number;user=profile(r.profile)}
  else if(type==='lifeRestart'){const data=legacyObject(r.data);score=numeric(data.times);metrics={times:score,achievement:numeric(r.achievement)};user=profile(r.profile)}
  else if(type==='xiaoice'){if(!['0','1','2','3'].includes(sub))throw bad();const publicUser=await legacyPublicUser(text(r.uname,64));user=decodeV3RelationUser(publicUser);const field=sub==='0'?'exp':sub==='1'?'dieTimes':sub==='2'?'allExTimes':'allBsTimes';score=numeric(r[field]);metrics={[field]:score};if(sub==='0'){metrics.ancestry=text(r.ancestry,1024);metrics.gongfa=text(r.gongfa,1024)}}
  else throw new ApiError('该榜单的旧接口尚未适配',501)
  if(type!=='balance'&&score<0||Object.entries(metrics).some(([key,v])=>typeof v==='number'&&v<0&&!(type==='balance'&&key==='points')))throw bad()
  return{rank,score,metrics,user}
 }));for(const row of chunk){const identity=row.user?.id||row.link?.id;if(!identity||seen.has(identity))throw bad();seen.add(identity);rows.push(row)}}
 return{type,subType:sub,p,size,total:rows.length,pageCount:Math.ceil(rows.length/size),list:rows.slice((p-1)*size,p*size),...(summary?{summary}:{})}
}
