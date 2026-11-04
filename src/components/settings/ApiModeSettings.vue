<script setup lang="ts">
import { getApiMode, switchApiMode } from '@/api/mode'
const mode=getApiMode()
</script>
<template>
  <section class="api-settings">
    <h3>接口版本</h3><p>v1 连接现网旧接口；v3 保留开发与联调使用。切换会刷新页面，当前草稿、连接及未确认操作会离开内存，请先完成或核实当前操作。</p>
    <div class="modes"><button :aria-pressed="mode==='v1'" :disabled="mode==='v1'" @click="switchApiMode('v1')">v1 · 现网接口</button><button :aria-pressed="mode==='v3'" :disabled="mode==='v3'" @click="switchApiMode('v3')">v3 · 开发接口</button></div>
    <p>两种模式独立认证。v1 登录凭据仅保存在内存，刷新页面后需要重新登录。</p>
    <p v-if="mode==='v1'" role="status">全站双模式正在分批接入：当前已支持首页基础列表、登录、需求反馈、普通文章/评论读取、搜索目录、清风、通知、私信聊天、共享编辑器及聊天室基础聊天；聊天室扩展操作、部分内容写入和账号模块仍在接入，不会自动调用 v3。</p>
  </section>
</template>
<style scoped>
.api-settings{display:grid;gap:16px}.api-settings h3{margin:0}.api-settings p{font-size:13px;line-height:1.8;color:var(--fp-muted)}.modes{display:flex;flex-wrap:wrap;gap:10px}.modes button{padding:12px;border:1px solid var(--fp-border);border-radius:8px;background:var(--fp-card);color:var(--fp-text);cursor:pointer}.modes button[aria-pressed=true]{border-color:var(--fp-accent);color:var(--fp-accent)}
</style>
