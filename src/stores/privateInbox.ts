import {onScopeDispose,ref,watch} from 'vue'
import {defineStore,storeToRefs} from 'pinia'
import {getAuthContextVersion} from '@/api/http'
import {privateUnread} from '@/api/v3-messages'
import {subscribeMessageChanges} from '@/api/v3-realtime'
import {useAuthStore} from '@/stores/auth'
import {useV3MessagesStore} from '@/stores/v3Messages'
/** Shared messages subscription/count for header, drawer and full page; never stores message bodies. */
export const usePrivateInboxStore=defineStore('private-inbox',()=>{
 const {accessToken,account}=storeToRefs(useAuthStore()),writes=useV3MessagesStore()
 const unreadTotal=ref<number|null>(null),loading=ref(false),error=ref(''),revision=ref(0),inboxOpen=ref(false),inboxPeer=ref(''),inboxPeerId=ref('')
 let generation=0,sequence=0,boundary=getAuthContextVersion(),owner=account.value?.oId,stopSubscription:(()=>void)|null=null,dirty=false
 const active=()=>!import.meta.env.SSR&&!!accessToken.value&&!!account.value?.oId
 async function refreshUnread(){if(!active())return;if(loading.value){dirty=true;return}const run=generation,seq=++sequence,reader=account.value!.oId,context=getAuthContextVersion();loading.value=true;error.value='';const valid=()=>active()&&run===generation&&seq===sequence&&reader===account.value?.oId&&context===getAuthContextVersion()
 try{const count=await privateUnread();if(valid())unreadTotal.value=count}catch{if(valid()){unreadTotal.value=null;error.value='私信未读数暂不可用'}}finally{if(valid()){loading.value=false;if(dirty){dirty=false;void refreshUnread()}}}}
 function invalidate(){if(!active())return;revision.value++;void refreshUnread()}
 function disconnect(){stopSubscription?.();stopSubscription=null}
 function clear(){generation++;sequence++;dirty=false;loading.value=false;unreadTotal.value=null;error.value='';revision.value=0;inboxOpen.value=false;inboxPeer.value='';inboxPeerId.value='';disconnect()}
 function showInbox(name='',id=''){if(!active())return;inboxPeer.value=name;inboxPeerId.value=id;inboxOpen.value=true}
 function bind(){const next=getAuthContextVersion(),actor=account.value?.oId;if(!active()||next!==boundary||actor!==owner)clear();else{generation++;sequence++;dirty=false;loading.value=false;disconnect()}boundary=next;owner=actor;if(active()){void refreshUnread();const run=generation;stopSubscription=subscribeMessageChanges(()=>{if(run===generation)invalidate()})}}
 const stopAuth=watch([accessToken,()=>account.value?.oId],bind,{flush:'sync',immediate:true})
 const stopWrites=watch(()=>writes.revision,()=>{if(writes.completed)invalidate()},{flush:'post'})
 const focus=()=>invalidate();if(!import.meta.env.SSR)window.addEventListener('focus',focus)
 onScopeDispose(()=>{stopAuth();stopWrites();clear();if(!import.meta.env.SSR)window.removeEventListener('focus',focus)})
 return{unreadTotal,loading,error,revision,inboxOpen,inboxPeer,inboxPeerId,refreshUnread,invalidate,showInbox,clear}
})
