import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacySetUserFollow} from '@/api/legacy/user-follow'
import {useAuthStore} from './auth'
type Command={following:boolean;busy:boolean;error:string}
export const useLegacyUserFollowStore=defineStore('legacy-user-follow',()=>{
 const auth=useAuthStore(),commands=ref<Record<string,Command>>({}),lastChange=ref({targetId:'',revision:0});let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;commands.value={};lastChange.value={targetId:'',revision:lastChange.value.revision+1}}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function set(id:string,following:boolean){if(!active()||auth.account?.oId===id||commands.value[id]||Object.keys(commands.value).length>=100||!/^[1-9][0-9]{0,18}$/.test(id)||typeof following!=='boolean')return
 const run=generation,reader=identity(),valid=()=>active()&&run===generation&&reader===identity();commands.value[id]={following,busy:true,error:''};const command=commands.value[id]!
 try{await legacySetUserFollow(id,following);if(valid()){delete commands.value[id];lastChange.value={targetId:id,revision:lastChange.value.revision+1}}}
 catch(e){if(valid())command.error=(e instanceof Error?e.message:'关注操作失败')+'。旧接口无幂等回执，请先重读核对，勿重复提交。'}
 finally{if(valid()&&commands.value[id]===command)command.busy=false}}
 function release(id:string){if(commands.value[id]&&!commands.value[id]?.busy)delete commands.value[id]}
 return{commands,lastChange,set,release}
})
