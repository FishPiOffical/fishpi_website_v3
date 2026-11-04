import {defineStore} from 'pinia'
import {onScopeDispose,ref,watch} from 'vue'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {legacyReportInput,legacyPublishReport} from '@/api/legacy/reports'
import type {ReportInput} from '@/api/v3-reports'
import {useAuthStore} from './auth'
export const useLegacyReportsStore=defineStore('legacy-reports',()=>{
 const auth=useAuthStore(),pending=ref<{input:ReportInput}|null>(null),completed=ref<{input:ReportInput}|null>(null),busy=ref(false),error=ref(''),confirmed=ref(false)
 let generation=0
 const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId||'']),active=()=>!import.meta.env.SSR&&getApiMode()==='v1'&&!!auth.apiKey&&!!auth.account?.oId
 function clear(){generation++;pending.value=completed.value=null;busy.value=false;error.value='';confirmed.value=false}
 const stop=watch(identity,clear,{flush:'sync'});onScopeDispose(()=>{stop();clear()})
 async function save(value:ReportInput){if(!active()||pending.value||busy.value)return false;let input:ReportInput;try{input=legacyReportInput(value)}catch(e){error.value=e instanceof Error?e.message:'举报不合法';return false}const run=++generation,reader=identity(),valid=()=>active()&&run===generation&&reader===identity();busy.value=true;completed.value=null;confirmed.value=false;error.value=''
 try{await legacyPublishReport(input);if(!valid())return false;completed.value={input};confirmed.value=true;return true}catch(e){if(valid()){error.value=e instanceof Error?e.message:'举报提交失败';if(!(e instanceof ApiError)||![401,403,422].includes(e.status)){pending.value={input};error.value='本次举报结果未确认，旧接口不支持幂等恢复，请勿重复提交。'}}return false}finally{if(valid())busy.value=false}}
 function release(){if(!busy.value){pending.value=null;error.value=''}}
 function dismiss(){if(!busy.value&&!pending.value){completed.value=null;confirmed.value=false;error.value=''}}
 return{pending,completed,busy,error,confirmed,save,release,dismiss}
})
