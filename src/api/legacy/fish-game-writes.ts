import {ApiError,request} from '../http'
import {legacyObject} from './home'
import {getLegacyKey} from './auth'
import {gameComment,type GameSubmission} from '../v3-fish-games'
export type LegacyGameCommand={kind:'submit'|'edit';id:string;body:GameSubmission}|{kind:'vote';id:string;value:'like'|'dislike'}|{kind:'comment';id:string;content:string}
export type LegacyGameReceipt={id:string;kind:LegacyGameCommand['kind']}
const bad=()=>new ApiError('旧鱼游操作结果未确认',502)
function id(v:unknown){if(typeof v!=='string'||!/^[1-9][0-9]{0,31}$/.test(v))throw new ApiError('鱼游编号不合法',422);return v}
export function legacyGameSubmission(body:GameSubmission):GameSubmission{const result:GameSubmission={name:'',description:'',url:'',iconUrl:'',oauthLoginUrl:''};for(const key of ['name','description','url','iconUrl'] as const){const value=body[key];if(typeof value!=='string'||!value.trim()||value.length>16384||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)||Array.from(value).some(c=>c.length===1&&/[\ud800-\udfff]/u.test(c)))throw new ApiError('鱼游投稿内容不合法',422);result[key]=value}for(const key of ['url','iconUrl'] as const){try{const s=result[key].trim(),u=new URL(s);if(s.length>512||!/^https:\/\//i.test(s)||u.protocol!=='https:'||u.username||u.password||u.hash||/[\s\\]/u.test(s))throw bad()}catch{throw new ApiError('游戏与图标网址须为有效HTTPS地址',422)}}return result}
export function legacyGameCommand(command:LegacyGameCommand):LegacyGameCommand{if(command.kind==='submit'||command.kind==='edit')return{kind:command.kind,id:command.kind==='edit'?id(command.id):'',body:legacyGameSubmission(command.body)};if(command.kind==='comment')return{kind:'comment',id:id(command.id),content:gameComment(command.content)};if(command.kind==='vote'&&['like','dislike'].includes(command.value))return{kind:'vote',id:id(command.id),value:command.value};throw new ApiError('鱼游操作不合法',422)}
export async function legacyWriteGame(input:LegacyGameCommand):Promise<LegacyGameReceipt>{const c=legacyGameCommand(input),apiKey=getLegacyKey();if(!apiKey)throw new ApiError('请先登录鱼游',401);let path='/api/fish-games',body:Record<string,unknown>
 if(c.kind==='submit'||c.kind==='edit'){if(c.kind==='edit')path+=`/${c.id}/edit`;body={fishGameName:c.body.name,fishGameDescription:c.body.description,fishGameUrl:c.body.url,fishGameIconUrl:c.body.iconUrl}}
 else if(c.kind==='vote'){path+=`/${c.id}/vote`;body={value:c.value}}else if(c.kind==='comment'){path+=`/${c.id}/comments`;body={content:c.content}}else throw bad()
 const r=legacyObject(await request(path,{method:'POST',__captchaRetried:true,cache:'no-store',body:JSON.stringify({apiKey,...body})}));if(apiKey!==getLegacyKey())throw new ApiError('登录状态已变化',409);if(r.code!==0)throw new ApiError(typeof r.msg==='string'?r.msg:'鱼游操作失败',502);const data=legacyObject(r.data)
 if(c.kind==='submit'){if(data.fishGameStatus!==0)throw bad();return{id:id(data.oId),kind:c.kind}}
 if(c.kind==='vote'){if(!['','like','dislike'].includes(data.fishGameUserVote as string)||!['fishGameLikeCount','fishGameDislikeCount'].every(k=>typeof data[k]==='number'&&Number.isSafeInteger(data[k])&&(data[k] as number)>=0))throw bad()}
 if(c.kind==='comment'){if(data.fishGameCommentGameId!==c.id)throw bad();return{id:id(data.oId),kind:c.kind}}
 return{id:c.id,kind:c.kind}
}
