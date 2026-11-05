import {ApiError,request} from '../http'
import {getLegacyKey,legacyAccount} from './auth'
import {legacyObject} from './home'
import type {PointPage,PointEntry} from '../v3-points'
const bad=()=>new ApiError('旧积分流水响应格式不正确',502)
function integer(v:unknown){if(typeof v!=='number'||!Number.isSafeInteger(v))throw bad();return v}
function count(v:unknown){const n=integer(v);if(n<0)throw bad();return n}
function text(v:unknown){if(typeof v!=='string'||v.length>65536)throw bad();return v}
async function owner(){const key=getLegacyKey();if(!key)throw new ApiError('请先登录查看积分',401);const account=await legacyAccount(key);if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409);if(!/^[1-9][0-9]{0,31}$/.test(account.oId)||!account.userName)throw bad();return{key,account}}
export async function legacyPointBalance(){const {account}=await owner();return integer(account.userPoint)}
export async function legacyPointPage(p=1,size=20):Promise<PointPage>{
 if(!Number.isSafeInteger(p)||p<1||p>42949672||!Number.isSafeInteger(size)||size<20||size>50)throw new ApiError('旧积分流水分页参数不合法',422)
 const {key,account}=await owner(),r=legacyObject(await request(`/api/user/${encodeURIComponent(account.userName)}/points?`+new URLSearchParams({p:String(p),size:String(size),apiKey:key}),{cache:'no-store'}))
 if(key!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'积分流水读取失败',400)
 const data=legacyObject(r.data),meta=legacyObject(data.pagination),total=count(meta.paginationRecordCount),pageCount=count(meta.paginationPageCount)
 if(pageCount!==Math.ceil(total/size)||!Array.isArray(data.points)||data.points.length>size||data.points.length>total)throw bad()
 const list=data.points.map((value:unknown):PointEntry=>{const row=legacyObject(value),time=count(row.time);if(!Number.isFinite(new Date(time).getTime())||!['+','-'].includes(row.operation as string))throw bad();return{time,amount:integer(row.sum),operation:row.operation as '+'|'-',balance:integer(row.balance),type:integer(row.type),displayType:text(row.displayType),descriptionHtml:'',descriptionText:text(row.description)}})
 return{list,p,size,total,pageCount}
}
