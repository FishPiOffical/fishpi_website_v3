<script setup lang="ts">
import {onMounted,onUnmounted} from 'vue'
import {RouterLink} from 'vue-router'
import {useLegacyChatMutesStore} from '@/stores/legacyChatMutes'
import {DEFAULT_AVATAR} from '@/utils/avatar'
const mutes=useLegacyChatMutesStore()
onMounted(()=>{void mutes.connect()})
onUnmounted(()=>mutes.disconnect())
function avatarError(event:Event){const img=event.target as HTMLImageElement;if(img.getAttribute('src')!==DEFAULT_AVATAR)img.src=DEFAULT_AVATAR}
</script>
<template><div class="mute-list">

  <p>快照未到期记录数：{{ mutes.total===null?'尚未取得':mutes.total }} <button type="button" :disabled="mutes.loading" @click="mutes.refresh">刷新</button></p>
  <p class="scope">旧接口名单快照，按读取时的到期时间筛选，可能滞后于实际禁言状态。</p>
  <p v-if="mutes.loading" role="status">正在读取思过崖…</p>
  <p v-if="mutes.error" role="alert">{{ mutes.error }} <button type="button" :disabled="mutes.loading" @click="mutes.retry">重试第{{ mutes.attempt }}页</button></p>
  <ul><li v-for="item in mutes.users" :key="item.userName">
   <RouterLink :to="`/member/${encodeURIComponent(item.userName)}`" :data-user-card="item.userName"><img :src="item.userAvatarURL||DEFAULT_AVATAR" alt="" loading="lazy" @error="avatarError"/><span>{{ item.userNickname||item.userName }}</span></RouterLink>
   <time :datetime="new Date(item.expiresAt).toISOString()">解除：{{ new Date(item.expiresAt).toLocaleString() }}</time>
  </li></ul>
  <p v-if="!mutes.loading&&!mutes.error&&mutes.total===0">本次快照没有未到期记录。</p>
  <p v-else-if="!mutes.loading&&!mutes.error&&!mutes.users.length">本页没有记录，请返回上一页或刷新。</p>
  <p v-if="mutes.readAt" class="scope">读取于 {{ new Date(mutes.readAt).toLocaleString() }}，翻页会重读完整快照。</p>
  <nav v-if="mutes.pageCount||mutes.page>1"><button type="button" :disabled="mutes.loading||!!mutes.error||mutes.page<=1" @click="mutes.load(mutes.page-1)">上一页</button><span>第{{ mutes.page }}页 / 共{{ mutes.pageCount }}页</span><button type="button" :disabled="mutes.loading||!!mutes.error||!mutes.hasMore" @click="mutes.load(mutes.page+1)">下一页</button></nav>

</div></template>
<style scoped lang="scss">
.mute-list{min-width:0;overflow-wrap:anywhere}p{margin:6px 0}.scope,time{font-size:11px;color:var(--fp-muted)}button{font:inherit;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text);padding:4px 7px;cursor:pointer}button:disabled{opacity:.45;cursor:default}ul{margin:0;padding:0;list-style:none;max-height:260px;overflow:auto}li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:7px 0}li+li{border-top:1px solid var(--fp-border)}a{display:flex;align-items:center;gap:6px;min-width:0;color:inherit;text-decoration:none}img{width:24px;height:24px;border-radius:50%;flex:none}nav{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px}[role=alert]{color:#bf503c}
</style>
