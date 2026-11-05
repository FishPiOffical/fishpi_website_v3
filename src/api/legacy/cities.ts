import {ApiError,request} from '../http'
import {legacyObject} from './home'
import {cityInput,type CityPage,type CityUser} from '../v3-cities'
import {decodeV3RelationUser} from '../v3-user-relations'
const bad=()=>new ApiError('旧同城响应格式不正确',502)
export async function legacyCityUsers(value:string,p=1):Promise<CityPage<CityUser>>{
 const city=cityInput(value);if(!Number.isSafeInteger(p)||p<1||p>42949672)throw new ApiError('同城页码不合法',422)
 const envelope=legacyObject(await request(`/api/city/${encodeURIComponent(city)}?p=${p}&size=20`,{cache:'no-store'}));if(envelope.code!==0)throw new ApiError(typeof envelope.msg==='string'?envelope.msg:'同城用户读取失败',502)
 const data=legacyObject(envelope.data),meta=legacyObject(data.pagination),pageCount=meta.paginationPageCount
 if(data.city!==city||!Number.isSafeInteger(pageCount)||(pageCount as number)<0||meta.paginationCurrentPageNum!==p||meta.paginationPageSize!==20||!Array.isArray(data.users)||data.users.length>20||pageCount===0&&data.users.length)throw bad()
 const list=data.users.map(value=>{const row=legacyObject(value),user=decodeV3RelationUser({id:row.oId,userName:row.userName,userNickname:row.userNickname,userAvatarURL:row.userAvatarURL});if(typeof row.userIntro!=='string'||row.userIntro.length>65536)throw bad();return{...user,userIntro:row.userIntro}})
 if(new Set(list.map(u=>u.id)).size!==list.length)throw bad()
 return{list,p,size:20,total:null,pageCount:pageCount as number}
}
