<script setup lang="ts">
import { DEFAULT_AVATAR } from '@/utils/avatar'

import {computed,ref} from 'vue'
import {storeToRefs} from 'pinia'
import {RouterLink} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatOnlineStore} from '@/stores/v3ChatOnline'
const props=defineProps<{previewLimit?:number; avatarsOnly?:boolean}>(),expanded=ref(false)
const online=useV3ChatOnlineStore(),{accessToken,account}=storeToRefs(useAuthStore())
const visibleUsers=computed(()=>props.previewLimit&&!expanded.value?online.users.slice(0,props.previewLimit):online.users)
function avatarError(event:Event){const image=event.target as HTMLImageElement;if(image.getAttribute('src')!==DEFAULT_AVATAR)image.src=DEFAULT_AVATAR}
</script>
<template>
 <div class="online-list" :class="{ 'avatars-only': avatarsOnly }">
  <p v-if="!accessToken || !account?.oId" class="empty">登录后可查看在线成员</p>
  <template v-else>
   <div v-if="!avatarsOnly" class="online-summary">
    <div><span class="count">{{ online.total === null ? '—' : online.total }}</span><span class="count-label">本次可见成员</span></div>
    <button class="refresh" type="button" :disabled="online.loading" aria-label="刷新在线名单" title="刷新在线名单" @click="online.refresh"><svg :class="{ spinning: online.loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></svg></button>
   </div>
   <p v-if="online.loading" class="empty" role="status">正在读取在线名单…</p>
   <div v-if="online.error" class="error" role="alert"><span>{{ online.error }}</span><button type="button" :disabled="online.loading" @click="online.retry">重试第 {{ online.attempt }} 页</button></div>
   <ul v-if="online.users.length"><li v-for="user in visibleUsers" :key="user.id"><RouterLink :to="`/member/${encodeURIComponent(user.userName)}`" :data-user-card="user.userName" :title="user.userName" :aria-label="user.userName"><img :src="user.userAvatarURL || DEFAULT_AVATAR" alt="" loading="lazy" @error="avatarError"/><span v-if="!avatarsOnly">{{ user.userName }}</span></RouterLink></li></ul>
   <p v-if="!online.loading && !online.error && !online.users.length" class="empty">本页暂无可见成员</p>
   <button v-if="previewLimit && online.users.length>previewLimit" class="expand-members" type="button" :aria-expanded="expanded" @click="expanded=!expanded">{{ expanded ? '收起名单' : '展开本页成员' }}</button>
   <nav v-if="(!previewLimit || expanded) && (online.pageCount > (avatarsOnly ? 1 : 0) || online.page > 1)" aria-label="在线成员分页"><button type="button" :disabled="online.loading || !!online.error || online.page <= 1" @click="online.load(online.page-1)">上一页</button><span>{{ online.page }} / {{ online.pageCount }}</span><button type="button" :disabled="online.loading || !!online.error || !online.hasMore" @click="online.load(online.page+1)">下一页</button></nav>
  </template>
 </div>
</template>
<style scoped>
.online-list { min-width:0; overflow-wrap:anywhere; }
.online-summary,.online-summary>div { display:flex; align-items:center; gap:8px; }
.online-summary { justify-content:space-between; }
.count { font-size:26px; font-weight:700; line-height:1.3; color:var(--fp-title); font-variant-numeric:tabular-nums; }
.count-label { color:var(--fp-muted); font-size:11px; }
button { font:inherit; border:1px solid var(--fp-border); border-radius:6px; background:var(--fp-card); color:var(--fp-text); padding:5px 9px; cursor:pointer; transition:background 150ms; }
button:hover:not(:disabled) { background:var(--fp-hover); }
button:disabled { opacity:.4; cursor:default; }
.refresh { display:grid; place-items:center; width:28px; height:28px; padding:5px; border:0; background:var(--fp-hover); color:var(--fp-muted); }
svg { flex:none; width:16px; height:16px; }
button:focus-visible,a:focus-visible { outline:2px solid var(--fp-primary); outline-offset:2px; }
ul { list-style:none; margin:10px 0; padding:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4px; max-height:300px; overflow:auto; }
li { min-width:0; }
a { display:flex; align-items:center; gap:7px; min-width:0; padding:6px 4px; border-radius:6px; color:var(--fp-text); text-decoration:none; }
a:hover { background:var(--fp-hover); }
a:hover span { text-decoration:underline; text-underline-offset:3px; }
a span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
img { width:26px; height:26px; flex:none; border-radius:50%; object-fit:cover; }
.avatars-only ul { display:flex; flex-wrap:wrap; gap:5px; margin:8px 0 0; padding:2px; }
.avatars-only a { padding:0; border-radius:50%; }
.avatars-only img { display:block; width:20px; height:20px; }
.avatars-only nav { justify-content:flex-start; padding-top:5px; border-top:0; }
.avatars-only nav button { padding:2px 5px; }
nav { display:flex; align-items:center; justify-content:space-between; gap:5px; padding-top:10px; border-top:1px solid var(--fp-border); font-size:11px; }
nav span { color:var(--fp-muted); font-variant-numeric:tabular-nums; }
.empty { margin:12px 0; padding:12px 0; text-align:center; color:var(--fp-muted); }
.error { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:9px; margin:10px 0; border-radius:6px; background:var(--fp-hover); color:#bf503c; }
.spinning { animation:spin 1.1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) { button { transition:none; }.spinning { animation:none; } }
</style>
