import {onScopeDispose,ref,watch} from 'vue'
import {getLegacyKey} from '@/api/legacy/auth'
import {legacyMessageUnread} from '@/api/legacy/messages'
import {subscribeLegacyUserChanges} from '@/api/legacy/user-channel'
import {useAuthStore} from './auth'
export function legacyPrivateInboxState(){
 const auth=useAuthStore(),unreadTotal=ref<number|null>(null),byPeer=ref<Record<string,number>>({}),loading=ref(false),error=ref(''),revision=ref(0),inboxOpen=ref(false),inboxPeer=ref(''),inboxPeerId=ref('')
 let generation=0,dirty=false,stop:(()=>void)|null=null
 const active=()=>!import.meta.env.SSR&&!!getLegacyKey()&&!!auth.account?.oId&&auth.isLoggedIn
 function clear(){generation++;dirty=false;loading.value=false;unreadTotal.value=null;byPeer.value={};error.value='';revision.value++;inboxOpen.value=false;inboxPeer.value='';inboxPeerId.value='';stop?.();stop=null}
 async function refreshUnread(){if(!active())return;if(loading.value){dirty=true;return}const run=generation,key=getLegacyKey(),owner=auth.account!.oId;loading.value=true;const valid=()=>active()&&run===generation&&key===getLegacyKey()&&owner===auth.account?.oId
  try{const result=await legacyMessageUnread(owner);if(valid()){unreadTotal.value=result.total;byPeer.value=result.byPeer;error.value=''}}catch{if(valid()){unreadTotal.value=null;byPeer.value={};error.value='私信未读数暂不可用'}}finally{if(valid()){loading.value=false;if(dirty){dirty=false;void refreshUnread()}}}}
 function invalidate(){if(!active())return;revision.value++;void refreshUnread()}
 function showInbox(name='',id=''){if(!active())return;inboxPeer.value=name;inboxPeerId.value=id;inboxOpen.value=true}
 const stopAuth=watch(()=>JSON.stringify([auth.apiKey,auth.account?.oId,auth.isLoggedIn]),()=>{clear();if(active()){void refreshUnread();stop=subscribeLegacyUserChanges(invalidate)}},{flush:'sync',immediate:true})
 const focus=()=>invalidate();if(!import.meta.env.SSR)window.addEventListener('focus',focus)
 onScopeDispose(()=>{stopAuth();clear();if(!import.meta.env.SSR)window.removeEventListener('focus',focus)})
 return{unreadTotal,byPeer,loading,error,revision,inboxOpen,inboxPeer,inboxPeerId,refreshUnread,invalidate,showInbox,clear}
}
