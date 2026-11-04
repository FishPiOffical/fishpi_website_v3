<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {RouterLink} from 'vue-router'
import {useChatStore} from '@/stores/chat'
import {DEFAULT_AVATAR} from '@/utils/avatar'
const chat=useChatStore(),page=ref(1),query=ref(''),pages=computed(()=>Math.max(1,Math.ceil(chat.onlines.length/20)))
const users=computed(()=>chat.onlines.slice((page.value-1)*20,page.value*20).filter(u=>u.userName.toLowerCase().includes(query.value.trim().toLowerCase())))
watch(pages,n=>{page.value=Math.min(page.value,n)})
</script>
<template><div><p>本次可见人数：{{ chat.onlineTotal===null?'暂不可用':chat.onlineTotal }} <button @click="chat.refreshOnline">刷新在线名单</button></p><p class="scope">节点汇总快照；筛选仅针对本页。</p><p v-if="chat.onlineError" role="alert">{{ chat.onlineError }} <button @click="chat.refreshOnline">重试</button></p><input v-if="chat.onlines.length" v-model="query" aria-label="筛选本页在线用户" placeholder="本页用户名" /><ul><li v-for="user in users" :key="user.userName"><RouterLink :to="`/member/${encodeURIComponent(user.userName)}`" :data-user-card="user.userName"><img :src="user.userAvatarURL||DEFAULT_AVATAR" alt="" />{{ user.userName }}</RouterLink></li></ul><p v-if="!users.length&&!chat.onlineError">本页暂无匹配用户。</p><nav v-if="pages>1"><button :disabled="page<=1" @click="page--;query=''">上一页</button><span>{{ page }}/{{ pages }}</span><button :disabled="page>=pages" @click="page++;query=''">下一页</button></nav></div></template>
<style scoped>p{font-size:13px;margin:6px 0}.scope{font-size:12px;color:var(--fp-muted)}input{box-sizing:border-box;width:100%}input,button{font:inherit;color:inherit;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:5px;padding:4px 7px}ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}a{display:flex;gap:5px;align-items:center;min-width:0;overflow:hidden}img{width:22px;height:22px;border-radius:4px}nav{display:flex;justify-content:space-between;font-size:12px}[role=alert]{color:#bd503c}</style>
