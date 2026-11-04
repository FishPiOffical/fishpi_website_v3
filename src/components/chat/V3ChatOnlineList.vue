<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {storeToRefs} from 'pinia'
import {RouterLink} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatOnlineStore} from '@/stores/v3ChatOnline'
const online=useV3ChatOnlineStore(),{accessToken,account}=storeToRefs(useAuthStore()),query=ref('')
watch(()=>account.value?.oId,()=>{query.value=''})
const filtered=computed(()=>{const key=query.value.trim().toLowerCase();return online.users.filter(u=>u.userName.toLowerCase().includes(key))})
</script>
<template><div class="online-list">
 <p v-if="!accessToken||!account?.oId">登录后可读取在线名单。</p>
 <template v-else>
  <p>本次可见人数：{{ online.total===null?'尚未取得':online.total }} <button type="button" :disabled="online.loading" @click="online.refresh">刷新在线名单</button></p>
  <p class="scope">非全站实时人数；在线变化时，分页结果可能改变。</p>
  <p v-if="online.nodesComplete===false" class="scope">节点采样不完整，名单可能有缺漏。</p><p v-if="online.nodesSampledAt===0" class="scope">节点尚未采样。</p><p v-else-if="online.nodesSampledAt" class="scope">节点采样时间：{{ new Date(online.nodesSampledAt).toLocaleString() }}</p>
  <p v-if="online.loading" role="status">正在读取在线名单…</p><p v-if="online.error" role="alert">{{ online.error }} <button type="button" :disabled="online.loading" @click="online.retry">重试第{{ online.attempt }}页</button></p>
  <label v-if="online.users.length">筛选本页 <input v-model="query" maxlength="64" type="search" placeholder="本页用户名" /></label>
  <ul><li v-for="user in filtered" :key="user.id"><RouterLink :to="`/member/${encodeURIComponent(user.userName)}`">{{ user.userName }}</RouterLink></li></ul>
  <p v-if="!online.loading&&!online.error&&!online.users.length">本页暂无可见用户。</p><p v-else-if="online.users.length&&!filtered.length">本页没有匹配的用户。</p>
  <nav v-if="online.pageCount||online.page>1"><button type="button" :disabled="online.loading||online.page<=1" @click="query='';online.load(online.page-1)">上一页在线用户</button><span>第{{ online.page }}页 / 共{{ online.pageCount }}页</span><button type="button" :disabled="online.loading||!online.hasMore" @click="query='';online.load(online.page+1)">下一页在线用户</button></nav>
 </template>
</div></template>
<style scoped lang="scss">.online-list{min-width:0;overflow-wrap:anywhere}p{margin:6px 0}.scope{font-size:12px;color:var(--fp-muted)}button,input{font:inherit;border:1px solid var(--fp-border);border-radius:5px;background:var(--fp-card);color:var(--fp-text);padding:4px 7px;margin:3px}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}input{width:100%;box-sizing:border-box}ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}a{color:inherit;text-decoration:none}nav{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px}[role=alert]{color:#bf503c}</style>
