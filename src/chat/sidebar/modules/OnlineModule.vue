<script setup lang="ts">
import { computed, ref } from 'vue'
import VipNickname from '@/components/user/VipNickname.vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { avatarUrl } from '@/utils/avatar'

const { onlines } = storeToRefs(useChatStore())
const expanded = ref(false)
const query = ref('')
const filtered = computed(() => {
  const key = query.value.trim().toLowerCase()
  return onlines.value.filter((u) => `${u.userName} ${u.userNickname || ''}`.toLowerCase().includes(key))
})
const visible = computed(() => expanded.value ? filtered.value : onlines.value.slice(0, 8))
</script>

<template>
  <div class="online-module">
    <div class="summary"><span>此刻在这里</span><span><b>{{ onlines.length }}</b> 人</span></div>
    <input v-if="expanded" v-model="query" type="search" aria-label="搜索在线成员" placeholder="搜索昵称或用户名" />
    <ul v-if="visible.length">
      <li v-for="user in visible" :key="user.userName">
        <RouterLink :to="`/member/${user.userName}`" :title="`${user.userNickname || user.userName} (${user.userName})`">
          <span class="fp-avatar-frame"><img class="fp-avatar" :src="avatarUrl(user)" alt="" loading="lazy" /></span>
          <span class="name"><VipNickname :user-name="user.userName">{{ user.userNickname || user.userName }}</VipNickname></span>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="empty">{{ query ? '没有匹配的在线成员' : '暂无在线成员' }}</p>
    <button v-if="onlines.length > 8 || expanded" type="button" :aria-expanded="expanded" @click="expanded = !expanded; query = ''">
      {{ expanded ? '收起成员' : `查看全部 ${onlines.length} 位成员` }} <span aria-hidden="true">{{ expanded ? '↑' : '↓' }}</span>
    </button>
  </div>
</template>

<style scoped>
.summary { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 9px; color: var(--fp-muted); font-size: 11px; }
.summary b { color: var(--fp-title); font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
input { width: 100%; margin-bottom: 10px; padding: 6px 8px; border: 1px solid var(--fp-border); border-radius: 5px; background: var(--fp-bg); color: var(--fp-text); font-size: 12px; }
ul { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 8px; max-height: 236px; overflow: auto; list-style: none; margin: 0; padding: 2px; scrollbar-width: thin; }
li { min-width: 0; }
li a { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 5px 2px; border-radius: 5px; color: var(--fp-text); text-decoration: none; }
li a:hover { background: var(--fp-hover); }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.fp-avatar-frame { position: relative; display: inline-flex; flex: none; width: 26px; height: 26px; border-radius: 50%; }
.fp-avatar { display: block; width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
button { width: 100%; margin-top: 10px; padding: 7px 0 0; border: 0; border-top: 1px solid var(--fp-border); background: transparent; color: var(--fp-muted); font-size: 11px; cursor: pointer; }
button:hover { color: var(--fp-primary); }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.empty { margin: 0; color: var(--fp-muted); font-size: 12px; }
</style>
