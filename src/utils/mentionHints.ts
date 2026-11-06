import { getAccessToken, getAuthContextVersion } from '@/api/http'
import { userSuggestions } from '@/api/v3-user-suggestions'
type Hint={value:string;html:string}
const escape=(s:string)=>s.replace(/[&<>"']/gu,c=>`&#${c.charCodeAt(0)};`)
/** Settle superseded promises immediately: Vditor itself does not sequence async hint responses. */
export function createMentionHints(onError:(message:string)=>void){
  let active:{abort:AbortController;resolve:(rows:Hint[])=>void}|null=null,disposed=false
  function cancel(){const old=active;active=null;old?.abort.abort();old?.resolve([]);onError('')}
  return{
    cancel,dispose(){disposed=true;cancel()},
    hint(prefix:string):Promise<Hint[]>{
      cancel()
      if(disposed||!getAccessToken()||!prefix||!/^[A-Za-z0-9_-]{1,64}$/.test(prefix))return Promise.resolve([])
      const version=getAuthContextVersion()
      return new Promise(resolve=>{
        const run={abort:new AbortController(),resolve};active=run
        const current=()=>active===run&&!disposed&&!run.abort.signal.aborted&&version===getAuthContextVersion()&&!!getAccessToken()
        void userSuggestions(prefix,run.abort.signal).then(users=>{
          if(!current()){if(active===run)active=null;resolve([]);return}
          active=null
          resolve(users.map(user=>({value:`@${user.userName} `,html:`${user.userAvatarURL?`<img src="${escape(user.userAvatarURL)}" alt=""/>`:''}${escape(user.userName)}${user.userNickname?` <small>${escape(user.userNickname)}</small>`:''}`})))
        }).catch(()=>{if(current()){active=null;onError('用户联想暂不可用，可手动输入用户名')}else if(active===run)active=null;resolve([])})
      })
    },
  }
}
