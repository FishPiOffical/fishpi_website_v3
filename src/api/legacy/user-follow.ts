import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {publicUserName} from '../v3-public-user'
function target(id:string){if(!/^[1-9][0-9]{0,18}$/.test(id))throw new ApiError('目标用户ID不合法',422)}
export async function legacyReadUserFollow(name:string,expectedId?:string){
 publicUserName(name);if(expectedId)target(expectedId)
 const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录查看关注状态',401)
 const r=legacyObject(await request(`/user/${encodeURIComponent(name)}?`+new URLSearchParams({apiKey}),{cache:'no-store'}))
 if(apiKey!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'关注状态读取失败',400)
 if(typeof r.oId!=='string')throw new ApiError('关注目标响应不正确',502)
 target(r.oId);if(expectedId&&expectedId!==r.oId)throw new ApiError('目标用户身份已变化，请重新打开资料',409)
 if(r.canFollow!=='yes'&&r.canFollow!=='no')throw new ApiError('当前无法操作此用户的关注关系',403)
 return{targetId:r.oId,following:r.canFollow==='no'}
}
export async function legacySetUserFollow(id:string,following:boolean){
 target(id);if(typeof following!=='boolean')throw new ApiError('关注参数不合法',422)
 const apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录关注用户',401)
 const r=legacyObject(await request(`/${following?'follow':'unfollow'}/user`,{method:'POST',__captchaRetried:true,cache:'no-store',body:JSON.stringify({apiKey,followingId:id})}))
 if(apiKey!==getLegacyKey())throw new ApiError('登录状态已变化',409)
 if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'关注结果未确认',502)
 // Legacy success has no target state or idempotency receipt. Caller must GET current state.
}
