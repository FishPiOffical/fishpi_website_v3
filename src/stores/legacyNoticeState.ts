import {computed,onScopeDispose,ref} from 'vue'
import {getLegacyKey,onLegacyKeyChange} from '@/api/legacy/auth'
import {legacyUnreadCount} from '@/api/legacy/notifications'
import {subscribeLegacyUserChanges} from '@/api/legacy/user-channel'
import type {UnreadCount} from '@/api/fishpi'
export function legacyNoticeState(){
  const unread=ref<UnreadCount>({}),loading=ref(false),error=ref(''),revision=ref(0),warnBroadcast=ref<{text:string;who:string}|null>(null)
  const total=computed(()=>unread.value.unreadNotificationCnt ?? 0)
  let generation=0,dirty=false,stop:(()=>void)|null=null
  function disconnect(){stop?.();stop=null}
  function clear(){generation++;dirty=false;unread.value={};loading.value=false;error.value='';warnBroadcast.value=null;revision.value++;disconnect()}
  async function refresh(){const key=getLegacyKey();if(!key||import.meta.env.SSR)return;if(loading.value){dirty=true;return}const version=generation;loading.value=true
    const valid=()=>version===generation&&key===getLegacyKey()
    try{const result=await legacyUnreadCount();if(valid()){unread.value=result;error.value=''}}catch(e){if(valid()){unread.value={};error.value=e instanceof Error?e.message:'未读数读取失败'}}finally{if(valid()){loading.value=false;if(dirty){dirty=false;void refresh()}}}}
  function invalidate(){revision.value++;void refresh()}
  function connect(){disconnect();if(getLegacyKey()&&!import.meta.env.SSR)stop=subscribeLegacyUserChanges(invalidate)}
  const off=onLegacyKeyChange(key=>{clear();if(key){void refresh();connect()}})
  const focus=()=>{if(getLegacyKey())invalidate()}
  if(!import.meta.env.SSR)window.addEventListener('focus',focus)
  onScopeDispose(()=>{off();clear();if(!import.meta.env.SSR)window.removeEventListener('focus',focus)})
  return {unread,loading,error,revision,total,warnBroadcast,refresh,invalidate,clear,connect,disconnect}
}
