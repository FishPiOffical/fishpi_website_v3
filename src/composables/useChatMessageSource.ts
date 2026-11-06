import {computed,onScopeDispose,ref,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {ApiError,getAuthContextVersion} from '@/api/http'
import {chatMessageDetail,chatSourceText} from '@/api/v3-chat-messages'
import {useAuthStore} from '@/stores/auth'
export function useChatMessageSource(){
 const {accessToken,account}=storeToRefs(useAuthStore())
 const quote=ref<{userName:string;messageId:string;content:string;html:string;label:string}|null>(null),quoteBusy=ref(''),quoteErr=ref(''),rawText=ref(''),rawError=ref(''),rawLoading=ref(false),rawOpen=ref(false)
 const identity=computed(()=>JSON.stringify([getAuthContextVersion(),!!accessToken.value,account.value?.oId||'']))
 let quoteRun=0,rawRun=0,quoteAbort:AbortController|null=null,rawAbort:AbortController|null=null,disposed=false
 const active=()=>!import.meta.env.SSR&&!disposed&&!!accessToken.value&&!!account.value?.oId
 function clearQuote(){quoteRun++;quoteAbort?.abort();quoteAbort=null;quote.value=null;quoteBusy.value='';quoteErr.value=''}
 function closeRaw(){rawRun++;rawAbort?.abort();rawAbort=null;rawOpen.value=false;rawLoading.value=false;rawText.value='';rawError.value=''}
 async function quoteMessage(id:string){if(!active())return;clearQuote();const run=quoteRun,reader=identity.value,abort=new AbortController();quoteAbort=abort;quoteBusy.value=id;const valid=()=>active()&&run===quoteRun&&reader===identity.value&&!abort.signal.aborted
 try{const value=await chatMessageDetail(id,abort.signal),content=chatSourceText(value);if(!content.trim())throw new ApiError('当前消息没有可引用内容',422);if(valid())quote.value={userName:value.author.userName,messageId:id,content,html:value.type==='text'?value.contentHtml:'',label:value.type==='text'?value.content:content}}
 catch(e){if(valid())quoteErr.value=e instanceof Error?e.message:'消息读取失败'}finally{if(valid()){quoteBusy.value='';quoteAbort=null}}}
 async function showRaw(id:string){if(!active())return;closeRaw();const run=rawRun,reader=identity.value,abort=new AbortController();rawAbort=abort;rawOpen.value=true;rawLoading.value=true;const valid=()=>active()&&rawOpen.value&&run===rawRun&&reader===identity.value&&!abort.signal.aborted
 try{const value=await chatMessageDetail(id,abort.signal),content=chatSourceText(value);if(valid())rawText.value=content}catch(e){if(valid())rawError.value=e instanceof Error?e.message:'消息读取失败'}finally{if(valid()){rawLoading.value=false;rawAbort=null}}}
 function buildQuoteSuffix(){const q=quote.value;if(!q?.content)return '';const author=q.userName?`@${q.userName.replace(/[\\`*_[\]<>!#|]/g,'\\$&')} `:'';return `\n\n##### 引用 ${author}[↩](/cr#chatroom${q.messageId} "跳转至原消息")  \n> ${q.content.replace(/\r\n?/g,'\n').replace(/\n/g,'\n> ')}\n`}
 const stop=watch(identity,()=>{clearQuote();closeRaw()},{flush:'sync'})
 onScopeDispose(()=>{disposed=true;stop();clearQuote();closeRaw()})
 return{quote,quoteBusy,quoteErr,rawText,rawError,rawLoading,rawOpen,quoteMessage,showRaw,clearQuote,closeRaw,buildQuoteSuffix}
}
