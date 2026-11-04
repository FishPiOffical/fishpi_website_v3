<script setup lang="ts">
import {onMounted,onUnmounted} from 'vue'
import {RouterLink} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatMutesStore} from '@/stores/v3ChatMutes'
import {DEFAULT_AVATAR} from '@/utils/avatar'
const auth=useAuthStore(),mutes=useV3ChatMutesStore()
onMounted(()=>{void mutes.connect()})
onUnmounted(()=>mutes.disconnect())
function avatarError(event:Event){const img=event.target as HTMLImageElement;if(img.getAttribute('src')!==DEFAULT_AVATAR)img.src=DEFAULT_AVATAR}
</script>
<template><div class="mute-list">
 <p v-if="!auth.accessToken||!auth.account?.oId">登录后可读取思过崖。</p>
 <template v-else>
  <p>读取时禁言人数：{{ mutes.total===null?'尚未取得':mutes.total }} <button type="button" :disabled="mutes.loading" @click="mutes.refresh">刷新</button></p>
  <p class="scope">仅展示读取时仍有效的个人禁言，状态可能变化。</p>
  <p v-if="mutes.loading" role="status">正在读取思过崖…</p>
  <p v-if="mutes.error" role="alert">{{ mutes.error }} <button type="button" :disabled="mutes.loading" @click="mutes.retry">重试第{{ mutes.attempt }}页</button></p>
  <ul><li v-for="item in mutes.users" :key="item.id">
   <RouterLink :to="`/member/${encodeURIComponent(item.userName)}`" :data-user-card="item.userName"><img :src="item.userAvatarURL||DEFAULT_AVATAR" alt="" loading="lazy" @error="avatarError"/><span>{{ item.userNickname||item.userName }}</span></RouterLink>
   <time :datetime="new Date(item.expiresAt).toISOString()">解除：{{ new Date(item.expiresAt).toLocaleString() }}</time>
  </li></ul>
  <p v-if="!mutes.loading&&!mutes.error&&mutes.total===0">当前没有被禁言的成员。</p>
  <p v-else-if="!mutes.loading&&!mutes.error&&!mutes.users.length">本页没有记录，请返回上一页或刷新。</p>
  <nav v-if="mutes.pageCount||mutes.page>1"><button type="button" :disabled="mutes.loading||!!mutes.error||mutes.page<=1" @click="mutes.load(mutes.page-1)">上一页</button><span>第{{ mutes.page }}页 / 共{{ mutes.pageCount }}页</span><button type="button" :disabled="mutes.loading||!!mutes.error||!mutes.hasMore" @click="mutes.load(mutes.page+1)">下一页</button></nav>
 </template>
</div></template>
<style scoped lang="scss">
.mute-list{min-width:0;overflow-wrap:anywhere}p{margin:6px 0}.scope,time{font-size:11px;color:var(--fp-muted)}button{font:inherit;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text);padding:4px 7px;cursor:pointer}button:disabled{opacity:.45;cursor:default}ul{margin:0;padding:0;list-style:none;max-height:260px;overflow:auto}li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:7px 0}li+li{border-top:1px solid var(--fp-border)}a{display:flex;align-items:center;gap:6px;min-width:0;color:inherit;text-decoration:none}img{width:24px;height:24px;border-radius:50%;flex:none}nav{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px}[role=alert]{color:#bf503c}
</style>
