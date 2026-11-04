import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {repeaterPublication} from '../v3-repeater'
const invalid=()=>new ApiError('旧复读机结果未确认',502)
async function send(path:string,input:Record<string,unknown>){const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录复读机',401);const r=legacyObject(await request(path,{method:'POST',__captchaRetried:true,body:JSON.stringify({apiKey,...input}),cache:'no-store'}));if(typeof r.code!=='number')throw invalid();if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'复读机操作失败',400);return legacyObject(r.data)}
export async function legacyRepeaterPublish(type:string,content:string){const input=repeaterPublication(type,content),r=await send('/api/repeater',{repeaterContentType:input.type,repeaterContent:input.content}),item=legacyObject(r.item);if(typeof item.oId!=='string'||!/^[1-9][0-9]{0,31}$/.test(item.oId)||item.repeaterContentType!==input.type)throw invalid();return{id:item.oId}}
export async function legacyRepeaterToggle(id:string){if(typeof id!=='string'||!/^[1-9][0-9]{0,31}$/.test(id))throw new ApiError('复读内容ID不合法',422);const r=await send(`/api/repeater/${id}/like`,{});if(typeof r.liked!=='boolean'||typeof r.repeaterContentLikeCount!=='number'||!Number.isSafeInteger(r.repeaterContentLikeCount)||r.repeaterContentLikeCount<0)throw invalid()}
