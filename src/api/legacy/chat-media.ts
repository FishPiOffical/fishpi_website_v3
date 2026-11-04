import {ApiError,request} from '../http'
import {getLegacyKey} from './auth'
import {legacyObject} from './home'
import {musicInput,type ChatMusicInput} from '../v3-chat-music'
import {weatherInput,type ChatWeatherInput} from '../v3-chat-weather'
function content(kind:'music'|'weather',value:unknown){const result=`[${kind}]${JSON.stringify(value)}[/${kind}]`;if(result.length>4096)throw new ApiError('旧聊天室卡片内容超过4096字符，请缩短字段',422);return result}
export function legacyMusicContent(value:ChatMusicInput){return content('music',musicInput(value))}
export function legacyWeatherContent(value:ChatWeatherInput){const input=weatherInput(value);return content('weather',{t:input.city,st:input.description,date:input.days.map(d=>d.date).join(','),weatherCode:input.days.map(d=>d.code).join(','),min:input.days.map(d=>d.min).join(','),max:input.days.map(d=>d.max).join(',')})}
export async function legacyChatSendMedia(kind:'music'|'weather',value:ChatMusicInput|ChatWeatherInput){const body=kind==='music'?legacyMusicContent(value as ChatMusicInput):legacyWeatherContent(value as ChatWeatherInput),apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录聊天室',401)
 const r=legacyObject(await request('/chat-room/send',{method:'POST',body:JSON.stringify({apiKey,content:body,client:'Web/website_v3'}),cache:'no-store'}));if(typeof r.code!=='number')throw new ApiError('卡片发送响应不完整，结果未确认',502);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'卡片发送失败',400)
}
